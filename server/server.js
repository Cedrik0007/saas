import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

dotenv.config();

// Configure Cloudinary (with error handling for missing credentials)
let upload;
try {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Use memory storage and upload to Cloudinary manually (compatible with Cloudinary v2)
    upload = multer({ storage: multer.memoryStorage() });
    console.log("✓ Cloudinary configured successfully");
  } else {
    console.warn("⚠️ Cloudinary credentials not found. Image upload will use memory storage.");
    // Fallback to memory storage if Cloudinary is not configured
    upload = multer({ storage: multer.memoryStorage() });
  }
} catch (error) {
  console.error("Error configuring Cloudinary:", error.message);
  console.warn("⚠️ Falling back to memory storage for file uploads.");
  upload = multer({ storage: multer.memoryStorage() });
}

const app = express();
const PORT = process.env.PORT || 4000;

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://0741sanjai_db_user:L11x9pdm3tHuOJE9@members.mmnf0pe.mongodb.net/subscriptionmanager";

// Connection options for serverless environments (Vercel)
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  connectTimeoutMS: 10000, // Connection timeout
  maxPoolSize: 1, // Limit connection pool for serverless
};

// Disable mongoose buffering globally (do this before connect)
mongoose.set('bufferCommands', false);
// bufferMaxEntries is not a supported option - removed to prevent crashes

// Cache the connection to avoid multiple connections in serverless
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      ...mongooseOptions,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("MongoDB connected");
      return mongoose;
    }).catch((err) => {
      console.error("MongoDB connection error:", err);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Connect to MongoDB
connectDB().catch((err) => console.log("MongoDB connection error:", err));

// Helper function to ensure DB connection before operations
const ensureConnection = async () => {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database not connected");
  }
};

const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    phone: String,
    password: String,  // Add password field for member login
    status: String,
    balance: String,
    nextDue: String,
    lastPayment: String,
}, {
    timestamps: true  // Automatically adds createdAt and updatedAt fields
})

const UserModel = mongoose.model("members", UserSchema);

const AdminSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  password: String,
  role: { type: String, default: 'Viewer' },
  status: { type: String, default: 'Active' },
})

const AdminModel = mongoose.model("admins", AdminSchema);

// Invoice Schema
const InvoiceSchema = new mongoose.Schema({
  id: String,
  memberId: String,
  memberName: String,
  memberEmail: String,
  period: String,
  amount: String,
  status: { type: String, default: "Unpaid" },
  due: String,
  method: String,
  reference: String,
  screenshot: String,
  paidToAdmin: String,
  paidToAdminName: String,
}, {
  timestamps: true
});

const InvoiceModel = mongoose.model("invoices", InvoiceSchema);

// Payment Schema
const PaymentSchema = new mongoose.Schema({
  invoiceId: String,
  memberId: String,
  memberEmail: String,
  member: String,
  amount: String,
  method: String,
  reference: String,
  period: String,
  status: { type: String, default: "Paid" },
  date: String,
  screenshot: String,
  paidToAdmin: String,
  paidToAdminName: String,
}, {
  timestamps: true
});

const PaymentModel = mongoose.model("payments", PaymentSchema);

// Middleware - must be before routes
// CORS configuration: Allow localhost for development, production origin for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? "https://subs-manager.vercel.app"
    : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// GET all members (from MongoDB)
app.get("/api/members", async (req, res) => {
  try {
    // Ensure connection is ready
    await connectDB();
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database not connected" });
    }
    
    const members = await UserModel.find({}).sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message});
  }
});

//get total members
app.get("/api/members/count", async (req, res) => {
  try {
    await ensureConnection();
    const count = await UserModel.countDocuments();
    res.json({ total : count})
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message});
  }
});


app.get("/api/admins", async (req, res) => {
  try {
    await ensureConnection();
    const admins = await AdminModel.find();
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new admin
app.post("/api/admins", async (req, res) => {
  try {
    await ensureConnection();
    // Generate ID if not provided
    let adminId = req.body.id;
    if (!adminId) {
      adminId = `ADM${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    // Check if ID already exists
    const existing = await AdminModel.findOne({ id: adminId });
    if (existing) {
      return res.status(400).json({ message: "Admin ID already exists" });
    }
    
    const newAdmin = new AdminModel({
      id: adminId,
      name: req.body.name || '',
      email: req.body.email || '',
      password: req.body.password || '',
      role: req.body.role || 'Viewer',
      status: req.body.status || 'Active',
    });
    
    const savedAdmin = await newAdmin.save();
    res.status(201).json(savedAdmin);
  } catch (error) {
    console.error("Error creating admin:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email or ID already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update admin
app.put("/api/admins/:id", async (req, res) => {
  try {
    await ensureConnection();
    const admin = await AdminModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    res.json(admin);
  } catch (error) {
    console.error("Error updating admin:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE admin
app.delete("/api/admins/:id", async (req, res) => {
  try {
    await ensureConnection();
    const admin = await AdminModel.findOneAndDelete({ id: req.params.id });
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ error: error.message });
  }
});


app.get("/", (req, res) => {
  res.send("server & db running");
});

// Members are now stored in MongoDB - no need for in-memory array
// All member data is fetched from MongoDB database 'subscriptionmanager' collection 'members'

const metrics = {
  totalMembers: 312,
  collectedMonth: 12450,
  collectedYear: 220800,
  outstanding: 18400,
  overdueMembers: 27,
};

// Invoices are now stored in MongoDB - no need for in-memory array
// All invoice data is fetched from MongoDB database 'subscriptionmanager' collection 'invoices'

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.post("/api/login", async (req, res) => {
  const { email, password, role } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    await ensureConnection();
    const emailLower = email.trim().toLowerCase();
    
    // Check based on the role specified
    if (role === "admin" || role === "Admin") {
      // Check admin database only
      const admin = await AdminModel.findOne({ 
        email: emailLower 
      });

      if (!admin) {
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Check password
      if (admin.password !== password) {
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Check if admin is active
      if (admin.status && admin.status !== 'Active') {
        return res.status(403).json({ 
          message: "Your account is not active. Please contact administrator.",
          success: false 
        });
      }

      // Successful admin login
      return res.json({
        success: true,
        role: "Admin",
        token: `admin_${admin.id}_${Date.now()}`,
        email: admin.email,
        name: admin.name,
        adminId: admin.id,
        adminRole: admin.role || 'Viewer'
      });
    } else if (role === "member" || role === "Member") {
      // Check member database only
      const escapedEmail = emailLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const member = await UserModel.findOne({ 
        email: { $regex: `^${escapedEmail}$`, $options: 'i' }
      });

      if (!member) {
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Check password - require password for member login
      if (!member.password || member.password.trim() === '') {
        return res.status(401).json({ 
          message: "Password not set for this account. Please contact administrator or sign up.",
          success: false 
        });
      }

      // Check password (trim both for comparison)
      const memberPassword = member.password.trim();
      const inputPassword = password.trim();
      
      if (memberPassword !== inputPassword) {
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Check if member is active
      if (member.status && member.status !== 'Active') {
        return res.status(403).json({ 
          message: "Your account is not active. Please contact administrator.",
          success: false 
        });
      }

      // Successful member login
      return res.json({
        success: true,
        role: "Member",
        token: `member_${member.id}_${Date.now()}`,
        email: member.email,
        name: member.name,
        memberId: member.id,
        phone: member.phone,
        status: member.status
      });
    } else {
      // No role specified or invalid role
      return res.status(400).json({ 
        message: "Invalid role specified. Please select Admin or Member.",
        success: false 
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      message: "Server error during login",
      success: false 
    });
  }
});

app.get("/api/metrics", (_req, res) => {
  res.json(metrics);
});

// GET single member
app.get("/api/members/:id", async (req, res) => {
  try {
    await ensureConnection();
    const member = await UserModel.findOne({ id: req.params.id });
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    res.json(member);
  } catch (error) {
    console.error("Error fetching member:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new member
app.post("/api/members", async (req, res) => {
  try {
    await ensureConnection();
    // Generate ID if not provided
    let memberId = req.body.id;
    if (!memberId) {
      memberId = `HK${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    // Check if ID already exists
    const existing = await UserModel.findOne({ id: memberId });
    if (existing) {
      return res.status(400).json({ message: "Member ID already exists" });
    }
    
    const newMember = new UserModel({
      id: memberId,
      name: req.body.name || '',
      email: (req.body.email || '').trim().toLowerCase(),  // Ensure lowercase storage
      phone: req.body.phone || '',
      password: req.body.password || '',
      status: req.body.status || 'Active',
      balance: req.body.balance || '$0',
      nextDue: req.body.nextDue || '',
      lastPayment: req.body.lastPayment || '',
    });
    
    const savedMember = await newMember.save();
    res.status(201).json(savedMember);
  } catch (error) {
    console.error("Error creating member:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email or ID already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update member
app.put("/api/members/:id", async (req, res) => {
  try {
    await ensureConnection();
    // Ensure email is lowercase if being updated
    const updateData = { ...req.body };
    if (updateData.email) {
      updateData.email = updateData.email.trim().toLowerCase();
    }
    const member = await UserModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    
    res.json(member);
  } catch (error) {
    console.error("Error updating member:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE member
app.delete("/api/members/:id", async (req, res) => {
  try {
    await ensureConnection();
    const member = await UserModel.findOneAndDelete({ id: req.params.id });
    
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting member:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== INVOICES CRUD ENDPOINTS ==========

// Helper function to calculate and update member balance from unpaid invoices
async function calculateAndUpdateMemberBalance(memberId) {
  try {
    await ensureConnection();
    
    // Get all unpaid invoices for this member from MongoDB
    const unpaidInvoices = await InvoiceModel.find({
      memberId: memberId,
      status: { $in: ["Unpaid", "Overdue"] }
    });
    
    // Calculate total outstanding
    const outstandingTotal = unpaidInvoices.reduce((sum, inv) => {
      const amount = parseFloat(inv.amount.replace("$", "").replace(",", "")) || 0;
      return sum + amount;
    }, 0);
    
    // Format balance string
    let balanceString = `$${outstandingTotal.toFixed(2)}`;
    if (outstandingTotal === 0) {
      balanceString = "$0";
    } else {
      // Check if any are overdue
      const hasOverdue = unpaidInvoices.some(inv => inv.status === "Overdue");
      balanceString += hasOverdue ? " Overdue" : " Outstanding";
    }
    
    // Update member balance in MongoDB
    await UserModel.findOneAndUpdate(
      { id: memberId },
      { $set: { balance: balanceString } },
      { new: true }
    );
    
    console.log(`✓ Updated balance for member ${memberId}: ${balanceString}`);
    return balanceString;
  } catch (error) {
    console.error(`Error updating balance for member ${memberId}:`, error);
    throw error;
  }
}

// GET all invoices
app.get("/api/invoices", async (req, res) => {
  try {
    await ensureConnection();
    const allInvoices = await InvoiceModel.find({}).sort({ createdAt: -1 });
    res.json(allInvoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET invoices for specific member
app.get("/api/invoices/member/:memberId", async (req, res) => {
  try {
    await ensureConnection();
    const memberInvoices = await InvoiceModel.find({ 
      memberId: req.params.memberId 
    }).sort({ createdAt: -1 });
    res.json(memberInvoices);
  } catch (error) {
    console.error("Error fetching member invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new invoice
app.post("/api/invoices", async (req, res) => {
  try {
    await ensureConnection();
    
    const invoiceData = {
      id: `INV-2025-${Math.floor(100 + Math.random() * 900)}`,
      ...req.body,
      status: req.body.status || "Unpaid",
    };
    
    const newInvoice = new InvoiceModel(invoiceData);
    await newInvoice.save();
    
    // Update member balance if invoice is unpaid
    if (invoiceData.memberId && (invoiceData.status === "Unpaid" || invoiceData.status === "Overdue")) {
      await calculateAndUpdateMemberBalance(invoiceData.memberId);
    }
    
    res.status(201).json(newInvoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update invoice
app.put("/api/invoices/:id", async (req, res) => {
  try {
    await ensureConnection();
    
    const oldInvoice = await InvoiceModel.findOne({ id: req.params.id });
    if (!oldInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    const updatedInvoice = await InvoiceModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    // Update member balance if status, amount, or memberId changed
    const statusChanged = oldInvoice.status !== updatedInvoice.status;
    const amountChanged = oldInvoice.amount !== updatedInvoice.amount;
    const memberChanged = oldInvoice.memberId !== updatedInvoice.memberId;
    
    if (statusChanged || amountChanged || memberChanged) {
      // Update balance for old member (if member changed or invoice was unpaid)
      if (oldInvoice.memberId) {
        if (memberChanged || oldInvoice.status === "Unpaid" || oldInvoice.status === "Overdue") {
          await calculateAndUpdateMemberBalance(oldInvoice.memberId);
        }
      }
      
      // Update balance for new member (if member changed or invoice is unpaid)
      if (updatedInvoice.memberId) {
        if (memberChanged || updatedInvoice.status === "Unpaid" || updatedInvoice.status === "Overdue") {
          await calculateAndUpdateMemberBalance(updatedInvoice.memberId);
        }
      }
    }
    
    res.json(updatedInvoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE invoice
app.delete("/api/invoices/:id", async (req, res) => {
  try {
    await ensureConnection();
    
    const deletedInvoice = await InvoiceModel.findOneAndDelete({ id: req.params.id });
    if (!deletedInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    // Update member balance after deletion if invoice was unpaid
    if (deletedInvoice.memberId && 
        (deletedInvoice.status === "Unpaid" || deletedInvoice.status === "Overdue")) {
      await calculateAndUpdateMemberBalance(deletedInvoice.memberId);
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PAYMENTS CRUD ENDPOINTS ==========

// GET all payments
app.get("/api/payments", async (req, res) => {
  try {
    await ensureConnection();
    const allPayments = await PaymentModel.find({}).sort({ createdAt: -1 });
    res.json(allPayments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET payments for specific member
app.get("/api/payments/member/:memberId", async (req, res) => {
  try {
    await ensureConnection();
    const memberPayments = await PaymentModel.find({
      $or: [
        { memberId: req.params.memberId },
        { memberEmail: req.params.memberId }
      ]
    }).sort({ createdAt: -1 });
    res.json(memberPayments);
  } catch (error) {
    console.error("Error fetching member payments:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new payment
app.post("/api/payments", async (req, res) => {
  try {
    await ensureConnection();
    
    const paymentData = {
      ...req.body,
      date: req.body.date || new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      status: req.body.status || "Paid",
    };
    
    const newPayment = new PaymentModel(paymentData);
    await newPayment.save();
    
    res.status(201).json(newPayment);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== CLOUDINARY IMAGE UPLOAD ENDPOINT ==========

// POST upload payment screenshot to Cloudinary
app.post("/api/upload-screenshot", upload.single("screenshot"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      // Upload to Cloudinary using v2 API - convert buffer to data URI (more reliable)
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;
      
      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: "payment-screenshots",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [{ width: 1000, crop: "limit" }],
      });

      res.json({
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });
    } else {
      // Memory storage fallback - convert to base64
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
      
      res.json({
        success: true,
        url: dataUrl,
        publicId: `temp_${Date.now()}`,
        warning: "Cloudinary not configured. Using base64 encoding. Please configure Cloudinary for production use."
      });
    }
  } catch (error) {
    console.error("Error uploading screenshot:", error);
    res.status(500).json({ 
      error: "Failed to upload screenshot: " + error.message,
      details: error.stack 
    });
  }
});

// Export for Vercel serverless functions
export default app;

// Function to initialize all member balances on server start
async function initializeAllMemberBalances() {
  try {
    await ensureConnection();
    const allMembers = await UserModel.find({});
    
    for (const member of allMembers) {
      await calculateAndUpdateMemberBalance(member.id);
    }
    
    console.log(`✓ Initialized balances for ${allMembers.length} members`);
  } catch (error) {
    console.error("Error initializing member balances:", error);
  }
}

// Only listen locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`Subscription Manager HK API running on port ${PORT}`);
    console.log(`✓ API endpoints available:`);
    console.log(`  - GET    /api/members`);
    console.log(`  - POST   /api/members`);
    console.log(`  - PUT    /api/members/:id`);
    console.log(`  - DELETE /api/members/:id`);
    console.log(`  - GET    /api/invoices`);
    console.log(`  - POST   /api/invoices`);
    console.log(`  - PUT    /api/invoices/:id`);
    console.log(`  - DELETE /api/invoices/:id`);
    console.log(`  - GET    /api/payments`);
    console.log(`  - GET    /api/payments/member/:memberId`);
    console.log(`  - POST   /api/payments`);
    
    // Initialize all member balances on server start
    await initializeAllMemberBalances();
  });
}












import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://0741sanjai_db_user:L11x9pdm3tHuOJE9@members.mmnf0pe.mongodb.net/subscriptionmanager";

mongoose.connect(MONGODB_URI)
.then(()=> {console.log("MongoDB connected")})
.catch((err)=> {console.log(err)});

const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    phone: String,
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
})

const AdminModel = mongoose.model("admins", AdminSchema);

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
    const members = await UserModel.find({}).sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message});
  }
});

app.get("/api/admins", async (req, res) => {
  try {
    const admins = await AdminModel.find();
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
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

const invoices = [
  {
    id: "INV-2025-095",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Nov 2025 Monthly",
    amount: "$50",
    status: "Unpaid",
    due: "20 Nov 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-094",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Oct 2025 Monthly",
    amount: "$50",
    status: "Overdue",
    due: "20 Oct 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-093",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Sep 2025 Eid 2",
    amount: "$100",
    status: "Overdue",
    due: "30 Sep 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-092",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Sep 2025 Monthly",
    amount: "$50",
    status: "Overdue",
    due: "20 Sep 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-091",
    memberId: "HK1021",
    memberName: "Ahmed Al-Rashid",
    period: "Oct 2025",
    amount: "$50",
    status: "Paid",
    due: "05 Oct 2025",
    method: "FPS",
    reference: "FP89231",
  },
  {
    id: "INV-2025-072",
    memberId: "HK1112",
    memberName: "Aisha Malik",
    period: "Sep 2025 (Eid)",
    amount: "$100",
    status: "Unpaid",
    due: "30 Sep 2025",
    method: "-",
    reference: "-",
  },
];

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const role = email.includes("admin") ? "Admin" : "Member";
  res.json({
    role,
    token: `demo-token-${Math.random().toString(36).slice(2, 10)}`,
    email,
  });
});

app.get("/api/metrics", (_req, res) => {
  res.json(metrics);
});

// GET single member
app.get("/api/members/:id", async (req, res) => {
  try {
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
      email: req.body.email || '',
      phone: req.body.phone || '',
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
    const member = await UserModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
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

// GET all invoices
app.get("/api/invoices", (_req, res) => {
  res.json(invoices);
});

// GET invoices for specific member
app.get("/api/invoices/member/:memberId", (req, res) => {
  const memberInvoices = invoices.filter(inv => inv.memberId === req.params.memberId);
  res.json(memberInvoices);
});

// POST create new invoice
app.post("/api/invoices", (req, res) => {
  const invoice = {
    id: `INV-2025-${Math.floor(100 + Math.random() * 900)}`,
    ...req.body,
    status: req.body.status || "Unpaid",
  };
  invoices.push(invoice);
  res.status(201).json(invoice);
});

// PUT update invoice
app.put("/api/invoices/:id", (req, res) => {
  const index = invoices.findIndex(inv => inv.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  invoices[index] = { ...invoices[index], ...req.body };
  res.json(invoices[index]);
});

// DELETE invoice
app.delete("/api/invoices/:id", (req, res) => {
  const index = invoices.findIndex(inv => inv.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  invoices.splice(index, 1);
  res.status(204).send();
});


app.listen(PORT, () => {
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
});












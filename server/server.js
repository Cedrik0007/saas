import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import connectDB from "./config/database.js";
import { initializeCloudinary } from "./config/cloudinary.js";
import { initializeEmailTransporter } from "./config/email.js";
import { scheduleReminderCron, scheduleInvoiceGenerationCron, scheduleNextYearInvoiceCron, reminderCronJob } from "./utils/cron.js";
import { calculateAndUpdateMemberBalance } from "./utils/balance.js";
import UserModel from "./models/User.js";
import { initializeSocket } from "./config/socket.js";
import { ensureInvoiceCollectionValidator, runStartupIntegrityChecks, verifyMemberIdUniqueIndex } from "./utils/dataIntegrity.js";
import { getPublicApiBaseUrl } from "./utils/receiptLinks.js";

// Import routes
import membersRoutes from "./routes/members.js";
import adminsRoutes from "./routes/admins.js";
import invoicesRoutes from "./routes/invoices.js";
import paymentsRoutes from "./routes/payments.js";
import donationsRoutes from "./routes/donations.js";
import remindersRoutes from "./routes/reminders.js";
import emailRoutes from "./routes/email.js";
import paymentMethodsRoutes from "./routes/paymentMethods.js";
import authRoutes from "./routes/auth.js";
import uploadRoutes from "./routes/upload.js";
import authGoogleMemberRoutes from "./routes/authGoogleMember.js";
import adminSecurityRoutes from "./routes/adminSecurity.js";

dotenv.config();

if (process.env.NODE_ENV === "production" && !getPublicApiBaseUrl()) {
  console.warn("⚠ PUBLIC_API_BASE_URL is not set in production. Receipt links will be missing.");
}

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 4001;

// Middleware
const allowedOrigins = [
  "https://admin.imahk.org",
  "http://localhost:5173",
  "http://localhost:5174"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());

// Initialize Socket.io (after CORS setup)
initializeSocket(server);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware - set 20 second timeout for all requests
app.use((req, res, next) => {
  req.setTimeout(20000, () => {
    res.status(408).json({ error: 'Request timeout - server took too long to respond' });
  });
  next();
});

// Initialize services
initializeCloudinary();
initializeEmailTransporter();

// Connect to database
connectDB()
  .then(async () => {
    console.log("✓ MongoDB pre-connected successfully");
    await ensureInvoiceCollectionValidator();
    runStartupIntegrityChecks();
    verifyMemberIdUniqueIndex();
  })
  .catch((err) => {
    console.error("MongoDB pre-connection error:", err);
    // Don't exit - allow lazy connection on first request
  });

// Routes
app.get("/", (req, res) => {
  res.send("server & db running");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

const metrics = {
  totalMembers: 312,
  collectedMonth: 12450,
  collectedYear: 220800,
  outstanding: 18400,
  overdueMembers: 27,
};

app.get("/api/metrics", (_req, res) => {
  res.json(metrics);
});

// API Routes
app.use("/api/members", membersRoutes);
app.use("/api/admins", adminsRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/donations", donationsRoutes);
app.use("/api/reminders", remindersRoutes);
app.use("/api/email-settings", emailRoutes);
app.use("/api/payment-methods", paymentMethodsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminSecurityRoutes);
app.use("/api", authRoutes); // email/password login
app.use("/api", authGoogleMemberRoutes); // Google member login

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  const requestOrigin = req.headers?.origin;
  if (
    requestOrigin === "https://admin.imahk.org"
    || requestOrigin === "http://localhost:5173"
    || requestOrigin === "http://localhost:5174"
  ) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  
  // Handle timeout errors
  if (err.message && err.message.includes('timeout')) {
    return res.status(408).json({ 
      error: 'Request timeout', 
      message: 'The server took too long to respond. Please try again.' 
    });
  }
  
  // Handle database connection errors
  if (err.message && (err.message.includes('Database') || err.message.includes('connection'))) {
    return res.status(503).json({ 
      error: 'Database unavailable', 
      message: 'Database connection failed. Please try again in a moment.' 
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Function to initialize all member balances on server start
async function initializeAllMemberBalances() {
  try {
    const { ensureConnection } = await import("./config/database.js");
    await ensureConnection();
    const allMembers = await UserModel.find({});
    
    for (const member of allMembers) {
      try {
        await calculateAndUpdateMemberBalance(member?.id, {
          skipInvalidIdentifier: true,
          allowMissingMember: true,
        });
      } catch (error) {
        console.error(`Error initializing member balance (memberId=${member?.id || ""}):`, error);
      }
    }
    
    console.log(`✓ Initialized balances for ${allMembers.length} members`);
  } catch (error) {
    console.error("Error initializing member balances:", error);
  }
}

// Export for Vercel serverless functions
export default app;
export { server };

// Only listen locally (not on Vercel)
if (!process.env.VERCEL) {
  server.listen(PORT, async () => {
    console.log(`IMA Subscription Manager API running on port ${PORT}`);
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
    console.log(`  - POST   /api/reminders/check`);
    console.log(`  - POST   /api/reminders/send`);
    console.log(`  - POST   /api/reminders/test-now`);
    console.log(`  - GET    /api/reminders/logs`);
    console.log(`  - POST   /api/reminders/log`);
    console.log(`  - POST   /api/invoices/send-reminder`);
    console.log(`  - POST   /api/upload/screenshot`);
    console.log(`  - GET    /api/email-settings`);
    console.log(`  - POST   /api/email-settings`);
    console.log(`  - POST   /api/email-settings/test`);
    console.log(`  - GET    /api/email-settings/template`);
    console.log(`  - POST   /api/email-settings/template`);
    console.log(`  - GET    /api/donations`);
    console.log(`  - POST   /api/donations`);
    console.log(`  - DELETE /api/donations/:id`);
    
    // Initialize all member balances on server start
    await initializeAllMemberBalances();
    
    // Schedule automated reminders dynamically based on database settings
    await scheduleReminderCron();
    
    // Schedule invoice generation cron
    scheduleInvoiceGenerationCron();
    
    // Schedule next year invoice creation cron
    scheduleNextYearInvoiceCron();
    
    // Verify cron job was scheduled (need to re-import to get updated value)
    const cronModule = await import("./utils/cron.js");
    console.log('🔍 Cron job verification:', cronModule.reminderCronJob ? '✅ SCHEDULED' : '❌ NOT SCHEDULED');
    if (cronModule.reminderCronJob) {
      console.log('🔍 Cron job running:', cronModule.reminderCronJob.running ? '✅ YES' : '❌ NO');
    }
    
    // Optional: Run immediately on startup for testing (uncomment to enable)
    console.log('🔄 Running initial reminder check for testing...');
    try {
      const { checkAndSendReminders } = await import("./services/reminderService.js");
      await checkAndSendReminders();
      console.log('✅ Initial test reminder check completed');
    } catch (error) {
      console.error('❌ Error in initial test reminder check:', error);
    }
  });
}

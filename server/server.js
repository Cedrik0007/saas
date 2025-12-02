import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import { initializeCloudinary } from "./config/cloudinary.js";
import { initializeEmailTransporter } from "./config/email.js";
import { scheduleReminderCron, scheduleInvoiceGenerationCron, reminderCronJob } from "./utils/cron.js";
import { calculateAndUpdateMemberBalance } from "./utils/balance.js";
import UserModel from "./models/User.js";

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? "https://subs-manager.vercel.app"
    : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize services
initializeCloudinary();
initializeEmailTransporter();

// Connect to database
connectDB()
  .then(() => {
    console.log("✓ MongoDB pre-connected successfully");
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
app.use("/api", authRoutes); // email/password login
app.use("/api", authGoogleMemberRoutes); // Google member login

// Function to initialize all member balances on server start
async function initializeAllMemberBalances() {
  try {
    const { ensureConnection } = await import("./config/database.js");
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

// Export for Vercel serverless functions
export default app;

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
    console.log(`  - POST   /api/reminders/check`);
    console.log(`  - POST   /api/reminders/send`);
    console.log(`  - POST   /api/reminders/test-now`);
    console.log(`  - GET    /api/reminders/logs`);
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

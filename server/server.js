import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import cron from "node-cron";
import nodemailer from "nodemailer";

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

// Global variable to store the cron job so it can be rescheduled
let reminderCronJob = null;
let invoiceCronJob = null;

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
    subscriptionType: { type: String, default: "Monthly" },
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
  status: { type: String, default: "Pending" }, // Changed default to "Pending"
  date: String,
  screenshot: String,
  paidToAdmin: String,
  paidToAdminName: String,
  rejectionReason: String, // Reason for rejection
  approvedBy: String, // Admin who approved
  approvedAt: Date, // When approved
  rejectedBy: String, // Admin who rejected
  rejectedAt: Date, // When rejected
}, {
  timestamps: true
});

const PaymentModel = mongoose.model("payments", PaymentSchema);

// Donation Schema
const DonationSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  isMember: { type: Boolean, default: false },
  memberId: String, // If isMember is true, link to member
  amount: { type: String, required: true },
  notes: String,
  date: String, // Auto-generated
}, {
  timestamps: true
});

const DonationModel = mongoose.model("donations", DonationSchema);

// Email Template Schema
const EmailTemplateSchema = new mongoose.Schema({
  subject: { type: String, default: "Payment Reminder - Outstanding Balance" },
  htmlTemplate: String,
}, {
  timestamps: true
});

const EmailTemplateModel = mongoose.model("emailtemplates", EmailTemplateSchema);

// Reminder Log Schema
const ReminderLogSchema = new mongoose.Schema({
  memberId: String,
  memberEmail: String,
  sentAt: Date,
  reminderType: String, // "overdue" or "upcoming"
  amount: String,
  invoiceCount: Number,
}, {
  timestamps: true
});

const ReminderLogModel = mongoose.model("reminderlogs", ReminderLogSchema);

// Payment Method Schema
const PaymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // "Alipay", "PayMe", "FPS", "Direct Bank Transfer"
  visible: { type: Boolean, default: true },
  qrImageUrl: String,
  details: [String], // Array of payment details for non-QR methods
}, {
  timestamps: true
});

const PaymentMethodModel = mongoose.model("paymentmethods", PaymentMethodSchema);

// Email configuration using nodemailer
let transporter = null;

// Helper function to generate unique message ID for each email (prevents threading)
function generateUniqueMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `<${timestamp}-${random}@subscriptionhk.org>`;
}

function initializeEmailTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    console.log("✓ Email transporter initialized");
  } else {
    console.warn("⚠️ Email credentials not found. Automated reminders will not send emails.");
  }
}

// Initialize email transporter
initializeEmailTransporter();

// Function to send reminder email
async function sendReminderEmail(member, unpaidInvoices, totalDue) {
  if (!transporter) {
    console.warn(`⚠️ Email not configured. Skipping email to ${member.email}`);
    return false;
  }

  try {
    await ensureConnection();
    
    // Get email template from database
    let emailTemplate = await EmailTemplateModel.findOne({});
    if (!emailTemplate) {
      // Use default template if none exists
      emailTemplate = {
        subject: "Payment Reminder - Outstanding Balance",
        htmlTemplate: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Payment Reminder - Outstanding Balance
  </h2>
  <p>Dear {{member_name}},</p>
  <p>This is a friendly reminder about your outstanding subscription payments.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Member ID:</strong> {{member_id}}</p>
    <p><strong>Email:</strong> {{member_email}}</p>
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">${{total_due}}</span></p>
  </div>
  <h3 style="color: #333;">Outstanding Invoices ({{invoice_count}}):</h3>
  <ul style="list-style: none; padding: 0;">
    {{invoice_list}}
  </ul>
  <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>💳 Payment Methods Available:</strong></p>
    <ul>
      {{payment_methods}}
    </ul>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{portal_link}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Access Member Portal
    </a>
  </p>
  <p>Please settle your outstanding balance at your earliest convenience.</p>
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
</div>`,
      };
    }

    // Generate invoice list HTML
    const invoiceListHTML = unpaidInvoices
      .map((inv) => 
        `<li style="margin-bottom: 10px;">
          <strong>${inv.period}</strong>: ${inv.amount} 
          <span style="color: #666;">(Due: ${inv.due})</span> - 
          <strong style="color: ${inv.status === 'Overdue' ? '#d32f2f' : '#f57c00'}">${inv.status}</strong>
        </li>`
      )
      .join('');

    // Get payment methods from database (if available) or use default
    const paymentMethodsHTML = `<li>FPS: Available in member portal</li>
    <li>PayMe: Available in member portal</li>
    <li>Bank Transfer: Available in member portal</li>
    <li>Credit Card: Pay instantly online</li>`;

    // Replace placeholders in template
    const portalLink = process.env.FRONTEND_URL || 'http://localhost:5173';
    let emailHTML = emailTemplate.htmlTemplate
      .replace(/\{\{member_name\}\}/g, member.name)
      .replace(/\{\{member_id\}\}/g, member.id)
      .replace(/\{\{member_email\}\}/g, member.email)
      .replace(/\{\{total_due\}\}/g, totalDue.toFixed(2))
      .replace(/\{\{invoice_count\}\}/g, unpaidInvoices.length)
      .replace(/\{\{invoice_list\}\}/g, invoiceListHTML)
      .replace(/\{\{payment_methods\}\}/g, paymentMethodsHTML)
      .replace(/\{\{portal_link\}\}/g, `${portalLink}/member`);

    // Replace placeholders in subject
    let emailSubject = emailTemplate.subject
      .replace(/\{\{member_name\}\}/g, member.name)
      .replace(/\{\{total_due\}\}/g, totalDue.toFixed(2))
      .replace(/\{\{invoice_count\}\}/g, unpaidInvoices.length);

    // Get email settings to use the configured email address
    const emailSettings = await EmailSettingsModel.findOne({});
    const fromEmail = emailSettings?.emailUser || process.env.EMAIL_USER || 'noreply@subscriptionhk.org';
    
    // Add date to subject to make it unique and prevent threading
    const uniqueSubject = `${emailSubject} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    await transporter.sendMail({
      from: `"Subscription Manager HK" <${fromEmail}>`,
      to: member.email,
      subject: uniqueSubject,
      html: emailHTML,
      text: `Dear ${member.name},\n\nThis is a friendly reminder about your outstanding subscription payments.\n\nMember ID: ${member.id}\nTotal Outstanding: $${totalDue.toFixed(2)}\n\nOutstanding Invoices (${unpaidInvoices.length}):\n${unpaidInvoices.map(inv => `• ${inv.period}: ${inv.amount} (Due: ${inv.due}) - ${inv.status}`).join('\n')}\n\nPayment Methods: Available in member portal\n\nAccess Member Portal: ${portalLink}/member\n\nPlease settle your outstanding balance at your earliest convenience.\n\nBest regards,\nFinance Team\nSubscription Manager HK`,
      // Add unique headers to prevent email threading
      messageId: generateUniqueMessageId(),
      headers: {
        'X-Entity-Ref-ID': `${member.id}-${Date.now()}`,
        'In-Reply-To': undefined,
        'References': undefined,
        'Thread-Topic': undefined,
        'Thread-Index': undefined,
      },
    });

    console.log(`✓ Reminder email sent to ${member.email}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${member.email}:`, error);
    return false;
  }
}

// Function to convert time string (HH:MM) to cron expression
function timeToCronExpression(timeString) {
  // timeString format: "HH:MM" (24-hour format, e.g., "09:00", "14:30")
  const [hours, minutes] = timeString.split(':').map(Number);
  // Cron format: "minute hour * * *"
  return `${minutes} ${hours} * * *`;
}

// Function to schedule the reminder cron job
async function scheduleReminderCron() {
  try {
    await ensureConnection();
    
    // Get email settings from database
    const emailSettings = await EmailSettingsModel.findOne({});
    
    // Read schedule time from database, default to 9:00 AM if not set
    const scheduleTime = emailSettings?.scheduleTime || "09:00";
    const automationEnabled = emailSettings?.automationEnabled !== false;
    
    // Stop existing cron job if it exists
    if (reminderCronJob) {
      reminderCronJob.stop();
      reminderCronJob = null;
    }
    
    // Only schedule if automation is enabled
    if (automationEnabled) {
      const cronExpression = timeToCronExpression(scheduleTime);
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      
      console.log(`🔍 Automation Status: ENABLED`);
      console.log(`🔍 Schedule Time: ${scheduleTime} (${hours}:${minutes.toString().padStart(2, '0')})`);
      console.log(`📅 Cron Expression: "${cronExpression}"`);
      console.log(`📅 Cron will run: minute=${minutes}, hour=${hours}, daily (* * *)`);
      
      reminderCronJob = cron.schedule(cronExpression, async () => {
        try {
          console.log(`\n🔄 ===== Running scheduled automated reminder check (scheduled for ${scheduleTime}) =====`);
          const now = new Date();
          const indiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
          console.log(`⏰ Server time: ${now.toLocaleString()}`);
          console.log(`⏰ India time: ${indiaTime.toLocaleString()}`);
          await checkAndSendReminders();
          console.log(`✅ Scheduled reminder check completed\n`);
        } catch (error) {
          console.error('❌ Error in scheduled reminder check:', error);
          console.error('❌ Error stack:', error.stack);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
      });
      
      // Format time for display (convert 24-hour to 12-hour with AM/PM)
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      
      // Calculate next run time in India timezone
      const now = new Date();
      const indiaNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);
      const indiaNextRun = new Date(nextRun.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      if (indiaNextRun <= indiaNow) {
        indiaNextRun.setDate(indiaNextRun.getDate() + 1); // Tomorrow if time already passed
      }
      
      console.log(`✓ Automated reminders scheduled (daily at ${displayTime} / ${scheduleTime})`);
      console.log(`🔍 Cron job object:`, reminderCronJob ? 'Created successfully' : 'FAILED TO CREATE');
      console.log(`🔍 Cron job details:`);
      console.log(`   - Expression: ${cronExpression}`);
      console.log(`   - Scheduled: ${reminderCronJob ? 'Yes' : 'No'}`);
      console.log(`   - Running: ${reminderCronJob?.running ? 'Yes' : 'No'}`);
      console.log(`   - Timezone: Asia/Kolkata (India)`);
      console.log(`⏰ India time now: ${indiaNow.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`⏰ Next cron run (India time): ${indiaNextRun.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    } else {
      console.log('⏭️ Automated reminders DISABLED - not scheduling cron job');
      console.log(`🔍 Automation enabled status: ${automationEnabled}`);
    }
  } catch (error) {
    console.error('Error scheduling reminder cron:', error);
    // Fallback to default schedule
    const cronExpression = timeToCronExpression("09:00");
    reminderCronJob = cron.schedule(cronExpression, () => {
      console.log('🔄 Running scheduled automated reminder check (fallback schedule)...');
      checkAndSendReminders();
    });
    console.log('✓ Automated reminders scheduled (fallback: daily at 9:00 AM)');
  }
}

// Function to check and send automated reminders
async function checkAndSendReminders() {
  try {
    console.log('\n🔍 ===== checkAndSendReminders STARTED =====');
    const now = new Date();
    const indiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    console.log('🔍 Server time:', now.toLocaleString());
    console.log('🔍 India time:', indiaTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    await ensureConnection();
    console.log('🔍 Database connection verified');
    
    // Get email settings from database
    const emailSettings = await EmailSettingsModel.findOne({});
    console.log('🔍 Email settings retrieved:', emailSettings ? 'Found' : 'NOT FOUND');
    
    // Check if email automation is enabled
    if (!emailSettings || !emailSettings.automationEnabled) {
      console.log('⏭️ Email automation is disabled');
      console.log('🔍 Email settings exists:', emailSettings ? 'Yes' : 'No');
      console.log('🔍 Automation enabled:', emailSettings?.automationEnabled);
      return;
    }

    // Check if email is configured
    if (!emailSettings.emailUser || !emailSettings.emailPassword) {
      console.log('⏭️ Email not configured. Skipping reminder check.');
      console.log('🔍 Email user:', emailSettings.emailUser ? 'Set' : 'NOT SET');
      console.log('🔍 Email password:', emailSettings.emailPassword ? 'Set' : 'NOT SET');
      return;
    }
    
    console.log('✅ Email configuration verified');

    // Update transporter with saved settings
    transporter = nodemailer.createTransport({
      service: emailSettings.emailService || 'gmail',
      auth: {
        user: emailSettings.emailUser,
        pass: emailSettings.emailPassword,
      },
    });
    
    console.log('🔄 Starting automated reminder check...');
    console.log(`📧 Email configured: ${emailSettings.emailUser}`);
    
    // Get all active members
    const members = await UserModel.find({ status: 'Active' });
    console.log(`📋 Found ${members.length} active members`);
    
    if (members.length === 0) {
      console.log('⚠️ No active members found. Skipping reminder check.');
      return;
    }
    
    // Get reminder interval from settings (default: 7 days)
    const reminderInterval = emailSettings.reminderInterval || 7;
    console.log(`🔍 Reminder interval: ${reminderInterval} day(s)`);
    console.log(`📅 Reminder logic: Will send if ${reminderInterval} or more days have passed since last reminder`);
    
    let remindersSent = 0;
    let remindersFailed = 0;
    let remindersSkipped = 0;
    
    for (const member of members) {
      // Get unpaid/overdue invoices for this member
      const unpaidInvoices = await InvoiceModel.find({
        memberId: member.id,
        status: { $in: ['Unpaid', 'Overdue'] }
      });

      if (unpaidInvoices.length === 0) continue;

      // Calculate total due
      const totalDue = unpaidInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.amount.replace('$', '').replace(',', '')) || 0;
      }, 0);

      // Determine reminder type
      const hasOverdue = unpaidInvoices.some(inv => inv.status === 'Overdue');
      const reminderType = hasOverdue ? 'overdue' : 'upcoming';

      // Check if we should send reminder based on interval
      // Find the most recent reminder for this member
      const lastReminder = await ReminderLogModel.findOne({
        memberId: member.id
      }).sort({ sentAt: -1 }); // Get most recent

      let shouldSend = false;
      let daysSinceLastReminder = 0;

      if (!lastReminder) {
        // No previous reminder - send immediately
        shouldSend = true;
        console.log(`📧 No previous reminder found for ${member.email} (${member.name}) - will send`);
      } else {
        // Calculate days since last reminder
        const lastReminderDate = new Date(lastReminder.sentAt);
        const now = new Date();
        const diffTime = Math.abs(now - lastReminderDate);
        daysSinceLastReminder = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // Send if interval days have passed
        // Interval = 1: send daily (daysSinceLastReminder >= 1)
        // Interval = 2: send every 2 days (daysSinceLastReminder >= 2, means 1 day gap)
        // Interval = 3: send every 3 days (daysSinceLastReminder >= 3, means 2 days gap)
        if (daysSinceLastReminder >= reminderInterval) {
          shouldSend = true;
          console.log(`📧 Last reminder to ${member.email} (${member.name}) was ${daysSinceLastReminder} days ago (interval: ${reminderInterval}) - will send`);
        } else {
          console.log(`⏭️ Skipping ${member.email} (${member.name}) - last reminder ${daysSinceLastReminder} days ago (needs ${reminderInterval} days interval)`);
        }
      }

      if (shouldSend) {
        // Send reminder email
        const sent = await sendReminderEmail(member, unpaidInvoices, totalDue);

        if (sent) {
          // Log the reminder
          await ReminderLogModel.create({
            memberId: member.id,
            memberEmail: member.email,
            sentAt: new Date(),
            reminderType: reminderType,
            amount: `$${totalDue}`,
            invoiceCount: unpaidInvoices.length,
          });
          console.log(`✓ Automated reminder sent to ${member.name} (${member.email}) - $${totalDue} due`);
          remindersSent++;
        } else {
          remindersFailed++;
          console.log(`✗ Failed to send reminder to ${member.email}`);
        }
      } else {
        remindersSkipped++;
      }
    }
    
    console.log(`✅ Reminder check completed: ${remindersSent} sent, ${remindersFailed} failed, ${remindersSkipped} skipped (interval: ${reminderInterval} days)`);
  } catch (error) {
    console.error('❌ Error in automated reminder check:', error);
  }
}

// Function to automatically generate invoices for subscriptions based on payment dates
async function generateSubscriptionInvoices() {
  try {
    console.log('\n🔄 ===== Starting automatic invoice generation =====');
    await ensureConnection();
    
    // Get all active members
    const activeMembers = await UserModel.find({ status: 'Active' });
    console.log(`📋 Found ${activeMembers.length} active members to check`);
    
    let invoicesCreated = 0;
    let invoicesSkipped = 0;
    
    for (const member of activeMembers) {
      try {
        const subscriptionType = member.subscriptionType || 'Monthly';
        
        // Find the last paid payment for this member
        const lastPayment = await PaymentModel.findOne({
          memberId: member.id,
          status: 'Paid'
        }).sort({ createdAt: -1 });
        
        if (!lastPayment) {
          // No payment found, check if they have any invoice
          const lastInvoice = await InvoiceModel.findOne({ 
            memberId: member.id 
          }).sort({ createdAt: -1 });
          
          if (!lastInvoice) {
            // No invoice exists, create initial invoice
            console.log(`📝 No invoice/payment found for ${member.name} (${member.id}), creating initial invoice...`);
            await createSubscriptionInvoice(member, subscriptionType);
            invoicesCreated++;
            continue;
          } else {
            // Has invoice but no payment - check if invoice is old enough
            const invoiceDate = new Date(lastInvoice.createdAt);
            const now = new Date();
            const timeDiff = now - invoiceDate;
            
            const periodMs = subscriptionType === 'Yearly' 
              ? 365 * 24 * 60 * 60 * 1000 
              : 30 * 24 * 60 * 60 * 1000;
            
            if (timeDiff >= periodMs) {
              console.log(`📝 Creating invoice for ${member.name} based on old invoice date...`);
              await createSubscriptionInvoice(member, subscriptionType);
              invoicesCreated++;
            } else {
              invoicesSkipped++;
            }
            continue;
          }
        }
        
        // Use payment date to calculate next invoice date
        const paymentDate = new Date(lastPayment.createdAt);
        const now = new Date();
        const timeSincePayment = now - paymentDate;
        
        let shouldCreate = false;
        let periodName = '';
        const periodMs = subscriptionType === 'Yearly' 
          ? 365 * 24 * 60 * 60 * 1000 
          : 30 * 24 * 60 * 60 * 1000;
        
        if (timeSincePayment >= periodMs) {
          shouldCreate = true;
          const monthYear = now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
          periodName = subscriptionType === 'Yearly' 
            ? `${monthYear} Yearly Subscription`
            : `${monthYear} Monthly Subscription`;
        }
        
        // Check if there's already an unpaid invoice for current period
        if (shouldCreate) {
          const currentMonth = now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
          const existingUnpaid = await InvoiceModel.findOne({
            memberId: member.id,
            status: { $in: ['Unpaid', 'Overdue'] },
            period: { $regex: currentMonth, $options: 'i' }
          });
          
          if (existingUnpaid) {
            console.log(`⏭️ Skipping ${member.name} - already has unpaid invoice for current period`);
            invoicesSkipped++;
            continue;
          }
          
          console.log(`✅ Creating ${subscriptionType} invoice for ${member.name} (${member.id}) based on payment date`);
          await createSubscriptionInvoice(member, subscriptionType, periodName);
          invoicesCreated++;
        } else {
          const daysSincePayment = Math.floor(timeSincePayment / (24 * 60 * 60 * 1000));
          const daysNeeded = subscriptionType === 'Yearly' ? 365 : 30;
          console.log(`⏭️ Skipping ${member.name} - last payment was ${daysSincePayment} days ago (needs ${daysNeeded} days)`);
          invoicesSkipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing member ${member.name} (${member.id}):`, error);
      }
    }
    
    console.log(`✅ Invoice generation completed: ${invoicesCreated} created, ${invoicesSkipped} skipped`);
    return { created: invoicesCreated, skipped: invoicesSkipped };
  } catch (error) {
    console.error('❌ Error in automatic invoice generation:', error);
    throw error;
  }
}

// Helper function to create a subscription invoice
async function createSubscriptionInvoice(member, subscriptionType, customPeriod = null) {
  try {
    const invoiceAmount = subscriptionType === 'Yearly' ? '$500' : '$50';
    const invoicePeriod = customPeriod || (subscriptionType === 'Yearly' ? 'Yearly Subscription' : 'Monthly Subscription');
    
    // Calculate due date (1 month for monthly, 1 year for yearly)
    const dueDate = new Date();
    if (subscriptionType === 'Yearly') {
      dueDate.setFullYear(dueDate.getFullYear() + 1);
    } else {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
    
    // Format due date
    const dueDateFormatted = dueDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(',', '');
    
    // Create invoice
    const invoiceData = {
      id: `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      memberId: member.id,
      memberName: member.name,
      memberEmail: member.email,
      period: invoicePeriod,
      amount: invoiceAmount,
      status: "Unpaid",
      due: dueDateFormatted,
      method: "",
      reference: "",
    };
    
    const newInvoice = new InvoiceModel(invoiceData);
    await newInvoice.save();
    
    // Update member balance
    await calculateAndUpdateMemberBalance(member.id);
    
    console.log(`✓ Invoice created: ${newInvoice.id} for ${member.name} - ${invoiceAmount} due ${dueDateFormatted}`);
    return newInvoice;
  } catch (error) {
    console.error(`Error creating invoice for ${member.name}:`, error);
    throw error;
  }
}

// Function to schedule the invoice generation cron job
function scheduleInvoiceGenerationCron() {
  try {
    // Stop existing cron job if it exists
    if (invoiceCronJob) {
      invoiceCronJob.stop();
      invoiceCronJob = null;
    }
    
    // Schedule to run daily at 2:00 AM (after reminder cron)
    // This ensures invoices are generated before reminders are sent
    invoiceCronJob = cron.schedule('0 2 * * *', async () => {
      try {
        console.log(`\n🔄 ===== Running scheduled invoice generation (daily at 2:00 AM) =====`);
        const now = new Date();
        console.log(`⏰ Server time: ${now.toLocaleString()}`);
        await generateSubscriptionInvoices();
        console.log(`✅ Scheduled invoice generation completed\n`);
      } catch (error) {
        console.error('❌ Error in scheduled invoice generation:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    console.log('✓ Invoice generation scheduled (daily at 2:00 AM)');
  } catch (error) {
    console.error('Error scheduling invoice generation cron:', error);
  }
}

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

      // Check if member is approved (status must be 'Active')
      if (member.status === 'Pending') {
        return res.status(403).json({ 
          message: "Your account is pending approval. Please wait for admin approval before logging in.",
          success: false 
        });
      }

      // Check if member is active (not suspended/inactive)
      if (member.status && member.status !== 'Active' && member.status !== 'Pending') {
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
      status: req.body.status || 'Pending',
      balance: req.body.balance || '$0',
      nextDue: req.body.nextDue || '',
      lastPayment: req.body.lastPayment || '',
      subscriptionType: req.body.subscriptionType || 'Monthly',
    });
    
    const savedMember = await newMember.save();
    
    // Create initial invoice based on subscription type
    const subscriptionType = req.body.subscriptionType || 'Monthly';
    let invoiceAmount = '$50';
    let invoicePeriod = 'Monthly Subscription';
    let dueDate = new Date();
    
    if (subscriptionType === 'Yearly') {
      invoiceAmount = '$500';
      invoicePeriod = 'Yearly Subscription';
      dueDate.setFullYear(dueDate.getFullYear() + 1);
    } else {
      // Monthly
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
    
    // Format due date as "DD MMM YYYY"
    const dueDateFormatted = dueDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(',', '');
    
    // Create invoice
    const invoiceData = {
      id: `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      memberId: savedMember.id,
      memberName: savedMember.name,
      memberEmail: savedMember.email,
      period: invoicePeriod,
      amount: invoiceAmount,
      status: "Unpaid",
      due: dueDateFormatted,
      method: "",
      reference: "",
    };
    
    const newInvoice = new InvoiceModel(invoiceData);
    await newInvoice.save();
    
    // Update member balance
    await calculateAndUpdateMemberBalance(savedMember.id);
    
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
      status: req.body.status || "Pending", // Changed default to "Pending"
    };
    
    const newPayment = new PaymentModel(paymentData);
    await newPayment.save();
    
    res.status(201).json(newPayment);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PAYMENT APPROVAL ENDPOINTS ==========

// PUT approve payment
app.put("/api/payments/:id/approve", async (req, res) => {
  try {
    await ensureConnection();
    
    // Try to find by _id first, then by id field
    let payment = await PaymentModel.findById(req.params.id);
    if (!payment) {
      payment = await PaymentModel.findOne({ id: req.params.id });
    }
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Update payment status
    payment.status = "Completed";
    payment.approvedBy = req.body.adminId || req.body.adminName || "Admin";
    payment.approvedAt = new Date();
    await payment.save();

    // Update related invoice to Paid
    if (payment.invoiceId) {
      await InvoiceModel.findOneAndUpdate(
        { id: payment.invoiceId },
        { 
          $set: { 
            status: "Paid",
            method: payment.method,
            reference: payment.reference,
            screenshot: payment.screenshot
          }
        }
      );
      
      // Update member balance
      await calculateAndUpdateMemberBalance(payment.memberId);
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT reject payment
app.put("/api/payments/:id/reject", async (req, res) => {
  try {
    await ensureConnection();
    
    // Try to find by _id first, then by id field
    let payment = await PaymentModel.findById(req.params.id);
    if (!payment) {
      payment = await PaymentModel.findOne({ id: req.params.id });
    }
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Update payment status
    payment.status = "Rejected";
    payment.rejectionReason = req.body.reason || "";
    payment.rejectedBy = req.body.adminId || req.body.adminName || "Admin";
    payment.rejectedAt = new Date();
    await payment.save();

    // Update related invoice back to Unpaid
    if (payment.invoiceId) {
      await InvoiceModel.findOneAndUpdate(
        { id: payment.invoiceId },
        { 
          $set: { 
            status: "Unpaid",
            method: "",
            reference: "",
            screenshot: ""
          }
        }
      );
      
      // Update member balance
      await calculateAndUpdateMemberBalance(payment.memberId);
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error("Error rejecting payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== DONATION ENDPOINTS ==========

// GET all donations
app.get("/api/donations", async (req, res) => {
  try {
    await ensureConnection();
    const donations = await DonationModel.find().sort({ createdAt: -1 });
    res.json(donations);
  } catch (error) {
    console.error("Error fetching donations:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create donation
app.post("/api/donations", async (req, res) => {
  try {
    await ensureConnection();
    const donationData = {
      ...req.body,
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
    const donation = new DonationModel(donationData);
    await donation.save();
    res.json(donation);
  } catch (error) {
    console.error("Error creating donation:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE donation
app.delete("/api/donations/:id", async (req, res) => {
  try {
    await ensureConnection();
    await DonationModel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting donation:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== INVOICE REMINDER EMAIL ENDPOINT ==========

// POST send invoice reminder email (for invoice creation and manual sending)
app.post("/api/invoices/send-reminder", async (req, res) => {
  try {
    await ensureConnection();
    
    const { 
      toEmail, 
      toName, 
      memberId, 
      totalDue, 
      invoiceCount, 
      invoiceListText, 
      invoiceListHTML,
      paymentMethods,
      portalLink 
    } = req.body;
    
    if (!toEmail || !toName) {
      return res.status(400).json({ error: "Email and name are required" });
    }
    
    // Check if email is configured
    const emailSettings = await EmailSettingsModel.findOne({});
    if (!emailSettings || !emailSettings.emailUser || !emailSettings.emailPassword) {
      return res.status(400).json({ error: "Email not configured. Please configure email settings first." });
    }

    // Get email template
    const emailTemplate = await EmailTemplateModel.findOne({});
    const emailSubject = emailTemplate?.subject || "Payment Reminder - Outstanding Balance";
    let emailHTML = emailTemplate?.htmlTemplate || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
          Payment Reminder - Outstanding Balance
        </h2>
        <p>Dear {{member_name}},</p>
        <p>This is a friendly reminder about your outstanding subscription payments.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Member ID:</strong> {{member_id}}</p>
          <p><strong>Email:</strong> {{member_email}}</p>
          <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">\${{total_due}}</span></p>
        </div>
        <h3 style="color: #333;">Outstanding Invoices ({{invoice_count}}):</h3>
        <ul style="list-style: none; padding: 0;">
          {{invoice_list}}
        </ul>
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>💳 Payment Methods Available:</strong></p>
          <ul>
            {{payment_methods}}
          </ul>
        </div>
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{portal_link}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Access Member Portal
          </a>
        </p>
        <p>Please settle your outstanding balance at your earliest convenience.</p>
        <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
      </div>
    `;

    // Replace template variables
    emailHTML = emailHTML
      .replace(/\{\{member_name\}\}/g, toName)
      .replace(/\{\{member_id\}\}/g, memberId || 'N/A')
      .replace(/\{\{member_email\}\}/g, toEmail)
      .replace(/\{\{total_due\}\}/g, totalDue)
      .replace(/\{\{invoice_count\}\}/g, invoiceCount)
      .replace(/\{\{invoice_list\}\}/g, invoiceListHTML || invoiceListText)
      .replace(/\{\{payment_methods\}\}/g, paymentMethods || 'Available in member portal')
      .replace(/\{\{portal_link\}\}/g, portalLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/member`);

    // Update transporter with saved settings
    const invoiceTransporter = nodemailer.createTransport({
      service: emailSettings.emailService || 'gmail',
      auth: {
        user: emailSettings.emailUser,
        pass: emailSettings.emailPassword,
      },
    });

    // Prepare unique subject with date to prevent threading
    const finalSubject = emailSubject.replace(/\{\{total_due\}\}/g, totalDue);
    const uniqueSubject = `${finalSubject} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    // Send email
    await invoiceTransporter.sendMail({
      from: `"Subscription Manager HK" <${emailSettings.emailUser}>`,
      to: toEmail,
      subject: uniqueSubject,
      html: emailHTML,
      text: `Dear ${toName},\n\nThis is a friendly reminder about your outstanding subscription payments.\n\nMember ID: ${memberId || 'N/A'}\nTotal Outstanding: ${totalDue}\n\nOutstanding Invoices (${invoiceCount}):\n${invoiceListText || 'N/A'}\n\nPayment Methods: ${paymentMethods || 'Available in member portal'}\n\nAccess Member Portal: ${portalLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/member`}\n\nPlease settle your outstanding balance at your earliest convenience.\n\nBest regards,\nFinance Team\nSubscription Manager HK`,
      // Add unique headers to prevent email threading
      messageId: generateUniqueMessageId(),
      headers: {
        'X-Entity-Ref-ID': `${memberId || 'invoice'}-${Date.now()}`,
        'In-Reply-To': undefined,
        'References': undefined,
        'Thread-Topic': undefined,
        'Thread-Index': undefined,
      },
    });

    console.log(`✓ Invoice reminder email sent to ${toEmail}`);

    res.json({ 
      success: true, 
      message: `Email sent successfully to ${toEmail}` 
    });
  } catch (error) {
    console.error("Error sending invoice reminder email:", error);
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

    // Determine folder based on upload type (QR code vs payment screenshot)
    const uploadType = req.body.uploadType || "screenshot"; // Default to screenshot
    const folder = uploadType === "qr-code" ? "qr-codes" : "payment-screenshots";

    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      // Upload to Cloudinary using v2 API - convert buffer to data URI (more reliable)
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;
      
      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: folder,
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: uploadType === "qr-code" 
          ? [{ width: 500, height: 500, crop: "limit" }] // Optimize for QR codes
          : [{ width: 1000, crop: "limit" }], // Original transformation for screenshots
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

// ========== AUTOMATED REMINDERS ENDPOINT ==========

// POST endpoint to trigger reminder check manually
app.post("/api/reminders/check", async (req, res) => {
  try {
    await ensureConnection();
    await checkAndSendReminders();
    res.json({ success: true, message: "Reminder check completed" });
  } catch (error) {
    console.error("Error in reminder check endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to test reminder check immediately (for debugging)
app.post("/api/reminders/test-now", async (req, res) => {
  try {
    console.log('🧪 ===== Manual test trigger - running checkAndSendReminders =====');
    const now = new Date();
    const indiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    console.log(`⏰ Server time: ${now.toLocaleString()}`);
    console.log(`⏰ India time: ${indiaTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    
    await ensureConnection();
    await checkAndSendReminders();
    
    res.json({ 
      success: true, 
      message: "Manual reminder check completed. Check server logs for details.",
      serverTime: now.toLocaleString(),
      indiaTime: indiaTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
  } catch (error) {
    console.error('❌ Error in manual test:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST send manual reminder to specific member or all outstanding members
app.post("/api/reminders/send", async (req, res) => {
  try {
    await ensureConnection();
    
    const { memberId, sendToAll } = req.body;
    
    // Check if email is configured
    const emailSettings = await EmailSettingsModel.findOne({});
    if (!emailSettings || !emailSettings.emailUser || !emailSettings.emailPassword) {
      return res.status(400).json({ error: "Email not configured. Please configure email settings first." });
    }

    // Update transporter with saved settings
    transporter = nodemailer.createTransport({
      service: emailSettings.emailService || 'gmail',
      auth: {
        user: emailSettings.emailUser,
        pass: emailSettings.emailPassword,
      },
    });

    let results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    if (sendToAll) {
      // Send to all members with outstanding invoices
      const members = await UserModel.find({ status: 'Active' });
      
      for (const member of members) {
        const unpaidInvoices = await InvoiceModel.find({
          memberId: member.id,
          status: { $in: ['Unpaid', 'Overdue'] }
        });

        if (unpaidInvoices.length === 0) {
          results.skipped++;
          continue;
        }

        const totalDue = unpaidInvoices.reduce((sum, inv) => {
          return sum + parseFloat(inv.amount.replace('$', '').replace(',', '')) || 0;
        }, 0);

        const sent = await sendReminderEmail(member, unpaidInvoices, totalDue);
        
        if (sent) {
          await ReminderLogModel.create({
            memberId: member.id,
            memberEmail: member.email,
            sentAt: new Date(),
            reminderType: unpaidInvoices.some(inv => inv.status === 'Overdue') ? 'overdue' : 'upcoming',
            amount: `$${totalDue}`,
            invoiceCount: unpaidInvoices.length,
          });
          results.sent++;
        } else {
          results.failed++;
        }
      }
    } else if (memberId) {
      // Send to specific member
      const member = await UserModel.findOne({ id: memberId });
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      const unpaidInvoices = await InvoiceModel.find({
        memberId: member.id,
        status: { $in: ['Unpaid', 'Overdue'] }
      });

      if (unpaidInvoices.length === 0) {
        return res.status(400).json({ error: "This member has no outstanding invoices" });
      }

      const totalDue = unpaidInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.amount.replace('$', '').replace(',', '')) || 0;
      }, 0);

      const sent = await sendReminderEmail(member, unpaidInvoices, totalDue);
      
      if (sent) {
        await ReminderLogModel.create({
          memberId: member.id,
          memberEmail: member.email,
          sentAt: new Date(),
          reminderType: unpaidInvoices.some(inv => inv.status === 'Overdue') ? 'overdue' : 'upcoming',
          amount: `$${totalDue}`,
          invoiceCount: unpaidInvoices.length,
        });
        results.sent = 1;
      } else {
        return res.status(500).json({ error: "Failed to send email" });
      }
    } else {
      return res.status(400).json({ error: "Either memberId or sendToAll must be provided" });
    }

    res.json({ 
      success: true, 
      message: sendToAll 
        ? `Reminders sent: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`
        : `Reminder sent successfully`,
      results 
    });
  } catch (error) {
    console.error("Error sending manual reminders:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST send invoice reminder email (for invoice creation and manual reminders)
app.post("/api/invoices/send-reminder", async (req, res) => {
  try {
    await ensureConnection();
    
    const { 
      toEmail, 
      toName, 
      memberId, 
      totalDue, 
      invoiceCount, 
      invoiceListText, 
      invoiceListHTML,
      paymentMethods,
      portalLink 
    } = req.body;
    
    if (!toEmail || !toName) {
      return res.status(400).json({ error: "Email and name are required" });
    }
    
    // Check if email is configured
    const emailSettings = await EmailSettingsModel.findOne({});
    if (!emailSettings || !emailSettings.emailUser || !emailSettings.emailPassword) {
      return res.status(400).json({ error: "Email not configured. Please configure email settings first." });
    }

    // Get email template from database
    let emailTemplate = await EmailTemplateModel.findOne({});
    if (!emailTemplate) {
      // Use default template if none exists
      emailTemplate = {
        subject: "Payment Reminder - Outstanding Balance",
        htmlTemplate: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Payment Reminder - Outstanding Balance
  </h2>
  <p>Dear {{member_name}},</p>
  <p>This is a friendly reminder about your outstanding subscription payments.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Member ID:</strong> {{member_id}}</p>
    <p><strong>Email:</strong> {{member_email}}</p>
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">\${{total_due}}</span></p>
  </div>
  <h3 style="color: #333;">Outstanding Invoices ({{invoice_count}}):</h3>
  <ul style="list-style: none; padding: 0;">
    {{invoice_list}}
  </ul>
  <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>💳 Payment Methods Available:</strong></p>
    <ul>
      {{payment_methods}}
    </ul>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{portal_link}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Access Member Portal
    </a>
  </p>
  <p>Please settle your outstanding balance at your earliest convenience.</p>
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
</div>`,
      };
    }

    // Replace template variables
    const portalLinkFinal = portalLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/member`;
    const paymentMethodsHTML = paymentMethods || `<li>FPS: Available in member portal</li>
    <li>PayMe: Available in member portal</li>
    <li>Bank Transfer: Available in member portal</li>
    <li>Credit Card: Pay instantly online</li>`;

    let emailHTML = emailTemplate.htmlTemplate
      .replace(/\{\{member_name\}\}/g, toName)
      .replace(/\{\{member_id\}\}/g, memberId || 'N/A')
      .replace(/\{\{member_email\}\}/g, toEmail)
      .replace(/\{\{total_due\}\}/g, totalDue)
      .replace(/\{\{invoice_count\}\}/g, invoiceCount)
      .replace(/\{\{invoice_list\}\}/g, invoiceListHTML || invoiceListText || 'No invoices')
      .replace(/\{\{payment_methods\}\}/g, paymentMethodsHTML)
      .replace(/\{\{portal_link\}\}/g, portalLinkFinal);

    // Replace placeholders in subject
    let emailSubject = emailTemplate.subject
      .replace(/\{\{member_name\}\}/g, toName)
      .replace(/\{\{total_due\}\}/g, totalDue)
      .replace(/\{\{invoice_count\}\}/g, invoiceCount);

    // Create transporter with saved settings
    const invoiceTransporter = nodemailer.createTransport({
      service: emailSettings.emailService || 'gmail',
      auth: {
        user: emailSettings.emailUser,
        pass: emailSettings.emailPassword,
      },
    });

    // Prepare unique subject with date to prevent threading
    const uniqueSubject = `${emailSubject} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    // Send email
    await invoiceTransporter.sendMail({
      from: `"Subscription Manager HK" <${emailSettings.emailUser}>`,
      to: toEmail,
      subject: uniqueSubject,
      html: emailHTML,
      text: `Dear ${toName},\n\nThis is a friendly reminder about your outstanding subscription payments.\n\nMember ID: ${memberId || 'N/A'}\nTotal Outstanding: ${totalDue}\n\nOutstanding Invoices (${invoiceCount}):\n${invoiceListText || 'N/A'}\n\nPayment Methods: ${paymentMethods || 'Available in member portal'}\n\nAccess Member Portal: ${portalLinkFinal}\n\nPlease settle your outstanding balance at your earliest convenience.\n\nBest regards,\nFinance Team\nSubscription Manager HK`,
      // Add unique headers to prevent email threading
      messageId: generateUniqueMessageId(),
      headers: {
        'X-Entity-Ref-ID': `${memberId || 'invoice'}-${Date.now()}`,
        'In-Reply-To': undefined,
        'References': undefined,
        'Thread-Topic': undefined,
        'Thread-Index': undefined,
      },
    });

    console.log(`✓ Invoice reminder email sent to ${toEmail}`);

    res.json({ 
      success: true, 
      message: `Email sent successfully to ${toEmail}` 
    });
  } catch (error) {
    console.error("Error sending invoice reminder email:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to view reminder logs
app.get("/api/reminders/logs", async (req, res) => {
  try {
    await ensureConnection();
    const logs = await ReminderLogModel.find({})
      .sort({ sentAt: -1 })
      .limit(100);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching reminder logs:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== EMAIL SETTINGS ENDPOINTS ==========

// Email Settings Schema
const EmailSettingsSchema = new mongoose.Schema({
  emailService: { type: String, default: "gmail" },
  emailUser: String,
  emailPassword: { type: String, default: "kuil uhbe zlqq oymd" },
  scheduleTime: { type: String, default: "09:00" },
  automationEnabled: { type: Boolean, default: true },
  reminderInterval: { type: Number, default: 7 },
}, {
  timestamps: true
});

const EmailSettingsModel = mongoose.model("emailsettings", EmailSettingsSchema);

// GET email settings
app.get("/api/email-settings", async (req, res) => {
  try {
    await ensureConnection();
    let settings = await EmailSettingsModel.findOne({});
    if (!settings) {
      // Create default settings
      settings = new EmailSettingsModel({
        emailService: "gmail",
        scheduleTime: "09:00",
        automationEnabled: true,
        reminderInterval: 7,
        emailPassword: "kuil uhbe zlqq oymd",
      });
      await settings.save();
    }
    // Return password so it persists in UI
    const response = settings.toObject();
    res.json(response);
  } catch (error) {
    console.error("Error fetching email settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST/PUT email settings
app.post("/api/email-settings", async (req, res) => {
  try {
    await ensureConnection();
    let settings = await EmailSettingsModel.findOne({});
    
    if (settings) {
      // Save OLD values BEFORE updating (to detect changes)
      const oldScheduleTime = settings.scheduleTime;
      const oldAutomationEnabled = settings.automationEnabled;
      
      // Update existing
      settings.emailService = req.body.emailService || settings.emailService;
      settings.emailUser = req.body.emailUser || settings.emailUser;
      settings.emailPassword = req.body.emailPassword || settings.emailPassword;
      settings.scheduleTime = req.body.scheduleTime || settings.scheduleTime;
      settings.automationEnabled = req.body.automationEnabled !== undefined ? req.body.automationEnabled : settings.automationEnabled;
      settings.reminderInterval = req.body.reminderInterval || settings.reminderInterval;
      await settings.save();

      // Update transporter with new settings
      if (settings.emailUser && settings.emailPassword) {
        transporter = nodemailer.createTransport({
          service: settings.emailService || 'gmail',
          auth: {
            user: settings.emailUser,
            pass: settings.emailPassword,
          },
        });
        console.log("✓ Email transporter updated with new settings");
      }

      // Reschedule cron job if schedule time or automation status changed
      const scheduleTimeChanged = req.body.scheduleTime && req.body.scheduleTime !== oldScheduleTime;
      const automationChanged = req.body.automationEnabled !== undefined && req.body.automationEnabled !== oldAutomationEnabled;
      
      if (scheduleTimeChanged || automationChanged) {
        console.log('🔄 Settings changed - rescheduling cron job...');
        if (scheduleTimeChanged) {
          console.log(`🔍 Schedule time changed: ${oldScheduleTime} → ${req.body.scheduleTime}`);
        }
        if (automationChanged) {
          console.log(`🔍 Automation status changed: ${oldAutomationEnabled} → ${req.body.automationEnabled}`);
        }
        await scheduleReminderCron();
        console.log('✅ Cron job rescheduled successfully');
      } else {
        // Always reschedule to ensure cron job is up to date (even if no change detected)
        console.log('🔄 Rescheduling cron job to ensure it\'s up to date...');
        await scheduleReminderCron();
      }
    } else {
      // Create new
      const newSettingsData = {
        ...req.body,
        emailPassword: req.body.emailPassword || "kuil uhbe zlqq oymd",
      };
      settings = new EmailSettingsModel(newSettingsData);
      await settings.save();
      
      // Update transporter with new settings
      if (settings.emailUser && settings.emailPassword) {
        transporter = nodemailer.createTransport({
          service: settings.emailService || 'gmail',
          auth: {
            user: settings.emailUser,
            pass: settings.emailPassword,
          },
        });
        console.log("✓ Email transporter updated with new settings");
      }
      
      // Schedule cron job for new settings
      console.log('🔄 Scheduling cron job for new email settings...');
      await scheduleReminderCron();
      console.log('✅ Cron job scheduled successfully');
    }

    // Return password so it persists in UI
    const response = settings.toObject();
    res.json(response);
  } catch (error) {
    console.error("Error saving email settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST test email
app.post("/api/email-settings/test", async (req, res) => {
  try {
    const { emailService, emailUser, emailPassword, testEmail } = req.body;
    
    if (!emailUser || !emailPassword) {
      return res.status(400).json({ error: "Email credentials required" });
    }

    // Create temporary transporter for testing
    const testTransporter = nodemailer.createTransport({
      service: emailService || 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    // Add date to test email subject to make it unique
    const testSubject = `Test Email - Email Configuration - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    await testTransporter.sendMail({
      from: `"Subscription Manager HK" <${emailUser}>`,
      to: testEmail || emailUser,
      subject: testSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">✅ Email Configuration Test</h2>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p>If you received this email, your email settings are configured properly!</p>
          <p>Best regards,<br><strong>Subscription Manager HK</strong></p>
        </div>
      `,
      text: "This is a test email to verify your email configuration is working correctly.",
      // Add unique headers to prevent email threading
      messageId: generateUniqueMessageId(),
      headers: {
        'X-Entity-Ref-ID': `test-${Date.now()}`,
        'In-Reply-To': undefined,
        'References': undefined,
        'Thread-Topic': undefined,
        'Thread-Index': undefined,
      },
    });

    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: error.message || "Failed to send test email" });
  }
});

// ========== EMAIL TEMPLATE ENDPOINTS ==========

// GET email template
app.get("/api/email-template", async (req, res) => {
  try {
    await ensureConnection();
    let template = await EmailTemplateModel.findOne({});
    if (!template) {
      // Create default template
      template = new EmailTemplateModel({
        subject: "Payment Reminder - Outstanding Balance",
        htmlTemplate: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Payment Reminder - Outstanding Balance
  </h2>
  <p>Dear {{member_name}},</p>
  <p>This is a friendly reminder about your outstanding subscription payments.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Member ID:</strong> {{member_id}}</p>
    <p><strong>Email:</strong> {{member_email}}</p>
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">${{total_due}}</span></p>
  </div>
  <h3 style="color: #333;">Outstanding Invoices ({{invoice_count}}):</h3>
  <ul style="list-style: none; padding: 0;">
    {{invoice_list}}
  </ul>
  <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>💳 Payment Methods Available:</strong></p>
    <ul>
      {{payment_methods}}
    </ul>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{portal_link}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Access Member Portal
    </a>
  </p>
  <p>Please settle your outstanding balance at your earliest convenience.</p>
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
</div>`,
      });
      await template.save();
    }
    res.json(template);
  } catch (error) {
    console.error("Error fetching email template:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST email template
app.post("/api/email-template", async (req, res) => {
  try {
    await ensureConnection();
    let template = await EmailTemplateModel.findOne({});
    
    if (template) {
      // Update existing
      template.subject = req.body.subject || template.subject;
      template.htmlTemplate = req.body.htmlTemplate || template.htmlTemplate;
      await template.save();
    } else {
      // Create new
      template = new EmailTemplateModel(req.body);
      await template.save();
    }

    res.json(template);
  } catch (error) {
    console.error("Error saving email template:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PAYMENT METHODS ENDPOINTS ==========

// GET all payment methods
app.get("/api/payment-methods", async (req, res) => {
  try {
    await ensureConnection();
    const paymentMethods = await PaymentMethodModel.find({}).sort({ name: 1 });
    res.json(paymentMethods);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET single payment method by name
app.get("/api/payment-methods/:name", async (req, res) => {
  try {
    await ensureConnection();
    const method = await PaymentMethodModel.findOne({ name: req.params.name });
    if (!method) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    res.json(method);
  } catch (error) {
    console.error("Error fetching payment method:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create or update payment method
app.post("/api/payment-methods", async (req, res) => {
  try {
    await ensureConnection();
    const { name, visible, qrImageUrl, details } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Payment method name is required" });
    }

    // Find existing or create new
    let method = await PaymentMethodModel.findOne({ name });
    
    if (method) {
      // Update existing
      if (visible !== undefined) method.visible = visible;
      if (qrImageUrl !== undefined) method.qrImageUrl = qrImageUrl;
      if (details !== undefined) method.details = details;
      await method.save();
    } else {
      // Create new
      method = new PaymentMethodModel({
        name,
        visible: visible !== undefined ? visible : true,
        qrImageUrl: qrImageUrl || "",
        details: details || [],
      });
      await method.save();
    }

    res.json(method);
  } catch (error) {
    console.error("Error saving payment method:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Payment method already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update payment method
app.put("/api/payment-methods/:name", async (req, res) => {
  try {
    await ensureConnection();
    const method = await PaymentMethodModel.findOneAndUpdate(
      { name: req.params.name },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    
    res.json(method);
  } catch (error) {
    console.error("Error updating payment method:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== INVOICE GENERATION ENDPOINTS ==========

// POST endpoint to manually trigger invoice generation
app.post("/api/invoices/generate", async (req, res) => {
  try {
    await ensureConnection();
    const result = await generateSubscriptionInvoices();
    res.json({ 
      success: true, 
      message: `Invoice generation completed: ${result.created} created, ${result.skipped} skipped`,
      result 
    });
  } catch (error) {
    console.error("Error in manual invoice generation:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== INVOICE GENERATION ENDPOINTS ==========

// POST endpoint to manually trigger invoice generation
app.post("/api/invoices/generate", async (req, res) => {
  try {
    await ensureConnection();
    const result = await generateSubscriptionInvoices();
    res.json({ 
      success: true, 
      message: `Invoice generation completed: ${result.created} created, ${result.skipped} skipped`,
      result 
    });
  } catch (error) {
    console.error("Error in manual invoice generation:", error);
    res.status(500).json({ error: error.message });
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
    console.log(`  - POST   /api/reminders/check`);
    console.log(`  - POST   /api/reminders/send`);
    console.log(`  - POST   /api/reminders/test-now`);
    console.log(`  - GET    /api/reminders/logs`);
    console.log(`  - POST   /api/invoices/send-reminder`);
    console.log(`  - POST   /api/upload-screenshot`);
    console.log(`  - GET    /api/email-settings`);
    console.log(`  - POST   /api/email-settings`);
    console.log(`  - POST   /api/email-settings/test`);
    console.log(`  - GET    /api/email-template`);
    console.log(`  - POST   /api/email-template`);
    console.log(`  - GET    /api/donations`);
    console.log(`  - POST   /api/donations`);
    console.log(`  - DELETE /api/donations/:id`);
    
    // Initialize all member balances on server start
    await initializeAllMemberBalances();
    
    // Schedule automated reminders dynamically based on database settings
    await scheduleReminderCron();
    
    // Verify cron job was scheduled
    console.log('🔍 Cron job verification:', reminderCronJob ? '✅ SCHEDULED' : '❌ NOT SCHEDULED');
    if (reminderCronJob) {
      console.log('🔍 Cron job running:', reminderCronJob.running ? '✅ YES' : '❌ NO');
    }
    
    // Optional: Run immediately on startup for testing (uncomment to enable)
    console.log('🔄 Running initial reminder check for testing...');
    try {
      await checkAndSendReminders();
      console.log('✅ Initial test reminder check completed');
    } catch (error) {
      console.error('❌ Error in initial test reminder check:', error);
    }
  });
}












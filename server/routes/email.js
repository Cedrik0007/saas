import express from "express";
import { ensureConnection } from "../config/database.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import { generateUniqueMessageId, setTransporter, createEmailTransporter } from "../config/email.js";
import { scheduleReminderCron } from "../utils/cron.js";
import nodemailer from "nodemailer";

const router = express.Router();

// GET email settings
router.get("/", async (req, res) => {
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
router.post("/", async (req, res) => {
  try {
    await ensureConnection();
    let settings = await EmailSettingsModel.findOne({});
    
    if (settings) {
      // Save OLD values BEFORE updating (to detect changes)
      const oldScheduleTime = settings.scheduleTime;
      const oldAutomationEnabled = settings.automationEnabled;
      
      // Update existing
      settings.emailService = req.body.emailService || settings.emailService;
      // Only update emailUser if provided (don't overwrite with undefined)
      if (req.body.emailUser !== undefined) {
        settings.emailUser = req.body.emailUser;
      }
      // Preserve password exactly as provided (don't trim - Gmail App-Specific Passwords may have spaces)
      if (req.body.emailPassword !== undefined) {
        settings.emailPassword = req.body.emailPassword;
      }
      settings.scheduleTime = req.body.scheduleTime || settings.scheduleTime;
      settings.automationEnabled = req.body.automationEnabled !== undefined ? req.body.automationEnabled : settings.automationEnabled;
      settings.reminderInterval = req.body.reminderInterval || settings.reminderInterval;
      await settings.save();

      // Update transporter with new settings immediately
      const hasEmailUser = settings.emailUser && String(settings.emailUser).trim() !== '';
      const hasEmailPassword = settings.emailPassword && String(settings.emailPassword).trim() !== '';
      
      if (hasEmailUser && hasEmailPassword) {
        console.log("📧 Updating email transporter with new settings...");
        console.log(`   Email User: ${settings.emailUser}`);
        console.log(`   Email Service: ${settings.emailService || 'gmail'}`);
        console.log(`   Password length: ${String(settings.emailPassword).length} characters`);
        try {
        const transporter = createEmailTransporter(
          settings.emailUser,
          settings.emailPassword,
          settings.emailService || 'gmail'
        );
        setTransporter(transporter);
        console.log("✓ Email transporter updated with new settings");
          
          // Verify in background (non-blocking)
          const { verifyEmailTransporter } = await import("../config/email.js");
          verifyEmailTransporter(transporter).then((verified) => {
            if (verified) {
              console.log("✓ Email transporter verified successfully");
            } else {
              console.warn("⚠️ Email transporter verification failed, but will still attempt to send emails");
            }
          }).catch((verifyError) => {
            console.warn("⚠️ Email transporter verification error (non-blocking):", verifyError.message);
          });
        } catch (transporterError) {
          console.error("❌ Error creating email transporter:", transporterError);
          console.error("   Error details:", {
            message: transporterError.message,
            code: transporterError.code,
            stack: transporterError.stack,
          });
          console.error("   Common causes:");
          console.error("     1. Invalid email credentials");
          console.error("     2. For Gmail: Need App-Specific Password (not regular password)");
          console.error("     3. Network/firewall blocking SMTP connection");
        }
      } else {
        console.warn("⚠️ Email settings incomplete - transporter not updated");
        console.warn(`   Email User: ${hasEmailUser ? '✓ Set' : '✗ Missing or empty'}`);
        console.warn(`   Email Password: ${hasEmailPassword ? '✓ Set' : '✗ Missing or empty'}`);
        if (!hasEmailUser || !hasEmailPassword) {
          console.warn("   → Please provide both emailUser and emailPassword to enable email sending");
        }
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
      
      // Update transporter with new settings immediately
      if (settings.emailUser && settings.emailPassword) {
        console.log("📧 Updating email transporter with new settings...");
        console.log(`   Email User: ${settings.emailUser}`);
        console.log(`   Email Service: ${settings.emailService || 'gmail'}`);
        try {
        const transporter = createEmailTransporter(
          settings.emailUser,
          settings.emailPassword,
          settings.emailService || 'gmail'
        );
        setTransporter(transporter);
        console.log("✓ Email transporter updated with new settings");
          
          // Verify in background (non-blocking)
          const { verifyEmailTransporter } = await import("../config/email.js");
          verifyEmailTransporter(transporter).then((verified) => {
            if (verified) {
              console.log("✓ Email transporter verified successfully");
            } else {
              console.warn("⚠️ Email transporter verification failed, but will still attempt to send emails");
            }
          }).catch((verifyError) => {
            console.warn("⚠️ Email transporter verification error (non-blocking):", verifyError.message);
          });
        } catch (transporterError) {
          console.error("❌ Error creating email transporter:", transporterError);
          console.error("   Error details:", {
            message: transporterError.message,
            code: transporterError.code,
          });
        }
      } else {
        console.warn("⚠️ Email settings incomplete - transporter not updated");
        console.warn(`   Email User: ${settings.emailUser ? 'Set' : 'Missing'}`);
        console.warn(`   Email Password: ${settings.emailPassword ? 'Set' : 'Missing'}`);
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
router.post("/test", async (req, res) => {
  try {
    const { emailService, emailUser, emailPassword, testEmail } = req.body;
    
    if (!emailUser || !emailPassword) {
      return res.status(400).json({ error: "Email credentials required" });
    }

    // Create temporary transporter for testing (use same config as production)
    const { createEmailTransporter } = await import("../config/email.js");
    const testTransporter = createEmailTransporter(
      emailUser,
      emailPassword,
      emailService || 'gmail'
    );

    // Add date to test email subject to make it unique
    const testSubject = `Test Email - Email Configuration - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    await testTransporter.sendMail({
      from: `"IMA Subscription Manager" <${emailUser}>`,
      to: testEmail || emailUser,
      subject: testSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">✅ Email Configuration Test</h2>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p>If you received this email, your email settings are configured properly!</p>
          <p>Best regards,<br><strong>IMA Subscription Manager</strong></p>
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
    
    let errorMessage = error.message || "Failed to send test email";
    let errorDetails = "Please check your email configuration.";
    
    if (error.code === 'EAUTH') {
      errorMessage = "Gmail authentication failed. Please use an App-Specific Password.";
      errorDetails = "For Gmail, you must:\n1. Enable 2-Step Verification in your Google Account\n2. Generate an App-Specific Password at https://myaccount.google.com/apppasswords\n3. Use that 16-character password (not your regular password) in the email settings.";
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = "Email connection failed. SMTP may be blocked.";
      errorDetails = "Connection to email server failed. This may be due to network restrictions or cloud platform limitations.";
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      code: error.code || 'UNKNOWN'
    });
  }
});

// GET email template
router.get("/template", async (req, res) => {
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
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">HK${{total_due}}</span></p>
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
  <p>Best regards,<br><strong>Finance Team</strong><br>IMA Subscription Manager</p>
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
router.post("/template", async (req, res) => {
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

// POST one-time email setup (for quick configuration)
router.post("/setup", async (req, res) => {
  try {
    await ensureConnection();
    
    const { emailUser, emailPassword, emailService } = req.body;
    
    if (!emailUser || !emailPassword) {
      return res.status(400).json({ 
        error: "Email user and password are required",
        example: {
          emailUser: "your-email@gmail.com",
          emailPassword: "your-app-specific-password",
          emailService: "gmail"
        }
      });
    }
    
    let settings = await EmailSettingsModel.findOne({});
    
    if (settings) {
      settings.emailUser = emailUser;
      settings.emailPassword = emailPassword;
      settings.emailService = emailService || 'gmail';
      await settings.save();
    } else {
      settings = new EmailSettingsModel({
        emailUser,
        emailPassword,
        emailService: emailService || 'gmail',
        scheduleTime: "09:00",
        automationEnabled: true,
        reminderInterval: 7,
      });
      await settings.save();
    }
    
    // Update transporter immediately
    console.log("📧 Setting up email transporter...");
    console.log(`   Email User: ${emailUser}`);
    console.log(`   Email Service: ${emailService || 'gmail'}`);
    
    try {
      const transporter = createEmailTransporter(
        emailUser,
        emailPassword,
        emailService || 'gmail'
      );
      setTransporter(transporter);
      console.log("✓ Email transporter created and set");
      
      // Test the connection
      const { verifyEmailTransporter } = await import("../config/email.js");
      const verified = await verifyEmailTransporter(transporter);
      
      if (verified) {
        console.log("✅ Email transporter verified successfully");
        res.json({
          success: true,
          message: "Email settings configured and verified successfully",
          emailUser: emailUser,
          emailService: emailService || 'gmail'
        });
      } else {
        console.warn("⚠️ Email transporter verification failed, but settings are saved");
        res.json({
          success: true,
          warning: true,
          message: "Email settings saved, but verification failed. Emails may still work.",
          emailUser: emailUser,
          emailService: emailService || 'gmail',
          note: "Verification failures are common on cloud platforms. Try sending a test email."
        });
      }
    } catch (transporterError) {
      console.error("❌ Error creating email transporter:", transporterError);
      res.status(500).json({
        error: "Failed to create email transporter",
        details: transporterError.message,
        code: transporterError.code
      });
    }
  } catch (error) {
    console.error("Error setting up email:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


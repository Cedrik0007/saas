import express from "express";
import { ensureConnection } from "../config/database.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import { generateUniqueMessageId } from "../config/email.js";
import { setTransporter } from "../config/email.js";
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
      settings.emailUser = req.body.emailUser || settings.emailUser;
      settings.emailPassword = req.body.emailPassword || settings.emailPassword;
      settings.scheduleTime = req.body.scheduleTime || settings.scheduleTime;
      settings.automationEnabled = req.body.automationEnabled !== undefined ? req.body.automationEnabled : settings.automationEnabled;
      settings.reminderInterval = req.body.reminderInterval || settings.reminderInterval;
      await settings.save();

      // Update transporter with new settings
      if (settings.emailUser && settings.emailPassword) {
        const transporter = nodemailer.createTransport({
          service: settings.emailService || 'gmail',
          auth: {
            user: settings.emailUser,
            pass: settings.emailPassword,
          },
        });
        setTransporter(transporter);
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
        const transporter = nodemailer.createTransport({
          service: settings.emailService || 'gmail',
          auth: {
            user: settings.emailUser,
            pass: settings.emailPassword,
          },
        });
        setTransporter(transporter);
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
router.post("/test", async (req, res) => {
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

export default router;


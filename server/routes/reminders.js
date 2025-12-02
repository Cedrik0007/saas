import express from "express";
import { ensureConnection } from "../config/database.js";
import { checkAndSendReminders } from "../services/reminderService.js";
import { sendReminderEmail } from "../utils/emailHelpers.js";
import { setTransporter } from "../config/email.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import ReminderLogModel from "../models/ReminderLog.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import nodemailer from "nodemailer";

const router = express.Router();

// POST endpoint to trigger reminder check manually
router.post("/check", async (req, res) => {
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
router.post("/test-now", async (req, res) => {
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
router.post("/send", async (req, res) => {
  try {
    await ensureConnection();
    
    const { memberId, sendToAll } = req.body;
    
    // Check if email is configured
    const emailSettings = await EmailSettingsModel.findOne({});
    if (!emailSettings || !emailSettings.emailUser || !emailSettings.emailPassword) {
      return res.status(400).json({ error: "Email not configured. Please configure email settings first." });
    }

    // Update transporter with saved settings
    const transporter = nodemailer.createTransport({
      service: emailSettings.emailService || 'gmail',
      auth: {
        user: emailSettings.emailUser,
        pass: emailSettings.emailPassword,
      },
    });
    setTransporter(transporter);

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

// GET endpoint to view reminder logs
router.get("/logs", async (req, res) => {
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

export default router;


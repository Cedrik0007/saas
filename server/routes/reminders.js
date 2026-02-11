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
const objectIdRegex = /^[a-f\d]{24}$/i;

const normalizeMemberId = (rawMemberId = "") =>
  typeof rawMemberId === "string" ? rawMemberId.trim() : "";

const assertValidMemberId = (value, contextLabel = "memberId") => {
  const normalized = normalizeMemberId(value);
  if (!normalized) {
    const error = new Error(`${contextLabel} is required and must be a non-empty string`);
    error.status = 400;
    throw error;
  }
  if (objectIdRegex.test(normalized)) {
    const error = new Error(`${contextLabel} must be the business identifier (e.g., IMA1234), not the Mongo _id`);
    error.status = 400;
    throw error;
  }
  return normalized;
};

const findMemberOrThrow = async (memberId) => {
  const normalized = normalizeMemberId(memberId);
  const member = objectIdRegex.test(normalized)
    ? await UserModel.findById(normalized)
    : await UserModel.findOne({
        $or: [
          { id: normalized },
          { "previousDisplayIds.id": normalized },
        ],
      });
  if (!member) {
    const error = new Error(`Member with ID "${memberId}" not found.`);
    error.status = 404;
    throw error;
  }
  return member;
};

const buildInvoiceMemberMatch = (member) => {
  const previousIds = Array.isArray(member?.previousDisplayIds)
    ? member.previousDisplayIds.map((entry) => entry?.id).filter(Boolean)
    : [];
  const memberIdCandidates = [member?.id, ...previousIds].filter(Boolean).map(String);

  return {
    $or: [
      member?._id ? { memberRef: member._id } : null,
      member?.memberNo ? { memberNo: member.memberNo } : null,
      memberIdCandidates.length > 0 ? { memberId: { $in: memberIdCandidates } } : null,
    ].filter(Boolean),
  };
};

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
    
    const { memberId: rawMemberId, sendToAll, channel = "Email" } = req.body;
    let normalizedRequestMemberId = null;

    if (!sendToAll && rawMemberId) {
      try {
        normalizedRequestMemberId = assertValidMemberId(rawMemberId);
      } catch (validationError) {
        return res.status(validationError.status || 400).json({ error: validationError.message });
      }
    }
    
    // Check if email is configured (only for Email channel)
    if (channel === "Email") {
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
    }

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
          ...buildInvoiceMemberMatch(member),
          status: { $in: ['Unpaid', 'Overdue'] }
        });

        if (unpaidInvoices.length === 0) {
          results.skipped++;
          continue;
        }

        const totalDue = unpaidInvoices.reduce((sum, inv) => {
          // Handle both "$" and "HK$" formats
          return sum + parseFloat(inv.amount.replace(/HK\$|\$/g, '').replace(',', '')) || 0;
        }, 0);

        const sent = await sendReminderEmail(member, unpaidInvoices, totalDue);
        
        if (sent) {
          await ReminderLogModel.create({
            memberId: member.id,
            memberEmail: member.email,
            sentAt: new Date(),
            reminderType: unpaidInvoices.some(inv => inv.status === 'Overdue') ? 'overdue' : 'upcoming',
            amount: `HK$${totalDue}`,
            invoiceCount: unpaidInvoices.length,
            status: "Delivered",
            channel: channel,
          });
          results.sent++;
        } else {
          // Log failed reminder attempt
          await ReminderLogModel.create({
            memberId: member.id,
            memberEmail: member.email,
            sentAt: new Date(),
            reminderType: unpaidInvoices.some(inv => inv.status === 'Overdue') ? 'overdue' : 'upcoming',
            amount: `HK$${totalDue}`,
            invoiceCount: unpaidInvoices.length,
            status: "Failed",
            channel: channel,
          });
          results.failed++;
        }
      }
    } else if (normalizedRequestMemberId) {
      // Send to specific member
      let member;
      try {
        member = await findMemberOrThrow(normalizedRequestMemberId);
      } catch (memberError) {
        return res.status(memberError.status || 404).json({ error: memberError.message });
      }

      const unpaidInvoices = await InvoiceModel.find({
        ...buildInvoiceMemberMatch(member),
        status: { $in: ['Unpaid', 'Overdue'] }
      });

      if (unpaidInvoices.length === 0) {
        return res.status(400).json({ error: "This member has no outstanding invoices" });
      }

      const totalDue = unpaidInvoices.reduce((sum, inv) => {
        // Handle both "$" and "HK$" formats
        return sum + parseFloat(inv.amount.replace(/HK\$|\$/g, '').replace(',', '')) || 0;
      }, 0);

      const sent = await sendReminderEmail(member, unpaidInvoices, totalDue);
      
      if (sent) {
        await ReminderLogModel.create({
          memberId: member.id,
          memberEmail: member.email,
          sentAt: new Date(),
          reminderType: unpaidInvoices.some(inv => inv.status === 'Overdue') ? 'overdue' : 'upcoming',
          amount: `HK$${totalDue}`,
          invoiceCount: unpaidInvoices.length,
          status: "Delivered",
          channel: channel,
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

// POST endpoint to create a reminder log
router.post("/log", async (req, res) => {
  try {
    await ensureConnection();
    
    const {
      memberId,
      memberEmail,
      reminderType,
      amount,
      invoiceCount,
      status,
      channel
    } = req.body;

    let normalizedMemberId;
    try {
      normalizedMemberId = assertValidMemberId(memberId);
    } catch (validationError) {
      return res.status(validationError.status || 400).json({ error: validationError.message });
    }

    let memberRecord;
    try {
      memberRecord = await findMemberOrThrow(normalizedMemberId);
    } catch (memberError) {
      return res.status(memberError.status || 404).json({ error: memberError.message });
    }

    const resolvedMemberEmail = memberRecord.email || memberEmail || "";

    const reminderLog = await ReminderLogModel.create({
      memberId: normalizedMemberId,
      memberEmail: resolvedMemberEmail,
      sentAt: new Date(),
      reminderType: reminderType || 'upcoming',
      amount: amount || 'HK$0',
      invoiceCount: invoiceCount || 0,
      status: status || "Delivered",
      channel: channel || "WhatsApp"
    });

    console.log(`✓ Reminder log saved to database for ${memberEmail}`);
    
    res.json({
      success: true,
      message: "Reminder log created successfully",
      reminderLog
    });
  } catch (error) {
    console.error("Error creating reminder log:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to retry a failed reminder
router.post("/retry", async (req, res) => {
  try {
    await ensureConnection();
    const { reminderId } = req.body;
    
    if (!reminderId) {
      return res.status(400).json({ error: "reminderId is required" });
    }

    // Find the reminder log
    const reminderLog = await ReminderLogModel.findById(reminderId);
    if (!reminderLog) {
      return res.status(404).json({ error: "Reminder log not found" });
    }

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

    // Find the member
    const member = await UserModel.findOne({
      $or: [
        { id: reminderLog.memberId },
        { "previousDisplayIds.id": reminderLog.memberId },
      ],
    });
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Find unpaid invoices
    const unpaidInvoices = await InvoiceModel.find({
      ...buildInvoiceMemberMatch(member),
      status: { $in: ['Unpaid', 'Overdue'] }
    });

    if (unpaidInvoices.length === 0) {
      return res.status(400).json({ error: "This member has no outstanding invoices" });
    }

    const totalDue = unpaidInvoices.reduce((sum, inv) => {
      return sum + parseFloat(inv.amount.replace(/HK\$|\$/g, '').replace(',', '')) || 0;
    }, 0);

    // Send the reminder email
    const sent = await sendReminderEmail(member, unpaidInvoices, totalDue);
    
    if (sent) {
      // Update the reminder log status
      reminderLog.status = "Delivered";
      reminderLog.sentAt = new Date();
      await reminderLog.save();
      
      res.json({ 
        success: true, 
        message: "Reminder retried successfully" 
      });
    } else {
      // Update the reminder log status to failed
      reminderLog.status = "Failed";
      await reminderLog.save();
      
      res.status(500).json({ error: "Failed to send email" });
    }
  } catch (error) {
    console.error("Error retrying reminder:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE endpoint to delete a reminder log
router.delete("/logs/:id", async (req, res) => {
  try {
    await ensureConnection();
    const { id } = req.params;
    
    const deletedLog = await ReminderLogModel.findByIdAndDelete(id);
    
    if (!deletedLog) {
      return res.status(404).json({ error: "Reminder log not found" });
    }
    
    res.json({ 
      success: true, 
      message: "Reminder log deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting reminder log:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


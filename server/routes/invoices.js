import express from "express";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import PaymentModel from "../models/Payment.js";
import ReminderLogModel from "../models/ReminderLog.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { generateSubscriptionInvoices } from "../services/invoiceService.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import { generateUniqueMessageId, createEmailTransporter } from "../config/email.js";
import { sendPaymentApprovalEmail } from "../utils/emailHelpers.js";
import nodemailer from "nodemailer";

const router = express.Router();

// GET all invoices
router.get("/", async (req, res) => {
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
router.get("/member/:memberId", async (req, res) => {
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
router.post("/", async (req, res) => {
  try {
    await ensureConnection();

    // Check for existing invoice for the same member and period (prevent duplicates)
    const existingInvoice = await InvoiceModel.findOne({
      memberId: req.body.memberId,
      period: req.body.period,
      status: { $ne: "Rejected" } // Allow re-creating only if previous one was rejected
    });

    if (existingInvoice) {
      return res.status(400).json({
        error: `An invoice for period "${req.body.period}" already exists for this member.`
      });
    }

    // Ensure 'due' field is always set at invoice creation
    // If not provided, calculate it based on period or default to 1 year from now
    let dueDate = req.body.due;
    if (!dueDate) {
      // Try to extract year from period if available
      const periodStr = String(req.body.period || "").trim();
      const yearMatch = periodStr.match(/\d{4}/);
      if (yearMatch) {
        const dueYear = parseInt(yearMatch[0]) + 1;
        const dueDateObj = new Date(dueYear, 0, 1); // Jan 1st of next year
        dueDate = dueDateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }).replace(',', '');
      } else {
        // Default to 1 year from now
        const defaultDueDate = new Date();
        defaultDueDate.setFullYear(defaultDueDate.getFullYear() + 1);
        dueDate = defaultDueDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }).replace(',', '');
      }
    }

    const invoiceData = {
      id: `INV-2025-${Math.floor(100 + Math.random() * 900)}`,
      ...req.body,
      due: dueDate, // Always set due date at creation
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

// POST endpoint to manually trigger invoice generation
router.post("/generate", async (req, res) => {
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

// POST send invoice reminder email (for invoice creation and manual sending)
router.post("/send-reminder", async (req, res) => {
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
          <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">HK\${{total_due}}</span></p>
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

    // Convert $ to HK$ in invoice lists if needed (safety check)
    let finalInvoiceListHTML = invoiceListHTML || invoiceListText || '';
    let finalInvoiceListText = invoiceListText || '';

    // Replace $ with HK$ in invoice lists (handle both HTML and text)
    if (finalInvoiceListHTML.includes('$') && !finalInvoiceListHTML.includes('HK$')) {
      finalInvoiceListHTML = finalInvoiceListHTML.replace(/\$/g, 'HK$');
    }
    if (finalInvoiceListText.includes('$') && !finalInvoiceListText.includes('HK$')) {
      finalInvoiceListText = finalInvoiceListText.replace(/\$/g, 'HK$');
    }

    // Replace template variables
    emailHTML = emailHTML
      .replace(/\{\{member_name\}\}/g, toName)
      .replace(/\{\{member_id\}\}/g, memberId || 'N/A')
      .replace(/\{\{member_email\}\}/g, toEmail)
      .replace(/\{\{total_due\}\}/g, totalDue)
      .replace(/\{\{invoice_count\}\}/g, invoiceCount)
      .replace(/\{\{invoice_list\}\}/g, finalInvoiceListHTML)
      .replace(/\{\{payment_methods\}\}/g, paymentMethods || 'Available in member portal')
      .replace(/\{\{portal_link\}\}/g, portalLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/member`);

    // Update transporter with saved settings using improved configuration
    let invoiceTransporter;
    try {
      invoiceTransporter = createEmailTransporter(
        emailSettings.emailUser,
        emailSettings.emailPassword,
        emailSettings.emailService || 'gmail'
      );
      console.log("✓ Invoice reminder email transporter created (SMTP)");
    } catch (transporterError) {
      console.error("❌ Error creating invoice reminder transporter:", transporterError);
      return res.status(500).json({ 
        error: "Failed to initialize email transporter",
        details: transporterError.message 
      });
    }

    // Prepare unique subject with date to prevent threading
    const finalSubject = emailSubject.replace(/\{\{total_due\}\}/g, totalDue);
    const uniqueSubject = `${finalSubject} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    // Verify transporter before sending (non-blocking - try to send even if verification fails)
    let transporterVerified = false;
    try {
      // Use a timeout for verification to prevent hanging
      const verifyPromise = invoiceTransporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 15000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      transporterVerified = true;
      console.log("✓ Invoice reminder email transporter verified");
    } catch (verifyError) {
      console.warn(`⚠️ Invoice reminder email transporter verification failed (will still attempt to send):`, verifyError.message);
      if (verifyError.code === 'EAUTH') {
        console.error(`   ⚠️ Authentication failed. Make sure you're using App-Specific Password for Gmail.`);
      } else if (verifyError.code === 'ETIMEDOUT' || verifyError.message.includes('timeout')) {
        console.warn(`   ⚠️ Verification timeout (common on cloud platforms). Will attempt to send email anyway.`);
      }
      // Don't block sending - verification can fail on cloud platforms but sending might still work
    }

    // Send email (attempt even if verification failed - verification is just a check)
    let emailSent = false;
    let emailError = null;
    try {
      await invoiceTransporter.sendMail({
        from: `"Subscription Manager HK" <${emailSettings.emailUser}>`,
        to: toEmail,
        subject: uniqueSubject,
        html: emailHTML,
        text: `Dear ${toName},\n\nThis is a friendly reminder about your outstanding subscription payments.\n\nMember ID: ${memberId || 'N/A'}\nTotal Outstanding: ${totalDue}\n\nOutstanding Invoices (${invoiceCount}):\n${finalInvoiceListText || 'N/A'}\n\nPayment Methods: ${paymentMethods || 'Available in member portal'}\n\nAccess Member Portal: ${portalLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/member`}\n\nPlease settle your outstanding balance at your earliest convenience.\n\nBest regards,\nFinance Team\nSubscription Manager HK`,
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
      emailSent = true;
      console.log(`✓ Invoice reminder email sent to ${toEmail}`);
    } catch (err) {
      console.error(`❌ Failed to send email to ${toEmail}:`, err);
      console.error(`   Error details:`, {
        message: err.message,
        code: err.code,
        command: err.command,
        response: err.response,
        responseCode: err.responseCode,
      });
      
      let errorMessage = "Email could not be sent. Please check email configuration.";
      let errorDetails = "Unknown error occurred.";
      
      if (err.code === 'EAUTH') {
        console.error(`   ⚠️ Authentication failed. Common causes:`);
        console.error(`      - Using regular Gmail password instead of App-Specific Password`);
        console.error(`      - 2-Step Verification not enabled on Gmail account`);
        console.error(`      - Incorrect email or password in settings`);
        errorMessage = "Gmail authentication failed. Please use an App-Specific Password.";
        errorDetails = "For Gmail, you must:\n1. Enable 2-Step Verification\n2. Generate an App-Specific Password\n3. Use that password (not your regular password) in email settings.\n\nVisit: https://myaccount.google.com/apppasswords";
      } else if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') {
        console.error(`   ⚠️ Connection failed. This may be due to:`);
        console.error(`      - Network firewall blocking SMTP port 465`);
        console.error(`      - Cloud platform (like Render) blocking SMTP connections`);
        errorMessage = "Email connection failed. SMTP may be blocked.";
        errorDetails = "Connection to Gmail SMTP server failed. This may be due to network restrictions or cloud platform limitations.";
      }
      
      emailSent = false;
      // Store error with user-friendly messages
      emailError = {
        code: err.code,
        message: err.message,
        userMessage: errorMessage,
        userDetails: errorDetails
      };
    }

    // Save to ReminderLog database
    try {
      // Get member's unpaid invoices to determine reminder type
      const unpaidInvoices = memberId ? await InvoiceModel.find({
        memberId: memberId,
        status: { $in: ['Unpaid', 'Overdue'] }
      }) : [];

      const reminderType = unpaidInvoices.some(inv => inv.status === 'Overdue') ? 'overdue' : 'upcoming';

      await ReminderLogModel.create({
        memberId: memberId || '',
        memberEmail: toEmail,
        sentAt: new Date(),
        reminderType: reminderType,
        amount: totalDue,
        invoiceCount: invoiceCount || 0,
        status: emailSent ? "Delivered" : "Failed",
      });

      console.log(`✓ Reminder log saved to database for ${toEmail}`);
    } catch (logError) {
      console.error("Error saving reminder log:", logError);
      // Don't fail the request if logging fails, but log the error
    }

    if (emailSent) {
      res.json({
        success: true,
        message: `Email sent successfully to ${toEmail}`
      });
    } else {
      // Get the last error details if available
      const lastError = emailError || {};
      // Return 200 with warning instead of 500, so frontend can handle it gracefully
      res.status(200).json({
        success: false,
        warning: true,
        message: lastError.userMessage || "Reminder email could not be sent.",
        details: lastError.userDetails || "Email may not be configured or connection failed. Please check email settings in the admin panel or server logs.",
        errorCode: lastError.code || 'UNKNOWN'
      });
    }
  } catch (error) {
    console.error("Error sending invoice reminder email:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update invoice
router.put("/:id", async (req, res) => {
  try {
    await ensureConnection();

    const oldInvoice = await InvoiceModel.findOne({ id: req.params.id });
    if (!oldInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Protect the 'due' field - never allow it to be updated once invoice is created
    // The due date is set at invoice creation and must remain immutable
    const updateData = { ...req.body };
    delete updateData.due; // Remove 'due' from update data to prevent changes

    const updatedInvoice = await InvoiceModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Update member balance if status, amount, or memberId changed
    const statusChanged = oldInvoice.status !== updatedInvoice.status;
    const amountChanged = oldInvoice.amount !== updatedInvoice.amount;
    const memberChanged = oldInvoice.memberId !== updatedInvoice.memberId;

    // Check if invoice was marked as paid (status changed from Unpaid/Overdue to Paid)
    const wasUnpaid = oldInvoice.status === "Unpaid" || oldInvoice.status === "Overdue";
    const isNowPaid = updatedInvoice.status === "Paid";
    const markedAsPaid = statusChanged && wasUnpaid && isNowPaid;

    if (statusChanged || amountChanged || memberChanged) {
      // Always recalculate balance for the old member if:
      // - Member changed, OR
      // - Invoice was unpaid/overdue (needs recalculation when paid), OR
      // - Invoice is now unpaid/overdue (needs recalculation)
      if (oldInvoice.memberId) {
        if (memberChanged || wasUnpaid || markedAsPaid ||
          updatedInvoice.status === "Unpaid" || updatedInvoice.status === "Overdue") {
          await calculateAndUpdateMemberBalance(oldInvoice.memberId);
        }
      }

      // Recalculate balance for new member if member changed and invoice is unpaid
      if (updatedInvoice.memberId && memberChanged) {
        if (updatedInvoice.status === "Unpaid" || updatedInvoice.status === "Overdue") {
          await calculateAndUpdateMemberBalance(updatedInvoice.memberId);
        }
      }

      // If invoice was marked as paid, also recalculate for the member (in case member didn't change)
      if (markedAsPaid && updatedInvoice.memberId) {
        await calculateAndUpdateMemberBalance(updatedInvoice.memberId);
      }
    }

    res.json(updatedInvoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE invoice
router.delete("/:id", async (req, res) => {
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

// POST send payment confirmation email with PDF receipt
router.post("/:id/send-payment-confirmation", async (req, res) => {
  try {
    await ensureConnection();

    const invoice = await InvoiceModel.findOne({ id: req.params.id });
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status !== "Paid") {
      return res.status(400).json({ message: "Invoice is not marked as paid" });
    }

    const member = await UserModel.findOne({ id: invoice.memberId });
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Find the most recent payment for this invoice
    const payment = await PaymentModel.findOne({
      invoiceId: invoice.id
    }).sort({ createdAt: -1 });

    // Prepare payment object with screenshot from payment or invoice
    const paymentData = payment ? {
      ...payment.toObject(),
      screenshot: payment.screenshot || invoice.screenshot || invoice.payment_proof || null,
    } : {
      invoiceId: invoice.id,
      amount: invoice.amount,
      method: invoice.method || 'Payment',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      reference: invoice.reference || invoice.id,
      screenshot: invoice.screenshot || invoice.payment_proof || null,
    };

    // Send email with PDF receipt (optional - don't fail if email sending fails)
    console.log(`📧 Attempting to send payment confirmation email for invoice ${invoice.id} to member ${member.email}...`);
    try {
      const emailSent = await sendPaymentApprovalEmail(
        member,
        paymentData,
        invoice
      );

      if (emailSent) {
        console.log(`✅ Payment confirmation email sent successfully to ${member.email}`);
        res.json({
          success: true,
          message: `Payment confirmation email with PDF receipt sent to ${member.email}`
        });
      } else {
        console.warn(`⚠️ Failed to send payment confirmation email to ${member.email} - email may not be configured`);
        // Return success with warning instead of error - payment is still processed
        res.json({
          success: false,
          warning: true,
          message: "Payment processed successfully, but email confirmation could not be sent.",
          details: "Email may not be configured. Please check email settings in the admin panel."
        });
      }
    } catch (emailError) {
      console.error(`❌ Error attempting to send payment confirmation email:`, emailError);
      // Return success with warning - payment is still processed even if email fails
      res.json({
        success: false,
        warning: true,
        message: "Payment processed successfully, but email confirmation could not be sent.",
        details: emailError.message || "Email sending failed. Please check email configuration in settings."
      });
    }
  } catch (error) {
    console.error("Error sending payment confirmation email:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


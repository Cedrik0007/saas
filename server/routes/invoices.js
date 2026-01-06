import express from "express";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import PaymentModel from "../models/Payment.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { generateSubscriptionInvoices } from "../services/invoiceService.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import { generateUniqueMessageId } from "../config/email.js";
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

// PUT update invoice
router.put("/:id", async (req, res) => {
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

    // Send email with PDF receipt
    console.log(`📧 Attempting to send payment confirmation email for invoice ${invoice.id} to member ${member.email}...`);
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
      console.error(`❌ Failed to send payment confirmation email to ${member.email}`);
      res.status(500).json({ 
        error: "Failed to send payment confirmation email. Please check email configuration in settings.",
        details: "Email may not be configured. Please check server logs for details."
      });
    }
  } catch (error) {
    console.error("Error sending payment confirmation email:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


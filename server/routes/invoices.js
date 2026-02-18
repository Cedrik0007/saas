import express from "express";
import { emitInvoiceUpdate } from "../config/socket.js";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import PaymentModel from "../models/Payment.js";
import ReminderLogModel from "../models/ReminderLog.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { calculateFees, normalizeSubscriptionType, SUBSCRIPTION_TYPES } from "../utils/subscriptionTypes.js";
import { generateSubscriptionInvoices } from "../services/invoiceService.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import { generateUniqueMessageId, createEmailTransporter } from "../config/email.js";
import { sendPaymentApprovalEmail } from "../utils/emailHelpers.js";
import { resolveInvoice, resolveMember } from "../utils/resolveRefs.js";
import { getNextSequence } from "../utils/sequence.js";
import { getReceiptWhatsAppUrl } from "../utils/receiptLinks.js";
import nodemailer from "nodemailer";

const router = express.Router();
const objectIdRegex = /^[a-f\d]{24}$/i;

const normalizeMemberId = (rawMemberId = "") => (typeof rawMemberId === "string" ? rawMemberId.trim() : "");

const assertValidMemberId = (memberIdValue) => {
  const normalized = normalizeMemberId(memberIdValue);
  if (!normalized) {
    const error = new Error("memberId is required and must be a non-empty string");
    error.status = 400;
    throw error;
  }
  if (objectIdRegex.test(normalized)) {
    const error = new Error("memberId must be the business identifier (e.g., IMA1234), not the Mongo _id");
    error.status = 400;
    throw error;
  }
  return normalized;
};

const resolveInvoiceByParam = async (invoiceParam) => {
  const normalized = String(invoiceParam || "").trim();
  if (!normalized) return null;
  
  // Try Mongo _id first
  if (objectIdRegex.test(normalized)) {
    const invoice = await InvoiceModel.findById(normalized);
    if (invoice) {
      console.log(`✓ Resolved invoice by _id: ${invoice._id} -> business id: ${invoice.id}`);
      return invoice;
    }
  }
  
  // Try business invoice id (e.g., INV-2024-001)
  let invoice = await InvoiceModel.findOne({ id: normalized });
  if (invoice) {
    console.log(`✓ Resolved invoice by business id: ${invoice.id} -> _id: ${invoice._id}`);
    return invoice;
  }
  
  // Try receipt number (e.g., 123, 456) for paid invoices
  if (/^\d+$/.test(normalized)) {
    invoice = await InvoiceModel.findOne({ receiptNumber: normalized });
    if (invoice) {
      console.log(`✓ Resolved invoice by receiptNumber: ${invoice.receiptNumber} -> _id: ${invoice._id}, business id: ${invoice.id}`);
      return invoice;
    }
  }
  
  console.warn(`⚠ Could not resolve invoice with param: ${normalized}`);
  return null;
};

const getInvoiceRouteId = (invoiceDoc) => invoiceDoc?._id?.toString() || invoiceDoc?.id;

const filterInvoicesWithExistingMembers = async (invoiceDocs = []) => {
  if (!Array.isArray(invoiceDocs) || invoiceDocs.length === 0) {
    return invoiceDocs;
  }

  // Do not drop invoices from responses to avoid hiding legacy data.
  return invoiceDocs;
};

const resolveMemberByParam = async (memberParam) => {
  const normalized = String(memberParam || "").trim();
  if (!normalized) return null;

  if (objectIdRegex.test(normalized)) {
    return UserModel.findById(normalized);
  }

  return UserModel.findOne({
    $or: [
      { id: normalized },
      { "previousDisplayIds.id": normalized },
    ],
  });
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

// GET all invoices
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const allInvoices = await InvoiceModel.find({}).sort({ createdAt: -1 });
    const responsePayload = await Promise.all(allInvoices.map(async (invoice) => {
      const invoiceObj = invoice?.toObject ? invoice.toObject() : invoice;
      return {
        ...invoiceObj,
        receiptPdfUrl: invoiceObj?._id
          ? await getReceiptWhatsAppUrl(invoiceObj)
          : null,
      };
    }));
    res.json(responsePayload);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET invoices for specific member
router.get("/member/:memberId", async (req, res) => {
  try {
    await ensureConnection();

    const memberId = String(req.params.memberId || "").trim();
    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }
    if (!objectIdRegex.test(memberId)) {
      return res.status(400).json({ error: "memberId must be the Mongo _id for invoice history lookups." });
    }

    const memberExists = await UserModel.findById(memberId);
    if (!memberExists) {
      return res.status(404).json({ error: `Member with ID "${memberId}" not found.` });
    }

    const previousIds = Array.isArray(memberExists?.previousDisplayIds)
      ? memberExists.previousDisplayIds.map((entry) => entry?.id).filter(Boolean)
      : [];
    const validIds = Array.from(
      new Set([memberExists?.id, ...previousIds].filter(Boolean).map((value) => String(value).trim()).filter(Boolean))
    );

    const memberInvoices = await InvoiceModel.find({ memberId: { $in: validIds } }).sort({ createdAt: -1 });
    const responsePayload = await Promise.all(memberInvoices.map(async (invoice) => {
      const invoiceObj = invoice?.toObject ? invoice.toObject() : invoice;
      return {
        ...invoiceObj,
        receiptPdfUrl: invoiceObj?._id
          ? await getReceiptWhatsAppUrl(invoiceObj)
          : null,
      };
    }));
    res.json(responsePayload);
  } catch (error) {
    console.error("Error fetching member invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new invoice
router.post("/", async (req, res) => {
  try {
    await ensureConnection();

    if (Object.prototype.hasOwnProperty.call(req.body, "invoiceNo")) {
      return res.status(400).json({ error: "invoiceNo is generated by the backend and cannot be provided." });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "memberName") || Object.prototype.hasOwnProperty.call(req.body, "memberEmail")) {
      return res.status(400).json({
        error: "Do not send memberName/memberEmail; invoices store only memberId",
      });
    }

    if (req.body.memberId && objectIdRegex.test(String(req.body.memberId).trim())) {
      return res.status(400).json({
        error: "Invoices require a business identifier (e.g., LM100, AM702) and not a Mongo ObjectId.",
      });
    }

    let memberExists;
    try {
      memberExists = await resolveMember(req.body.memberId || req.body.memberRef);
    } catch (resolveError) {
      console.warn("Invoice creation rejected due to invalid member reference", resolveError.message);
      return res.status(resolveError.status || 400).json({ error: resolveError.message });
    }

    if (!memberExists.id) {
      return res.status(400).json({
        error: "Member is missing business ID; invoice creation requires a business identifier.",
      });
    }

    const memberId = memberExists.id;
    const memberRef = memberExists._id;
    const memberNo = memberExists.memberNo;
    req.body.memberId = memberId;
    console.log(`✓ Invoice creation: Validated member exists (id=${memberExists.id}, name=${memberExists.name})`);

    // For manual invoice creation, ALWAYS use annual-only amounts:
    // - Annual Member: HK$500/year
    // - Lifetime Member: HK$250/year (Janaza Fund only, never 5250)
    // HK$5250 is NEVER charged in invoice creation (only during member registration/upgrade)
    const normalizedType = normalizeSubscriptionType(memberExists.subscriptionType);
    let membershipFee = 0;
    let janazaFee = 0;
    let totalFee = 0;

    if (normalizedType === SUBSCRIPTION_TYPES.ANNUAL_MEMBER) {
      membershipFee = 500;
      janazaFee = 0;
      totalFee = 500;
    } else if (normalizedType === SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND) {
      // For Lifetime Members in invoice creation: always charge only the annual Janaza Fund
      membershipFee = 0;
      janazaFee = 250;
      totalFee = 250;
    } else {
      return res.status(400).json({
        error: `Cannot create invoice for member type: ${normalizedType}`
      });
    }

    // Frontend fee fields are ignored; backend enforces canonical values
    req.body.membershipFee = membershipFee;
    req.body.janazaFee = janazaFee;
    req.body.amount = `HK$${totalFee.toFixed(2)}`;

    // Check for existing invoice for the same member and period (prevent duplicates)
    const existingInvoice = await InvoiceModel.findOne({
      ...buildInvoiceMemberMatch(memberExists),
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

    const invoiceNo = await getNextSequence("invoiceNo");

    const invoiceData = {
      invoiceNo,
      id: `INV-2025-${Math.floor(100 + Math.random() * 900)}`,
      ...req.body,
      membershipFee,
      janazaFee,
      amount: `HK$${totalFee.toFixed(2)}`,
      memberRef,
      memberNo,
      memberId,
      receiver_name: null,
      due: dueDate, // Always set due date at creation
      status: req.body.status || "Unpaid",
    };

    delete invoiceData.memberName;
    delete invoiceData.memberEmail;

    const newInvoice = new InvoiceModel(invoiceData);
    await newInvoice.save();

    // Update member balance if invoice is unpaid
    const balanceIdentifier = invoiceData.memberRef || invoiceData.memberNo || invoiceData.memberId;
    if (balanceIdentifier && (invoiceData.status === "Unpaid" || invoiceData.status === "Overdue")) {
      await calculateAndUpdateMemberBalance(balanceIdentifier);
    }

    // Emit Socket.io event for real-time update
    emitInvoiceUpdate('created', newInvoice);

    res.status(201).json(newInvoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to manually trigger next year invoice creation
router.post("/create-next-year", async (req, res) => {
  try {
    await ensureConnection();
    const { checkAndCreateNextYearInvoices } = await import("../services/nextYearInvoiceService.js");
    const result = await checkAndCreateNextYearInvoices();
    res.json({
      success: result.success,
      message: result.message,
      result: {
        created: result.created,
        skipped: result.skipped,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error("Error in manual next year invoice creation:", error);
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

// GET next receipt number (sequential 4-digit number)
router.get("/next-receipt-number", async (req, res) => {
  try {
    await ensureConnection();
    const receiptNumber = await getNextReceiptNumber();
    res.json({ receiptNumber });
  } catch (error) {
    console.error("Error getting next receipt number:", error);
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
          <p><strong>Payment Methods Available:</strong></p>
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
        from: `"IMA Subscription Manager" <${emailSettings.emailUser}>`,
        to: toEmail,
        subject: uniqueSubject,
        html: emailHTML,
        text: `Dear ${toName},\n\nThis is a friendly reminder about your outstanding subscription payments.\n\nMember ID: ${memberId || 'N/A'}\nTotal Outstanding: ${totalDue}\n\nOutstanding Invoices (${invoiceCount}):\n${finalInvoiceListText || 'N/A'}\n\nPayment Methods: ${paymentMethods || 'Available in member portal'}\n\nAccess Member Portal: ${portalLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/member`}\n\nPlease settle your outstanding balance at your earliest convenience.\n\nBest regards,\nFinance Team\nIMA Subscription Manager`,
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
      let unpaidInvoices = [];
      if (memberId) {
        let memberForReminder = null;
        try {
          memberForReminder = await resolveMember(memberId);
        } catch (resolveError) {
          memberForReminder = null;
        }

        if (memberForReminder) {
          unpaidInvoices = await InvoiceModel.find({
            ...buildInvoiceMemberMatch(memberForReminder),
            status: { $in: ['Unpaid', 'Overdue'] }
          });
        } else {
          unpaidInvoices = await InvoiceModel.find({
            memberId: memberId,
            status: { $in: ['Unpaid', 'Overdue'] }
          });
        }
      }

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

    let oldInvoice;
    try {
      oldInvoice = await resolveInvoice(req.params.id);
    } catch (resolveError) {
      return res.status(resolveError.status || 400).json({ error: resolveError.message });
    }

    // Protect the 'due' field - never allow it to be updated once invoice is created
    // The due date is set at invoice creation and must remain immutable
    const updateData = { ...req.body };
    delete updateData.due; // Remove 'due' from update data to prevent changes

    if (Object.prototype.hasOwnProperty.call(updateData, "memberName")) {
      delete updateData.memberName;
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "memberEmail")) {
      delete updateData.memberEmail;
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "memberId")
      || Object.prototype.hasOwnProperty.call(updateData, "memberRef")) {
      let memberExists;
      try {
        memberExists = await resolveMember(updateData.memberId || updateData.memberRef);
      } catch (resolveError) {
        console.warn(`Invoice update rejected: invalid member reference for invoice ${req.params.id}`, resolveError.message);
        return res.status(resolveError.status || 400).json({ error: resolveError.message });
      }

      if (!memberExists.id) {
        return res.status(400).json({
          error: "Member is missing business ID; invoice updates require a business identifier.",
        });
      }

      updateData.memberId = memberExists.id;
      updateData.memberRef = memberExists._id;
      updateData.memberNo = memberExists.memberNo;
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
      const nextStatus = String(updateData.status || "").trim();
      if (nextStatus === "Paid" || nextStatus === "Completed") {
        return res.status(400).json({
          error: "Paid status can only be set via the payment approval service.",
        });
      }
    }

    const updatedInvoice = await InvoiceModel.findOneAndUpdate(
      { _id: oldInvoice._id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Update member balance if status, amount, or memberId changed
    const statusChanged = oldInvoice.status !== updatedInvoice.status;
    const amountChanged = oldInvoice.amount !== updatedInvoice.amount;
    const memberChanged = oldInvoice.memberId !== updatedInvoice.memberId ||
      String(oldInvoice.memberRef || "") !== String(updatedInvoice.memberRef || "") ||
      oldInvoice.memberNo !== updatedInvoice.memberNo;

    // Check if invoice was marked as paid (status changed from Unpaid/Overdue to Paid)
    const wasUnpaid = oldInvoice.status === "Unpaid" || oldInvoice.status === "Overdue";
    const isNowPaid = updatedInvoice.status === "Paid";
    const markedAsPaid = statusChanged && wasUnpaid && isNowPaid;

    if (statusChanged || amountChanged || memberChanged) {
      // Always recalculate balance for the old member if:
      // - Member changed, OR
      // - Invoice was unpaid/overdue (needs recalculation when paid), OR
      // - Invoice is now unpaid/overdue (needs recalculation)
      const oldMemberIdentifier = oldInvoice.memberRef || oldInvoice.memberNo || oldInvoice.memberId;
      if (oldMemberIdentifier) {
        if (memberChanged || wasUnpaid || markedAsPaid ||
          updatedInvoice.status === "Unpaid" || updatedInvoice.status === "Overdue") {
          await calculateAndUpdateMemberBalance(oldMemberIdentifier);
        }
      }

      // Recalculate balance for new member if member changed and invoice is unpaid
      const newMemberIdentifier = updatedInvoice.memberRef || updatedInvoice.memberNo || updatedInvoice.memberId;
      if (newMemberIdentifier && memberChanged) {
        if (updatedInvoice.status === "Unpaid" || updatedInvoice.status === "Overdue") {
          await calculateAndUpdateMemberBalance(newMemberIdentifier);
        }
      }

      // If invoice was marked as paid, also recalculate for the member (in case member didn't change)
      if (markedAsPaid && newMemberIdentifier) {
        await calculateAndUpdateMemberBalance(newMemberIdentifier);
      }
    }

    // Convert to plain object to ensure all properties are included
    const responseInvoice = updatedInvoice.toObject ? updatedInvoice.toObject() : updatedInvoice;

    // Emit Socket.io event for real-time update
    emitInvoiceUpdate('updated', responseInvoice);

    res.json(responseInvoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    const statusCode = error.statusCode || error.status || (error.name === "ValidationError" ? 400 : 500);
    res.status(statusCode).json({ error: error.message });
  }
});

// DELETE invoice
router.delete("/:id", async (req, res) => {
  try {
    await ensureConnection();

    const invoice = await resolveInvoiceByParam(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const deletedInvoice = await InvoiceModel.findByIdAndDelete(invoice._id);
    if (!deletedInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Update member balance after deletion if invoice was unpaid
    const deletedMemberIdentifier = deletedInvoice.memberRef || deletedInvoice.memberNo || deletedInvoice.memberId;
    if (deletedMemberIdentifier &&
      (deletedInvoice.status === "Unpaid" || deletedInvoice.status === "Overdue")) {
      await calculateAndUpdateMemberBalance(deletedMemberIdentifier);
    }

    // Emit Socket.io event for real-time update
    emitInvoiceUpdate('deleted', { id: deletedInvoice._id?.toString(), businessId: deletedInvoice.id });

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

    const invoice = await resolveInvoiceByParam(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check if invoice is paid (accept both "Paid" and "Completed" status)
    const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
    if (!isPaid) {
      return res.status(400).json({ message: "Invoice is not marked as paid. Current status: " + invoice.status });
    }

    const member = await resolveMember(invoice.memberRef || invoice.memberNo || invoice.memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    console.log(`✓ Send payment confirmation: invoice=${invoice.id}, invoice.memberId=${invoice.memberId}, fetched member.id=${member.id}, member.name=${member.name}`);

    // Find the most recent payment for this invoice
    const payment = await PaymentModel.findOne({
      invoiceId: { $in: [invoice.id, invoice._id?.toString()] }
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
    console.log(`📧 Attempting to send payment confirmation email for invoice ${invoice.id} to member ${member.email || member.memberEmail || 'N/A'}...`);
    console.log(`   Invoice status: ${invoice.status}`);
    console.log(`   Member ID: ${member.id}, Member Name: ${member.name || member.memberName || 'N/A'}`);
    console.log(`   Payment data:`, {
      paymentId: payment?.id || 'N/A',
      amount: paymentData.amount || invoice.amount,
      method: paymentData.method || 'N/A'
    });
    
    try {
      const emailSent = await sendPaymentApprovalEmail(
        member,
        paymentData,
        invoice
      );

      if (emailSent) {
        console.log(`✅ Payment confirmation email sent successfully to ${member.email || member.memberEmail}`);
        res.json({
          success: true,
          message: `Payment confirmation email with PDF receipt sent to ${member.email || member.memberEmail}`
        });
      } else {
        console.warn(`⚠️ Failed to send payment confirmation email to ${member.email || member.memberEmail} - email may not be configured`);
        console.warn(`   Please check:`);
        console.warn(`   1. Email settings are configured in admin panel`);
        console.warn(`   2. EMAIL_USER and EMAIL_PASSWORD environment variables are set`);
        console.warn(`   3. For Gmail, using App-Specific Password (not regular password)`);
        // Return success with warning instead of error - payment is still processed
        res.json({
          success: false,
          warning: true,
          message: "Payment confirmation email could not be sent.",
          details: "Email may not be configured. Please check email settings in the admin panel or environment variables."
        });
      }
    } catch (emailError) {
      console.error(`❌ Error attempting to send payment confirmation email:`, emailError);
      console.error(`   Error stack:`, emailError.stack);
      console.error(`   Error code:`, emailError.code);
      console.error(`   Error message:`, emailError.message);
      // Return success with warning - payment is still processed even if email fails
      res.json({
        success: false,
        warning: true,
        message: "Payment confirmation email could not be sent.",
        details: emailError.message || "Email sending failed. Please check email configuration in settings.",
        error: emailError.code || 'UNKNOWN_ERROR'
      });
    }
  } catch (error) {
    console.error("Error sending payment confirmation email:", error);
    res.status(500).json({ error: error.message });
  }
});


// GET PDF options page (view/download options)
router.get("/:id/pdf-receipt/options", async (req, res) => {
  try {
    await ensureConnection();

    const invoiceParam = String(req.params.id || "").trim();
    console.log(`↘ PDF options requested for invoice id: ${invoiceParam}`);

    const invoice = await resolveInvoiceByParam(invoiceParam);
    if (!invoice) {
      console.warn(`⚠ Invoice not found for PDF options: ${invoiceParam}`);
      return res.status(404).json({ error: "Invoice not found" });
    }

    console.log(`✓ Resolved invoice for PDF options: ${invoice._id} (${invoice.id})`);

    // Get protocol correctly (handle proxy/load balancer)
    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const host = req.get('host');
    const apiBaseUrl = `${protocol}://${host}`;
    const invoiceRouteId = invoice._id;
    // View PDF - use the same download endpoint but will open in browser instead of downloading
    // We'll add a query parameter to indicate viewing mode
    const viewUrl = `${apiBaseUrl}/api/invoices/${invoiceRouteId}/pdf-receipt/view`;
    const downloadUrl = `${apiBaseUrl}/api/invoices/${invoiceRouteId}/pdf-receipt/download`;

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Receipt - Options</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
          }
          .header {
            margin-bottom: 30px;
          }
          .header h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
          }
          .header p {
            color: #666;
            font-size: 16px;
          }
          .options {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-top: 30px;
          }
          .btn {
            display: inline-block;
            padding: 16px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s ease;
            border: 2px solid transparent;
            cursor: pointer;
          }
          .btn-view {
            background: #10b981;
            color: white;
          }
          .btn-view:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
          }
          .btn-download {
            background: #3b82f6;
            color: white;
          }
          .btn-download:hover {
            background: #2563eb;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
          }
          .btn-icon {
            margin-right: 8px;
            font-size: 18px;
          }
          .info {
            margin-top: 30px;
            padding: 15px;
            background: #f3f4f6;
            border-radius: 8px;
            font-size: 14px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Payment Receipt</h1>
            <p>Choose an option to access your receipt</p>
          </div>
          <div class="options">
            <a href="${viewUrl}" target="_blank" class="btn btn-view">
              <span class="btn-icon">👁️</span>
              View PDF
            </a>
            <a href="${downloadUrl}" class="btn btn-download" download>
              <span class="btn-icon">⬇️</span>
              Download PDF
            </a>
          </div>
          <div class="info">
            <strong>Invoice #:</strong> ${invoice.id}<br>
            <strong>Amount:</strong> ${invoice.amount || 'N/A'}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Error generating PDF options page:", error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Error</h2>
          <p>An error occurred while loading the receipt options.</p>
        </body>
      </html>
    `);
  }
});

// GET download PDF receipt directly (proxy endpoint to bypass Cloudinary auth)
router.get("/:id/pdf-receipt/download", async (req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "https://admin.imahk.org");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    await ensureConnection();

    const invoiceParam = String(req.params.id || "").trim();
    console.log(`↘ PDF receipt download requested for invoice param: "${invoiceParam}"`);

    const invoice = await resolveInvoiceByParam(invoiceParam);
    if (!invoice) {
      console.error(`❌ Invoice not found for PDF download - param: "${invoiceParam}"`);
      return res.status(404).json({ error: "Invoice not found for PDF download" });
    }

    console.log(`✓ Resolved invoice for PDF download: _id=${invoice._id}, business id=${invoice.id}, receiptNumber=${invoice.receiptNumber || 'N/A'}`);

    // Optional: validate that the viewer (UI) is the member the invoice belongs to
    const viewerMemberId = req.query.viewerMemberId || req.headers['x-viewer-member-id'];
    if (viewerMemberId && invoice.memberId !== String(viewerMemberId)) {
      console.error(`Invoice-member mismatch on download: invoiceId=${invoice.id} invoice.memberId=${invoice.memberId} viewerMemberId=${viewerMemberId} requester=${req.ip}`);
      return res.status(400).json({ error: "Invoice does not belong to the requested member. PDF generation blocked." });
    }

    // Allow both "Paid" and "Completed" statuses
    const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
    if (!isPaid) {
      return res.status(400).json({ error: "Invoice is not marked as paid. Current status: " + invoice.status });
    }

    const member = await resolveMember(invoice.memberRef || invoice.memberNo || invoice.memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    console.log(`✓ Download receipt: invoice=${invoice.id}, invoice.memberId=${invoice.memberId}, fetched member.id=${member.id}, member.name=${member.name}`);

    // Log if invoice stored memberName differs from current member name
    if (invoice.memberName && member.name && invoice.memberName !== member.name) {
      console.warn(`Stored invoice.memberName (${invoice.memberName}) differs from current member.name (${member.name}) for invoice ${invoice.id}`);
    }

    // Find the most recent payment for this invoice
    const payment = await PaymentModel.findOne({
      invoiceId: { $in: [invoice.id, invoice._id?.toString()] }
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
    };

    // Generate PDF receipt - use receipt number from invoice if available
    const { generatePaymentReceiptPDF } = await import("../utils/pdfReceipt.js");
    const memberPayload = {
      ...(typeof member?.toObject === "function" ? member.toObject() : member),
      id: typeof member?.get === "function" ? member.get("id") : member?.id,
      subscriptionType: member?.subscriptionType,
    };

    const invoicePayload = {
      ...(typeof invoice?.toObject === "function" ? invoice.toObject() : invoice),
    };
    // Keep invoice.subscriptionType so PDF shows the invoice's subscription label (matches invoice table; e.g. Annual vs Lifetime for old invoices)

    const pdfBuffer = await generatePaymentReceiptPDF(memberPayload, invoicePayload, paymentData, invoice.receiptNumber);

    // Determine Content-Disposition based on mode query param
    const mode = req.query.mode || 'download'; // 'view' or 'download'
    const disposition = mode === 'view' ? 'inline' : 'attachment';
    
    // Set headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="Receipt_${invoice.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer directly
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error downloading PDF receipt:", error);
    res.status(500).json({ error: error.message });
  }

});

// GET generate PDF receipt and return URL for download
router.get("/:id/pdf-receipt", async (req, res) => {
  try {
    await ensureConnection();

    const invoiceParam = String(req.params.id || "").trim();
    console.log(`↘ PDF receipt generation requested for invoice id: ${invoiceParam}`);

    const invoice = await resolveInvoiceByParam(invoiceParam);
    if (!invoice) {
      console.warn(`⚠ Invoice not found for PDF receipt generation: ${invoiceParam}`);
      return res.status(404).json({ error: "Invoice not found" });
    }

    console.log(`✓ Resolved invoice for PDF receipt generation: ${invoice._id} (${invoice.id})`);

    // Allow both "Paid" and "Completed" statuses
    const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
    if (!isPaid) {
      return res.status(400).json({ error: "Invoice is not marked as paid. Current status: " + invoice.status });
    }

    const viewerMemberId = req.query.viewerMemberId || req.headers['x-viewer-member-id'];
    if (viewerMemberId && invoice.memberId !== String(viewerMemberId)) {
      console.error(`Invoice-member mismatch on generate: invoiceId=${invoice.id} invoice.memberId=${invoice.memberId} viewerMemberId=${viewerMemberId} requester=${req.ip}`);
      return res.status(400).json({ error: "Invoice does not belong to the requested member. PDF generation blocked." });
    }

    const member = await resolveMember(invoice.memberRef || invoice.memberNo || invoice.memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    console.log(`✓ Generate receipt (pdf-receipt): invoice=${invoice.id}, invoice.memberId=${invoice.memberId}, fetched member.id=${member.id}, member.name=${member.name}`);

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
    };

    // Generate PDF receipt - use receipt number from invoice if available
    const { generatePaymentReceiptPDF } = await import("../utils/pdfReceipt.js");
    const memberPayload = {
      ...(typeof member?.toObject === "function" ? member.toObject() : member),
      id: typeof member?.get === "function" ? member.get("id") : member?.id,
      subscriptionType: member?.subscriptionType,
    };

    const invoicePayload = {
      ...(typeof invoice?.toObject === "function" ? invoice.toObject() : invoice),
    };
    // Keep invoice.subscriptionType so PDF matches invoice table (e.g. Annual vs Lifetime for old invoices)

    const pdfBuffer = await generatePaymentReceiptPDF(memberPayload, invoicePayload, paymentData, invoice.receiptNumber);

    // Upload PDF to Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const { cloudinary } = await import("../config/cloudinary.js");
        const base64 = pdfBuffer.toString('base64');
        const dataUri = `data:application/pdf;base64,${base64}`;
        
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: "payment-receipts",
          resource_type: "raw",
          format: "pdf",
          public_id: `receipt_${invoice.id}_${Date.now()}`,
          access_mode: "public", // Ensure the resource is publicly accessible
          type: "upload", // Explicitly set type to upload (public)
          invalidate: false, // Don't invalidate CDN cache
        });

        // Use secure_url which is always HTTPS and publicly accessible
        const pdfUrl = uploadResult.secure_url;
        
        // For raw files (PDFs), ensure the URL is correct
        // Cloudinary raw files might need the format in the URL
        let finalPdfUrl = pdfUrl;
        if (!pdfUrl.endsWith('.pdf')) {
          // Add .pdf extension if not present for better browser recognition
          finalPdfUrl = pdfUrl + '.pdf';
        }

        res.json({
          success: true,
          pdfUrl: finalPdfUrl,
          message: "PDF receipt generated and uploaded successfully"
        });
      } catch (uploadError) {
        console.error("Error uploading PDF to Cloudinary:", uploadError);
        // Fallback: return PDF as base64 data URL
        const base64 = pdfBuffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${base64}`;
        res.json({
          success: true,
          pdfUrl: dataUrl,
          message: "PDF receipt generated (using base64 fallback)"
        });
      }
    } else {
      // Fallback: return PDF as base64 data URL
      const base64 = pdfBuffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64}`;
      res.json({
        success: true,
        pdfUrl: dataUrl,
        message: "PDF receipt generated (using base64 fallback)"
      });
    }
  } catch (error) {
    console.error("Error generating PDF receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET view PDF receipt in browser (opens in new tab instead of downloading)
router.get("/:id/pdf-receipt/view", async (req, res) => {
  try {
    await ensureConnection();

    const invoiceParam = String(req.params.id || "").trim();
    console.log(`↘ PDF receipt view requested for invoice id: ${invoiceParam}`);

    const invoice = await resolveInvoiceByParam(invoiceParam);
    if (!invoice) {
      console.warn(`⚠ Invoice not found for PDF receipt view: ${invoiceParam}`);
      return res.status(404).json({ error: "Invoice not found" });
    }

    console.log(`✓ Resolved invoice for PDF receipt view: ${invoice._id} (${invoice.id})`);

    // Allow both "Paid" and "Completed" statuses
    const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
    if (!isPaid) {
      return res.status(400).json({ error: "Invoice is not marked as paid. Current status: " + invoice.status });
    }
    const receiptNoView = (invoice.receiptNumber || "").trim();
    if (!receiptNoView || !/^\d+$/.test(receiptNoView)) {
      console.error("PDF receipt view blocked: Paid invoice missing receiptNumber", { invoiceId: invoice._id });
      return res.status(400).json({ error: "Receipt number is missing. Cannot generate PDF." });
    }

    const member = await resolveMember(invoice.memberRef || invoice.memberNo || invoice.memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    console.log(`✓ View receipt (view-pdf-receipt): invoice=${invoice.id}, invoice.memberId=${invoice.memberId}, fetched member.id=${member.id}, member.name=${member.name}`);

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
    };

    // Generate PDF receipt - use receipt number from invoice if available
    const { generatePaymentReceiptPDF } = await import("../utils/pdfReceipt.js");
    const memberPayload = {
      ...(typeof member?.toObject === "function" ? member.toObject() : member),
      id: typeof member?.get === "function" ? member.get("id") : member?.id,
      subscriptionType: member?.subscriptionType,
    };

    const invoicePayload = {
      ...(typeof invoice?.toObject === "function" ? invoice.toObject() : invoice),
    };
    // Keep invoice.subscriptionType so PDF matches invoice table (e.g. Annual vs Lifetime for old invoices)

    const pdfBuffer = await generatePaymentReceiptPDF(memberPayload, invoicePayload, paymentData, invoice.receiptNumber);

    // Set headers for PDF view (inline instead of attachment, with caching disabled)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Receipt_${invoice.id}.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send PDF buffer directly
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error viewing PDF receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET WhatsApp receipt data - fresh from DB, single source of truth for WhatsApp message building
// Used for both Send Confirmation and Re-send Receipt. Never use cached/frontend data.
router.get("/:id/whatsapp-data", async (req, res) => {
  try {
    await ensureConnection();

    const invoiceParam = String(req.params.id || "").trim();
    const invoice = await resolveInvoiceByParam(invoiceParam);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const inv = invoice.toObject ? invoice.toObject() : invoice;
    const isPaid = inv.status === "Paid" || inv.status === "Completed";
    if (!isPaid) {
      return res.status(400).json({ error: "Invoice is not paid. Cannot send receipt." });
    }

    const receiptNo = (inv.receiptNumber || "").trim();
    if (!receiptNo || !/^\d+$/.test(receiptNo)) {
      console.error("WhatsApp data blocked: Paid invoice missing receiptNumber", { invoiceId: inv._id, invoiceBusinessId: inv.id });
      return res.status(400).json({ error: "Receipt number is missing. Cannot send WhatsApp receipt." });
    }

    const member = await resolveMember(inv.memberRef || inv.memberNo || inv.memberId);
    if (!member || !member.phone) {
      return res.status(400).json({ error: "Member or member phone not found. Cannot send WhatsApp receipt." });
    }

    const memberObj = member.toObject ? member.toObject() : member;
    const memberName = inv.memberName || memberObj?.name || "Member";
    const memberId = memberObj?.id || inv.memberId || "-";
    const memberPhone = String(memberObj?.phone || "").trim();
    const amountStr = inv.amount || "HK$0";
    const amountNum = parseFloat(String(amountStr).replace(/[^0-9.]/g, "")) || 0;
    const invoiceYear = (inv.period || "").match(/\d{4}/)?.[0] || "";
    const method = String(inv.method || "").trim();
    const receiptPdfUrl = await getReceiptWhatsAppUrl(inv);

    res.json({
      memberName,
      memberId,
      memberPhone,
      receiptNumber: receiptNo,
      amount: amountStr,
      amountNum,
      period: inv.period || "",
      invoiceYear,
      method,
      receiptPdfUrl,
      invoiceId: inv.id,
      invoiceDbId: inv._id,
    });
  } catch (error) {
    console.error("Error fetching WhatsApp data:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET WhatsApp-safe PDF receipt (public, inline, no downloads/redirects)
router.get("/:id/pdf-receipt/whatsapp", async (req, res) => {
  try {
    await ensureConnection();

    const invoiceParam = String(req.params.id || "").trim();
    console.log(`↘ PDF receipt WhatsApp view requested for invoice id: ${invoiceParam}`);

    const invoice = await resolveInvoiceByParam(invoiceParam);
    if (!invoice) {
      console.warn(`⚠ Invoice not found for PDF receipt WhatsApp view: ${invoiceParam}`);
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Allow both "Paid" and "Completed" statuses
    const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
    if (!isPaid) {
      return res.status(400).json({ error: "Invoice is not marked as paid. Current status: " + invoice.status });
    }
    const receiptNoPdf = (invoice.receiptNumber || "").trim();
    if (!receiptNoPdf || !/^\d+$/.test(receiptNoPdf)) {
      console.error("PDF receipt blocked: Paid invoice missing receiptNumber", { invoiceId: invoice._id });
      return res.status(400).json({ error: "Receipt number is missing. Cannot generate PDF." });
    }

    const member = await resolveMember(invoice.memberRef || invoice.memberNo || invoice.memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const payment = await PaymentModel.findOne({
      invoiceId: invoice.id
    }).sort({ createdAt: -1 });

    const paymentData = payment ? {
      ...payment.toObject(),
      screenshot: payment.screenshot || invoice.screenshot || invoice.payment_proof || null,
    } : {
      invoiceId: invoice.id,
      amount: invoice.amount,
      method: invoice.method || 'Payment',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      reference: invoice.reference || invoice.id,
    };

    const { generatePaymentReceiptPDF } = await import("../utils/pdfReceipt.js");
    const memberPayload = {
      ...(typeof member?.toObject === "function" ? member.toObject() : member),
      id: typeof member?.get === "function" ? member.get("id") : member?.id,
      subscriptionType: member?.subscriptionType,
    };

    const invoicePayload = {
      ...(typeof invoice?.toObject === "function" ? invoice.toObject() : invoice),
    };
    // Keep invoice.subscriptionType so PDF matches invoice table (e.g. Annual vs Lifetime for old invoices)

    const pdfBuffer = await generatePaymentReceiptPDF(memberPayload, invoicePayload, paymentData, invoice.receiptNumber);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Receipt_${invoice.id}.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error serving WhatsApp PDF receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


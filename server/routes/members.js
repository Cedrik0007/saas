import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import PaymentModel from "../models/Payment.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { sendAccountApprovalEmail } from "../utils/emailHelpers.js";
import { emitMemberUpdate } from "../config/socket.js";

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// GET all members
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const members = await UserModel.find({}).sort({ createdAt: -1 }).lean();
    res.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET total members count
router.get("/count", async (req, res) => {
  try {
    await ensureConnection();
    const count = await UserModel.countDocuments();
    res.json({ total: count })
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET single member
router.get("/:id", async (req, res) => {
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
router.post("/", async (req, res) => {
  try {
    await ensureConnection();
    
    // Validate required fields
    const errors = [];
    
    // Validate name
    if (!req.body.name || !req.body.name.trim()) {
      errors.push("Name is required.");
    } else if (req.body.name.trim().length < 2) {
      errors.push("Name must be at least 2 characters.");
    }
    
    // Validate email - optional, only validate format if provided
    if (req.body.email && req.body.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body.email.trim())) {
        errors.push("Please enter a valid email address.");
      }
    }
    
    // Validate phone - optional, only validate format if provided
    if (req.body.phone && req.body.phone.trim()) {
      const phoneStr = req.body.phone.trim();
      const cleaned = phoneStr.replace(/[^\d+]/g, "");
      
      if (!cleaned.startsWith("+")) {
        errors.push("Phone number must include country code (e.g., +852 for Hong Kong, +91 for India, +1 for US/Canada).");
      } else {
        const digitsOnly = cleaned.substring(1); // Remove the +
        
        // Validate country code (1-3 digits) followed by phone number
        // Country codes range from 1 digit (+1) to 3 digits (+852, +962, etc.)
        // Total phone number length should be 8-15 digits (ITU-T E.164 standard)
        
        if (digitsOnly.length < 9) {
          // Minimum: 1 digit country code + 8 digits = 9 total digits
          errors.push("Phone number is too short. Must include country code and at least 8 digits (e.g., +85212345678, +911234567890).");
        } else if (digitsOnly.length > 15) {
          // Maximum: ITU-T E.164 standard allows max 15 digits total
          errors.push("Phone number is too long. Maximum 15 digits allowed (including country code).");
        } else if (digitsOnly.length < 10) {
          // Warn if very short but allow it (some countries have short numbers)
          // This is just a warning, not blocking
        }
        
        // Basic format validation - ensure it's all digits after the +
        if (!/^\d+$/.test(digitsOnly)) {
          errors.push("Phone number can only contain digits after the country code (+).");
        }
      }
    }
    
    // Validate nextDue (start date) - optional, only validate format if provided
    if (req.body.nextDue) {
      const date = new Date(req.body.nextDue);
      if (isNaN(date.getTime())) {
        errors.push("Please select a valid start date.");
      }
    }
    if (req.body.start_date) {
      const date = new Date(req.body.start_date);
      if (isNaN(date.getTime())) {
        errors.push("Please select a valid start date.");
      }
    }
    
    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(400).json({ 
        message: "Validation failed",
        errors: errors 
      });
    }
    
    // Generate ID if not provided
    let memberId = req.body.id;
    if (!memberId) {
      memberId = `IMA${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Check if ID already exists
    const existing = await UserModel.findOne({ id: memberId });
    if (existing) {
      return res.status(400).json({ message: "Member ID already exists" });
    }
    
    // Check if email already exists (only if email is provided)
    if (req.body.email && req.body.email.trim()) {
      const existingEmail = await UserModel.findOne({ email: req.body.email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
      }
    }
    
    // Check if phone already exists (only if phone is provided)
    if (req.body.phone && req.body.phone.trim()) {
      const phoneStr = req.body.phone.trim();
      const cleaned = phoneStr.replace(/[^\d+]/g, "");
      const normalizedPhone = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
      
      const existingPhone = await UserModel.findOne({ phone: normalizedPhone });
      if (existingPhone) {
        return res.status(400).json({ message: "Phone number already exists" });
      }
    }

    // Parse start_date if provided, otherwise use current date
    let startDate = null;
    if (req.body.start_date) {
      startDate = new Date(req.body.start_date);
    } else if (req.body.nextDue) {
      // Fallback: use nextDue if start_date not provided (for backward compatibility)
      startDate = new Date(req.body.nextDue);
    } else {
      // Default to current date if neither provided
      startDate = new Date();
    }

    // Calculate next due date based on subscriptionYear if provided
    let nextDueDate = null;
    let nextDueStr = req.body.nextDue || '';

    if (req.body.subscriptionYear) {
      const year = parseInt(req.body.subscriptionYear);
      if (!isNaN(year)) {
        nextDueDate = new Date(year + 1, 0, 1);
        // Format as YYYY-MM-DD for nextDue display string
        const nextYear = nextDueDate.getFullYear();
        const nextMonth = String(nextDueDate.getMonth() + 1).padStart(2, '0');
        const nextDay = String(nextDueDate.getDate()).padStart(2, '0');
        nextDueStr = `${nextYear}-${nextMonth}-${nextDay}`;
      }
    }

    const newMember = new UserModel({
      id: memberId,
      name: req.body.name || '',
      email: (req.body.email || '').trim().toLowerCase(),
      phone: req.body.phone || '',
      native: req.body.native || '',
      password: req.body.password || '',
      status: req.body.status || 'Pending',
      balance: req.body.balance || 'HK$0',
      nextDue: nextDueStr,
      lastPayment: req.body.lastPayment || '',
      subscriptionType: req.body.subscriptionType || 'Lifetime',
      // Subscription fee fields - set based on subscription type
      membershipFee: req.body.membershipFee !== undefined ? req.body.membershipFee : 0,
      janazaFee: req.body.janazaFee !== undefined ? req.body.janazaFee : 250,
      lifetimeMembershipPaid: req.body.lifetimeMembershipPaid || false,
      // Payment management fields - set defaults on creation
      start_date: startDate,
      payment_status: 'unpaid',
      payment_mode: null,
      last_payment_date: null,
      next_due_date: nextDueDate,
      payment_proof: null,
    });

    const savedMember = await newMember.save();

    // Import subscription types utility
    const { calculateFees, SUBSCRIPTION_TYPES } = await import("../utils/subscriptionTypes.js");

    // Determine the invoice period first to check for duplicates accurately
    const subscriptionType = req.body.subscriptionType || 'Lifetime';
    
    // Calculate fees based on subscription type
    const fees = calculateFees(subscriptionType, savedMember.lifetimeMembershipPaid || false);
    
    // Set member fees based on subscription type
    savedMember.membershipFee = fees.membershipFee;
    savedMember.janazaFee = fees.janazaFee;
    await savedMember.save();
    
    let invoicePeriod = 'Lifetime Subscription';
    if (subscriptionType === SUBSCRIPTION_TYPES.ANNUAL_MEMBER) {
      invoicePeriod = 'Annual Member Subscription';
    } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER) {
      invoicePeriod = 'Lifetime Janaza Fund Member Subscription';
    } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP) {
      invoicePeriod = savedMember.lifetimeMembershipPaid 
        ? 'Lifetime Membership - Janaza Fund'
        : 'Lifetime Membership - Full Payment';
    } else if (subscriptionType === 'Yearly + Janaza Fund') {
      invoicePeriod = 'Yearly Subscription + Janaza Fund';
    }
    
    // If subscriptionYear is provided, use it as the period
    if (req.body.subscriptionYear) {
      invoicePeriod = req.body.subscriptionYear;
    }

    // Check if invoice already exists for this member and period (prevent duplicates)
    const existingInvoice = await InvoiceModel.findOne({
      memberId: savedMember.id,
      period: invoicePeriod,
      status: { $ne: "Rejected" }
    });

    // Only create invoice if one doesn't already exist
    if (!existingInvoice) {
      // Create initial invoice
      const invoiceAmount = `HK$${fees.totalFee}`;
      let dueDate = new Date();
      
      // Calculate due date based on subscriptionYear if provided, otherwise 1 year from now
      if (req.body.subscriptionYear) {
        const subscriptionYear = parseInt(req.body.subscriptionYear);
        if (!isNaN(subscriptionYear)) {
          // Due date is Jan 1st of the year after subscription year
          dueDate = new Date(subscriptionYear + 1, 0, 1);
        } else {
          // Invalid subscription year, fall back to 1 year from now
          dueDate.setFullYear(dueDate.getFullYear() + 1);
        }
      } else {
        // No subscription year provided, set due date to 1 year from now
        dueDate.setFullYear(dueDate.getFullYear() + 1);
      }

      // Format due date as "DD MMM YYYY"
      const dueDateFormatted = dueDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace(',', '');

      // Determine invoice type
      let invoiceType = "combined";
      if (fees.membershipFee > 0 && fees.janazaFee > 0) {
        invoiceType = "combined";
      } else if (fees.membershipFee > 0) {
        invoiceType = "membership";
      } else if (fees.janazaFee > 0) {
        invoiceType = "janaza";
      }
      
      // Special case for lifetime membership first payment
      if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP && !savedMember.lifetimeMembershipPaid) {
        invoiceType = "lifetime_membership";
      }

      // Create invoice
      const invoiceData = {
        id: `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        memberId: savedMember.id,
        memberName: savedMember.name,
        memberEmail: savedMember.email,
        period: invoicePeriod,
        amount: invoiceAmount,
        membershipFee: fees.membershipFee,
        janazaFee: fees.janazaFee,
        invoiceType: invoiceType,
        status: "Unpaid",
        due: dueDateFormatted,
        method: "",
        reference: "",
      };

      const newInvoice = new InvoiceModel(invoiceData);
      await newInvoice.save();
      console.log(`✓ Invoice created for new member ${savedMember.name} (${savedMember.id}): ${invoiceData.id}`);
    } else {
      console.log(`⚠ Invoice already exists for member ${savedMember.name} (${savedMember.id}), skipping duplicate creation`);
    }

    // Update member balance (this will also format it like "$250.00 Outstanding")
    await calculateAndUpdateMemberBalance(savedMember.id);

    // Fetch the updated member with the computed balance so frontend sees correct outstanding
    const updatedMember = await UserModel.findOne({ id: savedMember.id });

    // Emit Socket.io event for real-time update
    emitMemberUpdate('created', updatedMember);

    res.status(201).json(updatedMember);
  } catch (error) {
    console.error("Error creating member:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email or ID already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT approve member account
router.put("/:id/approve", async (req, res) => {
  try {
    await ensureConnection();

    const member = await UserModel.findOne({ id: req.params.id });
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Update member status to Active
    member.status = "Active";
    await member.save();

    // Send approval email
    await sendAccountApprovalEmail(member);

    res.json({ success: true, member });
  } catch (error) {
    console.error("Error approving member:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update member
router.put("/:id", async (req, res) => {
  try {
    await ensureConnection();
    
    // Check if this is a payment update request (has payment-related fields)
    const hasPaymentFields = req.body.payment_status || req.body.payment_mode || 
                            req.body.last_payment_date || req.body.next_due_date || 
                            req.body.payment_proof || req.body.lastPayment || req.body.nextDue;
    
    if (hasPaymentFields) {
      // This is a payment update - allow payment-related fields
      const allowedPaymentFields = [
        'payment_status', 
        'payment_mode', 
        'last_payment_date', 
        'next_due_date', 
        'payment_proof',
        'lastPayment',
        'nextDue'
      ];
      
      // Filter updateData to only include allowed payment fields
      const updateData = {};
      for (const field of allowedPaymentFields) {
        if (req.body.hasOwnProperty(field)) {
          updateData[field] = req.body[field];
        }
      }
      
      // Also allow basic fields if provided
      const basicFields = ['name', 'email', 'phone', 'native', 'status', 'password'];
      for (const field of basicFields) {
        if (req.body.hasOwnProperty(field)) {
          updateData[field] = req.body[field];
        }
      }
      
      // If no fields to update, return error
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      // Ensure email is lowercase if being updated
      if (updateData.email) {
        updateData.email = updateData.email.trim().toLowerCase();
      }
      
      // Convert ISO date strings to Date objects for date fields
      if (updateData.last_payment_date && typeof updateData.last_payment_date === 'string') {
        updateData.last_payment_date = new Date(updateData.last_payment_date);
      }
      if (updateData.next_due_date && typeof updateData.next_due_date === 'string') {
        updateData.next_due_date = new Date(updateData.next_due_date);
      }
      
      // Update member with payment data
      const member = await UserModel.findOneAndUpdate(
        { id: req.params.id },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Update member balance after payment update
      await calculateAndUpdateMemberBalance(member.id);

      // Emit Socket.io event for real-time update
      emitMemberUpdate('updated', member);

      res.json(member);
    } else {
      // Regular member update - only allow basic fields
      // Whitelist of allowed fields that can be updated when editing member
      // This prevents accidentally overwriting subscription, invoice, payment, or calculated fields
      const allowedFields = ['id', 'name', 'email', 'phone', 'native', 'status', 'password'];
      
      // Filter updateData to only include allowed fields
      const updateData = {};
      for (const field of allowedFields) {
        if (req.body.hasOwnProperty(field)) {
          updateData[field] = req.body[field];
        }
      }
      
      // If no fields to update, return error
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      // Ensure email is lowercase if being updated
      if (updateData.email) {
        updateData.email = updateData.email.trim().toLowerCase();
      }
      
      // Handle member ID update - need to update all related records
      if (updateData.id && updateData.id !== req.params.id) {
        // Check if new ID already exists
        const existingMember = await UserModel.findOne({ id: updateData.id });
        if (existingMember) {
          return res.status(400).json({ message: "Member ID already exists" });
        }
        
        // Update all related records with new member ID
        const oldId = req.params.id;
        const newId = updateData.id;
        
        try {
          // Update invoices
          await InvoiceModel.updateMany(
            { memberId: oldId },
            { $set: { memberId: newId } }
          );
          
          // Update payments
          await PaymentModel.updateMany(
            { memberId: oldId },
            { $set: { memberId: newId } }
          );
          
          console.log(`✓ Updated member ID from ${oldId} to ${newId} in related records`);
        } catch (updateError) {
          console.error("Error updating related records with new member ID:", updateError);
          return res.status(500).json({ message: "Failed to update related records" });
        }
      }
      
      // Only update the fields that are in updateData
      // All other fields (balance, subscriptionType, invoices, payment data, etc.) remain unchanged
      const member = await UserModel.findOneAndUpdate(
        { id: req.params.id },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Update related payments if member name, email, or phone changed
      if (updateData.name || updateData.email || updateData.phone) {
        try {
          const paymentUpdates = {};
          if (updateData.name) {
            paymentUpdates.member = updateData.name;
          }
          if (updateData.email) {
            paymentUpdates.memberEmail = updateData.email;
          }
          
          // Update all payments for this member and emit socket events for instant update
          const updatedPayments = await PaymentModel.find({ memberId: req.params.id });
          
          if (updatedPayments.length > 0) {
            await PaymentModel.updateMany(
              { memberId: req.params.id },
              { $set: paymentUpdates }
            );
            
            // Emit socket events for each updated payment to trigger instant frontend update
            const { emitPaymentUpdate } = await import("../config/socket.js");
            for (const payment of updatedPayments) {
              const updatedPayment = {
                ...payment.toObject(),
                ...paymentUpdates
              };
              emitPaymentUpdate('updated', updatedPayment);
            }
            
            console.log(`✓ Updated ${updatedPayments.length} payment(s) for member ${req.params.id} with new data`);
          }
        } catch (paymentUpdateError) {
          console.error("Error updating related payments:", paymentUpdateError);
          // Don't fail the member update if payment update fails
        }
      }

      // Emit Socket.io event for real-time update
      emitMemberUpdate('updated', member);

      res.json(member);
    }
  } catch (error) {
    console.error("Error updating member:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE member and all related data (invoices and payments, but NOT donations)
router.delete("/:id", async (req, res) => {
  try {
    await ensureConnection();
    
    const memberId = req.params.id;
    
    // Find the member first to confirm they exist
    const member = await UserModel.findOne({ id: memberId });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Import emit functions for real-time updates
    const { emitInvoiceUpdate, emitPaymentUpdate } = await import("../config/socket.js");

    // Find all invoices for this member before deleting (for Socket.io events)
    const memberInvoices = await InvoiceModel.find({ memberId: memberId });
    
    // Delete all invoices for this member (by memberId)
    const invoiceDeleteResult = await InvoiceModel.deleteMany({ memberId: memberId });
    console.log(`Deleted ${invoiceDeleteResult.deletedCount} invoice(s) for member ${memberId}`);
    
    // Emit delete events for each invoice
    for (const invoice of memberInvoices) {
      emitInvoiceUpdate('deleted', { id: invoice.id || invoice._id });
    }

    // Find all payments for this member before deleting (for Socket.io events)
    const memberPayments = await PaymentModel.find({ memberId: memberId });
    
    // Delete all payments for this member (by memberId)
    const paymentDeleteResult = await PaymentModel.deleteMany({ memberId: memberId });
    console.log(`Deleted ${paymentDeleteResult.deletedCount} payment(s) for member ${memberId}`);
    
    // Emit delete events for each payment
    for (const payment of memberPayments) {
      emitPaymentUpdate('deleted', { id: payment.id || payment._id });
    }

    // Note: Donations are NOT deleted - they are preserved for record keeping

    // Finally delete the member
    await UserModel.findOneAndDelete({ id: memberId });

    // Emit Socket.io event for real-time update
    emitMemberUpdate('deleted', { id: memberId });

    console.log(`✓ Member ${member.name} (${memberId}) deleted with ${invoiceDeleteResult.deletedCount} invoice(s) and ${paymentDeleteResult.deletedCount} payment(s). Donations preserved.`);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting member:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST import members from CSV/Excel file
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    await ensureConnection();

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = req.file.originalname.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
      return res.status(400).json({ error: "File must be CSV or Excel format (.csv, .xlsx, .xls)" });
    }

    let membersData = [];
    let rowErrors = []; // Track errors for each row

    if (isCSV) {
      // Parse CSV
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV file must have at least a header row and one data row" });
      }

      // Parse header row
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

      // Find column indices
      const memberIdIndex = headers.findIndex(h => h.includes('member id') || h.includes('memberid') || (h.includes('id') && !h.includes('email') && !h.includes('subscription')));
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('whatsapp') || h.includes('mobile'));
      const nativeIndex = headers.findIndex(h => h.includes('native') || h.includes('native place'));
      const statusIndex = headers.findIndex(h => h.includes('status'));
      const subscriptionTypeIndex = headers.findIndex(h => h.includes('subscription') || h.includes('type'));
      const subscriptionYearIndex = headers.findIndex(h => (h.includes('subscription') && h.includes('year')) || h.includes('subyear') || (h.includes('year') && !h.includes('start') && !h.includes('date')));
      const startDateIndex = headers.findIndex(h => h.includes('start') || h.includes('date'));

      if (nameIndex === -1) {
        return res.status(400).json({ error: "CSV must have 'name' column" });
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const rowNumber = i + 1; // Row number for error reporting (1-indexed, +1 for header)
        const errors = [];

        // Handle CSV with quoted fields
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));

        const memberId = memberIdIndex !== -1 ? values[memberIdIndex]?.trim() : '';
        const name = values[nameIndex]?.trim();
        const email = values[emailIndex]?.trim();

        // Validate required fields
        if (!name) {
          errors.push("Name is required");
        } else if (name.length < 2) {
          errors.push("Name must be at least 2 characters");
        }

        // Email is optional - only validate format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push("Invalid email format");
        }

        // Parse subscription year
        let subscriptionYear = null;
        if (subscriptionYearIndex !== -1 && values[subscriptionYearIndex]?.trim()) {
          const yearStr = values[subscriptionYearIndex].trim();
          const year = parseInt(yearStr, 10);
          if (isNaN(year)) {
            errors.push("Subscription Year must be a valid number");
          } else if (year < 1900 || year > 2100) {
            errors.push("Subscription Year must be between 1900 and 2100");
          } else {
            subscriptionYear = year.toString();
          }
        }

        // Parse start date
        let startDate = new Date();
        if (startDateIndex !== -1 && values[startDateIndex]?.trim()) {
          const dateStr = values[startDateIndex].trim();
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            startDate = parsedDate;
          } else {
            errors.push("Invalid start date format");
          }
        }

        // Store row data with errors
        if (errors.length > 0) {
          rowErrors.push({
            row: rowNumber,
            errors: errors,
            data: {
              id: memberId || '',
              name: name || '',
              email: email || '',
              phone: phoneIndex !== -1 ? (values[phoneIndex]?.trim() || '') : '',
              native: nativeIndex !== -1 ? (values[nativeIndex]?.trim().replace(/[^a-zA-Z\s]/g, '') || '') : '',
              subscriptionType: subscriptionTypeIndex !== -1 ? (values[subscriptionTypeIndex]?.trim() || 'Lifetime') : 'Lifetime',
              subscriptionYear: subscriptionYear || '',
              start_date: startDate.toISOString().split('T')[0],
            }
          });
        } else {
          // If phone is empty, provide a default placeholder to avoid validation errors
          let phoneValue = phoneIndex !== -1 ? (values[phoneIndex]?.trim() || '') : '';
          
          // Automatically add "+" prefix if missing and phone is not empty
          if (phoneValue && !phoneValue.startsWith('+')) {
            phoneValue = '+' + phoneValue;
          }
          
          const finalPhone = phoneValue || '+85200000000'; // Default placeholder for import if empty
          
          membersData.push({
            id: memberId || undefined, // Only include if provided
            name: name,
            email: email ? email.toLowerCase() : '', // Use empty string if no email provided
            phone: finalPhone,
            native: nativeIndex !== -1 ? (values[nativeIndex]?.trim().replace(/[^a-zA-Z\s]/g, '') || '') : '',
            status: statusIndex !== -1 ? (values[statusIndex]?.trim() || 'Active') : 'Active',
            subscriptionType: subscriptionTypeIndex !== -1 ? (values[subscriptionTypeIndex]?.trim() || 'Lifetime') : 'Lifetime',
            subscriptionYear: subscriptionYear || null,
            start_date: startDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
            payment_status: 'unpaid',
            next_due_date: null,
            _rowNumber: rowNumber, // Store original row number for error reporting
          });
        }
      }
    } else {
      // Parse Excel file using exceljs
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];

      // Find maximum column count by checking all rows
      let maxColumnCount = 0;
      worksheet.eachRow((row) => {
        if (row.cellCount > maxColumnCount) {
          maxColumnCount = row.cellCount;
        }
      });

      // Convert worksheet to array of arrays
      const data = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowData = new Array(maxColumnCount).fill(''); // Initialize with empty strings

        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          // Get cell value, handling different types
          let value = cell.value;
          if (value === null || value === undefined) {
            value = '';
          } else if (typeof value === 'object' && value.text !== undefined) {
            // Rich text cell
            value = value.text;
          } else if (value instanceof Date) {
            // Date cell - keep as Date object
            value = value;
          }
          // colNumber is 1-indexed, convert to 0-indexed
          rowData[colNumber - 1] = value;
        });
        data.push(rowData);
      });

      if (data.length < 2) {
        return res.status(400).json({ error: "Excel file must have at least a header row and one data row" });
      }

      // Get headers from first row
      const headers = data[0].map(h => String(h || '').trim().toLowerCase());

      // Find column indices
      const memberIdIndex = headers.findIndex(h => h.includes('member id') || h.includes('memberid') || (h.includes('id') && !h.includes('email') && !h.includes('subscription')));
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('whatsapp') || h.includes('mobile'));
      const nativeIndex = headers.findIndex(h => h.includes('native') || h.includes('native place'));
      const statusIndex = headers.findIndex(h => h.includes('status'));
      const subscriptionTypeIndex = headers.findIndex(h => h.includes('subscription') || h.includes('type'));
      const subscriptionYearIndex = headers.findIndex(h => (h.includes('subscription') && h.includes('year')) || h.includes('subyear') || (h.includes('year') && !h.includes('start') && !h.includes('date')));
      const startDateIndex = headers.findIndex(h => h.includes('start') || h.includes('date'));

      if (nameIndex === -1) {
        return res.status(400).json({ error: "Excel file must have 'name' column" });
      }

      // Parse data rows
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const rowNumber = i + 1; // Row number for error reporting (1-indexed, +1 for header)
        const errors = [];

        const memberId = memberIdIndex !== -1 ? String(row[memberIdIndex] || '').trim() : '';
        const name = String(row[nameIndex] || '').trim();
        const email = emailIndex !== -1 ? String(row[emailIndex] || '').trim() : '';

        // Validate required fields
        if (!name) {
          errors.push("Name is required");
        } else if (name.length < 2) {
          errors.push("Name must be at least 2 characters");
        }

        // Email is optional - only validate format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push("Invalid email format");
        }

        // Parse subscription year
        let subscriptionYear = null;
        if (subscriptionYearIndex !== -1 && row[subscriptionYearIndex] !== undefined && row[subscriptionYearIndex] !== null) {
          const yearValue = row[subscriptionYearIndex];
          let year;
          
          // Handle different Excel cell types (number, string, date)
          if (typeof yearValue === 'number') {
            year = Math.floor(yearValue);
          } else if (typeof yearValue === 'string' && yearValue.trim()) {
            year = parseInt(yearValue.trim(), 10);
          } else if (yearValue instanceof Date) {
            year = yearValue.getFullYear();
          } else {
            year = NaN;
          }
          
          if (isNaN(year)) {
            errors.push("Subscription Year must be a valid number");
          } else if (year < 1900 || year > 2100) {
            errors.push("Subscription Year must be between 1900 and 2100");
          } else {
            subscriptionYear = year.toString();
          }
        }

        // Parse start date
        let startDate = new Date();
        if (startDateIndex !== -1 && row[startDateIndex] !== undefined && row[startDateIndex] !== null) {
          const dateValue = row[startDateIndex];
          let parsedDate;

          // Excel dates are numbers (serial date), regular dates are strings
          if (typeof dateValue === 'number') {
            // Excel date serial number - convert to JavaScript date
            // Excel epoch is 1900-01-01, but Excel incorrectly treats 1900 as a leap year
            const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
            parsedDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 86400000);
          } else if (typeof dateValue === 'string' && dateValue.trim()) {
            parsedDate = new Date(dateValue);
          } else if (dateValue instanceof Date) {
            parsedDate = dateValue;
          }

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            startDate = parsedDate;
          } else if (startDateIndex !== -1 && row[startDateIndex] !== undefined && row[startDateIndex] !== null) {
            errors.push("Invalid start date format");
          }
        }

        // Store row data with errors
        if (errors.length > 0) {
          rowErrors.push({
            row: rowNumber,
            errors: errors,
            data: {
              id: memberId || '',
              name: name || '',
              email: email || '',
              phone: phoneIndex !== -1 ? String(row[phoneIndex] || '').trim() : '',
              native: nativeIndex !== -1 ? String(row[nativeIndex] || '').trim().replace(/[^a-zA-Z\s]/g, '') : '',
              subscriptionType: subscriptionTypeIndex !== -1 ? String(row[subscriptionTypeIndex] || 'Lifetime').trim() : 'Lifetime',
              subscriptionYear: subscriptionYear || '',
              start_date: startDate.toISOString().split('T')[0],
            }
          });
        } else {
          // If phone is empty, provide a default placeholder to avoid validation errors
          let phoneValue = phoneIndex !== -1 ? String(row[phoneIndex] || '').trim() : '';
          
          // Automatically add "+" prefix if missing and phone is not empty
          if (phoneValue && !phoneValue.startsWith('+')) {
            phoneValue = '+' + phoneValue;
          }
          
          const finalPhone = phoneValue || '+85200000000'; // Default placeholder for import if empty
          
          membersData.push({
            id: memberId || undefined, // Only include if provided
            name: name,
            email: email ? email.toLowerCase() : '', // Use empty string if no email provided
            phone: finalPhone,
            native: nativeIndex !== -1 ? String(row[nativeIndex] || '').trim().replace(/[^a-zA-Z\s]/g, '') : '',
            status: statusIndex !== -1 ? String(row[statusIndex] || 'Active').trim() : 'Active',
            subscriptionType: subscriptionTypeIndex !== -1 ? String(row[subscriptionTypeIndex] || 'Lifetime').trim() : 'Lifetime',
            subscriptionYear: subscriptionYear || null,
            start_date: startDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
            payment_status: 'unpaid',
            next_due_date: null,
            _rowNumber: rowNumber, // Store original row number for error reporting
          });
        }
      }
    }

    // Check for duplicate emails within the file and against database
    const emailMap = new Map(); // Track emails within file: email -> {row, memberIndex}
    const emailsToCheck = []; // Collect all valid emails to check against DB

    // First pass: Check for duplicates within the file
    const membersToRemove = new Set(); // Track indices to remove

    for (let i = 0; i < membersData.length; i++) {
      const member = membersData[i];
      const emailLower = member.email ? member.email.toLowerCase() : '';
      const rowNumber = member._rowNumber || (i + 2);

      // Skip duplicate checking if email is empty
      if (!emailLower) {
        continue;
      }

      if (emailMap.has(emailLower)) {
        // This email was seen before in the file
        const firstOccurrence = emailMap.get(emailLower);
        // Add error to current row
        rowErrors.push({
          row: rowNumber,
          errors: [`Email "${member.email}" already exists in row ${firstOccurrence.row}`],
          data: {
            name: member.name || '',
            email: member.email || '',
            phone: member.phone || '',
            subscriptionType: member.subscriptionType || 'Lifetime',
              subscriptionYear: member.subscriptionYear || '',
            start_date: member.start_date || '',
          }
        });
        membersToRemove.add(i);
      } else {
        emailMap.set(emailLower, { row: rowNumber, memberIndex: i });
        emailsToCheck.push(emailLower);
      }
    }

    // Remove duplicates from membersData (in reverse order to maintain indices)
    for (let i = membersData.length - 1; i >= 0; i--) {
      if (membersToRemove.has(i)) {
        membersData.splice(i, 1);
      }
    }

    // Check against database for existing emails
    if (emailsToCheck.length > 0) {
      const existingMembers = await UserModel.find({
        email: { $in: emailsToCheck }
      }).select('email').lean();

      const existingEmails = new Set(
        existingMembers.map(m => m.email.toLowerCase())
      );

      // Check each member's email against database
      const dbDuplicatesToRemove = [];
      for (let i = 0; i < membersData.length; i++) {
        const member = membersData[i];
        const emailLower = member.email ? member.email.toLowerCase() : '';

        // Skip duplicate checking if email is empty
        if (!emailLower) {
          continue;
        }

        if (existingEmails.has(emailLower)) {
          // Email exists in database
          const rowNumber = member._rowNumber || (i + 2);
          rowErrors.push({
            row: rowNumber,
            errors: [`Email "${member.email}" already exists in the system`],
            data: {
              name: member.name || '',
              email: member.email || '',
              phone: member.phone || '',
              subscriptionType: member.subscriptionType || 'Lifetime',
              subscriptionYear: member.subscriptionYear || '',
              start_date: member.start_date || '',
            }
          });
          dbDuplicatesToRemove.push(i);
        }
      }

      // Remove database duplicates (in reverse order)
      for (let i = dbDuplicatesToRemove.length - 1; i >= 0; i--) {
        membersData.splice(dbDuplicatesToRemove[i], 1);
      }
    }

    // Clean up _rowNumber from membersData before sending response
    membersData = membersData.map(({ _rowNumber, ...member }) => member);

    if (membersData.length === 0 && rowErrors.length === 0) {
      return res.status(400).json({ error: "No valid member data found in file" });
    }

    res.json({
      success: true,
      count: membersData.length,
      members: membersData,
      errors: rowErrors // Include errors in response
    });
  } catch (error) {
    console.error("Error importing members:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


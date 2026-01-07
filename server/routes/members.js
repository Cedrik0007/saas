import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { sendAccountApprovalEmail } from "../utils/emailHelpers.js";

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
      password: req.body.password || '',
      status: req.body.status || 'Pending',
      balance: req.body.balance || 'HK$0',
      nextDue: nextDueStr,
      lastPayment: req.body.lastPayment || '',
      subscriptionType: req.body.subscriptionType || 'Lifetime',
      // Payment management fields - set defaults on creation
      start_date: startDate,
      payment_status: 'unpaid',
      payment_mode: null,
      last_payment_date: null,
      next_due_date: nextDueDate,
      payment_proof: null,
    });

    const savedMember = await newMember.save();

    // Determine the invoice period first to check for duplicates accurately
    const subscriptionType = req.body.subscriptionType || 'Lifetime';
    let invoicePeriod = 'Lifetime Subscription';
    if (subscriptionType === 'Yearly + Janaza Fund') {
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
      let invoiceAmount = 'HK$250';
      let dueDate = new Date();

      if (subscriptionType === 'Yearly + Janaza Fund') {
        invoiceAmount = 'HK$500';
      }
      // Both types are yearly, set due date to 1 year from now
      dueDate.setFullYear(dueDate.getFullYear() + 1);

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
      console.log(`✓ Invoice created for new member ${savedMember.name} (${savedMember.id}): ${invoiceData.id}`);
    } else {
      console.log(`⚠ Invoice already exists for member ${savedMember.name} (${savedMember.id}), skipping duplicate creation`);
    }

    // Update member balance (this will also format it like "$250.00 Outstanding")
    await calculateAndUpdateMemberBalance(savedMember.id);

    // Fetch the updated member with the computed balance so frontend sees correct outstanding
    const updatedMember = await UserModel.findOne({ id: savedMember.id });

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
router.delete("/:id", async (req, res) => {
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
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('whatsapp') || h.includes('mobile'));
      const statusIndex = headers.findIndex(h => h.includes('status'));
      const subscriptionTypeIndex = headers.findIndex(h => h.includes('subscription') || h.includes('type'));
      const startDateIndex = headers.findIndex(h => h.includes('start') || h.includes('date'));

      if (nameIndex === -1 || emailIndex === -1) {
        return res.status(400).json({ error: "CSV must have 'name' and 'email' columns" });
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

        const name = values[nameIndex]?.trim();
        const email = values[emailIndex]?.trim();

        // Validate required fields
        if (!name) {
          errors.push("Name is required");
        } else if (name.length < 2) {
          errors.push("Name must be at least 2 characters");
        }

        if (!email) {
          errors.push("Email is required");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push("Invalid email format");
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
              name: name || '',
              email: email || '',
              phone: phoneIndex !== -1 ? (values[phoneIndex]?.trim() || '') : '',
              subscriptionType: subscriptionTypeIndex !== -1 ? (values[subscriptionTypeIndex]?.trim() || 'Lifetime') : 'Lifetime',
              start_date: startDate.toISOString().split('T')[0],
            }
          });
        } else {
          membersData.push({
            name: name,
            email: email.toLowerCase(),
            phone: phoneIndex !== -1 ? (values[phoneIndex]?.trim() || '') : '',
            status: statusIndex !== -1 ? (values[statusIndex]?.trim() || 'Active') : 'Active',
            subscriptionType: subscriptionTypeIndex !== -1 ? (values[subscriptionTypeIndex]?.trim() || 'Lifetime') : 'Lifetime',
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
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('whatsapp') || h.includes('mobile'));
      const statusIndex = headers.findIndex(h => h.includes('status'));
      const subscriptionTypeIndex = headers.findIndex(h => h.includes('subscription') || h.includes('type'));
      const startDateIndex = headers.findIndex(h => h.includes('start') || h.includes('date'));

      if (nameIndex === -1 || emailIndex === -1) {
        return res.status(400).json({ error: "Excel file must have 'name' and 'email' columns" });
      }

      // Parse data rows
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const rowNumber = i + 1; // Row number for error reporting (1-indexed, +1 for header)
        const errors = [];

        const name = String(row[nameIndex] || '').trim();
        const email = String(row[emailIndex] || '').trim();

        // Validate required fields
        if (!name) {
          errors.push("Name is required");
        } else if (name.length < 2) {
          errors.push("Name must be at least 2 characters");
        }

        if (!email) {
          errors.push("Email is required");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push("Invalid email format");
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
              name: name || '',
              email: email || '',
              phone: phoneIndex !== -1 ? String(row[phoneIndex] || '').trim() : '',
              subscriptionType: subscriptionTypeIndex !== -1 ? String(row[subscriptionTypeIndex] || 'Lifetime').trim() : 'Lifetime',
              start_date: startDate.toISOString().split('T')[0],
            }
          });
        } else {
          membersData.push({
            name: name,
            email: email.toLowerCase(),
            phone: phoneIndex !== -1 ? String(row[phoneIndex] || '').trim() : '',
            status: statusIndex !== -1 ? String(row[statusIndex] || 'Active').trim() : 'Active',
            subscriptionType: subscriptionTypeIndex !== -1 ? String(row[subscriptionTypeIndex] || 'Lifetime').trim() : 'Lifetime',
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
      const emailLower = member.email.toLowerCase();
      const rowNumber = member._rowNumber || (i + 2);

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
        const emailLower = member.email.toLowerCase();

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


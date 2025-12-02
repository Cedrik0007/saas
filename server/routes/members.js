import express from "express";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { sendAccountApprovalEmail } from "../utils/emailHelpers.js";

const router = express.Router();

// GET all members
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const members = await UserModel.find({}).sort({ createdAt: -1 }).lean();
    res.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message});
  }
});

// GET total members count
router.get("/count", async (req, res) => {
  try {
    await ensureConnection();
    const count = await UserModel.countDocuments();
    res.json({ total : count})
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message});
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
    
    const newMember = new UserModel({
      id: memberId,
      name: req.body.name || '',
      email: (req.body.email || '').trim().toLowerCase(),
      phone: req.body.phone || '',
      password: req.body.password || '',
      status: req.body.status || 'Pending',
      balance: req.body.balance || '$0',
      nextDue: req.body.nextDue || '',
      lastPayment: req.body.lastPayment || '',
      subscriptionType: req.body.subscriptionType || 'Monthly',
    });
    
    const savedMember = await newMember.save();
    
    // Check if invoice already exists for this member (prevent duplicates)
    const existingInvoice = await InvoiceModel.findOne({ 
      memberId: savedMember.id,
      status: { $in: ["Unpaid", "Pending Verification"] }
    });
    
    // Only create invoice if one doesn't already exist
    if (!existingInvoice) {
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
      console.log(`✓ Invoice created for new member ${savedMember.name} (${savedMember.id}): ${invoiceData.id}`);
    } else {
      console.log(`⚠ Invoice already exists for member ${savedMember.name} (${savedMember.id}), skipping duplicate creation`);
    }
    
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

export default router;


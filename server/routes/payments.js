import express from "express";
import { ensureConnection } from "../config/database.js";
import PaymentModel from "../models/Payment.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { sendPaymentApprovalEmail, sendPaymentRejectionEmail } from "../utils/emailHelpers.js";

const router = express.Router();

// GET all payments
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const allPayments = await PaymentModel.find({}).sort({ createdAt: -1 });
    res.json(allPayments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET payments for specific member
router.get("/member/:memberId", async (req, res) => {
  try {
    await ensureConnection();
    const memberPayments = await PaymentModel.find({
      $or: [
        { memberId: req.params.memberId },
        { memberEmail: req.params.memberId }
      ]
    }).sort({ createdAt: -1 });
    res.json(memberPayments);
  } catch (error) {
    console.error("Error fetching member payments:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new payment
router.post("/", async (req, res) => {
  try {
    await ensureConnection();
    
    const paymentData = {
      ...req.body,
      date: req.body.date || new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      status: req.body.status || "Pending",
    };
    
    const newPayment = new PaymentModel(paymentData);
    await newPayment.save();
    
    res.status(201).json(newPayment);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT approve payment
router.put("/:id/approve", async (req, res) => {
  try {
    await ensureConnection();
    
    // Try to find by _id first, then by id field
    let payment = await PaymentModel.findById(req.params.id);
    if (!payment) {
      payment = await PaymentModel.findOne({ id: req.params.id });
    }
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Update payment status
    payment.status = "Completed";
    payment.approvedBy = req.body.adminId || req.body.adminName || "Admin";
    payment.approvedAt = new Date();
    await payment.save();

    // Get related invoice and member for email
    let invoice = null;
    let member = null;
    
    if (payment.invoiceId) {
      invoice = await InvoiceModel.findOne({ id: payment.invoiceId });
    }
    
    if (payment.memberId) {
      member = await UserModel.findOne({ id: payment.memberId });
    }
    
    if (!member && payment.memberEmail) {
      member = await UserModel.findOne({ email: payment.memberEmail.toLowerCase() });
    }

    // Update related invoice to Paid
    if (payment.invoiceId) {
      const invoiceUpdate = {
        status: "Paid",
        method: payment.method,
        reference: payment.reference,
        screenshot: payment.screenshot
      };
      
      // Preserve paidToAdmin fields for cash payments
      if (payment.paidToAdmin) {
        invoiceUpdate.paidToAdmin = payment.paidToAdmin;
      }
      if (payment.paidToAdminName) {
        invoiceUpdate.paidToAdminName = payment.paidToAdminName;
      }
      
      await InvoiceModel.findOneAndUpdate(
        { id: payment.invoiceId },
        { $set: invoiceUpdate }
      );
      
      // Update member balance
      await calculateAndUpdateMemberBalance(payment.memberId);
    }

    // Send approval email
    if (member) {
      await sendPaymentApprovalEmail(member, payment, invoice);
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT reject payment
router.put("/:id/reject", async (req, res) => {
  try {
    await ensureConnection();
    
    // Try to find by _id first, then by id field
    let payment = await PaymentModel.findById(req.params.id);
    if (!payment) {
      payment = await PaymentModel.findOne({ id: req.params.id });
    }
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Update payment status
    payment.status = "Rejected";
    payment.rejectionReason = req.body.reason || "";
    payment.rejectedBy = req.body.adminId || req.body.adminName || "Admin";
    payment.rejectedAt = new Date();
    await payment.save();

    // Get related invoice and member for email
    let invoice = null;
    let member = null;
    
    if (payment.invoiceId) {
      invoice = await InvoiceModel.findOne({ id: payment.invoiceId });
    }
    
    if (payment.memberId) {
      member = await UserModel.findOne({ id: payment.memberId });
    }
    
    if (!member && payment.memberEmail) {
      member = await UserModel.findOne({ email: payment.memberEmail.toLowerCase() });
    }

    // Update related invoice back to Unpaid
    if (payment.invoiceId) {
      await InvoiceModel.findOneAndUpdate(
        { id: payment.invoiceId },
        { 
          $set: { 
            status: "Unpaid",
            method: "",
            reference: "",
            screenshot: ""
          }
        }
      );
      
      // Update member balance
      await calculateAndUpdateMemberBalance(payment.memberId);
    }

    // Send rejection email
    if (member) {
      await sendPaymentRejectionEmail(member, payment, invoice, payment.rejectionReason);
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error("Error rejecting payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update payment
router.put("/:id", async (req, res) => {
  try {
    await ensureConnection();
    
    // Try to find by _id first, then by id field
    let payment = await PaymentModel.findById(req.params.id);
    if (!payment) {
      payment = await PaymentModel.findOne({ id: req.params.id });
    }
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Update payment fields
    const updateData = { ...req.body };
    delete updateData._id; // Don't allow _id updates
    delete updateData.id; // Don't allow id updates
    
    Object.assign(payment, updateData);
    await payment.save();

    res.json({ success: true, payment });
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE payment
router.delete("/:id", async (req, res) => {
  try {
    await ensureConnection();
    
    // Try to find by _id first, then by id field
    let payment = await PaymentModel.findById(req.params.id);
    if (!payment) {
      payment = await PaymentModel.findOne({ id: req.params.id });
    }
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // If payment was approved and has an invoice, revert invoice status
    if (payment.status === "Completed" && payment.invoiceId) {
      await InvoiceModel.findOneAndUpdate(
        { id: payment.invoiceId },
        { 
          $set: { 
            status: "Unpaid",
            method: "",
            reference: "",
            screenshot: ""
          }
        }
      );
      
      // Update member balance
      if (payment.memberId) {
        await calculateAndUpdateMemberBalance(payment.memberId);
      }
    }

    // Delete the payment
    await PaymentModel.findByIdAndDelete(payment._id);

    res.json({ success: true, message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


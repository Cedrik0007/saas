import express from "express";
import { ensureConnection } from "../config/database.js";
import PaymentModel from "../models/Payment.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { sendPaymentApprovalEmail, sendPaymentRejectionEmail } from "../utils/emailHelpers.js";
import { emitPaymentUpdate } from "../config/socket.js";

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
  const member = await UserModel.findOne({ id: memberId });
  if (!member) {
    const error = new Error(`Member with ID "${memberId}" not found.`);
    error.status = 404;
    throw error;
  }
  return member;
};

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

    let memberId;
    try {
      memberId = assertValidMemberId(req.params.memberId);
    } catch (validationError) {
      return res.status(validationError.status || 400).json({ error: validationError.message });
    }

    try {
      await findMemberOrThrow(memberId);
    } catch (memberError) {
      return res.status(memberError.status || 404).json({ error: memberError.message });
    }

    const memberPayments = await PaymentModel.find({ memberId }).sort({ createdAt: -1 });
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

    let memberId;
    try {
      memberId = assertValidMemberId(req.body.memberId);
    } catch (validationError) {
      return res.status(validationError.status || 400).json({ error: validationError.message });
    }

    let memberRecord;
    try {
      memberRecord = await findMemberOrThrow(memberId);
    } catch (memberError) {
      return res.status(memberError.status || 404).json({ error: memberError.message });
    }

    const paymentData = {
      ...req.body,
      memberId,
      member: req.body.member || memberRecord.name || "",
      memberEmail: req.body.memberEmail || memberRecord.email || "",
      date: req.body.date || new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      status: req.body.status || "Pending",
    };

    const newPayment = new PaymentModel(paymentData);
    await newPayment.save();

    // Emit Socket.io event for real-time update
    emitPaymentUpdate('created', newPayment);

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

    let normalizedMemberId;
    try {
      normalizedMemberId = assertValidMemberId(payment.memberId, "payment.memberId");
    } catch (validationError) {
      return res.status(validationError.status || 400).json({ error: validationError.message });
    }
    payment.memberId = normalizedMemberId;

    try {
      member = await findMemberOrThrow(normalizedMemberId);
      console.log(`✓ Payment approval: payment=${payment.id}, payment.memberId=${normalizedMemberId}, fetched member.id=${member.id}, member.name=${member.name}`);
    } catch (memberError) {
      return res.status(memberError.status || 404).json({ error: memberError.message });
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
      await calculateAndUpdateMemberBalance(normalizedMemberId);

      // AUTOMATIC NEXT DUE DATE UPDATE LOGIC
      if (member && invoice) {
        let nextDueYear = null;
        const periodStr = String(invoice.period || "").trim();

        // Attempt to extract year from period (e.g. "2025" or "Jan 2025 Yearly...")
        const yearMatch = periodStr.match(/\d{4}/);
        if (yearMatch) {
          nextDueYear = parseInt(yearMatch[0]) + 1;
        }
        // Fallback for yearly/lifetime subscriptions without a specific year
        else if (periodStr.toLowerCase().includes("yearly") || periodStr.toLowerCase().includes("lifetime")) {
          // Default to next year from now if generic yearly/lifetime
          nextDueYear = new Date().getFullYear() + 1;
        }

        if (nextDueYear) {
          const newNextDueDate = new Date(nextDueYear, 0, 1); // Jan 1st of next year

          // Format as YYYY-MM-DD for consistency
          const year = newNextDueDate.getFullYear();
          const month = String(newNextDueDate.getMonth() + 1).padStart(2, '0');
          const day = String(newNextDueDate.getDate()).padStart(2, '0');
          const nextDueStr = `${year}-${month}-${day}`;

          // Check if this is a lifetime membership full payment
          // Check by invoice type, amount (5250), or membershipFee (5000)
          const isLifetimeMembershipFullPayment = member.subscriptionType === "Lifetime Membership" 
            && !member.lifetimeMembershipPaid 
            && (
              invoice.invoiceType === "lifetime_membership" ||
              invoice.amount === "HK$5250" ||
              invoice.membershipFee === 5000
            );

          const memberUpdate = {
            payment_status: 'paid',
            last_payment_date: new Date(),
            next_due_date: newNextDueDate,
            nextDue: nextDueStr
          };
          
          // Mark lifetime membership as paid if this is the full payment
          if (isLifetimeMembershipFullPayment) {
            memberUpdate.lifetimeMembershipPaid = true;
            console.log(`✓ Marked lifetime membership as paid for member ${member.name} (${member.id})`);
          }

          await UserModel.findOneAndUpdate(
            { id: member.id },
            { $set: memberUpdate }
          );

          console.log(`✓ Updated next due date for member ${member.name} to ${nextDueYear} (Invoice Period: ${periodStr})`);
        } else {
          // Standard update for non-yearly payments, just mark as paid
          await UserModel.findOneAndUpdate(
            { id: member.id },
            {
              $set: {
                payment_status: 'paid',
                last_payment_date: new Date()
              }
            }
          );
        }
      }
    }

    // Do NOT automatically generate receipt number - only use if already exists in invoice
    // Refresh invoice to get latest data
    if (invoice && payment.invoiceId) {
      invoice = await InvoiceModel.findOne({ id: payment.invoiceId });
    }

    // Send approval email (will use the receipt number from invoice if available)
    if (member) {
      await sendPaymentApprovalEmail(member, payment, invoice);
    }

    // Emit Socket.io event for real-time update
    emitPaymentUpdate('updated', payment);

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

    let normalizedMemberId;
    try {
      normalizedMemberId = assertValidMemberId(payment.memberId, "payment.memberId");
    } catch (validationError) {
      return res.status(validationError.status || 400).json({ error: validationError.message });
    }
    payment.memberId = normalizedMemberId;

    try {
      member = await findMemberOrThrow(normalizedMemberId);
    } catch (memberError) {
      return res.status(memberError.status || 404).json({ error: memberError.message });
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
      await calculateAndUpdateMemberBalance(normalizedMemberId);
    }

    // Send rejection email
    if (member) {
      await sendPaymentRejectionEmail(member, payment, invoice, payment.rejectionReason);
    }

    // Emit Socket.io event for real-time update
    emitPaymentUpdate('updated', payment);

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

    if (Object.prototype.hasOwnProperty.call(updateData, "memberId")) {
      try {
        updateData.memberId = assertValidMemberId(updateData.memberId);
      } catch (validationError) {
        return res.status(validationError.status || 400).json({ error: validationError.message });
      }

      try {
        await findMemberOrThrow(updateData.memberId);
      } catch (memberError) {
        return res.status(memberError.status || 404).json({ error: memberError.message });
      }
    }

    Object.assign(payment, updateData);
    await payment.save();

    // Emit Socket.io event for real-time update
    emitPaymentUpdate('updated', payment);

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


import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import PaymentModel from "../models/Payment.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import { getNextReceiptNumberStrict } from "../utils/receiptCounter.js";

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

export async function approvePaymentAndMarkInvoicePaid({ paymentId, adminId, adminName }) {
  await ensureConnection();

  const session = await mongoose.startSession();
  let payment;
  let invoice;
  let member;

  try {
    await session.withTransaction(async () => {
      payment = await PaymentModel.findById(paymentId).session(session);
      if (!payment) {
        payment = await PaymentModel.findOne({ id: paymentId }).session(session);
      }
      if (!payment) {
        const error = new Error("Payment not found");
        error.status = 404;
        throw error;
      }

      const normalizedMemberId = assertValidMemberId(payment.memberId, "payment.memberId");
      payment.memberId = normalizedMemberId;

      member = await UserModel.findOne({ id: normalizedMemberId }).session(session);
      if (!member) {
        const error = new Error(`Member with ID "${normalizedMemberId}" not found.`);
        error.status = 404;
        throw error;
      }

      if (!payment.invoiceId) {
        const error = new Error("Payment is missing invoiceId.");
        error.status = 400;
        throw error;
      }

      invoice = await InvoiceModel.findOne({ id: payment.invoiceId }).session(session);
      if (!invoice) {
        const error = new Error("Invoice not found");
        error.status = 404;
        throw error;
      }

      payment.status = "Completed";
      payment.approvedBy = adminId || adminName || "Admin";
      payment.approvedAt = new Date();
      await payment.save({ session });

      const receiptNumber = await getNextReceiptNumberStrict({ session });

      const invoiceUpdate = {
        status: "Paid",
        receiptNumber,
        method: payment.method,
        reference: payment.reference,
        screenshot: payment.screenshot,
      };

      if (payment.paidToAdmin) {
        invoiceUpdate.paidToAdmin = payment.paidToAdmin;
      }
      if (payment.paidToAdminName) {
        invoiceUpdate.paidToAdminName = payment.paidToAdminName;
      }

      const updatedInvoice = await InvoiceModel.findOneAndUpdate(
        { id: payment.invoiceId },
        { $set: invoiceUpdate },
        { new: true, runValidators: true, session, allowPaidStatusUpdate: true }
      );

      if (!updatedInvoice) {
        const error = new Error("Failed to update invoice during payment approval");
        error.status = 500;
        throw error;
      }

      invoice = updatedInvoice;

      // AUTOMATIC NEXT DUE DATE UPDATE LOGIC
      let nextDueYear = null;
      const periodStr = String(invoice.period || "").trim();

      const yearMatch = periodStr.match(/\d{4}/);
      if (yearMatch) {
        nextDueYear = parseInt(yearMatch[0]) + 1;
      } else if (periodStr.toLowerCase().includes("yearly") || periodStr.toLowerCase().includes("lifetime")) {
        nextDueYear = new Date().getFullYear() + 1;
      }

      if (nextDueYear) {
        const newNextDueDate = new Date(nextDueYear, 0, 1);

        const year = newNextDueDate.getFullYear();
        const month = String(newNextDueDate.getMonth() + 1).padStart(2, "0");
        const day = String(newNextDueDate.getDate()).padStart(2, "0");
        const nextDueStr = `${year}-${month}-${day}`;

        const isLifetimeMembershipFullPayment = member.subscriptionType === "Lifetime Membership"
          && !member.lifetimeMembershipPaid
          && (
            invoice.invoiceType === "lifetime_membership" ||
            invoice.amount === "HK$5250" ||
            invoice.membershipFee === 5000
          );

        const memberUpdate = {
          payment_status: "paid",
          last_payment_date: new Date(),
          next_due_date: newNextDueDate,
          nextDue: nextDueStr,
        };

        if (isLifetimeMembershipFullPayment) {
          memberUpdate.lifetimeMembershipPaid = true;
        }

        await UserModel.findOneAndUpdate(
          { id: member.id },
          { $set: memberUpdate },
          { session }
        );
      } else {
        await UserModel.findOneAndUpdate(
          { id: member.id },
          { $set: { payment_status: "paid", last_payment_date: new Date() } },
          { session }
        );
      }
    });

    return { payment, invoice, member };
  } finally {
    session.endSession();
  }
}

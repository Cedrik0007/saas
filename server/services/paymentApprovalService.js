import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import PaymentModel from "../models/Payment.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import { getNextReceiptNumberStrict } from "../utils/receiptCounter.js";
import { resolveInvoice, resolveMember } from "../utils/resolveRefs.js";

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

      const memberRefInput = payment.memberRef || payment.memberId;
      member = await resolveMember(memberRefInput, { session });

      const invoiceRefInput = payment.invoiceRef || payment.invoiceId;
      if (!invoiceRefInput) {
        const error = new Error("Payment is missing invoice reference.");
        error.status = 400;
        throw error;
      }

      invoice = await resolveInvoice(invoiceRefInput, { session });

      if (member?._id) {
        payment.memberRef = member._id;
      }
      if (member?.id) {
        payment.memberId = member.id;
      }
      if (invoice?._id) {
        payment.invoiceRef = invoice._id;
      }
      if (invoice?.id) {
        payment.invoiceId = invoice.id;
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
        { _id: invoice._id },
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
          { _id: member._id },
          { $set: memberUpdate },
          { session }
        );
      } else {
        await UserModel.findOneAndUpdate(
          { _id: member._id },
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

export async function approveInvoicePayment({
  invoiceRef,
  memberRef,
  amount,
  paymentType,
  method,
  receiverName,
  reference,
  screenshot,
  date,
  paidToAdmin,
  paidToAdminName,
  approvedBy,
}) {
  await ensureConnection();

  const session = await mongoose.startSession();
  let payment;
  let invoice;
  let member;

  try {
    await session.withTransaction(async () => {
      invoice = await resolveInvoice(invoiceRef, { session });
      member = await resolveMember(memberRef, { session });

      if (invoice.status === "Paid" || invoice.status === "Completed") {
        const error = new Error("Invoice is already marked as paid.");
        error.status = 400;
        throw error;
      }

      const parsedDate = date ? new Date(date) : null;
      const paymentDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
      const paymentDateLabel = paymentDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      payment = new PaymentModel({
        invoiceRef: invoice._id,
        memberRef: member._id,
        invoiceId: invoice.id || undefined,
        memberId: member.id || undefined,
        member: member.name || "",
        memberEmail: member.email || "",
        amount: amount || invoice.amount,
        payment_type: paymentType || "online",
        method,
        receiver_name: receiverName,
        reference,
        period: invoice.period,
        status: "Completed",
        date: paymentDateLabel,
        screenshot: screenshot || undefined,
        paidToAdmin,
        paidToAdminName,
        approvedBy: approvedBy || "Admin",
        approvedAt: paymentDate,
      });

      await payment.save({ session });

      const receiptNumber = await getNextReceiptNumberStrict({ session });

      const invoiceUpdate = {
        status: "Paid",
        receiptNumber,
        method,
        reference,
        screenshot: screenshot || null,
        payment_mode: paymentType || null,
        payment_proof: screenshot || null,
        last_payment_date: paymentDate,
      };

      if (paidToAdmin) {
        invoiceUpdate.paidToAdmin = paidToAdmin;
      }
      if (paidToAdminName) {
        invoiceUpdate.paidToAdminName = paidToAdminName;
      }

      const updatedInvoice = await InvoiceModel.findByIdAndUpdate(
        invoice._id,
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
        nextDueYear = paymentDate.getFullYear() + 1;
      }

      const lastPaymentDisplay = paymentDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).replace(",", "");

      if (nextDueYear) {
        const newNextDueDate = new Date(nextDueYear, 0, 1);
        newNextDueDate.setHours(0, 0, 0, 0);

        const nextDueDisplay = newNextDueDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).replace(",", "");

        const isLifetimeMembershipFullPayment = member.subscriptionType === "Lifetime Membership"
          && !member.lifetimeMembershipPaid
          && (
            invoice.invoiceType === "lifetime_membership" ||
            invoice.amount === "HK$5250" ||
            invoice.membershipFee === 5000
          );

        const memberUpdate = {
          payment_status: "paid",
          payment_mode: paymentType || null,
          last_payment_date: paymentDate,
          next_due_date: newNextDueDate,
          payment_proof: screenshot || null,
          lastPayment: lastPaymentDisplay,
          nextDue: nextDueDisplay,
        };

        if (isLifetimeMembershipFullPayment) {
          memberUpdate.lifetimeMembershipPaid = true;
        }

        member = await UserModel.findByIdAndUpdate(
          member._id,
          { $set: memberUpdate },
          { session, new: true }
        );
      } else {
        member = await UserModel.findByIdAndUpdate(
          member._id,
          {
            $set: {
              payment_status: "paid",
              payment_mode: paymentType || null,
              last_payment_date: paymentDate,
              payment_proof: screenshot || null,
              lastPayment: lastPaymentDisplay,
            },
          },
          { session, new: true }
        );
      }
    });

    return { payment, invoice, member };
  } finally {
    session.endSession();
  }
}

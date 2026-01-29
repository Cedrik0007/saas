import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import PaymentModel from "../models/Payment.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import { getNextReceiptNumberStrict } from "../utils/receiptCounter.js";
import { resolveInvoice, resolveMember } from "../utils/resolveRefs.js";
import { getNextSequence } from "../utils/sequence.js";
import { getReceiptDownloadUrl, getReceiptWhatsAppUrl } from "../utils/receiptLinks.js";
import { normalizeSubscriptionType, SUBSCRIPTION_TYPES } from "../utils/subscriptionTypes.js";

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

      if (payment.paymentNo === undefined || payment.paymentNo === null) {
        payment.paymentNo = await getNextSequence("paymentNo", { session });
      }

      payment.status = "Completed";
      payment.approvedBy = adminId || adminName || "Admin";
      payment.approvedAt = new Date();

      const receiptNumber = await getNextReceiptNumberStrict({ session });
      payment.receiptNumber = receiptNumber;
      await payment.save({ session });

      const invoiceUpdate = {
        status: "Paid",
        receiptNumber,
        method: payment.method,
        reference: payment.reference,
        screenshot: payment.screenshot,
        receiver_name: payment.receiver_name || null,
        last_payment_date: payment.approvedAt,
        memberRef: member?._id,
        memberNo: member?.memberNo,
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
      invoice.receiptPdfUrl = getReceiptWhatsAppUrl(invoice._id);

      // Update member balance atomically inside the transaction
      const unpaidInvoices = await InvoiceModel.find(
        {
          ...buildInvoiceMemberMatch(member),
          status: { $in: ["Unpaid", "Overdue"] },
        },
        null,
        { session }
      );

      const outstandingTotal = unpaidInvoices.reduce((sum, inv) => {
        const amount = parseFloat(String(inv.amount || "").replace(/HK\$|\$/g, "").replace(",", "")) || 0;
        return sum + amount;
      }, 0);

      let balanceString = `HK$${outstandingTotal.toFixed(2)}`;
      if (outstandingTotal === 0) {
        balanceString = "HK$0";
      } else {
        const hasOverdue = unpaidInvoices.some(inv => inv.status === "Overdue");
        balanceString += hasOverdue ? " Overdue" : " Outstanding";
      }

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

        const normalizedMemberType = normalizeSubscriptionType(member?.subscriptionType);
        const membershipFeeNumber = Number(invoice?.membershipFee || 0);
        const invoiceAmountNumber = parseFloat(String(invoice?.amount || "").replace(/[^0-9.]/g, "")) || 0;
        const isLifetimeMembershipFullPayment =
          normalizedMemberType === SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND &&
          !member.lifetimeMembershipPaid &&
          (invoice.invoiceType === "lifetime_membership" || membershipFeeNumber >= 5000 || invoiceAmountNumber >= 5000);

        const memberUpdate = {
          payment_status: "paid",
          last_payment_date: new Date(),
          next_due_date: newNextDueDate,
          nextDue: nextDueStr,
          balance: balanceString,
        };

        if (isLifetimeMembershipFullPayment) {
          memberUpdate.lifetimeMembershipPaid = true;
          memberUpdate.janazaOnly = false;
        }

        await UserModel.findOneAndUpdate(
          { _id: member._id },
          { $set: memberUpdate },
          { session }
        );
      } else {
        await UserModel.findOneAndUpdate(
          { _id: member._id },
          { $set: { payment_status: "paid", last_payment_date: new Date(), balance: balanceString } },
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

      const receiptNumber = await getNextReceiptNumberStrict({ session });

      payment = new PaymentModel({
        paymentNo: await getNextSequence("paymentNo", { session }),
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
        receiptNumber,
      });

      await payment.save({ session });

      const invoiceUpdate = {
        status: "Paid",
        receiptNumber: payment.receiptNumber,
        method,
        reference,
        screenshot: screenshot || null,
        payment_mode: paymentType || null,
        payment_proof: screenshot || null,
        last_payment_date: payment.approvedAt,
        receiver_name: payment.receiver_name || null,
        memberRef: member?._id,
        memberNo: member?.memberNo,
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
      // Receipt link should never block payment approval.
      try {
        invoice.receiptPdfUrl = getReceiptDownloadUrl(invoice._id) || getReceiptWhatsAppUrl(invoice._id);
      } catch (receiptError) {
        console.warn("⚠ Failed to build receipt URL during payment approval:", receiptError);
        invoice.receiptPdfUrl = getReceiptWhatsAppUrl(invoice._id) || null;
      }

      const unpaidInvoices = await InvoiceModel.find(
        {
          ...buildInvoiceMemberMatch(member),
          status: { $in: ["Unpaid", "Overdue"] },
        },
        null,
        { session }
      );

      const outstandingTotal = unpaidInvoices.reduce((sum, inv) => {
        const amount = parseFloat(String(inv.amount || "").replace(/HK\$|\$/g, "").replace(",", "")) || 0;
        return sum + amount;
      }, 0);

      let balanceString = `HK$${outstandingTotal.toFixed(2)}`;
      if (outstandingTotal === 0) {
        balanceString = "HK$0";
      } else {
        const hasOverdue = unpaidInvoices.some(inv => inv.status === "Overdue");
        balanceString += hasOverdue ? " Overdue" : " Outstanding";
      }

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

        const normalizedMemberType = normalizeSubscriptionType(member?.subscriptionType);
        const membershipFeeNumber = Number(invoice?.membershipFee || 0);
        const invoiceAmountNumber = parseFloat(String(invoice?.amount || "").replace(/[^0-9.]/g, "")) || 0;
        const isLifetimeMembershipFullPayment =
          normalizedMemberType === SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND &&
          !member.lifetimeMembershipPaid &&
          (invoice.invoiceType === "lifetime_membership" || membershipFeeNumber >= 5000 || invoiceAmountNumber >= 5000);

        const memberUpdate = {
          payment_status: "paid",
          payment_mode: paymentType || null,
          last_payment_date: paymentDate,
          next_due_date: newNextDueDate,
          payment_proof: screenshot || null,
          lastPayment: lastPaymentDisplay,
          nextDue: nextDueDisplay,
          balance: balanceString,
        };

        if (isLifetimeMembershipFullPayment) {
          memberUpdate.lifetimeMembershipPaid = true;
          memberUpdate.janazaOnly = false;
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
              balance: balanceString,
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

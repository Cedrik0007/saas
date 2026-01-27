import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";

const objectIdRegex = /^[a-f\d]{24}$/i;

const normalizeValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const resolveMemberForBalance = async (identifier, session) => {
  const normalized = normalizeValue(identifier);
  if (!normalized) return null;

  const sessionOptions = session ? { session } : {};

  if (objectIdRegex.test(normalized)) {
    return UserModel.findById(normalized, null, sessionOptions);
  }

  const numericCandidate = Number.parseInt(normalized, 10);
  const memberNoQuery = Number.isNaN(numericCandidate) ? null : { memberNo: numericCandidate };

  return UserModel.findOne(
    {
      $or: [
        { id: normalized },
        { "previousDisplayIds.id": normalized },
        memberNoQuery,
      ].filter(Boolean),
    },
    null,
    sessionOptions
  );
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

// Helper function to calculate and update member balance from unpaid invoices
export async function calculateAndUpdateMemberBalance(memberIdentifier, options = {}) {
  try {
    await ensureConnection();

    const session = options.session || null;
    const member = await resolveMemberForBalance(memberIdentifier, session);

    if (!member) {
      throw new Error("Member not found for balance update.");
    }

    const invoiceMatch = buildInvoiceMemberMatch(member);

    const unpaidInvoices = await InvoiceModel.find(
      {
        ...invoiceMatch,
        status: { $in: ["Unpaid", "Overdue"] },
      },
      null,
      session ? { session } : {}
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

    await UserModel.findOneAndUpdate(
      { _id: member._id },
      { $set: { balance: balanceString } },
      { new: true, ...(session ? { session } : {}) }
    );

    console.log(`✓ Updated balance for member ${member.id || member._id}: ${balanceString}`);
    return balanceString;
  } catch (error) {
    console.error(`Error updating balance for member ${memberIdentifier}:`, error);
    throw error;
  }
}


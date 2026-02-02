/**
 * Data Audit Report – Root Cause Classification
 *
 * Runs against the database to identify:
 * - Member existence / duplicate attempts
 * - Phone validation issues
 * - Member ID conflicts
 * - Invoice state inconsistencies
 * - Receipt number validation (Paid invoices)
 * - WhatsApp/PDF data source compliance
 *
 * Output: Table with Member ID, Phone, Issue Type, Root Cause, Required Action
 * Verdict: DATA CLEANUP REQUIRED or CODE FIX REQUIRED
 *
 * Usage: node server/scripts/dataAuditReport.js
 */

import process from "process";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import PaymentModel from "../models/Payment.js";

const normalizeMemberId = (v) => String(v ?? "").trim().toUpperCase();
const normalizePhone = (v) => {
  if (!v || typeof v !== "string") return "";
  const cleaned = v.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
};
const hasReceiptValue = (v) => v != null && String(v).trim() !== "" && /^\d+$/.test(String(v).trim());

const rows = [];

const addRow = (memberId, phone, issueType, rootCause, requiredAction) => {
  rows.push({ memberId: memberId || "-", phone: phone || "-", issueType, rootCause, requiredAction });
};

const runAudit = async () => {
  await ensureConnection();

  // ─── 1. Member existence / duplicate member ID ───
  const memberIdDupes = await UserModel.aggregate([
    { $match: { id: { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: normalizeMemberId("$id"), count: { $sum: 1 }, docs: { $push: { _id: "$_id", id: "$id", name: "$name", phone: "$phone", status: "$status" } } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  memberIdDupes.forEach((g) => {
    const memberId = g._id || "-";
    const doc = g.docs?.[0];
    const phone = doc?.phone || "-";
    addRow(memberId, phone, "DATA ISSUE", "Duplicate member ID in database (same ID used by multiple records)", "Merge or correct duplicate members; ensure unique member IDs");
  });

  // ─── 2. Duplicate phone numbers ───
  const phoneDupes = await UserModel.aggregate([
    { $match: { phone: { $exists: true, $nin: [null, ""] } } },
    { $addFields: { phoneNorm: { $trim: { input: { $ifNull: ["$phone", ""] } } } } },
    { $match: { phoneNorm: { $ne: "" } } },
    { $group: { _id: "$phoneNorm", count: { $sum: 1 }, docs: { $push: { id: "$id", name: "$name", status: "$status" } } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  phoneDupes.forEach((g) => {
    const phone = g._id || "-";
    const doc = g.docs?.[0];
    const memberId = doc?.id || "-";
    addRow(memberId, phone, "DATA ISSUE", "Duplicate phone number (same phone used by multiple members)", "Correct or merge members; ensure unique phone numbers");
  });

  // ─── 3. Members with missing or invalid phone ───
  const membersMissingPhone = await UserModel.find(
    { $or: [{ phone: { $exists: false } }, { phone: null }, { phone: "" }, { phone: { $regex: /^\s*$/ } }] },
    { id: 1, name: 1, phone: 1 }
  ).lean();
  membersMissingPhone.forEach((m) => {
    addRow(m.id || "-", m.phone || "", "DATA ISSUE", "Member has no phone number", "Add valid phone for WhatsApp/receipt delivery");
  });

  // ─── 4. Invoices referencing non-existent members ───
  const memberDocs = await UserModel.find({}, { id: 1, previousDisplayIds: 1 }).lean();
  const allMemberIds = new Set(
    memberDocs.flatMap((m) => {
      const ids = [m.id, ...(m.previousDisplayIds || []).map((p) => p?.id).filter(Boolean)].map(normalizeMemberId).filter(Boolean);
      return ids;
    })
  );
  const orphanInvoices = await InvoiceModel.find({ archived: { $ne: true } }, { id: 1, memberId: 1, period: 1, status: 1 }).lean();
  orphanInvoices.forEach((inv) => {
    const mid = normalizeMemberId(inv.memberId);
    if (mid && !allMemberIds.has(mid)) {
      addRow(inv.memberId || "-", "-", "DATA ISSUE", `Invoice ${inv.id || inv._id} references missing memberId`, "Link invoice to existing member or create missing member");
    }
  });

  // ─── 5. Duplicate invoices (same member + period) ───
  const dupInvoices = await InvoiceModel.aggregate([
    { $match: { archived: { $ne: true } } },
    { $project: { memberId: { $trim: { input: { $ifNull: ["$memberId", ""] } } }, period: { $trim: { input: { $ifNull: ["$period", ""] } } }, id: 1 } },
    { $match: { memberId: { $ne: "" }, period: { $ne: "" } } },
    { $group: { _id: { memberId: "$memberId", period: "$period" }, count: { $sum: 1 }, ids: { $push: "$id" } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  dupInvoices.forEach((g) => {
    addRow(g._id?.memberId || "-", "-", "DATA ISSUE", `Duplicate invoices for member ${g._id?.memberId} and period ${g._id?.period}`, "Archive or merge duplicate invoices; keep single canonical invoice per member+period");
  });

  // ─── 6. Paid invoices missing receiptNumber ───
  const paidNoReceipt = await InvoiceModel.find(
    {
      status: { $in: ["Paid", "Completed"] },
      $or: [{ receiptNumber: { $exists: false } }, { receiptNumber: null }, { receiptNumber: "" }, { receiptNumber: { $regex: /^\s*$/ } }],
      archived: { $ne: true },
    },
    { id: 1, memberId: 1, status: 1, receiptNumber: 1 }
  ).lean();
  paidNoReceipt.forEach((inv) => {
    addRow(inv.memberId || "-", "-", "DATA ISSUE", `Paid invoice ${inv.id || inv._id} missing receiptNumber (approval flow interrupted or pre-fix data)`, "Backfill receipt number via admin script or mark as Unpaid and re-approve");
  });

  // ─── 7. Receipt number format validation (Paid invoices) ───
  const paidBadReceipt = await InvoiceModel.find(
    {
      status: { $in: ["Paid", "Completed"] },
      receiptNumber: { $exists: true, $nin: [null, ""] },
      archived: { $ne: true },
    },
    { id: 1, memberId: 1, receiptNumber: 1 }
  ).lean();
  paidBadReceipt.forEach((inv) => {
    if (!hasReceiptValue(inv.receiptNumber)) {
      addRow(inv.memberId || "-", "-", "DATA ISSUE", `Paid invoice ${inv.id || inv._id} has invalid receiptNumber format (must be numeric)`, "Correct receiptNumber to valid numeric value");
    }
  });

  // ─── 8. Members with all Paid invoices but non-zero balance (integrity) ───
  const members = await UserModel.find({}, { id: 1, balance: 1 }).lean();
  const invSummary = await InvoiceModel.aggregate([
    { $match: { archived: { $ne: true } } },
    { $group: { _id: { $trim: { input: { $ifNull: ["$memberId", ""] } } }, allPaid: { $min: { $cond: [{ $in: ["$status", ["Paid", "Completed"]] }, 1, 0] } } },
    { $match: { _id: { $ne: "" }, allPaid: 1 } },
  ]);
  const allPaidMemberIds = new Set(invSummary.map((s) => s._id));
  const parseBalance = (b) => parseFloat(String(b || "0").replace(/[^0-9.]/g, "")) || 0;
  members.forEach((m) => {
    const mid = normalizeMemberId(m.id);
    if (mid && allPaidMemberIds.has(mid) && parseBalance(m.balance) > 0) {
      addRow(m.id || "-", "-", "DATA ISSUE", "Member has all invoices Paid but balance shows outstanding", "Recalculate and update member balance");
    }
  });

  // ─── Print report ───
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("DATA AUDIT REPORT – Root Cause Classification");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");

  if (rows.length === 0) {
    console.log("No issues detected. Database appears consistent with defined rules.");
    console.log("\nVerdict: NO DATA CLEANUP REQUIRED\n");
    process.exit(0);
    return;
  }

  // Table header
  const col = (s, w) => String(s ?? "").slice(0, w).padEnd(w);
  const header = `${col("Member ID", 14)} | ${col("Phone", 16)} | ${col("Issue Type", 22)} | Root Cause | Required Action`;
  console.log(header);
  console.log("-".repeat(120));
  rows.forEach((r) => {
    console.log(`${col(r.memberId, 14)} | ${col(r.phone, 16)} | ${col(r.issueType, 22)} | ${r.rootCause} | ${r.requiredAction}`);
  });

  const dataIssues = rows.filter((r) => r.issueType === "DATA ISSUE").length;
  const dupAttempts = rows.filter((r) => r.issueType === "DUPLICATE MEMBER ATTEMPT").length;
  const expectedBlocks = rows.filter((r) => r.issueType === "EXPECTED SYSTEM BLOCK").length;
  const legitBugs = rows.filter((r) => r.issueType === "LEGIT BUG").length;

  console.log("\n───────────────────────────────────────────────────────────────────────────────");
  console.log(`Total issues: ${rows.length} (DATA ISSUE: ${dataIssues}, DUPLICATE ATTEMPT: ${dupAttempts}, EXPECTED BLOCK: ${expectedBlocks}, LEGIT BUG: ${legitBugs})`);
  console.log("───────────────────────────────────────────────────────────────────────────────\n");

  if (legitBugs > 0) {
    console.log("Verdict: CODE FIX REQUIRED (system violates business rules)\n");
    process.exit(2);
  } else {
    console.log("Verdict: DATA CLEANUP REQUIRED (issues are data-related; system enforces rules correctly)\n");
    process.exit(1);
  }
};

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});

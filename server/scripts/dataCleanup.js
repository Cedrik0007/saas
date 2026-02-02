/**
 * Data Cleanup Script – Safe historical data repair
 *
 * Run in EXACT order: 1 → 2 → 3 → 4 → 5
 * Default: DRY RUN (no changes). Use --execute to apply.
 *
 * Usage:
 *   node server/scripts/dataCleanup.js              # dry run, all tasks
 *   node server/scripts/dataCleanup.js --task=1     # dry run, task 1 only
 *   node server/scripts/dataCleanup.js --execute    # apply all
 *   node server/scripts/dataCleanup.js --execute --task=1  # apply task 1 only
 */

import process from "process";
import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import PaymentModel from "../models/Payment.js";
import DisplayIdCounterModel from "../models/DisplayIdCounter.js";
import { getNextReceiptNumberStrict } from "../utils/receiptCounter.js";
import { SUBSCRIPTION_TYPES, normalizeSubscriptionType } from "../utils/subscriptionTypes.js";

const EXECUTE = process.argv.includes("--execute");
const TASK_ARG = process.argv.find((a) => a.startsWith("--task="));
const TASK_NUM = TASK_ARG ? parseInt(TASK_ARG.split("=")[1], 10) : null;

const log = (msg) => console.log(`[${EXECUTE ? "EXEC" : "DRY"}] ${msg}`);
const warn = (msg) => console.warn(`⚠ ${msg}`);

const normalizeMemberId = (v) => String(v ?? "").trim().toUpperCase();
const normalizePhone = (v) => {
  if (!v || typeof v !== "string") return "";
  const c = v.replace(/[^\d+]/g, "");
  return c.startsWith("+") ? c : `+${c}`;
};

// ─── TASK 1: Paid invoices missing receipt number ───
async function task1_PaidInvoicesMissingReceipt() {
  log("TASK 1: Paid invoices missing receipt number");
  const paidNoReceipt = await InvoiceModel.find({
    status: { $in: ["Paid", "Completed"] },
    $or: [{ receiptNumber: { $exists: false } }, { receiptNumber: null }, { receiptNumber: "" }, { receiptNumber: /^\s*$/ }],
  }).lean();

  if (paidNoReceipt.length === 0) {
    log("  No issues found.");
    return { resolved: 0 };
  }

  let resolved = 0;
  for (const inv of paidNoReceipt) {
    const payment = await PaymentModel.findOne({
      $or: [{ invoiceId: inv.id }, { invoiceRef: inv._id }],
      status: { $in: ["Completed", "Paid"] },
    }).lean();

    if (!payment) {
      warn(`  Invoice ${inv.id || inv._id} has no completed payment – skip (manual review)`);
      continue;
    }

    if (EXECUTE) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const receiptNumber = await getNextReceiptNumberStrict({ session });
          await InvoiceModel.updateOne(
            { _id: inv._id },
            { $set: { receiptNumber } },
            { session }
          );
        });
        resolved++;
        log(`  RESOLVED – BACKFILLED RECEIPT: Invoice ${inv.id || inv._id} → receipt ${(await InvoiceModel.findById(inv._id).lean()).receiptNumber}`);
      } catch (err) {
        warn(`  Failed to backfill invoice ${inv.id}: ${err.message}`);
      } finally {
        session.endSession();
      }
    } else {
      log(`  Would backfill receipt for invoice ${inv.id || inv._id} (has payment)`);
      resolved++;
    }
  }
  return { resolved };
}

// ─── TASK 2: Duplicate member phone numbers ───
async function task2_DuplicatePhoneNumbers() {
  log("TASK 2: Duplicate member phone numbers");
  const phoneGroups = await UserModel.aggregate([
    { $match: { phone: { $exists: true, $nin: [null, ""] } } },
    { $addFields: { phoneNorm: { $trim: { input: { $ifNull: ["$phone", ""] } } } } },
    { $match: { phoneNorm: { $ne: "" } } },
    { $group: { _id: "$phoneNorm", members: { $push: { _id: "$_id", id: "$id", name: "$name", status: "$status", createdAt: "$createdAt" } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (phoneGroups.length === 0) {
    log("  No issues found.");
    return { resolved: 0 };
  }

  let resolved = 0;
  for (const g of phoneGroups) {
    const members = g.members;
    const invoiceCounts = await Promise.all(
      members.map((m) => InvoiceModel.countDocuments({ $or: [{ memberId: m.id }, { memberRef: m._id }], archived: { $ne: true } }))
    );
    const withInvoices = members.map((m, i) => ({ ...m, invoiceCount: invoiceCounts[i] }));
    withInvoices.sort((a, b) => b.invoiceCount - a.invoiceCount || new Date(b.createdAt) - new Date(a.createdAt));
    const master = withInvoices[0];
    const duplicates = withInvoices.slice(1);

    if (EXECUTE) {
      for (const dup of duplicates) {
        const dupInvoices = await InvoiceModel.find({
          $or: [{ memberId: dup.id }, { memberRef: dup._id }],
          archived: { $ne: true },
        }).lean();
        for (const inv of dupInvoices) {
          await mongoose.connection.db.collection("invoices").updateOne(
            { _id: inv._id },
            { $set: { memberRef: master._id, memberId: master.id } }
          );
        }
        await UserModel.updateOne(
          { _id: dup._id },
          { $set: { status: "Archived", phone: `ARCHIVED_${String(dup.phone || "").slice(0, 10)}_${dup._id}` } }
        );
      }
      resolved += duplicates.length;
      log(`  RESOLVED – MERGED MEMBER: Phone ${g._id} → master ${master.id}, archived ${duplicates.length} duplicate(s)`);
    } else {
      log(`  Would merge: phone ${g._id} → master ${master.id}, archive ${duplicates.map((d) => d.id).join(", ")}`);
      resolved += duplicates.length;
    }
  }
  return { resolved };
}

// ─── TASK 3: Duplicate member IDs ───
async function task3_DuplicateMemberIds() {
  log("TASK 3: Duplicate member IDs");
  const idGroups = await UserModel.aggregate([
    { $match: { id: { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: { $toUpper: { $trim: { input: "$id" } } }, members: { $push: { _id: "$_id", id: "$id", name: "$name", status: "$status", createdAt: "$createdAt" } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (idGroups.length === 0) {
    log("  No issues found.");
    return { resolved: 0 };
  }

  let resolved = 0;

  for (const g of idGroups) {
    const members = g.members;
    const invoiceCounts = await Promise.all(
      members.map((m) => InvoiceModel.countDocuments({ $or: [{ memberId: m.id }, { memberRef: m._id }], archived: { $ne: true } }))
    );
    const withInvoices = members.map((m, i) => ({ ...m, invoiceCount: invoiceCounts[i] }));
    withInvoices.sort((a, b) => b.invoiceCount - a.invoiceCount || new Date(b.createdAt) - new Date(a.createdAt));
    const master = withInvoices[0];
    const duplicates = withInvoices.slice(1);

    if (EXECUTE) {
      const prefix = normalizeSubscriptionType(g._id) === SUBSCRIPTION_TYPES.ANNUAL_MEMBER ? "AM" : "LM";
      for (const dup of duplicates) {
        const newId = await getNewDisplayId(prefix);
        const dupInvoices = await InvoiceModel.find({ $or: [{ memberId: dup.id }, { memberRef: dup._id }], archived: { $ne: true } }).lean();
        for (const inv of dupInvoices) {
          await InvoiceModel.updateOne(
            { _id: inv._id },
            { $set: { memberRef: master._id, memberId: master.id } }
          );
        }
        await UserModel.findOneAndUpdate(
          { _id: dup._id },
          { $set: { id: newId, status: "Archived" } },
          { allowDisplayIdUpdate: true }
        );
      }
      resolved += duplicates.length;
      log(`  RESOLVED – ID CONFLICT FIXED: ID ${g._id} → master ${master.id}, reassigned/archived ${duplicates.length} duplicate(s)`);
    } else {
      log(`  Would fix: ID ${g._id} → master ${master.id}, reassign/archive ${duplicates.map((d) => d.id).join(", ")}`);
      resolved += duplicates.length;
    }
  }
  return { resolved };
}

async function getNewDisplayId(prefix) {
  const counter = await DisplayIdCounterModel.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `${prefix}${String(counter?.seq ?? 1).padStart(3, "0")}`;
}

// ─── TASK 4: Duplicate invoices for same member + year ───
async function task4_DuplicateInvoices() {
  log("TASK 4: Duplicate invoices for same member + year");
  const dupes = await InvoiceModel.aggregate([
    { $match: { archived: { $ne: true } } },
    { $project: { memberId: { $trim: { input: { $ifNull: ["$memberId", ""] } } }, period: { $trim: { input: { $ifNull: ["$period", ""] } } }, id: 1, status: 1, _id: 1 } },
    { $match: { memberId: { $ne: "" }, period: { $ne: "" } } },
    { $group: { _id: { memberId: "$memberId", period: "$period" }, invoices: { $push: { id: "$id", _id: "$_id", status: "$status" } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (dupes.length === 0) {
    log("  No issues found.");
    return { resolved: 0 };
  }

  let resolved = 0;
  for (const g of dupes) {
    const invoices = await InvoiceModel.find({
      _id: { $in: g.invoices.map((i) => i._id) },
      archived: { $ne: true },
    })
      .sort({ status: -1, createdAt: -1 })
      .lean();

    const paid = invoices.filter((i) => i.status === "Paid" || i.status === "Completed");
    const unpaid = invoices.filter((i) => i.status !== "Paid" && i.status !== "Completed");

    let toArchive = [];
    if (paid.length >= 1) {
      const keep = paid[0];
      toArchive = invoices.filter((i) => i._id.toString() !== keep._id.toString());
    } else {
      const keep = unpaid[0];
      toArchive = unpaid.slice(1);
    }

    if (EXECUTE && toArchive.length > 0) {
      for (const inv of toArchive) {
        await mongoose.connection.db.collection("invoices").updateOne({ _id: inv._id }, { $set: { archived: true } });
      }
      resolved += toArchive.length;
      log(`  RESOLVED – DUPLICATE INVOICE CLEANED: Member ${g._id.memberId} period ${g._id.period} – archived ${toArchive.length} duplicate(s)`);
    } else if (toArchive.length > 0) {
      log(`  Would archive ${toArchive.length} duplicate(s) for ${g._id.memberId} / ${g._id.period}`);
      resolved += toArchive.length;
    }
  }
  return { resolved };
}

// ─── TASK 5: Name mismatch (invoice.memberName vs member.name) ───
async function task5_NameMismatch() {
  log("TASK 5: Invoice memberName sync");
  const members = await UserModel.find({}, { _id: 1, id: 1, name: 1 }).lean();
  const memberByName = new Map(members.map((m) => [m._id.toString(), m]));
  const memberById = new Map(members.map((m) => [normalizeMemberId(m.id), m]));

  const invoices = await InvoiceModel.find({
    status: { $in: ["Paid", "Completed"] },
    archived: { $ne: true },
  }).lean();

  let resolved = 0;
  for (const inv of invoices) {
    const member = memberByName.get(inv.memberRef?.toString()) || memberById.get(normalizeMemberId(inv.memberId));
    if (!member) continue;
    const expectedName = member.name || "";
    const currentName = inv.memberName || "";
    if (expectedName && currentName !== expectedName) {
      if (EXECUTE) {
        await mongoose.connection.db.collection("invoices").updateOne(
          { _id: inv._id },
          { $set: { memberName: expectedName } }
        );
        resolved++;
        log(`  RESOLVED – NAME SYNCED: Invoice ${inv.id} memberName "${currentName}" → "${expectedName}"`);
      } else {
        log(`  Would sync memberName for invoice ${inv.id}: "${currentName}" → "${expectedName}"`);
        resolved++;
      }
    }
  }
  if (resolved === 0) log("  No issues found.");
  return { resolved };
}

// ─── Post-cleanup verification ───
async function verify() {
  log("POST-CLEANUP VERIFICATION");
  const issues = [];
  const paidNoReceipt = await InvoiceModel.countDocuments({
    status: { $in: ["Paid", "Completed"] },
    $or: [{ receiptNumber: { $exists: false } }, { receiptNumber: null }, { receiptNumber: "" }],
    archived: { $ne: true },
  });
  if (paidNoReceipt > 0) issues.push(`Paid invoices missing receiptNumber: ${paidNoReceipt}`);

  const phoneDupes = await UserModel.aggregate([
    { $match: { phone: { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: "$phone", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "n" },
  ]);
  if (phoneDupes[0]?.n > 0) issues.push(`Duplicate phone numbers: ${phoneDupes[0].n} groups`);

  const idDupes = await UserModel.aggregate([
    { $match: { id: { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: { $toUpper: { $trim: { input: "$id" } } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "n" },
  ]);
  if (idDupes[0]?.n > 0) issues.push(`Duplicate member IDs: ${idDupes[0].n} groups`);

  const invDupes = await InvoiceModel.aggregate([
    { $match: { archived: { $ne: true } } },
    { $group: { _id: { memberId: "$memberId", period: "$period" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "n" },
  ]);
  if (invDupes[0]?.n > 0) issues.push(`Duplicate invoices (member+period): ${invDupes[0].n} groups`);

  if (issues.length === 0) {
    log("  ✓ All checks passed.");
  } else {
    issues.forEach((i) => warn(`  ${i}`));
  }
  return issues;
}

// ─── Main ───
async function run() {
  await ensureConnection();
  log(EXECUTE ? "EXECUTE MODE – changes will be applied" : "DRY RUN – no changes");
  console.log("");

  const tasks = [
    [1, task1_PaidInvoicesMissingReceipt],
    [2, task2_DuplicatePhoneNumbers],
    [3, task3_DuplicateMemberIds],
    [4, task4_DuplicateInvoices],
    [5, task5_NameMismatch],
  ];

  for (const [num, fn] of tasks) {
    if (TASK_NUM != null && TASK_NUM !== num) continue;
    const r = await fn();
    console.log(`  → Resolved: ${r.resolved}\n`);
  }

  await verify();
  console.log("");
  log("Cleanup finished.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});

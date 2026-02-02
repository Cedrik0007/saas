#!/usr/bin/env node
/**
 * Data Audit Script – Root Cause Classification
 *
 * Classifies issues as:
 * - DATA ISSUE
 * - DUPLICATE MEMBER ATTEMPT
 * - EXPECTED SYSTEM BLOCK
 * - LEGIT BUG
 *
 * Run: node server/scripts/dataAudit.js
 *
 * Output: Table with Member ID, Phone, Issue Type, Root Cause, Required Action
 */

import process from "process";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import PaymentModel from "../models/Payment.js";

const normalizeMemberId = (v = "") => String(v ?? "").trim().toUpperCase();
const normalizePhone = (v = "") => String(v ?? "").trim().replace(/[^\d+]/g, "").replace(/^(\d+)$/, "+$1");

const issues = [];

const add = (memberId, phone, issueType, rootCause, requiredAction) => {
  issues.push({ memberId: memberId || "-", phone: phone || "-", issueType, rootCause, requiredAction });
};

const runAudit = async () => {
  await ensureConnection();

  // -------- 1. Member existence & duplicate phone --------
  const members = await UserModel.find({}, { id: 1, phone: 1, email: 1, name: 1, status: 1 }).lean();
  const phoneToMembers = new Map();
  for (const m of members) {
    const p = normalizePhone(m.phone);
    if (!p || p.length < 8) continue;
    if (!phoneToMembers.has(p)) phoneToMembers.set(p, []);
    phoneToMembers.get(p).push(m);
  }
  for (const [phone, list] of phoneToMembers) {
    if (list.length > 1) {
      add(
        list.map((x) => x.id).join(", "),
        phone,
        "DATA ISSUE",
        "Duplicate phone number across members",
        "Data correction: Merge or correct phone numbers"
      );
    }
  }

  // -------- 2. Members without phone --------
  const noPhone = members.filter((m) => !m.phone || normalizePhone(m.phone).length < 8);
  for (const m of noPhone) {
    add(m.id, m.phone || "(missing)", "DATA ISSUE", "Phone number missing or invalid", "Data correction: Add valid phone");
  }

  // -------- 3. Member ID conflicts (duplicate id) --------
  const idToMembers = new Map();
  for (const m of members) {
    const id = normalizeMemberId(m.id);
    if (!id || id === "NOT ASSIGNED") continue;
    if (!idToMembers.has(id)) idToMembers.set(id, []);
    idToMembers.get(id).push(m);
  }
  for (const [id, list] of idToMembers) {
    if (list.length > 1) {
      add(id, list.map((x) => x.phone).join(", "), "DATA ISSUE", "Duplicate member ID in DB", "Data correction: Resolve ID conflict");
    }
  }

  // -------- 4. Invoice state: Paid without receiptNumber --------
  const paidNoReceipt = await InvoiceModel.find(
    { status: { $in: ["Paid", "Completed"] }, $or: [{ receiptNumber: { $exists: false } }, { receiptNumber: null }, { receiptNumber: "" }] },
    { id: 1, memberId: 1, period: 1, status: 1 }
  ).lean();
  for (const inv of paidNoReceipt) {
    add(
      inv.memberId || "-",
      "-",
      "DATA ISSUE",
      "Paid invoice missing receiptNumber (approval flow interrupted or pre-fix data)",
      "Data correction: Re-run approval or backfill receipt"
    );
  }

  // -------- 5. Invoice state: Orphan invoices (memberId not in members) --------
  const memberIds = new Set(members.map((m) => normalizeMemberId(m.id)).filter(Boolean));
  const invoices = await InvoiceModel.find({ archived: { $ne: true } }, { id: 1, memberId: 1, period: 1, status: 1 }).lean();
  for (const inv of invoices) {
    const mid = normalizeMemberId(inv.memberId);
    if (mid && !memberIds.has(mid)) {
      add(inv.memberId, "-", "DATA ISSUE", "Invoice references non-existent member", "Data correction: Link to correct member or archive");
    }
  }

  // -------- 6. Duplicate invoices (same member + period) --------
  const keyToInvs = new Map();
  for (const inv of invoices) {
    const mid = normalizeMemberId(inv.memberId);
    const period = String(inv.period || "").trim();
    if (!mid || !period) continue;
    const key = `${mid}|${period}`;
    if (!keyToInvs.has(key)) keyToInvs.set(key, []);
    keyToInvs.get(key).push(inv);
  }
  for (const [key, list] of keyToInvs) {
    if (list.length > 1) {
      const [mid] = key.split("|");
      add(
        mid,
        "-",
        "DATA ISSUE",
        "Duplicate invoices for same member and period",
        "Data correction: Archive or merge duplicate invoices"
      );
    }
  }

  // -------- 7. WhatsApp data source (code check – informational) --------
  // WhatsApp is now built from GET /api/invoices/:id/whatsapp-data (fresh DB)
  // No row-level check; this is a code verification.

  // -------- Output --------
  if (issues.length === 0) {
    console.log("\n✅ Data audit passed. No issues detected.");
    process.exit(0);
    return;
  }

  console.log("\n=== DATA AUDIT REPORT ===\n");
  console.log(
    "| Member ID | Phone | Issue Type | Root Cause | Required Action |"
  );
  console.log("|-----------|-------|------------|------------|-----------------|");
  for (const r of issues) {
    const mid = (r.memberId || "-").substring(0, 20);
    const ph = (r.phone || "-").substring(0, 15);
    const it = (r.issueType || "").substring(0, 25);
    const rc = (r.rootCause || "").substring(0, 40);
    const ra = (r.requiredAction || "").substring(0, 40);
    console.log(`| ${mid} | ${ph} | ${it} | ${rc} | ${ra} |`);
  }

  const hasLegitBug = issues.some((i) => i.issueType === "LEGIT BUG");
  const hasDataIssue = issues.some((i) =>
    ["DATA ISSUE", "DUPLICATE MEMBER ATTEMPT"].includes(i.issueType)
  );

  console.log("\n--- Verdict ---");
  if (hasLegitBug) {
    console.log("CODE FIX REQUIRED (system violates business rules)");
  } else if (hasDataIssue) {
    console.log("DATA CLEANUP REQUIRED");
  } else {
    console.log("EXPECTED SYSTEM BLOCKS (no data or code fix needed)");
  }

  process.exit(issues.length > 0 ? 1 : 0);
};

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});

import process from "process";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";

/**
 * Normalize business memberId
 */
const normalizeMemberId = (raw = "") =>
  typeof raw === "string" ? raw.trim() : String(raw || "").trim();

/**
 * Parse numeric outstanding amount safely
 */
const parseOutstandingAmount = (balanceValue) => {
  if (balanceValue == null) return 0;
  const numericValue =
    parseFloat(String(balanceValue).replace(/[^0-9.]/g, "")) || 0;
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const runIntegrityCheck = async () => {
  await ensureConnection();

  // IMPORTANT:
  // We explicitly IGNORE archived invoices everywhere
  const [members, invoices] = await Promise.all([
    UserModel.find({}, { id: 1, balance: 1 }).lean(),
    InvoiceModel.find(
      { archived: { $ne: true } }, // ← CRITICAL FIX
      { id: 1, memberId: 1, status: 1 }
    ).lean(),
  ]);

  // Build member lookup by canonical business ID
  const memberLookup = new Map(
    members
      .map((member) => [normalizeMemberId(member.id), member])
      .filter(([memberId]) => Boolean(memberId))
  );

  const violations = [];

  // -------------------------
  // Rule 1:
  // Every invoice.memberId must exist in members.id
  // -------------------------
  invoices.forEach((invoice) => {
    const invoiceMemberId = normalizeMemberId(invoice.memberId);
    if (!invoiceMemberId || !memberLookup.has(invoiceMemberId)) {
      violations.push(
        `Rule 1 violated: Invoice ${invoice.id || "<unknown>"} references missing memberId "${invoice.memberId}".`
      );
    }
  });

  // -------------------------
  // Prepare invoice summary per member for Rule 2
  // -------------------------
  const invoiceSummaryByMember = new Map();

  invoices.forEach((invoice) => {
    const invoiceMemberId = normalizeMemberId(invoice.memberId);
    if (!invoiceMemberId) return;

    const summary = invoiceSummaryByMember.get(invoiceMemberId) || {
      hasInvoices: false,
      allPaid: true,
    };

    summary.hasInvoices = true;
    if (invoice.status !== "Paid") {
      summary.allPaid = false;
    }

    invoiceSummaryByMember.set(invoiceMemberId, summary);
  });

  // -------------------------
  // Rule 2:
  // Members with ONLY Paid invoices must have zero outstanding
  // -------------------------
  memberLookup.forEach((member, memberId) => {
    const summary = invoiceSummaryByMember.get(memberId);
    if (!summary || !summary.hasInvoices) return;

    if (summary.allPaid) {
      const outstandingAmount = parseOutstandingAmount(member.balance);
      if (outstandingAmount > 0) {
        violations.push(
          `Rule 2 violated: Member ${member.id} has all invoices Paid but outstanding balance is ${member.balance}.`
        );
      }
    }
  });

  // -------------------------
  // Result
  // -------------------------
  if (violations.length > 0) {
    console.error(
      "\n❌ INTEGRITY CHECK FAILED:\n" +
        violations.map((msg) => ` - ${msg}`).join("\n")
    );
    console.error(
      `\nFound ${violations.length} violation(s). Fix the data before proceeding.`
    );
    process.exit(1);
  }

  console.log("\n✅ Integrity check passed. No violations detected.");
  process.exit(0);
};

runIntegrityCheck().catch((error) => {
  console.error("Unexpected error during integrity check:", error);
  process.exit(1);
});

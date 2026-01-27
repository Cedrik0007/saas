import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";

const normalizeMemberId = (value = "") => String(value ?? "").trim().toUpperCase();
const paidStatuses = new Set(["paid", "completed", "settled", "approved"]);
const currencyCleaner = /[^0-9.-]/g;
const tolerance = 0.01;

const parseCurrency = (rawValue) => {
  if (rawValue == null) return 0;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }
  const cleaned = String(rawValue).replace(currencyCleaner, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const failIfIssues = (ruleLabel, issues) => {
  if (!issues.length) return;
  const serialized = issues
    .slice(0, 10)
    .map((issue) => JSON.stringify(issue, null, 2))
    .join("\n");
  throw new Error(`${ruleLabel} violated:\n${serialized}`);
};

describe("Minimal financial integrity", () => {
  beforeAll(async () => {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI must be defined to run integrity tests");
    }
    await ensureConnection();
  });

  afterAll(async () => {
    await mongoose.connection.close(true);
    await mongoose.disconnect();
    if (global.mongoose) {
      global.mongoose.conn = null;
      global.mongoose.promise = null;
    }
  });

  test("core invoice/member invariants hold", async () => {
    const [members, invoices] = await Promise.all([
      UserModel.find({}, { id: 1, balance: 1, previousDisplayIds: 1 }).lean(),
      InvoiceModel.find(
        { archived: { $ne: true } },
        { _id: 0, id: 1, memberId: 1, status: 1, amount: 1, period: 1 }
      ).lean(),
    ]);

    if (!members.length) {
      throw new Error("No members available; cannot validate integrity");
    }

    const memberIds = new Set();
    members.forEach((member) => {
      const currentId = normalizeMemberId(member.id);
      if (currentId) memberIds.add(currentId);
      const previousIds = Array.isArray(member.previousDisplayIds)
        ? member.previousDisplayIds.map((entry) => normalizeMemberId(entry?.id)).filter(Boolean)
        : [];
      previousIds.forEach((prevId) => memberIds.add(prevId));
    });

    const rule1Issues = invoices
      .filter((invoice) => {
        const normalizedId = normalizeMemberId(invoice.memberId);
        return !normalizedId || !memberIds.has(normalizedId);
      })
      .map((invoice) => ({
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        period: invoice.period,
      }));

    failIfIssues("Rule 1", rule1Issues);

    const outstandingByMember = new Map();

    invoices.forEach((invoice) => {
      const normalizedId = normalizeMemberId(invoice.memberId);
      if (!normalizedId) return;
      const amount = parseCurrency(invoice.amount);
      if (amount <= 0) return;
      const statusKey = String(invoice.status || "")
        .trim()
        .toLowerCase();
      if (!paidStatuses.has(statusKey)) {
        outstandingByMember.set(
          normalizedId,
          (outstandingByMember.get(normalizedId) || 0) + amount
        );
      }
    });

    const rule2Issues = [];
    let recordedOutstandingTotal = 0;

    members.forEach((member) => {
      const normalizedId = normalizeMemberId(member.id);
      if (!normalizedId) return;
      const recordedOutstanding = parseCurrency(member.balance);
      recordedOutstandingTotal += recordedOutstanding;
      const unpaidSum = outstandingByMember.get(normalizedId) || 0;
      if (recordedOutstanding - unpaidSum > tolerance) {
        rule2Issues.push({
          memberId: member.id,
          recordedOutstanding: recordedOutstanding.toFixed(2),
          unpaidInvoiceTotal: unpaidSum.toFixed(2),
        });
      }
    });

    failIfIssues(
      "Rule 2: Paid invoices must never contribute to outstanding",
      rule2Issues
    );

    const computedOutstandingTotal = Array.from(outstandingByMember.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    const totalDifference = Math.abs(
      recordedOutstandingTotal - computedOutstandingTotal
    );

    if (totalDifference > tolerance) {
      throw new Error(
        `Rule 3 violated: Members list total HK$${recordedOutstandingTotal.toFixed(
          2
        )} differs from unpaid invoices total HK$${computedOutstandingTotal.toFixed(2)}`
      );
    }
  });
});

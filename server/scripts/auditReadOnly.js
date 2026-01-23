import process from "process";
import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import PaymentModel from "../models/Payment.js";
import ReminderLogModel from "../models/ReminderLog.js";

const whitespaceRegex = /^\s*$/;

const normalizeMemberId = (value = "") => String(value ?? "").trim().toUpperCase();

const stringify = (value) =>
  JSON.stringify(
    value,
    (_, inner) => {
      if (inner instanceof RegExp) return inner.toString();
      if (typeof inner === "bigint") return inner.toString();
      return inner;
    },
    2
  );

const printQuery = (label, query) => {
  console.log(`Mongo query ("${label}"):\n${typeof query === "string" ? query : stringify(query)}\n`);
};

const printCheckReport = ({ name, queries, issues }) => {
  console.log(`\n=== ${name} ===`);
  queries.forEach(({ label, query }) => printQuery(label, query));

  if (!issues.length) {
    console.log("No issues detected.");
    return;
  }

  issues.forEach((issue, index) => {
    console.log(
      `${index + 1}. [${issue.collection}] ${issue.reason}\n   Document: ${stringify(issue.sample)}`
    );
  });
};

const buildMissingFieldQuery = (fieldName) => ({
  $or: [
    { [fieldName]: { $exists: false } },
    { [fieldName]: null },
    { [fieldName]: "" },
    { [fieldName]: { $regex: whitespaceRegex } },
  ],
});

const detectWhatsAppCollection = async () => {
  const candidates = [
    "whatsappLogs",
    "whatsapplogs",
    "whatsappmessages",
    "messageLogs",
    "messagelogs",
    "messages",
  ];
  const collections = await mongoose.connection.db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const lookup = new Map(collections.map(({ name }) => [name.toLowerCase(), name]));
  for (const candidate of candidates) {
    const found = lookup.get(candidate.toLowerCase());
    if (found) return found;
  }
  return null;
};

const checkMissingMemberIds = async (whatsappCollectionName) => {
  const issues = [];
  const queries = [];

  const memberQuery = buildMissingFieldQuery("id");
  queries.push({ label: "members without id", query: memberQuery });
  const invalidMembers = await UserModel.find(memberQuery, {
    _id: 1,
    id: 1,
    name: 1,
  }).lean();
  invalidMembers.forEach((doc) => {
    issues.push({
      collection: "members",
      reason: "Missing canonical member id",
      sample: doc,
    });
  });

  const memberIdQuery = buildMissingFieldQuery("memberId");
  const memberCollections = [
    {
      label: "invoices without memberId",
      collection: "invoices",
      model: InvoiceModel,
      projection: { _id: 1, id: 1, memberId: 1, period: 1, status: 1 },
    },
    {
      label: "payments without memberId",
      collection: "payments",
      model: PaymentModel,
      projection: { _id: 1, memberId: 1, invoiceId: 1, status: 1, period: 1 },
    },
    {
      label: "reminders without memberId",
      collection: "reminderlogs",
      model: ReminderLogModel,
      projection: { _id: 1, memberId: 1, sentAt: 1, channel: 1 },
    },
  ];

  for (const cfg of memberCollections) {
    queries.push({ label: cfg.label, query: memberIdQuery });
    const docs = await cfg.model.find(memberIdQuery, cfg.projection).lean();
    docs.forEach((doc) => {
      issues.push({
        collection: cfg.collection,
        reason: "Missing or blank memberId",
        sample: doc,
      });
    });
  }

  if (whatsappCollectionName) {
    const collection = mongoose.connection.db.collection(whatsappCollectionName);
    queries.push({
      label: `${whatsappCollectionName} without memberId`,
      query: memberIdQuery,
    });
    const docs = await collection
      .find(memberIdQuery, {
        projection: { _id: 1, memberId: 1, sentAt: 1, channel: 1, message: 1 },
      })
      .toArray();
    docs.forEach((doc) => {
      issues.push({
        collection: whatsappCollectionName,
        reason: "Missing or blank memberId",
        sample: doc,
      });
    });
  } else {
    queries.push({
      label: "whatsapp/message logs missing memberId",
      query: "Skipped: no WhatsApp/message log collection detected",
    });
  }

  return { name: "Check 1 – Missing or invalid memberId", queries, issues };
};

const checkDuplicateInvoices = async () => {
  const pipeline = [
    { $match: { archived: { $ne: true } } },
    {
      $project: {
        id: 1,
        status: 1,
        memberId: {
          $trim: { input: { $ifNull: ["$memberId", ""] } },
        },
        period: {
          $trim: { input: { $ifNull: ["$period", ""] } },
        },
      },
    },
    { $match: { memberId: { $ne: "" }, period: { $ne: "" } } },
    {
      $group: {
        _id: { memberId: "$memberId", period: "$period" },
        invoices: { $push: { id: "$id", status: "$status" } },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        _id: 0,
        memberId: "$_id.memberId",
        period: "$_id.period",
        count: 1,
        invoices: 1,
      },
    },
  ];

  const duplicates = await InvoiceModel.aggregate(pipeline);
  const issues = duplicates.map((doc) => ({
    collection: "invoices",
    reason: `Duplicate invoices for member ${doc.memberId} and period ${doc.period}`,
    sample: doc,
  }));

  return {
    name: "Check 2 – Duplicate invoices for same member and period",
    queries: [{ label: "invoice duplicate detection pipeline", query: pipeline }],
    issues,
  };
};

const checkPaidVsUnpaidInvoices = async () => {
  const pipeline = [
    { $match: { archived: { $ne: true } } },
    {
      $project: {
        id: 1,
        originalStatus: "$status",
        status: {
          $toLower: { $ifNull: ["$status", ""] },
        },
        memberId: {
          $trim: { input: { $ifNull: ["$memberId", ""] } },
        },
        period: {
          $trim: { input: { $ifNull: ["$period", ""] } },
        },
      },
    },
    { $match: { memberId: { $ne: "" }, period: { $ne: "" } } },
    {
      $group: {
        _id: { memberId: "$memberId", period: "$period" },
        invoices: { $push: { id: "$id", status: "$originalStatus" } },
        hasPaid: {
          $max: {
            $cond: [{ $in: ["$status", ["paid", "completed"]] }, 1, 0],
          },
        },
        hasUnpaid: {
          $max: {
            $cond: [
              { $in: ["$status", ["unpaid", "pending", "draft", "overdue"]] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $match: { hasPaid: 1, hasUnpaid: 1 } },
    {
      $project: {
        _id: 0,
        memberId: "$_id.memberId",
        period: "$_id.period",
        invoices: 1,
      },
    },
  ];

  const conflicts = await InvoiceModel.aggregate(pipeline);
  const issues = conflicts.map((doc) => ({
    collection: "invoices",
    reason: `Paid and unpaid invoice mix for member ${doc.memberId} in period ${doc.period}`,
    sample: doc,
  }));

  return {
    name: "Check 3 – Paid invoices that still appear unpaid",
    queries: [{ label: "paid/unpaid conflict pipeline", query: pipeline }],
    issues,
  };
};

const buildMissingMemberQuery = (memberIdsUpper) => ({
  $expr: {
    $and: [
      {
        $ne: [
          {
            $trim: { input: { $ifNull: ["$memberId", ""] } },
          },
          "",
        ],
      },
      {
        $not: {
          $in: [
            {
              $toUpper: {
                $trim: { input: { $ifNull: ["$memberId", ""] } },
              },
            },
            memberIdsUpper,
          ],
        },
      },
    ],
  },
});

const checkLogsAgainstMembers = async (memberIdsUpper, whatsappCollectionName) => {
  const issues = [];
  const queries = [];

  const reminderQuery = buildMissingMemberQuery(memberIdsUpper);
  queries.push({ label: "reminder logs referencing missing member", query: reminderQuery });
  const reminderDocs = await ReminderLogModel.find(reminderQuery, {
    _id: 1,
    memberId: 1,
    memberEmail: 1,
    sentAt: 1,
    channel: 1,
  }).lean();
  reminderDocs.forEach((doc) => {
    issues.push({
      collection: "reminderlogs",
      reason: "MemberId does not exist in members list",
      sample: doc,
    });
  });

  if (whatsappCollectionName) {
    const collection = mongoose.connection.db.collection(whatsappCollectionName);
    const whatsappQuery = buildMissingMemberQuery(memberIdsUpper);
    queries.push({
      label: `${whatsappCollectionName} referencing missing member`,
      query: whatsappQuery,
    });
    const whatsappDocs = await collection
      .find(whatsappQuery, {
        projection: { _id: 1, memberId: 1, sentAt: 1, channel: 1, message: 1 },
      })
      .toArray();
    whatsappDocs.forEach((doc) => {
      issues.push({
        collection: whatsappCollectionName,
        reason: "MemberId does not exist in members list",
        sample: doc,
      });
    });
  } else {
    queries.push({
      label: "whatsapp/message logs referencing missing member",
      query: "Skipped: no WhatsApp/message log collection detected",
    });
  }

  return {
    name: "Check 4 – Logs referencing missing members",
    queries,
    issues,
  };
};

const runAudit = async () => {
  await ensureConnection();

  const members = await UserModel.find({}, { _id: 1, id: 1 }).lean();
  const memberIdsUpper = members
    .map((member) => normalizeMemberId(member.id))
    .filter(Boolean);
  const uniqueMemberIdsUpper = Array.from(new Set(memberIdsUpper));

  const whatsappCollectionName = await detectWhatsAppCollection();

  const checks = await Promise.all([
    checkMissingMemberIds(whatsappCollectionName),
    checkDuplicateInvoices(),
    checkPaidVsUnpaidInvoices(),
    checkLogsAgainstMembers(uniqueMemberIdsUpper, whatsappCollectionName),
  ]);

  const totalIssues = checks.reduce((sum, check) => sum + check.issues.length, 0);
  checks.forEach(printCheckReport);

  if (totalIssues === 0) {
    console.log("\nAudit clean");
    process.exit(0);
  }

  console.log(`\nAudit finished with ${totalIssues} issue(s).`);
  process.exit(1);
};

runAudit().catch((error) => {
  console.error("Unexpected error while running audit:", error);
  process.exit(1);
});

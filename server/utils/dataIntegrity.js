import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";

const invoiceJsonSchema = {
  bsonType: "object",
  required: ["memberId"],
  properties: {
    memberId: {
      bsonType: "string",
      minLength: 1,
      description: "memberId must be the member's business identifier (non-empty string)",
    },
  },
  additionalProperties: true,
};

const validatorCommand = {
  validator: { $jsonSchema: invoiceJsonSchema },
  validationLevel: "moderate",
  validationAction: "error",
};

export async function ensureInvoiceCollectionValidator() {
  try {
    await ensureConnection();
    const db = mongoose.connection?.db;
    if (!db) {
      console.warn("⚠️ Invoice validator skipped: database connection unavailable");
      return;
    }

    try {
      await db.command({ collMod: "invoices", ...validatorCommand });
      console.log("✓ Invoice collection validator applied (collMod)");
    } catch (error) {
      if (error.codeName === "NamespaceNotFound") {
        await db.createCollection("invoices", validatorCommand);
        console.log("✓ Invoice collection created with validator");
      } else {
        console.warn("⚠️ Unable to apply invoice validator via collMod:", error.message);
      }
    }
  } catch (error) {
    console.warn("⚠️ Invoice validator setup failed:", error.message);
  }
}

export async function runStartupIntegrityChecks() {
  try {
    await ensureConnection();

    const duplicateMembers = await UserModel.aggregate([
      { $match: { id: { $exists: true, $ne: "" } } },
      { $group: { _id: "$id", count: { $sum: 1 }, members: { $push: { _id: "$_id", name: "$name" } } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 25 },
    ]);

    if (duplicateMembers.length) {
      console.error("❌ Duplicate member IDs detected:", duplicateMembers);
      if (process.env.NODE_ENV === "production") {
        console.error("   Production warning: resolve duplicates immediately to avoid invoice corruption.");
      }
    } else {
      console.log("✓ Integrity check: no duplicate member IDs found");
    }

    const orphanInvoices = await InvoiceModel.aggregate([
      {
        $lookup: {
          from: "members",
          localField: "memberId",
          foreignField: "id",
          as: "memberMatch",
        },
      },
      {
        $match: {
          $or: [
            { memberId: { $exists: false } },
            { memberId: { $eq: "" } },
            { memberMatch: { $size: 0 } },
          ],
        },
      },
      {
        $project: {
          _id: 0,
          invoiceId: "$id",
          memberId: 1,
          status: 1,
          createdAt: 1,
        },
      },
      { $limit: 25 },
    ]);

    if (orphanInvoices.length) {
      console.error("❌ Orphan invoices detected (memberId not found in members.id):", orphanInvoices);
      if (process.env.NODE_ENV === "production") {
        console.error("   Production warning: orphan invoices should be repaired with the fixer scripts.");
      }
    } else {
      console.log("✓ Integrity check: all invoices reference valid members");
    }
  } catch (error) {
    console.warn("⚠️ Startup integrity checks failed:", error.message);
  }
}

export async function verifyMemberIdUniqueIndex() {
  try {
    await ensureConnection();
    const db = mongoose.connection?.db;
    if (!db) {
      console.warn("⚠️ Member index verification skipped: database connection unavailable");
      return;
    }

    const memberCollection = db.collection("members");
    const indexes = await memberCollection.indexes();
    const hasUniqueIndex = indexes.some(
      (idx) => idx.key && idx.key.id === 1 && idx.unique === true
    );

    if (!hasUniqueIndex) {
      console.error("❌ Missing UNIQUE index on members.id. Create one to prevent duplicate business identifiers.");
    } else {
      console.log("✓ Index check: members.id has a UNIQUE index");
    }
  } catch (error) {
    console.warn("⚠️ Member id index verification failed:", error.message);
  }
}

export const invoiceCollectionValidator = validatorCommand;

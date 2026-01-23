import dotenv from "dotenv";
import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";

dotenv.config();

const objectIdRegex = /^[a-f\d]{24}$/i;
const isApplyMode = process.argv.includes("--apply") || process.argv.includes("--execute");
const dryRun = !isApplyMode;

async function fixLegacyInvoiceMemberIds() {
  try {
    console.log("\n===== Legacy Invoice Member ID Fix =====");
    console.log(`Mode       : ${dryRun ? "DRY-RUN (no writes)" : "APPLY (writes enabled)"}`);
    console.log("Constraint : Only invoices whose memberId looks like a Mongo ObjectId are targeted\n");

    await ensureConnection();

    const legacyInvoices = await InvoiceModel.find({
      memberId: { $regex: objectIdRegex }
    });

    console.log(`Found ${legacyInvoices.length} invoice(s) with legacy memberId format.\n`);

    let updatedCount = 0;
    let fixableCount = 0;
    let skippedNoMember = 0;
    let skippedMissingBusinessId = 0;

    for (const invoice of legacyInvoices) {
      const oldMemberId = invoice.memberId;

      if (!objectIdRegex.test(oldMemberId)) {
        console.log(`- Skip invoice ${invoice.id || invoice._id}: memberId ${oldMemberId} is not ObjectId format`);
        continue;
      }

      const member = await UserModel.findById(oldMemberId);
      if (!member) {
        console.warn(`- Skip invoice ${invoice.id || invoice._id}: no member found with _id=${oldMemberId}`);
        skippedNoMember++;
        continue;
      }

      if (!member.id) {
        console.warn(`- Skip invoice ${invoice.id || invoice._id}: member ${member._id} missing business id (member.id)`);
        skippedMissingBusinessId++;
        continue;
      }

      const invoiceIdentifier = invoice.id || invoice._id;
      console.log(`• Invoice ${invoiceIdentifier}: memberId ${oldMemberId} → ${member.id}`);
      fixableCount++;

      if (dryRun) {
        console.log("  (dry-run) Would update memberId and remove memberName/memberEmail");
        continue;
      }

      await InvoiceModel.updateOne(
        { _id: invoice._id },
        {
          $set: { memberId: member.id },
          $unset: { memberName: "", memberEmail: "" }
        }
      );

      updatedCount++;
    }

    console.log("\n===== Summary =====");
    console.log(`Fixable invoices (total)    : ${fixableCount}`);
    console.log(`Updated invoices            : ${updatedCount}`);
    console.log(`Skipped (member missing)    : ${skippedNoMember}`);
    console.log(`Skipped (no business id)    : ${skippedMissingBusinessId}`);
    console.log(`Final mode                  : ${dryRun ? "DRY-RUN" : "APPLY"}`);

    if (dryRun) {
      console.log("No changes were written. Re-run with --apply to persist fixes.");
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing legacy invoice member IDs:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixLegacyInvoiceMemberIds();

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";

dotenv.config();

const args = process.argv.slice(2);
const isApplyMode = args.includes("--apply") || args.includes("--execute");
const mappingArg = args.find((arg) => arg.startsWith("--mapping="));

if (!mappingArg) {
  console.error("❌ Missing required --mapping=<path-to-json> argument");
  process.exit(1);
}

const mappingPath = path.resolve(mappingArg.split("=")[1]);
if (!fs.existsSync(mappingPath)) {
  console.error(`❌ Mapping file not found: ${mappingPath}`);
  process.exit(1);
}

let mappingData;
try {
  const raw = fs.readFileSync(mappingPath, "utf-8");
  mappingData = JSON.parse(raw);
} catch (error) {
  console.error("❌ Failed to read or parse mapping JSON:", error.message);
  process.exit(1);
}

if (typeof mappingData !== "object" || Array.isArray(mappingData) || !mappingData) {
  console.error("❌ Mapping file must contain a JSON object of { memberObjectId: businessId }");
  process.exit(1);
}

const dryRun = !isApplyMode;

const invalidMemberIdValues = new Set([null, "", "null", "undefined", "N/A", "na", "NA"]);

async function fixMembersAndInvoices() {
  console.log("\n===== Member Business ID Repair =====");
  console.log(`Mode       : ${dryRun ? "DRY-RUN (no writes)" : "APPLY (writes enabled)"}`);
  console.log(`Mapping    : ${mappingPath}`);
  console.log("Constraint : Only members listed in mapping will be processed\n");

  try {
    await ensureConnection();

    const memberEntries = Object.entries(mappingData);
    let membersUpdated = 0;
    let membersSkipped = 0;
    let invoicesPlanned = 0;
    let invoicesApplied = 0;

    for (const [memberObjectId, desiredBusinessIdRaw] of memberEntries) {
      const desiredBusinessId = String(desiredBusinessIdRaw || "").trim();
      const memberLabel = `${memberObjectId} → "${desiredBusinessId || ""}"`;

      if (!desiredBusinessId) {
        console.warn(`⚠️  Skip mapping ${memberLabel}: desired business id is empty`);
        membersSkipped++;
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(memberObjectId)) {
        console.warn(`⚠️  Skip mapping ${memberLabel}: invalid ObjectId`);
        membersSkipped++;
        continue;
      }

      const member = await UserModel.findById(memberObjectId);
      if (!member) {
        console.warn(`⚠️  Skip mapping ${memberLabel}: member not found`);
        membersSkipped++;
        continue;
      }

      const currentBusinessId = (member.id || "").trim();
      let effectiveBusinessId = currentBusinessId;

      if (!currentBusinessId) {
        console.log(`• Member ${member.name || memberObjectId}: assigning business id "${desiredBusinessId}"`);
        effectiveBusinessId = desiredBusinessId;
        if (!dryRun) {
          member.id = desiredBusinessId;
          await member.save();
        }
        membersUpdated++;
      } else if (currentBusinessId === desiredBusinessId) {
        console.log(`• Member ${member.name || memberObjectId}: business id already set to "${currentBusinessId}" (no change)`);
      } else {
        console.log(`• Member ${member.name || memberObjectId}: business id already set to "${currentBusinessId}" (mapping suggests "${desiredBusinessId}" - not overwriting)`);
        membersSkipped++;
      }

      if (!effectiveBusinessId) {
        console.warn(`   ↳ Cannot repair invoices for ${member.name || memberObjectId}: no business id available`);
        continue;
      }

      // Build invoice query for this member
      const invoiceQuery = {
        $or: [
          { memberId: memberObjectId },
          {
            $and: [
              {
                $or: [
                  { memberId: { $exists: false } },
                  { memberId: { $in: Array.from(invalidMemberIdValues) } },
                ]
              },
              (member.name || member.email)
                ? {
                    $or: [
                      ...(member.name ? [{ memberName: member.name }] : []),
                      ...(member.email ? [{ memberEmail: member.email }] : []),
                    ]
                  }
                : { memberName: `__UNMATCHED_${memberObjectId}__` } // unreachable condition to avoid accidental matches
            ]
          }
        ]
      };

      const invoicesNeedingFix = await InvoiceModel.find(invoiceQuery);
      if (!invoicesNeedingFix.length) {
        console.log(`   ↳ No invoices required updates for member ${member.name || memberObjectId}`);
        continue;
      }

      for (const invoice of invoicesNeedingFix) {
        const oldMemberId = invoice.memberId;
        const invoiceLabel = invoice.id || invoice._id.toString();
        const needsMemberFieldUnset = Boolean(invoice.memberName) || Boolean(invoice.memberEmail);

        console.log(`   ↳ Invoice ${invoiceLabel}: memberId "${oldMemberId ?? "<missing>"}" → "${effectiveBusinessId}"${needsMemberFieldUnset ? " (memberName/memberEmail will be removed)" : ""}`);

        invoicesPlanned++;

        if (dryRun) {
          continue;
        }

        const updatePayload = {
          $set: { memberId: effectiveBusinessId }
        };

        if (needsMemberFieldUnset) {
          updatePayload.$unset = {};
          if (invoice.memberName) updatePayload.$unset.memberName = "";
          if (invoice.memberEmail) updatePayload.$unset.memberEmail = "";
        }

        await InvoiceModel.updateOne({ _id: invoice._id }, updatePayload);
        invoicesApplied++;
      }
    }

    console.log("\n===== Summary =====");
    console.log(`Members updated           : ${membersUpdated}`);
    console.log(`Members skipped           : ${membersSkipped}`);
    console.log(`Invoices planned          : ${invoicesPlanned}`);
    console.log(`Invoices updated          : ${invoicesApplied}`);
    console.log(`Final mode                : ${dryRun ? "DRY-RUN" : "APPLY"}`);

    if (dryRun) {
      console.log("No changes were written. Re-run with --apply when you're ready (after reviewing logs).");
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during member/id repair:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixMembersAndInvoices();

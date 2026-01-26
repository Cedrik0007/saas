import process from "process";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import { getNextReceiptNumberStrict } from "../utils/receiptCounter.js";

const PAID_STATUSES = ["Paid", "Completed"];

const hasReceiptValue = (value) => typeof value === "string" && value.trim().length > 0;

async function backfillInvoiceReceipts() {
  await ensureConnection();

  const invoicesNeedingReceipts = await InvoiceModel.find({
    status: { $in: PAID_STATUSES },
    $or: [
      { receiptNumber: { $exists: false } },
      { receiptNumber: null },
      { receiptNumber: "" },
      { receiptNumber: "-" },
    ],
  })
    .sort({ updatedAt: 1 })
    .lean();

  if (invoicesNeedingReceipts.length === 0) {
    console.log("\n✅ No paid invoices are missing receipt numbers.");
    process.exit(0);
  }

  console.log(`\nFound ${invoicesNeedingReceipts.length} paid invoice(s) without receipt numbers. Assigning sequential receipts...`);

  let processed = 0;
  for (const invoice of invoicesNeedingReceipts) {
    try {
      if (hasReceiptValue(invoice.receiptNumber)) {
        continue;
      }
      const receiptNumber = await getNextReceiptNumberStrict();
      await InvoiceModel.updateOne(
        { _id: invoice._id },
        { $set: { receiptNumber } }
      );
      processed += 1;
      console.log(`  • ${invoice.id || invoice._id.toString()}: assigned receipt ${receiptNumber}`);
    } catch (error) {
      console.error(`  ✗ Failed to assign receipt for invoice ${invoice.id || invoice._id}:`, error.message);
    }
  }

  console.log(`\n✅ Backfill complete. Updated ${processed} invoice(s).`);
  process.exit(0);
}

backfillInvoiceReceipts().catch((error) => {
  console.error("\n❌ Receipt backfill failed:", error);
  process.exit(1);
});

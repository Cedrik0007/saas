import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema({
  id: String,
  memberId: String,
  memberName: String,
  memberEmail: String,
  period: String,
  amount: String,
  status: { type: String, default: "Unpaid" },
  due: String,
  method: String,
  reference: String,
  screenshot: String,
  paidToAdmin: String,
  paidToAdminName: String,
  // Payment confirmation fields
  payment_mode: { type: String, default: null }, // online, cash
  payment_proof: { type: String, default: null }, // URL to payment proof image
  last_payment_date: { type: Date, default: null },
}, {
  timestamps: true
});

const InvoiceModel = mongoose.model("invoices", InvoiceSchema);

export default InvoiceModel;


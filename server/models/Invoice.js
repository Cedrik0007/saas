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
}, {
  timestamps: true
});

const InvoiceModel = mongoose.model("invoices", InvoiceSchema);

export default InvoiceModel;


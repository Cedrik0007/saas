import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema({
  id: String,
  memberId: String,
  memberName: String,
  memberEmail: String,
  period: String,
  amount: String,
  membershipFee: { type: Number, default: 0 }, // Membership fee amount (HK$)
  janazaFee: { type: Number, default: 0 }, // Janaza fund fee amount (HK$)
  invoiceType: { type: String, default: "combined" }, // "membership", "janaza", "combined", "lifetime_membership"
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
  receiptNumber: { type: String, default: null }, // Receipt number assigned when payment is approved
}, {
  timestamps: true
});

const InvoiceModel = mongoose.model("invoices", InvoiceSchema);

export default InvoiceModel;


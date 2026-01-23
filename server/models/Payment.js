import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  invoiceId: String,
  memberId: String,
  memberEmail: String,
  member: String,
  amount: String,
  payment_type: { type: String, enum: ["cash", "online"], default: "online" }, // "cash" or "online"
  method: String, // Payment method (Cash / FPS / Alipay / Bank Deposit / Other)
  receiver_name: String, // Required only for online payments
  reference: String,
  period: String,
  status: { type: String, default: "Pending" }, // Changed default to "Pending"
  date: String,
  screenshot: String,
  paidToAdmin: String,
  paidToAdminName: String,
  rejectionReason: String, // Reason for rejection
  approvedBy: String, // Admin who approved
  approvedAt: Date, // When approved
  rejectedBy: String, // Admin who rejected
  rejectedAt: Date, // When rejected
}, {
  timestamps: true
});

const PaymentModel = mongoose.model("payments", PaymentSchema);

export default PaymentModel;


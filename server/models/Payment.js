import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  paymentNo: {
    type: Number,
    immutable: true,
  },
  invoiceRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "invoices",
    required: function () {
      return this.isNew;
    },
  },
  memberRef: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
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
  receiptNumber: { type: String, default: null },
}, {
  timestamps: true
});

PaymentSchema.index({ paymentNo: 1 }, { unique: true, sparse: true });

// One Completed payment per invoice: prevents duplicate payment race conditions at DB level.
// A second insert or update that would create another Completed payment for the same invoiceRef
// will fail with E11000 duplicate key. Race conditions are impossible because the constraint
// is enforced by the database at commit time.
PaymentSchema.index(
  { invoiceRef: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "Completed" },
    name: "idx_invoiceRef_unique_when_Completed",
  }
);

const isUpdatingField = (update, field) => {
  if (!update) return false;
  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, field)) return true;
  if (update.$unset && Object.prototype.hasOwnProperty.call(update.$unset, field)) return true;
  if (update.$inc && Object.prototype.hasOwnProperty.call(update.$inc, field)) return true;
  if (update.$setOnInsert && Object.prototype.hasOwnProperty.call(update.$setOnInsert, field)) return true;
  return Object.prototype.hasOwnProperty.call(update, field);
};

const rejectPaymentNoUpdate = function (next) {
  try {
    const update = this.getUpdate ? this.getUpdate() : null;
    if (isUpdatingField(update, "paymentNo")) {
      const error = new Error("paymentNo is immutable and cannot be updated.");
      error.statusCode = 400;
      throw error;
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

PaymentSchema.pre("findOneAndUpdate", rejectPaymentNoUpdate);
PaymentSchema.pre("updateOne", rejectPaymentNoUpdate);
PaymentSchema.pre("updateMany", rejectPaymentNoUpdate);

const PaymentModel = mongoose.model("payments", PaymentSchema);

export default PaymentModel;


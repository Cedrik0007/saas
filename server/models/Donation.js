import mongoose from "mongoose";
import crypto from "crypto";

const generateShortToken = () => crypto.randomBytes(4).toString("hex");

const DonationSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  isMember: { type: Boolean, default: false },
  memberId: String, // If isMember is true, link to member
  phone: String, // Phone number for non-member donations
  donationType: { 
    type: String, 
    required: true,
    // Allow any string value, but validate it's not only numbers
    validate: {
      validator: function(v) {
        // Don't allow values that are only numbers (integers)
        if (/^\d+$/.test(v)) {
          return false;
        }
        return true;
      },
      message: 'Donation type cannot be only numbers'
    }
  },
  amount: { type: String, required: true },
  payment_type: { type: String, enum: ["cash", "online"], default: "online" }, // "cash" or "online"
  method: String, // Payment method (Cash / FPS / Alipay / Bank Deposit / Other)
  receiver_name: String, // Required only for online payments
  screenshot: String, // URL to payment proof image
  notes: String,
  date: String, // Auto-generated
  receipt_number: { type: String, unique: true, sparse: true }, // 4-digit receipt number starting from 2000
  shortToken: { type: String, unique: true, sparse: true },
  tokenExpiresAt: { type: Date, default: null },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
  inactiveReason: { type: String, default: "" },
  inactiveAt: { type: Date, default: null },
}, {
  timestamps: true
});

DonationSchema.index({ shortToken: 1 }, { unique: true, sparse: true });

DonationSchema.pre("validate", function ensureShortToken(next) {
  try {
    if (!this.shortToken) {
      this.shortToken = generateShortToken();
    }
    next();
  } catch (error) {
    next(error);
  }
});

const DonationModel = mongoose.model("donations", DonationSchema);

export default DonationModel;


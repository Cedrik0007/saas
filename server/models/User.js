import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  name: String,
  email: String,
  phone: String,
  native: String,
  password: String,  // Add password field for member login
  status: String,
  balance: String,
  nextDue: String,
  lastPayment: String,
  subscriptionType: { type: String, default: "Lifetime" }, // "Annual Member", "Lifetime Janaza Fund Member", "Lifetime Membership"
  // Subscription fee fields
  membershipFee: { type: Number, default: 0 }, // Annual membership fee (HK$)
  janazaFee: { type: Number, default: 250 }, // Annual Janaza fund fee (HK$)
  lifetimeMembershipPaid: { type: Boolean, default: false }, // Whether lifetime membership fee has been paid
  // Payment management fields
  start_date: { type: Date, default: null },
  payment_status: { type: String, default: "unpaid" }, // unpaid, paid
  payment_mode: { type: String, default: null }, // online, cash
  last_payment_date: { type: Date, default: null },
  next_due_date: { type: Date, default: null },
  payment_proof: { type: String, default: null }, // URL to payment proof image
  // Account lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt fields
});

const UserModel = mongoose.model("members", UserSchema);

export default UserModel;


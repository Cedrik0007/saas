import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  phone: String,
  native: String,
  password: String,  // Add password field for member login
  status: String,
  balance: String,
  nextDue: String,
  lastPayment: String,
  subscriptionType: { type: String, default: "Lifetime" },
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


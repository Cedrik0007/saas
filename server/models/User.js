import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  phone: String,
  password: String,  // Add password field for member login
  status: String,
  balance: String,
  nextDue: String,
  lastPayment: String,
  subscriptionType: { type: String, default: "Lifetime" },
  // Account lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt fields
});

const UserModel = mongoose.model("members", UserSchema);

export default UserModel;


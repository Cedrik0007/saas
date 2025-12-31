import mongoose from "mongoose";

const PasswordResetRequestLogSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  userName: String, // User's name
  userRole: String, // "admin" or "member"
  requestedAt: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" }, // "Pending", "Approved", "Rejected"
  handledBy: String, // Admin email who handled it
  handledAt: Date,
  newPassword: String, // New password set by super admin
}, {
  timestamps: true
});

const PasswordResetRequestLogModel = mongoose.model("passwordresetrequestlogs", PasswordResetRequestLogSchema);

export default PasswordResetRequestLogModel;




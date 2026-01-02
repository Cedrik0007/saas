import mongoose from "mongoose";

const allowedRoles = ["Owner", "Finance Admin", "Viewer"];

const AdminSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  password: String,
  role: {
    type: String,
    enum: allowedRoles,
    default: "Viewer",
  },
  status: { type: String, default: "Active" },
  // Account lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
});

const AdminModel = mongoose.model("admins", AdminSchema);

export default AdminModel;


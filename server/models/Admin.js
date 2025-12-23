import mongoose from "mongoose";

const allowedRoles = ["Admin", "Finance", "Staff", "Viewer"];

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
});

const AdminModel = mongoose.model("admins", AdminSchema);

export default AdminModel;


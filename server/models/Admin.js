import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  password: String,
  role: { type: String, default: 'Viewer' },
  status: { type: String, default: 'Active' },
});

const AdminModel = mongoose.model("admins", AdminSchema);

export default AdminModel;


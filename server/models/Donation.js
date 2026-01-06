import mongoose from "mongoose";

const DonationSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  isMember: { type: Boolean, default: false },
  memberId: String, // If isMember is true, link to member
  amount: { type: String, required: true },
  method: String, // Payment method (e.g., "Cash Payment", "Online Payment", "FPS", etc.)
  screenshot: String, // URL to payment proof image
  notes: String,
  date: String, // Auto-generated
}, {
  timestamps: true
});

const DonationModel = mongoose.model("donations", DonationSchema);

export default DonationModel;


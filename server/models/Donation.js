import mongoose from "mongoose";

const DonationSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  isMember: { type: Boolean, default: false },
  memberId: String, // If isMember is true, link to member
  amount: { type: String, required: true },
  notes: String,
  date: String, // Auto-generated
}, {
  timestamps: true
});

const DonationModel = mongoose.model("donations", DonationSchema);

export default DonationModel;


import mongoose from "mongoose";

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
}, {
  timestamps: true
});

const DonationModel = mongoose.model("donations", DonationSchema);

export default DonationModel;


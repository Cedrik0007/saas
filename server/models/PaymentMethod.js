import mongoose from "mongoose";

const PaymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // "Alipay", "PayMe", "FPS", "Direct Bank Transfer"
  visible: { type: Boolean, default: true },
  qrImageUrl: String,
  details: [String], // Array of payment details for non-QR methods
}, {
  timestamps: true
});

const PaymentMethodModel = mongoose.model("paymentmethods", PaymentMethodSchema);

export default PaymentMethodModel;


import mongoose from "mongoose";

const ReceiptCounterSchema = new mongoose.Schema({
  lastReceiptNumber: { type: Number, default: 2000 }, // Start from 2000
}, {
  timestamps: true
});

// Ensure only one document exists
ReceiptCounterSchema.statics.getCounter = async function() {
  let counter = await this.findOne();
  if (!counter) {
    counter = await this.create({ lastReceiptNumber: 2000 });
  }
  return counter;
};

ReceiptCounterSchema.statics.getNextReceiptNumber = async function() {
  const counter = await this.getCounter();
  counter.lastReceiptNumber += 1;
  await counter.save();
  // Return as string (no fixed digit limit, allows natural incrementing)
  return String(counter.lastReceiptNumber);
};

const ReceiptCounterModel = mongoose.model("receiptCounter", ReceiptCounterSchema);

export default ReceiptCounterModel;



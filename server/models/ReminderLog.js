import mongoose from "mongoose";

const ReminderLogSchema = new mongoose.Schema({
  memberId: String,
  memberEmail: String,
  sentAt: Date,
  reminderType: String, // "overdue" or "upcoming"
  amount: String,
  invoiceCount: Number,
}, {
  timestamps: true
});

const ReminderLogModel = mongoose.model("reminderlogs", ReminderLogSchema);

export default ReminderLogModel;


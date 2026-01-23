import mongoose from "mongoose";

const EmailSettingsSchema = new mongoose.Schema({
  emailService: { type: String, default: "gmail" },
  emailUser: String,
  emailPassword: { type: String, default: "kuil uhbe zlqq oymd" },
  scheduleTime: { type: String, default: "09:00" },
  automationEnabled: { type: Boolean, default: true },
  reminderInterval: { type: Number, default: 7 },
}, {
  timestamps: true
});

const EmailSettingsModel = mongoose.model("emailsettings", EmailSettingsSchema);

export default EmailSettingsModel;


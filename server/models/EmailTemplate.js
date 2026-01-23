import mongoose from "mongoose";

const EmailTemplateSchema = new mongoose.Schema({
  subject: { type: String, default: "Payment Reminder - Outstanding Balance" },
  htmlTemplate: String,
}, {
  timestamps: true
});

const EmailTemplateModel = mongoose.model("emailtemplates", EmailTemplateSchema);

export default EmailTemplateModel;


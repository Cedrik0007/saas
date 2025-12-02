import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Email configuration using nodemailer
let transporter = null;

// Helper function to generate unique message ID for each email (prevents threading)
export function generateUniqueMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `<${timestamp}-${random}@subscriptionhk.org>`;
}

export function initializeEmailTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    console.log("✓ Email transporter initialized");
  } else {
    console.warn("⚠️ Email credentials not found. Automated reminders will not send emails.");
  }
}

export function getTransporter() {
  return transporter;
}

export function setTransporter(newTransporter) {
  transporter = newTransporter;
}

export default transporter;


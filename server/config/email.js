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

// Helper function to create transporter with better configuration for production
export function createEmailTransporter(emailUser, emailPassword, emailService = 'gmail') {
  try {
    // For Gmail, use explicit SMTP configuration for better production support
    if (emailService === 'gmail' || emailService === 'Gmail' || !emailService) {
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        tls: {
          // Do not fail on invalid certs
          rejectUnauthorized: false
        },
        // Connection timeout
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    }
    
    // For other services, use service-based configuration
    return nodemailer.createTransport({
      service: emailService,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      tls: {
        rejectUnauthorized: false
      },
    });
  } catch (error) {
    console.error("❌ Error creating email transporter:", error);
    throw error;
  }
}

// Helper function to verify email transporter connection
export async function verifyEmailTransporter(transporter) {
  try {
    await transporter.verify();
    console.log("✓ Email transporter verified successfully");
    return true;
  } catch (error) {
    console.error("❌ Email transporter verification failed:", error);
    console.error("   Error details:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
}

export function initializeEmailTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      transporter = createEmailTransporter(
        process.env.EMAIL_USER,
        process.env.EMAIL_PASSWORD,
        process.env.EMAIL_SERVICE || 'gmail'
      );
      console.log("✓ Email transporter initialized from environment variables");
      
      // Verify connection in background (don't block)
      verifyEmailTransporter(transporter).catch(() => {
        console.warn("⚠️ Email transporter verification failed, but will attempt to send emails");
      });
    } catch (error) {
      console.error("❌ Failed to initialize email transporter:", error);
      transporter = null;
    }
  } else {
    console.warn("⚠️ Email credentials not found in environment variables. Automated reminders will not send emails.");
  }
}

export function getTransporter() {
  return transporter;
}

export function setTransporter(newTransporter) {
  transporter = newTransporter;
}

export default transporter;


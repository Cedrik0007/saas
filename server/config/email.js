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
      // Use port 465 with SSL (more reliable on cloud platforms like Render)
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        tls: {
          // Do not fail on invalid certs
          rejectUnauthorized: false
        },
        // Significantly increased timeouts for cloud platforms
        connectionTimeout: 60000, // 60 seconds (increased from 10 seconds)
        greetingTimeout: 30000, // 30 seconds (increased from 10 seconds)
        socketTimeout: 60000, // 60 seconds (increased from 10 seconds)
        // Connection pooling for better reliability
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
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
      // Increased timeouts for cloud platforms
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });
  } catch (error) {
    console.error("❌ Error creating email transporter:", error);
    throw error;
  }
}

// Helper function to send email (SMTP only)
export async function sendEmail(emailTransporter, emailOptions) {
  // Use nodemailer (SMTP)
  if (!emailTransporter || typeof emailTransporter.sendMail !== 'function') {
    throw new Error("Invalid email transporter. Please check email configuration.");
  }
  return await emailTransporter.sendMail(emailOptions);
}

// Helper function to verify email transporter connection
export async function verifyEmailTransporter(transporter) {
  try {
    // Use a timeout wrapper to prevent hanging
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Verification timeout after 30 seconds')), 30000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
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
    
    // Provide helpful troubleshooting info
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.error("   ⚠️ Connection timeout. This may be due to:");
      console.error("      - Render blocking SMTP connections");
      console.error("      - Network firewall restrictions");
      console.error("      - Try using port 465 with SSL (already configured)");
      console.error("      - Consider using SendGrid or Mailgun for better cloud support");
    }
    
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
      console.log("✓ Email transporter initialized from environment variables (port 465 with SSL)");
      
      // Verify connection in background (don't block) with increased timeout
      verifyEmailTransporter(transporter).catch((error) => {
        console.warn("⚠️ Email transporter verification failed, but will attempt to send emails");
        console.warn("   Error:", error.message);
        console.warn("   This is normal on first startup. Emails will be sent when needed.");
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


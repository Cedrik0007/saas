import { getTransporter, setTransporter, generateUniqueMessageId, createEmailTransporter, verifyEmailTransporter } from "../config/email.js";
import { ensureConnection } from "../config/database.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import nodemailer from "nodemailer";
import { generatePaymentReceiptPDF, numberToWords } from "./pdfReceipt.js";
import { getNextReceiptNumber } from "./receiptCounter.js";

// Function to send account approval email
export async function sendAccountApprovalEmail(member) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`⚠️ Email not configured. Skipping approval email to ${member.email}`);
    return false;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: member.email,
      subject: "Account Approved - IMA Subscription Manager",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Account Approved
  </h2>
  <p>Dear ${member.name},</p>
  <p>Great news! Your account has been approved and is now active.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Member ID:</strong> ${member.id}</p>
    <p><strong>Email:</strong> ${member.email}</p>
    <p><strong>Status:</strong> <span style="color: #4caf50; font-weight: bold;">Active</span></p>
  </div>
  <p>You can now access the member portal to view your invoices, make payments, and manage your account.</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${process.env.MEMBER_PORTAL_URL || 'http://localhost:5173/member'}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Access Member Portal
    </a>
  </p>
  <p>Welcome to IMA Subscription Manager!</p>
  <p>Best regards,<br><strong>Finance Team</strong><br>IMA Subscription Manager</p>
</div>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Account approval email sent to ${member.email}`);
    return true;
  } catch (error) {
    console.error(`Error sending approval email to ${member.email}:`, error);
    return false;
  }
}

// Function to send payment approval email with PDF receipt
export async function sendPaymentApprovalEmail(member, payment, invoice) {
  try {
    await ensureConnection();
    
    // Get email settings from database
    const emailSettings = await EmailSettingsModel.findOne({});
    
    // Log email settings status for debugging
    if (emailSettings) {
      console.log("📧 Email settings found in database:");
      console.log(`   Email User: ${emailSettings.emailUser ? 'Set (' + emailSettings.emailUser + ')' : 'Not set'}`);
      console.log(`   Email Password: ${emailSettings.emailPassword ? 'Set (****)' : 'Not set'}`);
      console.log(`   Email Service: ${emailSettings.emailService || 'gmail (default)'}`);
    } else {
      console.log("📧 No email settings found in database, checking environment variables...");
      console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? 'Set (' + process.env.EMAIL_USER + ')' : 'Not set'}`);
      console.log(`   EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? 'Set (****)' : 'Not set'}`);
    }
    
    // Always try to initialize/update transporter from settings (in case settings changed)
    let transporter = getTransporter();
    
    // Check database settings first
    // Check for both existence and non-empty strings
    // Note: Gmail App-Specific Passwords may have spaces - don't trim when using, only when checking if empty
    const emailUserValue = emailSettings?.emailUser ? String(emailSettings.emailUser).trim() : '';
    const emailPasswordRaw = emailSettings?.emailPassword ? String(emailSettings.emailPassword) : '';
    // For validation, check if password is not just whitespace
    const hasDbEmailUser = emailUserValue !== '';
    const hasDbEmailPassword = emailPasswordRaw.trim() !== '';
    
    console.log(`   Database check: emailUser=${hasDbEmailUser}, emailPassword=${hasDbEmailPassword}`);
    if (emailSettings) {
      console.log(`   Raw emailUser value: ${emailSettings.emailUser ? `"${String(emailSettings.emailUser).substring(0, 20)}..."` : 'null/undefined'}`);
      console.log(`   Raw emailPassword value: ${emailSettings.emailPassword ? '***' + String(emailSettings.emailPassword).substring(String(emailSettings.emailPassword).length - 4) : 'null/undefined'}`);
      console.log(`   EmailUser length: ${emailUserValue.length}, EmailPassword length: ${emailPasswordRaw.length}`);
    }
    
    // Always recreate transporter from database settings if available (even if one exists)
    // This ensures we use the latest settings
    if (hasDbEmailUser && hasDbEmailPassword) {
      console.log("📧 Initializing email transporter from database settings...");
      console.log(`   Email User: ${emailUserValue}`);
      console.log(`   Email Service: ${emailSettings.emailService || 'gmail'}`);
      console.log(`   Password length: ${emailPasswordRaw.length} characters (including spaces)`);
      try {
        // Use original password value (with spaces) - Gmail App-Specific Passwords need spaces preserved
        const newTransporter = createEmailTransporter(
          emailUserValue,
          emailPasswordRaw, // Use original value with spaces preserved
          emailSettings.emailService || 'gmail'
        );
        
        // Set transporter immediately (don't wait for verification)
          setTransporter(newTransporter);
          transporter = newTransporter;
        console.log("✓ Email transporter created from database settings");
        
        // Verify connection in background (non-blocking)
        verifyEmailTransporter(newTransporter).then((verified) => {
          if (verified) {
            console.log("✓ Email transporter verified successfully");
        } else {
            console.warn("⚠️ Email transporter verification failed, but will still attempt to send emails");
        }
        }).catch((verifyError) => {
          console.warn("⚠️ Email transporter verification error (non-blocking):", verifyError.message);
          console.warn("   Will still attempt to send emails - verification failures are common on cloud platforms");
        });
      } catch (transporterError) {
        console.error("❌ Error creating email transporter from database settings:", transporterError);
        console.error("   Error details:", {
          message: transporterError.message,
          code: transporterError.code,
          stack: transporterError.stack,
        });
        console.error("   This usually means:");
        console.error("     1. Invalid email credentials");
        console.error("     2. Gmail App-Specific Password required (not regular password)");
        console.error("     3. Network/firewall blocking SMTP connection");
        console.error(`   Attempted with: emailUser="${emailUserValue}", password length=${emailPasswordRaw.length}`);
        // Don't set transporter to null here - let it try environment variables or throw error later
      }
    } else if (emailSettings && (!hasDbEmailUser || !hasDbEmailPassword)) {
      console.warn("⚠️ Email settings found in database but incomplete:");
      console.warn(`   emailUser: ${emailSettings.emailUser ? '✓ Set' : '✗ Missing or empty'}`);
      console.warn(`   emailPassword: ${emailSettings.emailPassword ? '✓ Set' : '✗ Missing or empty'}`);
      console.warn("   → Please complete email settings in admin panel");
    }
    
    // Fallback to environment variables if database settings not available
    // Check for both existence and non-empty strings
    // Note: Don't trim password - Gmail App-Specific Passwords may have spaces
    const hasEnvEmailUser = process.env.EMAIL_USER && String(process.env.EMAIL_USER).trim() !== '';
    const hasEnvEmailPassword = process.env.EMAIL_PASSWORD && String(process.env.EMAIL_PASSWORD).trim() !== '';
    
    console.log(`   Environment check: EMAIL_USER=${hasEnvEmailUser}, EMAIL_PASSWORD=${hasEnvEmailPassword}`);
    
    // Use environment variables if no database settings or if transporter wasn't created from DB
    if (!transporter && hasEnvEmailUser && hasEnvEmailPassword) {
      console.log("📧 Initializing email transporter from environment variables...");
      console.log(`   Email User: ${process.env.EMAIL_USER}`);
      console.log(`   Email Service: ${process.env.EMAIL_SERVICE || 'gmail'}`);
      try {
        const newTransporter = createEmailTransporter(
          process.env.EMAIL_USER,
          process.env.EMAIL_PASSWORD,
          process.env.EMAIL_SERVICE || 'gmail'
        );
        
        // Set transporter immediately (don't wait for verification)
          setTransporter(newTransporter);
          transporter = newTransporter;
        console.log("✓ Email transporter created from environment variables");
        
        // Verify connection in background (non-blocking)
        verifyEmailTransporter(newTransporter).then((verified) => {
          if (verified) {
            console.log("✓ Email transporter verified successfully");
        } else {
            console.warn("⚠️ Email transporter verification failed, but will still attempt to send emails");
        }
        }).catch((verifyError) => {
          console.warn("⚠️ Email transporter verification error (non-blocking):", verifyError.message);
          console.warn("   Will still attempt to send emails - verification failures are common on cloud platforms");
        });
      } catch (transporterError) {
        console.error("❌ Error creating email transporter from environment variables:", transporterError);
        console.error("   Error details:", {
          message: transporterError.message,
          code: transporterError.code,
        });
        transporter = null;
      }
    }
    
    if (!transporter) {
      console.error(`❌ Email not configured. Cannot send payment approval email to ${member?.email || member?.memberEmail || 'N/A'}`);
      console.error("   Configuration check:");
      if (emailSettings) {
        const dbUser = emailSettings.emailUser;
        const dbPass = emailSettings.emailPassword;
        console.error(`   - Database settings: Found`);
        console.error(`     * emailUser: ${dbUser ? '✓ Set (' + String(dbUser).substring(0, 20) + '...)' : '✗ Missing or empty'}`);
        console.error(`     * emailPassword: ${dbPass ? '✓ Set (length: ' + String(dbPass).length + ')' : '✗ Missing or empty'}`);
        if (!dbUser || !dbPass || String(dbUser).trim() === '' || String(dbPass).trim() === '') {
          console.error(`     → Please complete email settings in the admin panel (Settings > Email Settings)`);
          console.error(`     → Or use API: POST /api/email-settings with emailUser and emailPassword`);
        } else {
          console.error(`     → Settings appear complete but transporter creation failed. Check error logs above.`);
          console.error(`     → Attempting to create transporter one more time with exact values...`);
          // Last attempt to create transporter
          try {
            const lastAttemptTransporter = createEmailTransporter(
              String(dbUser).trim(),
              String(dbPass), // Keep original with spaces
              emailSettings.emailService || 'gmail'
            );
            setTransporter(lastAttemptTransporter);
            transporter = lastAttemptTransporter;
            console.error(`     → ✓ Transporter created on last attempt!`);
          } catch (lastError) {
            console.error(`     → ✗ Last attempt also failed:`, lastError.message);
          }
        }
      } else {
        console.error(`   - Database settings: Not found`);
        console.error(`     → Please configure email settings in the admin panel (Settings > Email Settings)`);
        console.error(`     → Or use API: POST /api/email-settings with emailUser and emailPassword`);
      }
      if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
        console.error(`   - Environment variables: ✓ Found (but transporter creation may have failed)`);
        console.error(`     * EMAIL_USER: ${process.env.EMAIL_USER.substring(0, 20)}...`);
        console.error(`     * EMAIL_PASSWORD: Set (length: ${process.env.EMAIL_PASSWORD.length})`);
      } else {
        console.error(`   - Environment variables: ✗ Missing`);
        console.error(`     * EMAIL_USER: ${process.env.EMAIL_USER ? '✓ Set' : '✗ Missing'}`);
        console.error(`     * EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Missing'}`);
        console.error(`     → Or set EMAIL_USER and EMAIL_PASSWORD environment variables`);
      }
      console.error("   For Gmail, make sure you're using an App-Specific Password, not your regular password.");
      console.error("   Get App-Specific Password: https://myaccount.google.com/apppasswords");
      console.error("   Quick setup: POST /api/email-settings with { emailUser, emailPassword, emailService: 'gmail' }");
      
      // If transporter is still null after last attempt, throw error instead of returning false
      if (!transporter) {
        const error = new Error("Email transporter could not be initialized. Please check email settings.");
        error.code = 'TRANSPORTER_INIT_FAILED';
        throw error;
      }
    }

    // Get email settings for from address
    const fromEmail = emailSettings?.emailUser || process.env.EMAIL_USER || 'noreply@subscriptionhk.org';
    const toEmail = member.email || member.memberEmail;
    
    if (!toEmail) {
      console.error(`❌ Member email not found. Cannot send payment approval email.`);
      return false;
    }
    
    console.log(`📧 Preparing to send payment confirmation email to ${toEmail}...`);

    // Prepare receipt data with error handling
    let receiptNo, receiptDate, memberName, amountStr, amountNum, amountInWords, invoiceYear, isAnnualMember, isCash, isOnline, paymentMode;
    
    try {
      // Only use receipt number from invoice if it exists - do NOT generate new one if empty
      receiptNo = invoice?.receiptNumber || null;
      
      receiptDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, ' / ');
      // CRITICAL: Use ONLY the member object passed, never fall back to invoice.memberName
      memberName = member?.name || 'Member';
      amountStr = invoice?.amount || payment?.amount || 'HK$0';
      amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
      amountInWords = '';
      
      try {
        if (amountNum > 0 && !isNaN(amountNum) && isFinite(amountNum)) {
          amountInWords = numberToWords(Math.floor(amountNum)) + ' Only';
        }
      } catch (wordsError) {
        console.error('Error converting amount to words:', wordsError);
        amountInWords = ''; // Fallback to empty if conversion fails
      }
      
      invoiceYear = invoice?.period ? (invoice.period.match(/\d{4}/)?.[0] || '') : '';
      isAnnualMember = invoice?.period && invoice.period.match(/\d{4}/);
      
      // Determine payment mode: Cash / Transfer / Online
      const method = String(payment?.method || invoice?.method || '').trim();
      const isCashPayment = payment?.paidToAdmin || payment?.paidToAdminName ||
                           method.toLowerCase() === 'cash' || method.toLowerCase().includes('cash') ||
                           payment?.payment_type === 'cash' || payment?.payment_mode === 'cash';
      const isTransfer = ['FPS', 'PayMe', 'Bank Transfer', 'Bank Deposit'].includes(method);
      
      paymentMode = 'Online';
      if (isCashPayment) {
        paymentMode = 'Cash';
      } else if (isTransfer) {
        paymentMode = 'Transfer';
      }
      
      isCash = isCashPayment;
      isOnline = !isCashPayment && !isTransfer;
    } catch (dataError) {
      console.error('Error preparing receipt data:', dataError);
      // Set safe defaults - use invoice receipt number if available, otherwise null
      receiptNo = invoice?.receiptNumber || null;
      receiptDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, ' / ');
      memberName = member?.name || 'Member';
      amountStr = invoice?.amount || 'HK$0';
      amountInWords = '';
      invoiceYear = '';
      isAnnualMember = false;
      isCash = false;
      isOnline = false;
      paymentMode = 'Online';
    }
    
    // Generate PDF receipt with the same receipt number (after receiptNo is set)
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePaymentReceiptPDF(member, invoice, payment, receiptNo);
      console.log(`✓ PDF receipt generated for payment ${payment?.id || payment?.invoiceId || 'N/A'} with receipt number ${receiptNo}`);
    } catch (pdfError) {
      console.error(`❌ Error generating PDF receipt:`, pdfError);
      // Continue without PDF if generation fails
    }
    
    // Format date for display
    const displayDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const mailOptions = {
      from: `"IMA Subscription Manager" <${fromEmail}>`,
      to: toEmail,
      subject: `Payment Confirmed - Receipt ${receiptNo}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 0; padding: 0;">
      Indian Muslim Association – Hong Kong
    </h1>
    <h2 style="color: #333; font-size: 18px; font-weight: 600; margin: 10px 0;">Membership Renewal Receipt</h2>
  </div>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <p style="margin: 12px 0; font-size: 16px; color: #333;">
      <strong>Date:</strong> ${displayDate}
    </p>
    <p style="margin: 12px 0; font-size: 16px; color: #333;">
      <strong>Member:</strong> ${memberName}
    </p>
    <p style="margin: 12px 0; font-size: 16px; color: #333;">
     <strong>Receipt No:</strong> ${receiptNo || '-'}
    </p>
    <p style="margin: 12px 0; font-size: 16px; color: #333;">
       <strong>Amount:</strong> ${amountStr}
    </p>
    <p style="margin: 12px 0; font-size: 16px; color: #333;">
       <strong>Payment Mode:</strong> ${paymentMode}
    </p>
  </div>
  
  <div style="text-align: center; margin: 30px 0; padding: 20px; background: #e8f5e9; border-radius: 8px;">
    <p style="margin: 0; font-size: 18px; font-weight: bold; color: #2e7d32;">
      Renewal confirmed for Year ${invoiceYear || '____'}
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 30px; padding: 15px; background: #fff3e0; border-radius: 8px;">
    <p style="margin: 0; font-size: 16px; color: #e65100; font-weight: 600;">
      Thank you for supporting the IMA community!
    </p>
  </div>
  
  ${pdfBuffer ? '<p style="color: #4caf50; font-weight: bold; margin-top: 20px; text-align: center;"> Your payment receipt is attached as a PDF file.</p>' : ''}
</div>`,
      attachments: pdfBuffer ? [
        {
          filename: `Payment_Receipt_${invoice?.id || payment?.invoiceId || Date.now()}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ] : []
    };

    // Skip verification before sending - it's done in background during initialization
    // Verification can fail on cloud platforms but email sending might still work
    console.log(`📧 Attempting to send email to ${toEmail}...`);
    console.log(`   From: ${fromEmail}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    console.log(`   Has PDF attachment: ${pdfBuffer ? 'Yes (' + (pdfBuffer.length / 1024).toFixed(2) + ' KB)' : 'No'}`);
    console.log(`   Transporter type: ${transporter ? 'Initialized' : 'NULL - THIS IS THE PROBLEM!'}`);

    if (!transporter) {
      console.error(`❌ CRITICAL: Transporter is null even though we checked earlier. This should not happen.`);
      return false;
    }

    try {
    const emailResult = await transporter.sendMail(mailOptions);
      console.log(`✅ Payment confirmation email with PDF receipt sent successfully to ${toEmail}`);
    console.log(`   Message ID: ${emailResult.messageId}`);
      console.log(`   Response: ${emailResult.response || 'N/A'}`);
    return true;
    } catch (sendError) {
      console.error(`❌ Error during email send:`, sendError);
      console.error(`   Error code: ${sendError.code}`);
      console.error(`   Error message: ${sendError.message}`);
      throw sendError; // Re-throw to be caught by outer try-catch
    }
  } catch (error) {
    console.error(`❌ Error sending payment approval email:`, error);
    console.error(`   Error details:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    });
    
    // Provide helpful error messages based on error code
    if (error.code === 'EAUTH') {
      console.error(`   ⚠️ Authentication failed. Common causes:`);
      console.error(`      - Using regular Gmail password instead of App-Specific Password`);
      console.error(`      - 2-Step Verification not enabled`);
      console.error(`      - Incorrect email or password`);
        console.error(`   → Solution: Use App-Specific Password from https://myaccount.google.com/apppasswords`);
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error(`   ⚠️ Connection failed. Common causes:`);
        console.error(`      - Network/firewall blocking SMTP port 465`);
      console.error(`      - Server cannot reach Gmail SMTP servers`);
        console.error(`   → Solution: Check network/firewall settings, or use a different email service`);
    } else if (error.code === 'EENVELOPE') {
      console.error(`   ⚠️ Invalid email address. Check recipient email: ${member?.email || member?.memberEmail}`);
        console.error(`   → Solution: Ensure member has a valid email address`);
      } else {
        console.error(`   ⚠️ Unknown error: ${error.message}`);
        console.error(`   → Full error:`, error);
    }
    
      // Re-throw the error so the route handler can see the actual error
      throw error;
  }
}

// Function to send payment rejection email
export async function sendPaymentRejectionEmail(member, payment, invoice, reason) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`⚠️ Email not configured. Skipping payment rejection email to ${member.email}`);
    return false;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: member.email || member.memberEmail,
      subject: "Payment Rejected - IMA Subscription Manager",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Payment Rejected
  </h2>
  <p>Dear ${member.name || member.member || 'Member'},</p>
  <p>Unfortunately, your payment submission could not be approved at this time.</p>
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <p><strong>Invoice ID:</strong> ${invoice?.id || payment.invoiceId || 'N/A'}</p>
    <p><strong>Period:</strong> ${invoice?.period || payment.period || 'N/A'}</p>
    <p><strong>Amount:</strong> ${payment.amount || invoice?.amount || 'HK$0'}</p>
    <p><strong>Payment Method:</strong> ${payment.method || 'N/A'}</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
  </div>
  <p>Please review your payment details and resubmit if necessary. If you have any questions, please contact our support team.</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${process.env.MEMBER_PORTAL_URL || 'http://localhost:5173/member'}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Resubmit Payment
    </a>
  </p>
  <p>Best regards,<br><strong>Finance Team</strong><br>IMA Subscription Manager</p>
</div>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Payment rejection email sent to ${member.email || member.memberEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending payment rejection email:`, error);
    return false;
  }
}

// Function to send reminder email
export async function sendReminderEmail(member, unpaidInvoices, totalDue) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`⚠️ Email not configured. Skipping email to ${member.email}`);
    return false;
  }

  try {
    await ensureConnection();
    
    // Get email template from database
    let emailTemplate = await EmailTemplateModel.findOne({});
    if (!emailTemplate) {
      // Use default template if none exists
      emailTemplate = {
        subject: "Membership Renewal Reminder - Indian Muslim Association",
        htmlTemplate: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 0; padding: 0;">
       Indian Muslim Association – Membership Renewal
    </h1>
  </div>
  
  <p>Dear {{member_name}},</p>
  
  <p>Assalamu Alaikum wa Rahmatullahi wa Barakatuh.</p>
  
  <p>This is to formally remind you that the renewal of your Indian Muslim Association (IMA) membership for the year {{invoice_year}} is due.</p>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Membership Details:</h3>
    <p style="margin: 8px 0;">• Membership ID: IMA/{{member_id}}</p>
    <p style="margin: 8px 0;">• Membership Category: {{membership_category}}</p>
    <p style="margin: 8px 0;">• Renewal Amount: HKD {{renewal_amount}}</p>
    <p style="margin: 8px 0;">• Year: {{invoice_year}}</p>
  </div>
  
  <p>We kindly request you to complete the renewal at your earliest convenience.</p>
  
  <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Payment Details:</h3>
    <p style="margin: 8px 0;"><strong>FPS:</strong> +852 9545 4447</p>
    <p style="margin: 8px 0;"><strong>Bank Transfer:</strong></p>
    <p style="margin: 4px 0; padding-left: 20px;">Bank: Bank of China</p>
    <p style="margin: 4px 0; padding-left: 20px;">Account No: 012-968-2-013423-1</p>
    <p style="margin: 4px 0; padding-left: 20px;">Beneficiary: THE INDIAN MUSLIM ASSOCIATION (JAMA-ATH) LIMITED</p>
  </div>
  
  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Payment Confirmation:</strong></p>
    <p style="margin: 8px 0 0 0;">After making the payment, kindly send the payment reference or screenshot, via WhatsApp for our records.</p>
  </div>
  
  <p style="margin-top: 30px;">May Allah reward you for your continued support of the community.</p>
  
  <p style="text-align: center; margin-top: 30px; font-style: italic; color: #666;">
    <strong>Indian Muslim Association<br>Hong Kong</strong>
  </p>
</div>`,
      };
    }

    // Generate invoice list HTML
    const invoiceListHTML = unpaidInvoices
      .map((inv) => {
        // Convert $ to HK$ in amount for display (handle both $ and HK$ formats)
        let formattedAmount = inv.amount || 'HK$0';
        // Trim whitespace first
        formattedAmount = String(formattedAmount).trim();
        // If amount contains $ but not HK$, replace all $ with HK$
        if (formattedAmount.includes('$') && !formattedAmount.includes('HK$')) {
          formattedAmount = formattedAmount.replace(/\$/g, 'HK$');
        } else if (!formattedAmount.startsWith('HK$') && !formattedAmount.startsWith('$')) {
          // If amount doesn't start with currency symbol, add HK$
          formattedAmount = `HK$${formattedAmount}`;
        }
        return `<li style="margin-bottom: 10px;">
          <strong>${inv.period}</strong>: ${formattedAmount} 
          <span style="color: #666;">(Due: ${inv.due})</span> - 
          <strong style="color: ${inv.status === 'Overdue' ? '#d32f2f' : '#f57c00'}">${inv.status}</strong>
        </li>`;
      })
      .join('');

    // Get invoice year from the latest invoice (or current year if not available)
    let invoiceYear = new Date().getFullYear().toString();
    if (unpaidInvoices.length > 0) {
      const latestInvoice = unpaidInvoices[0];
      if (latestInvoice.period) {
        const yearMatch = latestInvoice.period.match(/\d{4}/);
        if (yearMatch) {
          invoiceYear = yearMatch[0];
        }
      }
    }
    
    // Get renewal amount (typically HKD 500, or from invoice amount)
    let renewalAmount = '500';
    if (unpaidInvoices.length > 0) {
      const latestInvoice = unpaidInvoices[0];
      if (latestInvoice.amount) {
        const amountStr = String(latestInvoice.amount).replace(/HK\$|\$|,/g, '').trim();
        renewalAmount = parseFloat(amountStr) || 500;
      }
    }
    
    // Get membership category from member's subscription type
    const membershipCategory = member.subscriptionType || 'Annual Member';
    
    // Determine if member is a lifetime member
    const isLifetimeMember = membershipCategory === 'Lifetime Membership' || 
                             membershipCategory === 'Lifetime Janaza Fund Member';
    
    // Use different template based on member type
    let emailHTML;
    let emailSubject;
    
    if (isLifetimeMember) {
      // Janazah Fund Reminder template for lifetime members
      emailSubject = "Janazah Fund Reminder - Indian Muslim Association";
      emailHTML = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 0; padding: 0;">
      Indian Muslim Association – Janazah Fund Reminder (Life Member)
    </h1>
  </div>
  
  <p>Dear ${member.name || 'Member'},</p>
  
  <p>Assalamu Alaikum wa Rahmatullahi wa Barakatuh.</p>
  
  <p>This is to formally remind you of the IMA Janazah Fund contribution for the year ${invoiceYear}.</p>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Contribution Details:</h3>
    <p style="margin: 8px 0;">• Membership ID: IMA/${member.id || 'N/A'}</p>
    <p style="margin: 8px 0;">• Member Category: Life Member</p>
    <p style="margin: 8px 0;">• Contribution Amount: HKD ${renewalAmount}</p>
    <p style="margin: 8px 0;">• Year: ${invoiceYear}</p>
  </div>
  
  <p>We kindly request you to make the contribution at your earliest convenience.</p>
  
  <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Payment Details:</h3>
    <p style="margin: 8px 0;">FPS: +852 9545 4447</p>
    <p style="margin: 8px 0;">Bank Transfer:</p>
    <p style="margin: 4px 0; padding-left: 20px;">Bank: Bank of China</p>
    <p style="margin: 4px 0; padding-left: 20px;">Account No: 012-968-2-013423-1</p>
    <p style="margin: 4px 0; padding-left: 20px;">Beneficiary: THE INDIAN MUSLIM ASSOCIATION (JAMA-ATH) LIMITED</p>
  </div>
  
  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Payment Confirmation:</strong></p>
    <p style="margin: 8px 0 0 0;">After completing the payment, kindly share the payment reference or screenshot via WhatsApp for our records.</p>
  </div>
  
  <p style="margin-top: 30px;">May Allah reward you for your continued support and generosity.</p>
  
  <p style="text-align: center; margin-top: 30px; color: #666;">
    <strong>Indian Muslim Association, Hong Kong</strong>
  </p>
</div>`;
    } else {
      // Membership Renewal template for annual members
      emailSubject = "Membership Renewal Reminder - Indian Muslim Association";
      emailHTML = emailTemplate.htmlTemplate
        .replace(/\{\{member_name\}\}/g, member.name || 'Member')
        .replace(/\{\{member_id\}\}/g, member.id || 'N/A')
        .replace(/\{\{member_email\}\}/g, member.email || '')
      .replace(/\{\{total_due\}\}/g, totalDue.toFixed(2))
      .replace(/\{\{invoice_count\}\}/g, unpaidInvoices.length)
      .replace(/\{\{invoice_list\}\}/g, invoiceListHTML)
        .replace(/\{\{payment_methods\}\}/g, '')
        .replace(/\{\{portal_link\}\}/g, `${process.env.FRONTEND_URL || 'http://localhost:5173'}/member`)
        .replace(/\{\{invoice_year\}\}/g, invoiceYear)
        .replace(/\{\{renewal_amount\}\}/g, renewalAmount.toString())
        .replace(/\{\{membership_category\}\}/g, membershipCategory);
    }

    // Replace placeholders in subject (if using template subject)
    if (!isLifetimeMember) {
      emailSubject = emailTemplate.subject
      .replace(/\{\{member_name\}\}/g, member.name)
      .replace(/\{\{total_due\}\}/g, totalDue.toFixed(2))
      .replace(/\{\{invoice_count\}\}/g, unpaidInvoices.length);
    }

    // Get email settings to use the configured email address
    const emailSettings = await EmailSettingsModel.findOne({});
    const fromEmail = emailSettings?.emailUser || process.env.EMAIL_USER || 'noreply@subscriptionhk.org';
    
    // Add date to subject to make it unique and prevent threading
    const uniqueSubject = `${emailSubject} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    await transporter.sendMail({
      from: `"IMA Subscription Manager" <${fromEmail}>`,
      to: member.email,
      subject: uniqueSubject,
      html: emailHTML,
      text: isLifetimeMember 
        ? `Indian Muslim Association – Janazah Fund Reminder (Life Member)

Dear ${member.name || 'Member'},

Assalamu Alaikum wa Rahmatullahi wa Barakatuh.

This is to formally remind you of the IMA Janazah Fund contribution for the year ${invoiceYear}.

Contribution Details:
• Membership ID: IMA/${member.id || 'N/A'}
• Member Category: Life Member
• Contribution Amount: HKD ${renewalAmount}
• Year: ${invoiceYear}

We kindly request you to make the contribution at your earliest convenience.

Payment Details:
FPS: +852 9545 4447

Bank Transfer:
Bank: Bank of China
Account No: 012-968-2-013423-1
Beneficiary: THE INDIAN MUSLIM ASSOCIATION (JAMA-ATH) LIMITED

Payment Confirmation:
After completing the payment, kindly share the payment reference or screenshot via WhatsApp for our records.

May Allah reward you for your continued support and generosity.

Indian Muslim Association, Hong Kong`
        : ` Indian Muslim Association – Membership Renewal 

Dear ${member.name || 'Member'},

Assalamu Alaikum wa Rahmatullahi wa Barakatuh.

This is to formally remind you that the renewal of your Indian Muslim Association (IMA) membership for the year ${invoiceYear} is due.

Membership Details:
• Membership ID: IMA/${member.id || 'N/A'}
• Membership Category: ${membershipCategory}
• Renewal Amount: HKD ${renewalAmount}
• Year: ${invoiceYear}

We kindly request you to complete the renewal at your earliest convenience.

Payment Details:
FPS: +852 9545 4447

Bank Transfer:
Bank: Bank of China
Account No: 012-968-2-013423-1
Beneficiary: THE INDIAN MUSLIM ASSOCIATION (JAMA-ATH) LIMITED

Payment Confirmation:
After making the payment, kindly send the payment reference or screenshot, via WhatsApp for our records.

May Allah reward you for your continued support of the community.

Indian Muslim Association Hong Kong`,
      // Add unique headers to prevent email threading
      messageId: generateUniqueMessageId(),
      headers: {
        'X-Entity-Ref-ID': `${member.id}-${Date.now()}`,
        'In-Reply-To': undefined,
        'References': undefined,
        'Thread-Topic': undefined,
        'Thread-Index': undefined,
      },
    });

    console.log(`✓ Reminder email sent to ${member.email}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${member.email}:`, error);
    return false;
  }
}

export { generateUniqueMessageId };


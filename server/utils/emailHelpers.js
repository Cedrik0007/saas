import { getTransporter, setTransporter, generateUniqueMessageId, createEmailTransporter, verifyEmailTransporter } from "../config/email.js";
import { ensureConnection } from "../config/database.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import nodemailer from "nodemailer";
import { generatePaymentReceiptPDF } from "./pdfReceipt.js";

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
      subject: "Account Approved - Subscription Manager HK",
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
  <p>Welcome to Subscription Manager HK!</p>
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
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
    
    // Initialize transporter from database settings if not already set
    let transporter = getTransporter();
    if (!transporter && emailSettings && emailSettings.emailUser && emailSettings.emailPassword) {
      console.log("📧 Initializing email transporter from database settings...");
      try {
        const newTransporter = createEmailTransporter(
          emailSettings.emailUser,
          emailSettings.emailPassword,
          emailSettings.emailService || 'gmail'
        );
        
        // Verify connection
        const verified = await verifyEmailTransporter(newTransporter);
        if (verified) {
          setTransporter(newTransporter);
          transporter = newTransporter;
          console.log("✓ Email transporter initialized and verified from database settings");
        } else {
          console.error("❌ Email transporter verification failed. Email may not send correctly.");
          // Still set it, but log the warning
          setTransporter(newTransporter);
          transporter = newTransporter;
        }
      } catch (transporterError) {
        console.error("❌ Error creating email transporter from database settings:", transporterError);
        console.error("   Error details:", {
          message: transporterError.message,
          code: transporterError.code,
        });
      }
    }
    
    // Fallback to environment variables if database settings not available
    if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      console.log("📧 Initializing email transporter from environment variables...");
      try {
        const newTransporter = createEmailTransporter(
          process.env.EMAIL_USER,
          process.env.EMAIL_PASSWORD,
          process.env.EMAIL_SERVICE || 'gmail'
        );
        
        // Verify connection
        const verified = await verifyEmailTransporter(newTransporter);
        if (verified) {
          setTransporter(newTransporter);
          transporter = newTransporter;
          console.log("✓ Email transporter initialized and verified from environment variables");
        } else {
          console.error("❌ Email transporter verification failed. Email may not send correctly.");
          // Still set it, but log the warning
          setTransporter(newTransporter);
          transporter = newTransporter;
        }
      } catch (transporterError) {
        console.error("❌ Error creating email transporter from environment variables:", transporterError);
        console.error("   Error details:", {
          message: transporterError.message,
          code: transporterError.code,
        });
      }
    }
    
    if (!transporter) {
      console.error(`❌ Email not configured. Cannot send payment approval email to ${member?.email || member?.memberEmail || 'N/A'}`);
      console.error("   Please configure email settings in the admin panel or set EMAIL_USER and EMAIL_PASSWORD environment variables.");
      console.error("   For Gmail, make sure you're using an App-Specific Password, not your regular password.");
      return false;
    }

    // Generate PDF receipt
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePaymentReceiptPDF(member, invoice, payment);
      console.log(`✓ PDF receipt generated for payment ${payment?.id || payment?.invoiceId || 'N/A'}`);
    } catch (pdfError) {
      console.error(`❌ Error generating PDF receipt:`, pdfError);
      // Continue without PDF if generation fails
    }

    // Get email settings for from address
    const fromEmail = emailSettings?.emailUser || process.env.EMAIL_USER || 'noreply@subscriptionhk.org';
    const toEmail = member.email || member.memberEmail;
    
    if (!toEmail) {
      console.error(`❌ Member email not found. Cannot send payment approval email.`);
      return false;
    }
    
    console.log(`📧 Preparing to send payment confirmation email to ${toEmail}...`);

    const mailOptions = {
      from: `"Subscription Manager HK" <${fromEmail}>`,
      to: toEmail,
      subject: `Payment Confirmed - Receipt ${invoice?.id || payment?.invoiceId || 'N/A'}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Payment Confirmed
  </h2>
  <p>Dear ${member.name || member.member || 'Member'},</p>
  <p>Your payment has been confirmed and processed successfully.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Invoice ID:</strong> ${invoice?.id || payment?.invoiceId || 'N/A'}</p>
    <p><strong>Period:</strong> ${invoice?.period || payment?.period || 'N/A'}</p>
    <p><strong>Amount:</strong> <span style="color: #4caf50; font-size: 18px; font-weight: bold;">${payment?.amount || invoice?.amount || 'HK$0'}</span></p>
    <p><strong>Payment Method:</strong> ${payment?.method || invoice?.method || 'N/A'}</p>
    <p><strong>Payment Date:</strong> ${payment?.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
    <p><strong>Status:</strong> <span style="color: #4caf50; font-weight: bold;">Confirmed</span></p>
  </div>
  ${pdfBuffer ? '<p style="color: #4caf50; font-weight: bold;">📎 Your payment receipt is attached as a PDF file.</p>' : ''}
  <p>Your invoice has been marked as paid. Thank you for your payment!</p>
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
</div>`,
      attachments: pdfBuffer ? [
        {
          filename: `Payment_Receipt_${invoice?.id || payment?.invoiceId || Date.now()}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ] : []
    };

    // Verify transporter before sending (non-blocking - try to send even if verification fails)
    try {
      // Use a timeout for verification to prevent hanging on cloud platforms
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 15000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log("✓ Email transporter verified before sending");
    } catch (verifyError) {
      console.warn(`⚠️ Email transporter verification failed (will still attempt to send):`, verifyError.message);
      if (verifyError.code === 'EAUTH') {
        console.error(`   ⚠️ Authentication failed. Common causes:`);
        console.error(`      - Using regular Gmail password instead of App-Specific Password`);
        console.error(`      - 2-Step Verification not enabled`);
        console.error(`      - Incorrect email or password`);
        // Don't return false for auth errors - let the actual send attempt handle it
      } else if (verifyError.code === 'ETIMEDOUT' || verifyError.message.includes('timeout')) {
        console.warn(`   ⚠️ Verification timeout (common on cloud platforms like Render). Will attempt to send email anyway.`);
        // Don't return false - sending might still work even if verification times out
      } else {
        console.warn(`   ⚠️ Verification failed but will attempt to send email.`);
      }
      // Continue to attempt sending - verification is just a check
    }

    const emailResult = await transporter.sendMail(mailOptions);
    console.log(`✓ Payment confirmation email with PDF receipt sent successfully to ${toEmail}`);
    console.log(`   Message ID: ${emailResult.messageId}`);
    return true;
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
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error(`   ⚠️ Connection failed. Common causes:`);
      console.error(`      - Network/firewall blocking SMTP port 587`);
      console.error(`      - Server cannot reach Gmail SMTP servers`);
    } else if (error.code === 'EENVELOPE') {
      console.error(`   ⚠️ Invalid email address. Check recipient email: ${member?.email || member?.memberEmail}`);
    }
    
    return false;
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
      subject: "Payment Rejected - Subscription Manager HK",
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
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
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
        subject: "Payment Reminder - Outstanding Balance",
        htmlTemplate: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Payment Reminder - Outstanding Balance
  </h2>
  <p>Dear {{member_name}},</p>
  <p>This is a friendly reminder about your outstanding subscription payments.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Member ID:</strong> {{member_id}}</p>
    <p><strong>Email:</strong> {{member_email}}</p>
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">HK${{total_due}}</span></p>
  </div>
  <h3 style="color: #333;">Outstanding Invoices ({{invoice_count}}):</h3>
  <ul style="list-style: none; padding: 0;">
    {{invoice_list}}
  </ul>
  <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>💳 Payment Methods Available:</strong></p>
    <ul>
      {{payment_methods}}
    </ul>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{portal_link}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Access Member Portal
    </a>
  </p>
  <p>Please settle your outstanding balance at your earliest convenience.</p>
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
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

    // Get payment methods from database (if available) or use default
    const paymentMethodsHTML = `<li>FPS: Available in member portal</li>
    <li>PayMe: Available in member portal</li>
    <li>Bank Transfer: Available in member portal</li>
    <li>Credit Card: Pay instantly online</li>`;

    // Replace placeholders in template
    const portalLink = process.env.FRONTEND_URL || 'http://localhost:5173';
    let emailHTML = emailTemplate.htmlTemplate
      .replace(/\{\{member_name\}\}/g, member.name)
      .replace(/\{\{member_id\}\}/g, member.id)
      .replace(/\{\{member_email\}\}/g, member.email)
      .replace(/\{\{total_due\}\}/g, totalDue.toFixed(2))
      .replace(/\{\{invoice_count\}\}/g, unpaidInvoices.length)
      .replace(/\{\{invoice_list\}\}/g, invoiceListHTML)
      .replace(/\{\{payment_methods\}\}/g, paymentMethodsHTML)
      .replace(/\{\{portal_link\}\}/g, `${portalLink}/member`);

    // Replace placeholders in subject
    let emailSubject = emailTemplate.subject
      .replace(/\{\{member_name\}\}/g, member.name)
      .replace(/\{\{total_due\}\}/g, totalDue.toFixed(2))
      .replace(/\{\{invoice_count\}\}/g, unpaidInvoices.length);

    // Get email settings to use the configured email address
    const emailSettings = await EmailSettingsModel.findOne({});
    const fromEmail = emailSettings?.emailUser || process.env.EMAIL_USER || 'noreply@subscriptionhk.org';
    
    // Add date to subject to make it unique and prevent threading
    const uniqueSubject = `${emailSubject} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    
    await transporter.sendMail({
      from: `"Subscription Manager HK" <${fromEmail}>`,
      to: member.email,
      subject: uniqueSubject,
      html: emailHTML,
      text: `Dear ${member.name},\n\nThis is a friendly reminder about your outstanding subscription payments.\n\nMember ID: ${member.id}\nTotal Outstanding: HK$${totalDue.toFixed(2)}\n\nOutstanding Invoices (${unpaidInvoices.length}):\n${unpaidInvoices.map(inv => {
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
        return `• ${inv.period}: ${formattedAmount} (Due: ${inv.due}) - ${inv.status}`;
      }).join('\n')}\n\nPayment Methods: Available in member portal\n\nAccess Member Portal: ${portalLink}/member\n\nPlease settle your outstanding balance at your earliest convenience.\n\nBest regards,\nFinance Team\nSubscription Manager HK`,
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


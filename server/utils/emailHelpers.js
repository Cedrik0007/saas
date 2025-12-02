import { getTransporter, setTransporter, generateUniqueMessageId } from "../config/email.js";
import { ensureConnection } from "../config/database.js";
import EmailTemplateModel from "../models/EmailTemplate.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import nodemailer from "nodemailer";

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

// Function to send payment approval email
export async function sendPaymentApprovalEmail(member, payment, invoice) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`⚠️ Email not configured. Skipping payment approval email to ${member.email}`);
    return false;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: member.email || member.memberEmail,
      subject: "Payment Approved - Subscription Manager HK",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
    Payment Approved
  </h2>
  <p>Dear ${member.name || member.member || 'Member'},</p>
  <p>Your payment has been approved and processed successfully.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Invoice ID:</strong> ${invoice?.id || payment.invoiceId || 'N/A'}</p>
    <p><strong>Period:</strong> ${invoice?.period || payment.period || 'N/A'}</p>
    <p><strong>Amount:</strong> <span style="color: #4caf50; font-size: 18px; font-weight: bold;">${payment.amount || invoice?.amount || '$0'}</span></p>
    <p><strong>Payment Method:</strong> ${payment.method || 'N/A'}</p>
    <p><strong>Status:</strong> <span style="color: #4caf50; font-weight: bold;">Approved</span></p>
  </div>
  <p>Your invoice has been marked as paid. Thank you for your payment!</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${process.env.MEMBER_PORTAL_URL || 'http://localhost:5173/member'}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      View Invoice
    </a>
  </p>
  <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
</div>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Payment approval email sent to ${member.email || member.memberEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending payment approval email:`, error);
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
    <p><strong>Amount:</strong> ${payment.amount || invoice?.amount || '$0'}</p>
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
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">${{total_due}}</span></p>
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
      .map((inv) => 
        `<li style="margin-bottom: 10px;">
          <strong>${inv.period}</strong>: ${inv.amount} 
          <span style="color: #666;">(Due: ${inv.due})</span> - 
          <strong style="color: ${inv.status === 'Overdue' ? '#d32f2f' : '#f57c00'}">${inv.status}</strong>
        </li>`
      )
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
      text: `Dear ${member.name},\n\nThis is a friendly reminder about your outstanding subscription payments.\n\nMember ID: ${member.id}\nTotal Outstanding: $${totalDue.toFixed(2)}\n\nOutstanding Invoices (${unpaidInvoices.length}):\n${unpaidInvoices.map(inv => `• ${inv.period}: ${inv.amount} (Due: ${inv.due}) - ${inv.status}`).join('\n')}\n\nPayment Methods: Available in member portal\n\nAccess Member Portal: ${portalLink}/member\n\nPlease settle your outstanding balance at your earliest convenience.\n\nBest regards,\nFinance Team\nSubscription Manager HK`,
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


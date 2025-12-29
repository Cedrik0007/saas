import { ensureConnection } from "../config/database.js";
import { sendReminderEmail } from "../utils/emailHelpers.js";
import { setTransporter } from "../config/email.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import ReminderLogModel from "../models/ReminderLog.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import nodemailer from "nodemailer";

// Function to check and send automated reminders
export async function checkAndSendReminders() {
  try {
    console.log('\n🔍 ===== checkAndSendReminders STARTED =====');
    const now = new Date();
    const indiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    console.log('🔍 Server time:', now.toLocaleString());
    console.log('🔍 India time:', indiaTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    await ensureConnection();
    console.log('🔍 Database connection verified');
    
    // Get email settings from database
    const emailSettings = await EmailSettingsModel.findOne({});
    console.log('🔍 Email settings retrieved:', emailSettings ? 'Found' : 'NOT FOUND');
    
    // Check if email automation is enabled
    if (!emailSettings || !emailSettings.automationEnabled) {
      console.log('⏭️ Email automation is disabled');
      console.log('🔍 Email settings exists:', emailSettings ? 'Yes' : 'No');
      console.log('🔍 Automation enabled:', emailSettings?.automationEnabled);
      return;
    }

    // Check if email is configured
    if (!emailSettings.emailUser || !emailSettings.emailPassword) {
      console.log('⏭️ Email not configured. Skipping reminder check.');
      console.log('🔍 Email user:', emailSettings.emailUser ? 'Set' : 'NOT SET');
      console.log('🔍 Email password:', emailSettings.emailPassword ? 'Set' : 'NOT SET');
      return;
    }
    
    console.log('✅ Email configuration verified');

    // Update transporter with saved settings
    const transporter = nodemailer.createTransport({
      service: emailSettings.emailService || 'gmail',
      auth: {
        user: emailSettings.emailUser,
        pass: emailSettings.emailPassword,
      },
    });
    setTransporter(transporter);
    
    console.log('🔄 Starting automated reminder check...');
    console.log(`📧 Email configured: ${emailSettings.emailUser}`);
    
    // Get all active members
    const members = await UserModel.find({ status: 'Active' });
    console.log(`📋 Found ${members.length} active members`);
    
    if (members.length === 0) {
      console.log('⚠️ No active members found. Skipping reminder check.');
      return;
    }
    
    // Get reminder interval from settings (default: 7 days)
    const reminderInterval = emailSettings.reminderInterval || 7;
    console.log(`🔍 Reminder interval: ${reminderInterval} day(s)`);
    console.log(`📅 Reminder logic: Will send if ${reminderInterval} or more days have passed since last reminder`);
    
    let remindersSent = 0;
    let remindersFailed = 0;
    let remindersSkipped = 0;
    
    for (const member of members) {
      // Get unpaid/overdue invoices for this member
      const unpaidInvoices = await InvoiceModel.find({
        memberId: member.id,
        status: { $in: ['Unpaid', 'Overdue'] }
      });

      if (unpaidInvoices.length === 0) continue;

      // Calculate total due
      const totalDue = unpaidInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.amount.replace('$', '').replace(',', '')) || 0;
      }, 0);

      // Determine reminder type
      const hasOverdue = unpaidInvoices.some(inv => inv.status === 'Overdue');
      const reminderType = hasOverdue ? 'overdue' : 'upcoming';

      // Check if we should send reminder based on interval
      // Find the most recent reminder for this member
      const lastReminder = await ReminderLogModel.findOne({
        memberId: member.id
      }).sort({ sentAt: -1 }); // Get most recent

      let shouldSend = false;
      let daysSinceLastReminder = 0;

      if (!lastReminder) {
        // No previous reminder - send immediately
        shouldSend = true;
        console.log(`📧 No previous reminder found for ${member.email} (${member.name}) - will send`);
      } else {
        // Calculate days since last reminder
        const lastReminderDate = new Date(lastReminder.sentAt);
        const now = new Date();
        const diffTime = Math.abs(now - lastReminderDate);
        daysSinceLastReminder = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // Send if interval days have passed
        // Interval = 1: send daily (daysSinceLastReminder >= 1)
        // Interval = 2: send every 2 days (daysSinceLastReminder >= 2, means 1 day gap)
        // Interval = 3: send every 3 days (daysSinceLastReminder >= 3, means 2 days gap)
        if (daysSinceLastReminder >= reminderInterval) {
          shouldSend = true;
          console.log(`📧 Last reminder to ${member.email} (${member.name}) was ${daysSinceLastReminder} days ago (interval: ${reminderInterval}) - will send`);
        } else {
          console.log(`⏭️ Skipping ${member.email} (${member.name}) - last reminder ${daysSinceLastReminder} days ago (needs ${reminderInterval} days interval)`);
        }
      }

      if (shouldSend) {
        // Send reminder email
        const sent = await sendReminderEmail(member, unpaidInvoices, totalDue);

        if (sent) {
          // Log the reminder
          await ReminderLogModel.create({
            memberId: member.id,
            memberEmail: member.email,
            sentAt: new Date(),
            reminderType: reminderType,
            amount: `$${totalDue}`,
            invoiceCount: unpaidInvoices.length,
            status: "Delivered",
          });
          console.log(`✓ Automated reminder sent to ${member.name} (${member.email}) - $${totalDue} due`);
          remindersSent++;
        } else {
          // Log failed reminder attempt
          await ReminderLogModel.create({
            memberId: member.id,
            memberEmail: member.email,
            sentAt: new Date(),
            reminderType: reminderType,
            amount: `$${totalDue}`,
            invoiceCount: unpaidInvoices.length,
            status: "Failed",
          });
          remindersFailed++;
          console.log(`✗ Failed to send reminder to ${member.email}`);
        }
      } else {
        remindersSkipped++;
      }
    }
    
    console.log(`✅ Reminder check completed: ${remindersSent} sent, ${remindersFailed} failed, ${remindersSkipped} skipped (interval: ${reminderInterval} days)`);
  } catch (error) {
    console.error('❌ Error in automated reminder check:', error);
  }
}


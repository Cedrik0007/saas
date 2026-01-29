import cron from "node-cron";
import { checkAndSendReminders } from "../services/reminderService.js";
import { ensureConnection } from "../config/database.js";
import EmailSettingsModel from "../models/EmailSettings.js";

const isDebug = process.env.LOG_LEVEL === "debug";

// Global variable to store the cron job so it can be rescheduled
export let reminderCronJob = null;
export let invoiceCronJob = null;
export let nextYearInvoiceCronJob = null;

// Function to convert time string (HH:MM) to cron expression
export function timeToCronExpression(timeString) {
  // timeString format: "HH:MM" (24-hour format, e.g., "09:00", "14:30")
  const [hours, minutes] = timeString.split(':').map(Number);
  // Cron format: "minute hour * * *"
  return `${minutes} ${hours} * * *`;
}

// Function to schedule the reminder cron job
export async function scheduleReminderCron() {
  try {
    await ensureConnection();
    
    // Get email settings from database
    const emailSettings = await EmailSettingsModel.findOne({});
    
    // Read schedule time from database, default to 9:00 AM if not set
    const scheduleTime = emailSettings?.scheduleTime || "09:00";
    const automationEnabled = emailSettings?.automationEnabled !== false;
    
    // Stop existing cron job if it exists
    if (reminderCronJob) {
      reminderCronJob.stop();
      reminderCronJob = null;
    }
    
    // Only schedule if automation is enabled
    if (automationEnabled) {
      const cronExpression = timeToCronExpression(scheduleTime);
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      
      const isDebug = (process.env.LOG_LEVEL || "info").toLowerCase() === "debug";
      if (isDebug) {
        console.log(`🔍 Automation Status: ENABLED`);
        console.log(`🔍 Schedule Time: ${scheduleTime} (${hours}:${minutes.toString().padStart(2, '0')})`);
        console.log(`📅 Cron Expression: "${cronExpression}"`);
        console.log(`📅 Cron will run: minute=${minutes}, hour=${hours}, daily (* * *)`);
      }
      
      reminderCronJob = cron.schedule(cronExpression, async () => {
        try {
          const now = new Date();
          if (isDebug) {
            console.log(`\n🔄 ===== Running scheduled automated reminder check (scheduled for ${scheduleTime}) =====`);
            const indiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
            console.log(`⏰ Server time: ${now.toLocaleString()}`);
            console.log(`⏰ India time: ${indiaTime.toLocaleString()}`);
          }
          await checkAndSendReminders();
          if (isDebug) {
            console.log(`✅ Scheduled reminder check completed\n`);
          }
        } catch (error) {
          console.error('❌ Error in scheduled reminder check:', error);
          console.error('❌ Error stack:', error.stack);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
      });
      
      // Format time for display (convert 24-hour to 12-hour with AM/PM)
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      
      // Calculate next run time in India timezone
      const now = new Date();
      const indiaNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);
      const indiaNextRun = new Date(nextRun.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      if (indiaNextRun <= indiaNow) {
        indiaNextRun.setDate(indiaNextRun.getDate() + 1); // Tomorrow if time already passed
      }
      
      if (isDebug) {
        console.log(`✓ Automated reminders scheduled (daily at ${displayTime} / ${scheduleTime})`);
        console.log(`🔍 Cron job object:`, reminderCronJob ? 'Created successfully' : 'FAILED TO CREATE');
        console.log(`🔍 Cron job details:`);
        console.log(`   - Expression: ${cronExpression}`);
        console.log(`   - Scheduled: ${reminderCronJob ? 'Yes' : 'No'}`);
        console.log(`   - Running: ${reminderCronJob?.running ? 'Yes' : 'No'}`);
        console.log(`   - Timezone: Asia/Kolkata (India)`);
        console.log(`⏰ India time now: ${indiaNow.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log(`⏰ Next cron run (India time): ${indiaNextRun.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      }
    } else {
      if (isDebug) {
        console.log('⏭️ Automated reminders DISABLED - not scheduling cron job');
        console.log(`🔍 Automation enabled status: ${automationEnabled}`);
      }
    }
  } catch (error) {
    console.error('Error scheduling reminder cron:', error);
    // Fallback to default schedule
    const cronExpression = timeToCronExpression("09:00");
    const isDebugFallback = (process.env.LOG_LEVEL || "info").toLowerCase() === "debug";
    reminderCronJob = cron.schedule(cronExpression, () => {
      if (isDebugFallback) {
        console.log('🔄 Running scheduled automated reminder check (fallback schedule)...');
      }
      checkAndSendReminders();
    });
    if (isDebugFallback) {
      console.log('✓ Automated reminders scheduled (fallback: daily at 9:00 AM)');
    }
  }
}

// Function to schedule the invoice generation cron job
export function scheduleInvoiceGenerationCron() {
  try {
    // Stop existing cron job if it exists
    if (invoiceCronJob) {
      invoiceCronJob.stop();
      invoiceCronJob = null;
    }
    
    // Schedule to run daily at 2:00 AM (after reminder cron)
    // This ensures invoices are generated before reminders are sent
    const isDebug = (process.env.LOG_LEVEL || "info").toLowerCase() === "debug";
    invoiceCronJob = cron.schedule('0 2 * * *', async () => {
      try {
        const now = new Date();
        if (isDebug) {
          console.log(`\n🔄 ===== Running scheduled invoice generation (daily at 2:00 AM) =====`);
          console.log(`⏰ Server time: ${now.toLocaleString()}`);
        }
        const { generateSubscriptionInvoices } = await import("../services/invoiceService.js");
        await generateSubscriptionInvoices();
        if (isDebug) {
          console.log(`✅ Scheduled invoice generation completed\n`);
        }
      } catch (error) {
        console.error('❌ Error in scheduled invoice generation:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    if (isDebug) {
      console.log('✓ Invoice generation scheduled (daily at 2:00 AM)');
    }
  } catch (error) {
    console.error('Error scheduling invoice generation cron:', error);
  }
}

// Function to schedule the next year invoice creation cron job
// This runs daily and checks if today is January 1st, then creates invoices for the next year
export function scheduleNextYearInvoiceCron() {
  try {
    // Stop existing cron job if it exists
    if (nextYearInvoiceCronJob) {
      nextYearInvoiceCronJob.stop();
      nextYearInvoiceCronJob = null;
    }
    
    // Schedule to run daily at 3:00 AM (after invoice generation)
    // The function itself checks if today is January 1st
    const isDebug = (process.env.LOG_LEVEL || "info").toLowerCase() === "debug";
    nextYearInvoiceCronJob = cron.schedule('0 3 * * *', async () => {
      try {
        const now = new Date();
        if (isDebug) {
          console.log(`\n🔄 ===== Running scheduled next year invoice check (daily at 3:00 AM) =====`);
          console.log(`⏰ Server time: ${now.toLocaleString()}`);
        }
        const { checkAndCreateNextYearInvoices } = await import("../services/nextYearInvoiceService.js");
        await checkAndCreateNextYearInvoices();
        if (isDebug) {
          console.log(`✅ Scheduled next year invoice check completed\n`);
        }
      } catch (error) {
        console.error('❌ Error in scheduled next year invoice check:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    if (isDebug) {
      console.log('✓ Next year invoice creation scheduled (daily at 3:00 AM, creates on Jan 1st)');
    }
  } catch (error) {
    console.error('Error scheduling next year invoice cron:', error);
  }
}


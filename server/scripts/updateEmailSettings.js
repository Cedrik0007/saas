import dotenv from "dotenv";
import { ensureConnection } from "../config/database.js";
import EmailSettingsModel from "../models/EmailSettings.js";

dotenv.config();

async function updateEmailSettings() {
  try {
    await ensureConnection();
    
    const emailUser = "usertesting22204@gmail.com";
    const emailPassword = "xpsiawmelavgkoly"; // Remove spaces from App-Specific Password
    
    let settings = await EmailSettingsModel.findOne({});
    
    if (settings) {
      settings.emailUser = emailUser;
      settings.emailPassword = emailPassword;
      settings.emailService = "gmail";
      await settings.save();
      console.log("✓ Email settings updated successfully");
      console.log(`   Email: ${emailUser}`);
      console.log(`   Service: gmail`);
    } else {
      settings = new EmailSettingsModel({
        emailService: "gmail",
        emailUser: emailUser,
        emailPassword: emailPassword,
        scheduleTime: "09:00",
        automationEnabled: true,
        reminderInterval: 7,
      });
      await settings.save();
      console.log("✓ Email settings created successfully");
      console.log(`   Email: ${emailUser}`);
      console.log(`   Service: gmail`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating email settings:", error);
    process.exit(1);
  }
}

updateEmailSettings();


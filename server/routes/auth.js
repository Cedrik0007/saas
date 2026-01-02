import express from "express";
import { ensureConnection } from "../config/database.js";
import AdminModel from "../models/Admin.js";
import UserModel from "../models/User.js";
import { getTransporter, setTransporter, generateUniqueMessageId } from "../config/email.js";
import EmailSettingsModel from "../models/EmailSettings.js";
import PasswordResetRequestLogModel from "../models/PasswordResetRequestLog.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

const router = express.Router();

// In-memory store for reset tokens (in production, use Redis or database)
const resetTokens = new Map(); // token -> { email, role, expiresAt }

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens.entries()) {
    if (data.expiresAt < now) {
      resetTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // Every hour

// POST login
router.post("/login", async (req, res) => {
  const { email, password, role } = req.body ?? {};
  
  // Validate input
  if (!email || !password) {
    return res.status(400).json({ 
      message: "Email and password required",
      success: false 
    });
  }

  if (!role) {
    return res.status(400).json({ 
      message: "Role is required. Please select Admin or Member.",
      success: false 
    });
  }

  try {
    await ensureConnection();
    const emailLower = email.trim().toLowerCase();
    const passwordTrimmed = password.trim();
    
    // Check based on the role specified
    if (role === "admin" || role === "Admin") {
      // Check admin database only
      const admin = await AdminModel.findOne({ 
        email: emailLower 
      });

      if (!admin) {
        console.log(`Login attempt failed: Admin not found for email ${emailLower}`);
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Check if account is locked
      if (admin.lockoutUntil && admin.lockoutUntil > new Date()) {
        const minutesRemaining = Math.ceil((admin.lockoutUntil - new Date()) / (1000 * 60));
        return res.status(403).json({ 
          message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
          success: false,
          locked: true
        });
      }

      // Reset lockout if it has expired
      if (admin.lockoutUntil && admin.lockoutUntil <= new Date()) {
        admin.failedLoginAttempts = 0;
        admin.lockoutUntil = null;
      }

      // Check password (trim both for comparison)
      const adminPassword = (admin.password || "").trim();
      if (adminPassword !== passwordTrimmed) {
        console.log(`Login attempt failed: Password mismatch for admin ${emailLower}`);
        // Increment failed attempts
        admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (admin.failedLoginAttempts >= 5) {
          const lockoutDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
          admin.lockoutUntil = new Date(Date.now() + lockoutDuration);
          await admin.save();
          return res.status(403).json({ 
            message: "Account temporarily locked due to multiple failed login attempts. Please try again in 10 minutes.",
            success: false,
            locked: true
          });
        }
        
        await admin.save();
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Successful login - reset failed attempts
      admin.failedLoginAttempts = 0;
      admin.lockoutUntil = null;
      await admin.save();

      // Check if admin is active
      if (admin.status && admin.status !== 'Active') {
        return res.status(403).json({ 
          message: "Your account is not active. Please contact administrator.",
          success: false 
        });
      }

      // Successful admin login
      return res.json({
        success: true,
        role: "Admin",
        token: `admin_${admin.id}_${Date.now()}`,
        email: admin.email,
        name: admin.name,
        adminId: admin.id,
        adminRole: admin.role || 'Viewer'
      });
    } else if (role === "member" || role === "Member") {
      // Check member database only
      const escapedEmail = emailLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const member = await UserModel.findOne({ 
        email: { $regex: `^${escapedEmail}$`, $options: 'i' }
      });

      if (!member) {
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Check if account is locked
      if (member.lockoutUntil && member.lockoutUntil > new Date()) {
        const minutesRemaining = Math.ceil((member.lockoutUntil - new Date()) / (1000 * 60));
        return res.status(403).json({ 
          message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
          success: false,
          locked: true
        });
      }

      // Reset lockout if it has expired
      if (member.lockoutUntil && member.lockoutUntil <= new Date()) {
        member.failedLoginAttempts = 0;
        member.lockoutUntil = null;
      }

      // Check password - require password for member login
      if (!member.password || member.password.trim() === '') {
        return res.status(401).json({ 
          message: "Password not set for this account. Please contact administrator or sign up.",
          success: false 
        });
      }

      // Check password (trim both for comparison)
      const memberPassword = member.password.trim();
      const inputPassword = password.trim();
      
      if (memberPassword !== inputPassword) {
        // Increment failed attempts
        member.failedLoginAttempts = (member.failedLoginAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (member.failedLoginAttempts >= 5) {
          const lockoutDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
          member.lockoutUntil = new Date(Date.now() + lockoutDuration);
          await member.save();
          return res.status(403).json({ 
            message: "Account temporarily locked due to multiple failed login attempts. Please try again in 10 minutes.",
            success: false,
            locked: true
          });
        }
        
        await member.save();
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Successful login - reset failed attempts
      member.failedLoginAttempts = 0;
      member.lockoutUntil = null;
      await member.save();

      // Check if member is approved (status must be 'Active')
      if (member.status === 'Pending') {
        return res.status(403).json({ 
          message: "Your account is pending approval. Please wait for admin approval before logging in.",
          success: false 
        });
      }

      // Check if member is active (not suspended/inactive)
      if (member.status && member.status !== 'Active' && member.status !== 'Pending') {
        return res.status(403).json({ 
          message: "Your account is not active. Please contact administrator.",
          success: false 
        });
      }

      // Successful member login
      return res.json({
        success: true,
        role: "Member",
        token: `member_${member.id}_${Date.now()}`,
        email: member.email,
        name: member.name,
        memberId: member.id,
        phone: member.phone,
        status: member.status
      });
    } else {
      // No role specified or invalid role
      console.log(`Login attempt failed: Invalid role '${role}' for email ${emailLower}`);
      return res.status(400).json({ 
        message: "Invalid role specified. Please select Admin or Member.",
        success: false 
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
      role: req.body?.role
    });
    res.status(500).json({ 
      message: "Server error during login. Please try again later.",
      success: false 
    });
  }
});

// POST /api/auth/forgot-password - Request password reset (manual approval)
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body ?? {};
  
  if (!email) {
    return res.status(400).json({ 
      message: "Email is required",
      success: false 
    });
  }

  try {
    await ensureConnection();
    const emailLower = email.trim().toLowerCase();
    
    // Check if email exists in admin database only
    const admin = await AdminModel.findOne({ email: emailLower });
    
    if (!admin) {
      // Email not found in admins - return error
      return res.status(400).json({ 
        message: "This email is not registered as an admin. Please contact your administrator.",
        success: false 
      });
    }

    const userName = admin.name || "";
    const userRole = "admin";

    // Log the password reset request
    try {
      await PasswordResetRequestLogModel.create({
        userEmail: emailLower,
        userName: userName,
        userRole: userRole,
        requestedAt: new Date(),
        status: "Pending"
      });
      console.log(`✓ Password reset request logged for ${emailLower}`);
    } catch (logError) {
      console.error(`✗ Failed to log password reset request:`, logError);
      // Continue even if logging fails
    }

    // Get email settings
    const emailSettings = await EmailSettingsModel.findOne({});
    
    if (emailSettings && emailSettings.emailUser && emailSettings.emailPassword) {
      // Update transporter with saved settings
      const transporter = nodemailer.createTransport({
        service: emailSettings.emailService || 'gmail',
        auth: {
          user: emailSettings.emailUser,
          pass: emailSettings.emailPassword,
        },
      });
      setTransporter(transporter);

      // Super Admin email
      // const superAdminEmail = "0741sanjai@gmail.com";
      // Super Admin email
      const superAdminEmail = "usertesting22204@gmail.com";
      const requestDate = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Send email to Super Admin
      const mailOptions = {
        from: `"Subscription Manager HK" <${emailSettings.emailUser}>`,
        to: superAdminEmail,
        subject: `Password Reset Request - ${emailLower}`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #5a31ea; padding-bottom: 10px;">
    Password Reset Request
  </h2>
  <p>Dear Administrator,</p>
  <p>A user has requested a password reset for the Subscription Manager HK system.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>User Email:</strong> ${emailLower}</p>
    <p><strong>User Name:</strong> ${userName || 'Not available'}</p>
    <p><strong>Account Type:</strong> ${userRole ? (userRole === "admin" ? "Admin" : "Member") : "User not found"}</p>
    <p><strong>Request Date & Time:</strong> ${requestDate}</p>
  </div>
  <p style="color: #d32f2f; font-weight: bold; margin-top: 20px;">
    User has requested a password reset. Please generate a new password manually.
  </p>
  <p>After creating a new password, please share it securely with the user via email or internal communication.</p>
  <p style="margin-top: 30px;">Best regards,<br><strong>Subscription Manager HK</strong></p>
</div>`,
        text: `Password Reset Request

User Email: ${emailLower}
User Name: ${userName || 'Not available'}
Account Type: ${userRole ? (userRole === "admin" ? "Admin" : "Member") : "User not found"}
Request Date & Time: ${requestDate}

User has requested a password reset. Please generate a new password manually.

After creating a new password, please share it securely with the user via email or internal communication.`,
        messageId: generateUniqueMessageId(),
        headers: {
          'X-Entity-Ref-ID': `password-reset-request-${Date.now()}`,
        },
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ Password reset request notification sent to Super Admin for ${emailLower}`);
      } catch (emailError) {
        console.error(`✗ Failed to send password reset request notification:`, emailError);
        // Still continue and return success for security (don't reveal email sending failures)
      }
    } else {
      console.warn(`⚠️ Email not configured. Cannot send password reset request notification`);
      // Still return success for security, but log the issue
    }

    // Return success message only if email was sent
    return res.json({
      success: true,
      message: "Your request has been sent to the administrator. You will receive your new password after verification.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ 
      message: "Server error. Please try again later.",
      success: false 
    });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword, role } = req.body ?? {};
  
  if (!token || !newPassword) {
    return res.status(400).json({ 
      message: "Token and new password are required",
      success: false 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      message: "Password must be at least 6 characters long",
      success: false 
    });
  }

  try {
    // Check if token exists and is valid
    const tokenData = resetTokens.get(token);
    
    if (!tokenData) {
      return res.status(400).json({ 
        message: "Invalid or expired reset token",
        success: false 
      });
    }

    // Check if token expired
    if (tokenData.expiresAt < Date.now()) {
      resetTokens.delete(token);
      return res.status(400).json({ 
        message: "Reset token has expired. Please request a new one.",
        success: false 
      });
    }

    // Check if role matches
    if (tokenData.role !== role) {
      return res.status(400).json({ 
        message: "Invalid reset token",
        success: false 
      });
    }

    await ensureConnection();
    const emailLower = tokenData.email;

    // Update password based on role
    if (role === "admin" || role === "Admin") {
      const admin = await AdminModel.findOne({ email: emailLower });
      if (!admin) {
        return res.status(404).json({ 
          message: "Admin account not found",
          success: false 
        });
      }
      
      admin.password = newPassword.trim();
      await admin.save();
      console.log(`✓ Password reset for admin: ${emailLower}`);
    } else if (role === "member" || role === "Member") {
      const escapedEmail = emailLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const member = await UserModel.findOne({ 
        email: { $regex: `^${escapedEmail}$`, $options: 'i' }
      });
      
      if (!member) {
        return res.status(404).json({ 
          message: "Member account not found",
          success: false 
        });
      }
      
      member.password = newPassword.trim();
      await member.save();
      console.log(`✓ Password reset for member: ${emailLower}`);
    } else {
      return res.status(400).json({ 
        message: "Invalid role specified",
        success: false 
      });
    }

    // Delete used token
    resetTokens.delete(token);

    return res.json({
      success: true,
      message: "Password has been reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ 
      message: "Server error. Please try again later.",
      success: false 
    });
  }
});

// GET all password reset requests
router.get("/auth/password-reset-requests", async (req, res) => {
  try {
    await ensureConnection();
    const requests = await PasswordResetRequestLogModel.find()
      .sort({ requestedAt: -1 })
      .limit(100); // Limit to recent 100 requests
    res.json(requests);
  } catch (error) {
    console.error("Error fetching password reset requests:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update password reset request and send new password to user
router.put("/auth/password-reset-requests/:id", async (req, res) => {
  try {
    await ensureConnection();
    const { newPassword, handledBy } = req.body;
    
    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ 
        error: "New password is required and must be at least 6 characters" 
      });
    }

    const request = await PasswordResetRequestLogModel.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Password reset request not found" });
    }

    if (request.status !== "Pending") {
      return res.status(400).json({ error: "This request has already been handled" });
    }

    const emailLower = request.userEmail.toLowerCase();
    const admin = await AdminModel.findOne({ email: emailLower });
    
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    // Update the admin's password
    admin.password = newPassword.trim();
    await admin.save();

    // Get email settings
    const emailSettings = await EmailSettingsModel.findOne({});
    
    if (emailSettings && emailSettings.emailUser && emailSettings.emailPassword) {
      // Update transporter with saved settings
      const transporter = nodemailer.createTransport({
        service: emailSettings.emailService || 'gmail',
        auth: {
          user: emailSettings.emailUser,
          pass: emailSettings.emailPassword,
        },
      });
      setTransporter(transporter);

      // Send email to user with new password
      const mailOptions = {
        from: `"Subscription Manager HK" <${emailSettings.emailUser}>`,
        to: emailLower,
        subject: "Password Reset - Subscription Manager HK",
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; border-bottom: 2px solid #5a31ea; padding-bottom: 10px;">
    Password Reset Complete
  </h2>
  <p>Dear ${admin.name || 'User'},</p>
  <p>Your password reset request has been processed. Your new password is:</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #5a31ea;">
    <p style="font-size: 18px; font-weight: bold; color: #1a1a1a; margin: 0; font-family: monospace;">
      ${newPassword.trim()}
    </p>
  </div>
  <p style="color: #d32f2f; font-weight: bold; margin-top: 20px;">
    Please login with this new password and change it to something memorable after your first login.
  </p>
  <p>If you did not request this password reset, please contact support immediately.</p>
  <p style="margin-top: 30px;">Best regards,<br><strong>Subscription Manager HK</strong></p>
</div>`,
        text: `Password Reset Complete

Dear ${admin.name || 'User'},

Your password reset request has been processed. Your new password is:

${newPassword.trim()}

Please login with this new password and change it to something memorable after your first login.

Login: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/login

If you did not request this password reset, please contact support immediately.

Best regards,
Subscription Manager HK`,
        messageId: generateUniqueMessageId(),
        headers: {
          'X-Entity-Ref-ID': `password-reset-complete-${Date.now()}`,
        },
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ New password sent to ${emailLower}`);
      } catch (emailError) {
        console.error(`✗ Failed to send password email:`, emailError);
        // Still update the request status but mark email as failed
      }
    }

    // Update the password reset request
    request.status = "Approved";
    request.newPassword = newPassword.trim();
    request.handledBy = handledBy || "Super Admin";
    request.handledAt = new Date();
    await request.save();

    res.json({ 
      success: true, 
      message: "Password updated and email sent successfully" 
    });
  } catch (error) {
    console.error("Error updating password reset request:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


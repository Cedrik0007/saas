import express from "express";
import { ensureConnection } from "../config/database.js";
import AdminModel from "../models/Admin.js";
import UserModel from "../models/User.js";

const router = express.Router();

// POST login
router.post("/login", async (req, res) => {
  const { email, password, role } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    await ensureConnection();
    const emailLower = email.trim().toLowerCase();
    
    // Check based on the role specified
    if (role === "admin" || role === "Admin") {
      // Check admin database only
      const admin = await AdminModel.findOne({ 
        email: emailLower 
      });

      if (!admin) {
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

      // Check password
      if (admin.password !== password) {
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

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
        return res.status(401).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }

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
      return res.status(400).json({ 
        message: "Invalid role specified. Please select Admin or Member.",
        success: false 
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      message: "Server error during login",
      success: false 
    });
  }
});

export default router;


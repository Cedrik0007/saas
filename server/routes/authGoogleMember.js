import express from "express";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import UserModel from "../models/User.js";

dotenv.config();

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /api/login/google-member
router.post("/login/google-member", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: "Missing credential" });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const name = payload?.name || email;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email not available from Google" });
    }

    // Find existing member (Google login is ONLY for existing members)
    const member = await UserModel.findOne({ email });

    if (!member) {
      return res.status(401).json({
        success: false,
        message: "Member not found. Please sign up first or contact administrator.",
      });
    }

    // Check if member is approved (status must be 'Active')
    if (member.status === "Pending") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval. Please wait for admin approval before logging in.",
      });
    }

    // Check if member is active (not suspended/inactive)
    if (member.status && member.status !== "Active" && member.status !== "Pending") {
      return res.status(403).json({
        success: false,
        message: "Your account is not active. Please contact administrator.",
      });
    }

    const token = `member_${member.id}_${Date.now()}`;

    return res.json({
      success: true,
      role: "Member",
      token,
      email: member.email,
      name: member.name,
      memberId: member.id,
      phone: member.phone || "",
    });
  } catch (err) {
    console.error("Google member login error:", err);
    res.status(500).json({ success: false, message: "Google member login failed" });
  }
});

export default router;



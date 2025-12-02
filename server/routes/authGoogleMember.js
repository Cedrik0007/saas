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

    // Find or create member (Google login is ONLY for members)
    let member = await UserModel.findOne({ email });

    if (!member) {
      member = await UserModel.create({
        id: `HK${Math.floor(1000 + Math.random() * 9000)}`,
        name,
        email,
        status: "Active",
        balance: "$0",
        subscriptionType: "Monthly",
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



import express from "express";
import bcrypt from "bcryptjs";
import { ensureConnection } from "../config/database.js";
import AdminModel from "../models/Admin.js";

const router = express.Router();

const getAdminContextFromAuthHeader = (authorizationHeader = "") => {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/);
  if ((scheme || "").toLowerCase() !== "bearer" || !token) {
    return null;
  }

  if (!token.startsWith("admin_")) {
    return null;
  }

  const raw = token.slice("admin_".length);
  const separatorIndex = raw.lastIndexOf("_");
  if (separatorIndex === -1) {
    return null;
  }

  const adminId = raw.substring(0, separatorIndex);
  if (!adminId) {
    return null;
  }

  return { token, adminId };
};

router.post("/confirm-password", async (req, res) => {
  try {
    const { password } = req.body ?? {};
    if (!password || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const authContext = getAdminContextFromAuthHeader(req.headers.authorization || req.headers.Authorization);
    if (!authContext) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await ensureConnection();

    let admin = await AdminModel.findOne({ id: authContext.adminId });
    if (!admin) {
      admin = await AdminModel.findById(authContext.adminId).catch(() => null);
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const storedPassword = admin.password || "";
    if (typeof storedPassword !== "string" || !storedPassword.startsWith("$2")) {
      return res.status(401).json({ success: false, message: "Password verification unavailable. Please reset your password." });
    }

    const passwordMatches = await bcrypt.compare(password, storedPassword);

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error confirming admin password:", error);
    return res.status(500).json({ success: false, message: "Failed to confirm password" });
  }
});

export default router;

/**
 * Middleware: require admin auth and Owner or Finance Admin role for payment operations.
 * Rejects with 401 if no/invalid token, 403 if role is not Owner or Finance Admin.
 */

import { ensureConnection } from "../config/database.js";
import AdminModel from "../models/Admin.js";

const ALLOWED_ROLES = new Set(["Owner", "Finance Admin"]);

function getAdminContextFromAuthHeader(authorizationHeader = "") {
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
}

/**
 * Require Authorization: Bearer admin_<adminId>_<timestamp> and admin role in [Owner, Finance Admin].
 * Sets req.admin (the admin document) on success.
 * Returns 401 if no/invalid token, 403 if role not allowed.
 */
export async function requireFinanceRole(req, res, next) {
  try {
    await ensureConnection();
  } catch (err) {
    console.error("requireFinanceRole: DB connection error", err);
    return res.status(503).json({ error: "Service unavailable" });
  }

  const authContext = getAdminContextFromAuthHeader(
    req.headers.authorization || req.headers.Authorization
  );
  if (!authContext) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid admin token is required for this action.",
    });
  }

  let admin = await AdminModel.findOne({ id: authContext.adminId });
  if (!admin) {
    admin = await AdminModel.findById(authContext.adminId).catch(() => null);
  }
  if (!admin) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Admin not found.",
    });
  }

  const role = String(admin.role || "").trim();
  if (!ALLOWED_ROLES.has(role)) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Only Owner or Finance Admin can perform this action.",
    });
  }

  req.admin = admin;
  next();
}

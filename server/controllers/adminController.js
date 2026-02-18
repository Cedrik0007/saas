import bcrypt from "bcryptjs";
import { ensureConnection } from "../config/database.js";
import AdminModel from "../models/Admin.js";

const allowedRoles = ["Owner", "Finance Admin", "Viewer"];
const BCRYPT_SALT_ROUNDS = 10;

const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const toSafeAdminPayload = (adminDoc) => {
  if (!adminDoc) return null;
  const obj = typeof adminDoc.toObject === "function" ? adminDoc.toObject() : { ...adminDoc };
  delete obj.password;
  return obj;
};

const normalizeRole = (roleValue) => (allowedRoles.includes(roleValue) ? roleValue : "Viewer");

export const listAdmins = async (req, res) => {
  try {
    await ensureConnection();
    const admins = await AdminModel.find().select("-password");
    return res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const createAdmin = async (req, res) => {
  try {
    await ensureConnection();

    const rawPassword = req.body?.password;
    if (typeof rawPassword !== "string" || !rawPassword.trim()) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Generate ID if not provided.
    let adminId = req.body.id;
    if (!adminId) {
      adminId = `ADM${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const existing = await AdminModel.findOne({ id: adminId });
    if (existing) {
      return res.status(400).json({ message: "Admin ID already exists" });
    }

    const safeRole = normalizeRole(req.body.role || "Viewer");
    const passwordToStore = isBcryptHash(rawPassword)
      ? rawPassword
      : await bcrypt.hash(rawPassword, BCRYPT_SALT_ROUNDS);

    const newAdmin = new AdminModel({
      id: adminId,
      name: req.body.name || "",
      email: req.body.email || "",
      phone: req.body.phone || "",
      password: passwordToStore,
      role: safeRole,
      status: req.body.status || "Active",
    });

    const savedAdmin = await newAdmin.save();
    return res.status(201).json(toSafeAdminPayload(savedAdmin));
  } catch (error) {
    console.error("Error creating admin:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email or ID already exists" });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    await ensureConnection();

    const update = { ...req.body };
    delete update._id;
    delete update.id;

    if (update.role && !allowedRoles.includes(update.role)) {
      return res.status(400).json({ message: "Invalid role. Allowed roles are Owner, Finance Admin, Viewer." });
    }

    if (Object.prototype.hasOwnProperty.call(update, "password")) {
      const incomingPassword = update.password;
      const normalizedIncomingPassword = typeof incomingPassword === "string" ? incomingPassword.trim() : "";

      // Keep existing password when edit forms send an empty password field.
      if (!normalizedIncomingPassword) {
        delete update.password;
      } else {
        const existingAdmin = await AdminModel.findOne({ id: req.params.id });
        if (!existingAdmin) {
          return res.status(404).json({ message: "Admin not found" });
        }

        const storedPassword = String(existingAdmin.password || "");
        let passwordUnchanged = normalizedIncomingPassword === storedPassword;

        // For hashed stored passwords, compare when a plain password is provided.
        if (!passwordUnchanged && isBcryptHash(storedPassword) && !isBcryptHash(normalizedIncomingPassword)) {
          passwordUnchanged = await bcrypt.compare(normalizedIncomingPassword, storedPassword);
        }

        if (passwordUnchanged) {
          delete update.password;
        } else if (isBcryptHash(normalizedIncomingPassword)) {
          // Already hashed input: persist as-is (never hash a hash).
          update.password = normalizedIncomingPassword;
        } else {
          update.password = await bcrypt.hash(normalizedIncomingPassword, BCRYPT_SALT_ROUNDS);
        }
      }
    }

    const admin = await AdminModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { new: true, runValidators: true }
    ).select("-password");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.json(admin);
  } catch (error) {
    console.error("Error updating admin:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    await ensureConnection();
    const admin = await AdminModel.findOneAndDelete({ id: req.params.id });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting admin:", error);
    return res.status(500).json({ error: error.message });
  }
};


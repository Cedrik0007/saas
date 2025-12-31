import express from "express";
import { ensureConnection } from "../config/database.js";
import AdminModel from "../models/Admin.js";

const router = express.Router();

// GET all admins
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const admins = await AdminModel.find();
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new admin
router.post("/", async (req, res) => {
  try {
    await ensureConnection();
    // Generate ID if not provided
    let adminId = req.body.id;
    if (!adminId) {
      adminId = `ADM${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    // Check if ID already exists
    const existing = await AdminModel.findOne({ id: adminId });
    if (existing) {
      return res.status(400).json({ message: "Admin ID already exists" });
    }
    
    const allowedRoles = ["Admin", "Super Admin", "Finance", "Staff", "Viewer"];
    const requestedRole = req.body.role || "Viewer";
    const safeRole = allowedRoles.includes(requestedRole) ? requestedRole : "Viewer";

    const newAdmin = new AdminModel({
      id: adminId,
      name: req.body.name || "",
      email: req.body.email || "",
      password: req.body.password || "",
      role: safeRole,
      status: req.body.status || "Active",
    });
    
    const savedAdmin = await newAdmin.save();
    res.status(201).json(savedAdmin);
  } catch (error) {
    console.error("Error creating admin:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email or ID already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update admin
router.put("/:id", async (req, res) => {
  try {
    await ensureConnection();
    const allowedRoles = ["Admin", "Super Admin", "Finance", "Staff", "Viewer"];
    const update = { ...req.body };
    if (update.role && !allowedRoles.includes(update.role)) {
      return res.status(400).json({ message: "Invalid role. Allowed roles are Admin, Super Admin, Finance, Staff, Viewer." });
    }

    const admin = await AdminModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { new: true, runValidators: true }
    );
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    res.json(admin);
  } catch (error) {
    console.error("Error updating admin:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE admin
router.delete("/:id", async (req, res) => {
  try {
    await ensureConnection();
    const admin = await AdminModel.findOneAndDelete({ id: req.params.id });
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


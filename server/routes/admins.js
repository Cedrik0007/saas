import express from "express";
import {
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} from "../controllers/adminController.js";

const router = express.Router();

// GET all admins
router.get("/", listAdmins);

// POST create new admin
router.post("/", createAdmin);

// PUT update admin
router.put("/:id", updateAdmin);

// DELETE admin
router.delete("/:id", deleteAdmin);

export default router;


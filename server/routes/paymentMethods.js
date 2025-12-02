import express from "express";
import { ensureConnection } from "../config/database.js";
import PaymentMethodModel from "../models/PaymentMethod.js";

const router = express.Router();

// GET all payment methods
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const paymentMethods = await PaymentMethodModel.find({}).sort({ name: 1 });
    res.json(paymentMethods);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET single payment method by name
router.get("/:name", async (req, res) => {
  try {
    await ensureConnection();
    const method = await PaymentMethodModel.findOne({ name: req.params.name });
    if (!method) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    res.json(method);
  } catch (error) {
    console.error("Error fetching payment method:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create or update payment method
router.post("/", async (req, res) => {
  try {
    await ensureConnection();
    const { name, visible, qrImageUrl, details } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Payment method name is required" });
    }

    // Find existing or create new
    let method = await PaymentMethodModel.findOne({ name });
    
    if (method) {
      // Update existing
      if (visible !== undefined) method.visible = visible;
      if (qrImageUrl !== undefined) method.qrImageUrl = qrImageUrl;
      if (details !== undefined) method.details = details;
      await method.save();
      res.json(method);
    } else {
      // Create new
      const newMethod = new PaymentMethodModel({
        name,
        visible: visible !== undefined ? visible : true,
        qrImageUrl,
        details: details || [],
      });
      await newMethod.save();
      res.status(201).json(newMethod);
    }
  } catch (error) {
    console.error("Error saving payment method:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Payment method name already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update payment method
router.put("/:name", async (req, res) => {
  try {
    await ensureConnection();
    const method = await PaymentMethodModel.findOneAndUpdate(
      { name: req.params.name },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!method) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    
    res.json(method);
  } catch (error) {
    console.error("Error updating payment method:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


import express from "express";
import { ensureConnection } from "../config/database.js";
import DonationModel from "../models/Donation.js";

const router = express.Router();

// GET all donations
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const donations = await DonationModel.find().sort({ createdAt: -1 });
    res.json(donations);
  } catch (error) {
    console.error("Error fetching donations:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create donation
router.post("/", async (req, res) => {
  try {
    await ensureConnection();
    
    const donationData = {
      ...req.body,
      date: req.body.date || new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
    
    const newDonation = new DonationModel(donationData);
    await newDonation.save();
    
    res.status(201).json(newDonation);
  } catch (error) {
    console.error("Error creating donation:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE donation
router.delete("/:id", async (req, res) => {
  try {
    await ensureConnection();
    const donation = await DonationModel.findByIdAndDelete(req.params.id);
    
    if (!donation) {
      return res.status(404).json({ message: "Donation not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting donation:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


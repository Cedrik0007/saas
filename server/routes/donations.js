import express from "express";
import { ensureConnection } from "../config/database.js";
import DonationModel from "../models/Donation.js";
import UserModel from "../models/User.js";
import { emitDonationUpdate } from "../config/socket.js";

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
    
    // Emit Socket.io event for real-time update
    emitDonationUpdate('created', newDonation);
    
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
    
    // Emit Socket.io event for real-time update
    emitDonationUpdate('deleted', { id: req.params.id });
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting donation:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET generate PDF receipt and return URL for download
router.get("/:id/pdf-receipt", async (req, res) => {
  try {
    await ensureConnection();

    const donation = await DonationModel.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    // Convert Mongoose document to plain object
    const donationData = donation.toObject ? donation.toObject() : donation;

    // Get member if donation is from a member
    let member = null;
    if (donationData.isMember && donationData.memberId) {
      member = await UserModel.findOne({ id: donationData.memberId });
      if (member && member.toObject) {
        member = member.toObject();
      }
    }

    // Generate PDF receipt
    const { generateDonationReceiptPDF } = await import("../utils/pdfReceipt.js");
    const pdfBuffer = await generateDonationReceiptPDF(donationData, member);

    // Upload PDF to Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const { cloudinary } = await import("../config/cloudinary.js");
        const base64 = pdfBuffer.toString('base64');
        const dataUri = `data:application/pdf;base64,${base64}`;
        
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: "donation-receipts",
          resource_type: "raw",
          format: "pdf",
          public_id: `donation_${donationData._id || donationData.id}_${Date.now()}`,
          access_mode: "public",
          type: "upload",
          invalidate: false,
        });

        let finalPdfUrl = uploadResult.secure_url;
        if (!finalPdfUrl.endsWith('.pdf')) {
          finalPdfUrl = finalPdfUrl + '.pdf';
        }

        res.json({
          success: true,
          pdfUrl: finalPdfUrl,
          message: "PDF receipt generated and uploaded successfully"
        });
      } catch (uploadError) {
        console.error("Error uploading PDF to Cloudinary:", uploadError);
        const base64 = pdfBuffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${base64}`;
        res.json({
          success: true,
          pdfUrl: dataUrl,
          message: "PDF receipt generated (using base64 fallback)"
        });
      }
    } else {
      const base64 = pdfBuffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64}`;
      res.json({
        success: true,
        pdfUrl: dataUrl,
        message: "PDF receipt generated (using base64 fallback)"
      });
    }
  } catch (error) {
    console.error("Error generating donation PDF receipt:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET download PDF receipt directly
router.get("/:id/pdf-receipt/download", async (req, res) => {
  try {
    await ensureConnection();

    const donation = await DonationModel.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    // Convert Mongoose document to plain object if needed
    const donationData = donation.toObject ? donation.toObject() : donation;

    // Get member if donation is from a member
    let member = null;
    if (donationData.isMember && donationData.memberId) {
      member = await UserModel.findOne({ id: donationData.memberId });
      if (member && member.toObject) {
        member = member.toObject();
      }
    }

    // Generate PDF receipt
    const { generateDonationReceiptPDF } = await import("../utils/pdfReceipt.js");
    const pdfBuffer = await generateDonationReceiptPDF(donationData, member);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Donation_Receipt_${donationData._id || donationData.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer directly
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error downloading donation PDF receipt:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;


import express from "express";
import { ensureConnection } from "../config/database.js";
import DonationModel from "../models/Donation.js";
import UserModel from "../models/User.js";
import ReceiptCounterModel from "../models/ReceiptCounter.js";
import { emitDonationUpdate } from "../config/socket.js";
import { getDonationReceiptWhatsAppUrl } from "../utils/receiptLinks.js";

const router = express.Router();

// GET all donations
router.get("/", async (req, res) => {
  try {
    await ensureConnection();
    const donations = await DonationModel.find().sort({ createdAt: -1 });
    const responsePayload = await Promise.all(
      donations.map(async (donation) => {
        const donationObj = donation?.toObject ? donation.toObject() : donation;
        return {
          ...donationObj,
          receiptPdfUrl: donationObj?._id
            ? await getDonationReceiptWhatsAppUrl(donationObj)
            : null,
        };
      })
    );
    res.json(responsePayload);
  } catch (error) {
    console.error("Error fetching donations:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create donation
router.post("/", async (req, res) => {
  try {
    await ensureConnection();
    
    // Generate receipt number
    const receiptNumber = await ReceiptCounterModel.getNextReceiptNumber();
    
    const donationData = {
      ...req.body,
      date: req.body.date || new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      receipt_number: receiptNumber,
    };
    
    const newDonation = new DonationModel(donationData);
    await newDonation.save();
    
    // Emit Socket.io event for real-time update
    emitDonationUpdate('created', newDonation);
    
    const donationObj = newDonation?.toObject ? newDonation.toObject() : newDonation;
    const receiptPdfUrl = donationObj?._id
      ? await getDonationReceiptWhatsAppUrl(donationObj)
      : null;
    res.status(201).json({ ...donationObj, receiptPdfUrl });
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
router.get("/:id/ ", async (req, res) => {
  try {
    await ensureConnection();

    const donation = await DonationModel.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    // Convert Mongoose document to plain object
    const donationData = donation.toObject ? donation.toObject() : donation;

    // Get member if donation is from a member (support previous display IDs)
    let member = null;
    if (donationData.isMember && donationData.memberId) {
      member = await UserModel.findOne({
        $or: [
          { id: donationData.memberId },
          { "previousDisplayIds.id": donationData.memberId },
        ],
      });

      if (member) {
        member = member.toObject ? member.toObject() : member;
        member = { ...member, id: member?.id };
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

// GET PDF options page (view/download options)
router.get("/:id/pdf-receipt/options", async (req, res) => {
  try {
    await ensureConnection();

    const donation = await DonationModel.findById(req.params.id);
    if (!donation) {
      return res.status(404).send(`
        <html>
          <head><title>Donation Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>Donation Not Found</h2>
            <p>The requested donation could not be found.</p>
          </body>
        </html>
      `);
    }

    // Get protocol correctly (handle proxy/load balancer)
    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const host = req.get('host');
    const apiBaseUrl = `${protocol}://${host}`;
    const viewUrl = `${apiBaseUrl}/api/donations/${donation._id || donation.id}/pdf-receipt/view`;
    const downloadUrl = `${apiBaseUrl}/api/donations/${donation._id || donation.id}/pdf-receipt/download`;

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Donation Receipt - Options</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
          }
          .header {
            margin-bottom: 30px;
          }
          .header h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
          }
          .header p {
            color: #666;
            font-size: 16px;
          }
          .options {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-top: 30px;
          }
          .btn {
            display: inline-block;
            padding: 16px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s ease;
            border: 2px solid transparent;
            cursor: pointer;
          }
          .btn-view {
            background: #10b981;
            color: white;
          }
          .btn-view:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
          }
          .btn-download {
            background: #3b82f6;
            color: white;
          }
          .btn-download:hover {
            background: #2563eb;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
          }
          .btn-icon {
            margin-right: 8px;
            font-size: 18px;
          }
          .info {
            margin-top: 30px;
            padding: 15px;
            background: #f3f4f6;
            border-radius: 8px;
            font-size: 14px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Donation Receipt</h1>
            <p>Choose an option to access your receipt</p>
          </div>
          <div class="options">
            <a href="${viewUrl}" target="_blank" class="btn btn-view">
              <span class="btn-icon">👁️</span>
              View PDF
            </a>
            <a href="${downloadUrl}" class="btn btn-download" download>
              <span class="btn-icon">⬇️</span>
              Download PDF
            </a>
          </div>
          <div class="info">
            <strong>Donor:</strong> ${donation.donorName || 'N/A'}<br>
            <strong>Amount:</strong> ${donation.amount || 'N/A'}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Error generating donation PDF options page:", error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Error</h2>
          <p>An error occurred while loading the receipt options.</p>
        </body>
      </html>
    `);
  }
});

// GET view PDF receipt in browser (opens in new tab instead of downloading)
router.get("/:id/pdf-receipt/view", async (req, res) => {
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

    // Set headers for PDF view (inline instead of attachment)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Donation_Receipt_${donationData._id || donationData.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer directly
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error viewing donation PDF receipt:", error);
    res.status(500).json({ error: error.message });
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

    // Determine Content-Disposition based on mode query param
    const mode = req.query.mode || 'download'; // 'view' or 'download'
    const disposition = mode === 'view' ? 'inline' : 'attachment';
    
    // Set headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="Donation_Receipt_${donationData._id || donationData.id}.pdf"`);
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


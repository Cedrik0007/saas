import express from "express";
import { upload, cloudinary } from "../config/cloudinary.js";

const router = express.Router();

// POST upload payment screenshot to Cloudinary
router.post("/screenshot", upload.single("screenshot"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Determine folder based on upload type (QR code vs payment screenshot)
    const uploadType = req.body.uploadType || "screenshot"; // Default to screenshot
    const folder = uploadType === "qr-code" ? "qr-codes" : "payment-screenshots";

    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      // Upload to Cloudinary using v2 API - convert buffer to data URI (more reliable)
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;
      
      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: folder,
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: uploadType === "qr-code" 
          ? [{ width: 500, height: 500, crop: "limit" }] // Optimize for QR codes
          : [{ width: 1000, crop: "limit" }], // Original transformation for screenshots
      });

      res.json({
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });
    } else {
      // Memory storage fallback - convert to base64
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
      
      res.json({
        success: true,
        url: dataUrl,
        publicId: `temp_${Date.now()}`,
        warning: "Cloudinary not configured. Using base64 encoding. Please configure Cloudinary for production use."
      });
    }
  } catch (error) {
    console.error("Error uploading screenshot:", error);
    res.status(500).json({ 
      error: "Failed to upload screenshot: " + error.message,
      details: error.stack 
    });
  }
});

export default router;


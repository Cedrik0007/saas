import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Initialize multer upload middleware immediately
// Use memory storage and upload to Cloudinary manually (compatible with Cloudinary v2)
const upload = multer({ storage: multer.memoryStorage() });

export function initializeCloudinary() {
  try {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      console.log("✓ Cloudinary configured successfully");
    } else {
      console.warn("⚠️ Cloudinary credentials not found. Image upload will use memory storage.");
    }
  } catch (error) {
    console.error("Error configuring Cloudinary:", error.message);
    console.warn("⚠️ Falling back to memory storage for file uploads.");
  }
}

export { upload, cloudinary };


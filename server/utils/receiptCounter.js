import { ensureConnection } from '../config/database.js';
import ReceiptCounterModel from '../models/ReceiptCounter.js';

/**
 * Get the next sequential receipt number using atomic increment
 * This prevents race conditions when multiple payments are processed concurrently
 * @returns {Promise<string>} Receipt number (e.g., "2001", "2002", "10000", etc.)
 */
export async function getNextReceiptNumber() {
  try {
    await ensureConnection();
    
    // First, ensure the counter document exists with proper initial value
    // This handles the case where the document doesn't exist yet
    let counter = await ReceiptCounterModel.findOne();
    
    if (!counter) {
      // Create initial counter document with starting value
      // Use findOneAndUpdate with upsert to handle race condition on first creation
      counter = await ReceiptCounterModel.findOneAndUpdate(
        {},
        { $setOnInsert: { lastReceiptNumber: 2000 } },
        { new: true, upsert: true }
      );
    }
    
    // Now atomically increment and return the new value
    // This is safe for concurrent requests
    const updatedCounter = await ReceiptCounterModel.findOneAndUpdate(
      {},
      { $inc: { lastReceiptNumber: 1 } },
      { new: true }
    );
    
    if (!updatedCounter) {
      throw new Error('Failed to update receipt counter');
    }
    
    console.log(`✓ Generated receipt number: ${updatedCounter.lastReceiptNumber}`);
    return String(updatedCounter.lastReceiptNumber);
  } catch (error) {
    console.error('Error getting next receipt number:', error);
    // Fallback: use timestamp-based unique number to avoid duplicates
    const fallbackNumber = `R${Date.now()}`;
    console.log(`⚠ Using fallback receipt number: ${fallbackNumber}`);
    return fallbackNumber;
  }
}

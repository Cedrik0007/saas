import { ensureConnection } from '../config/database.js';
import ReceiptCounterModel from '../models/ReceiptCounter.js';

/**
 * Get the next sequential receipt number (incrementing by 1, no fixed digit limit)
 * @returns {Promise<string>} Receipt number (e.g., "2000", "2001", "2002", "10000", etc.)
 */
export async function getNextReceiptNumber() {
  try {
    await ensureConnection();
    
    let counter = await ReceiptCounterModel.findOne();
    
    // If no counter exists, create one starting from 2000
    if (!counter) {
      counter = await ReceiptCounterModel.create({ lastReceiptNumber: 2000 });
    }
    
    // Increment the receipt number
    counter.lastReceiptNumber += 1;
    await counter.save();
    
    // Return as string (no fixed digit limit, allows natural incrementing)
    return String(counter.lastReceiptNumber);
  } catch (error) {
    console.error('Error getting next receipt number:', error);
    // Fallback: use timestamp-based number
    return String(Date.now()).slice(-6);
  }
}



import { ensureConnection } from '../config/database.js';
import ReceiptCounterModel from '../models/ReceiptCounter.js';

/**
 * Get the next sequential receipt number (4 digits, incrementing by 1)
 * @returns {Promise<string>} 4-digit receipt number (e.g., "2000", "2001", "2002")
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
    
    // Format as 4-digit string with leading zeros
    return String(counter.lastReceiptNumber).padStart(4, '0');
  } catch (error) {
    console.error('Error getting next receipt number:', error);
    // Fallback: use timestamp-based 4-digit number
    return String(Date.now()).slice(-4).padStart(4, '0');
  }
}



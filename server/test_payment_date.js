import mongoose from 'mongoose';
import InvoiceModel from './models/Invoice.js';

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    
    // Find first unpaid invoice
    const invoice = await InvoiceModel.findOne({ status: { $ne: 'Paid' } });
    if (!invoice) {
      console.log('No unpaid invoices found');
      process.exit(0);
    }
    
    console.log('Found invoice:', invoice._id);
    console.log('Current payment_date:', invoice.payment_date);
    
    // Try to update payment_date
    const testDate = new Date('2026-02-10');
    console.log('Attempting to set payment_date to:', testDate);
    
    const updated = await InvoiceModel.findByIdAndUpdate(
      invoice._id,
      { $set: { payment_date: testDate } },
      { new: true }
    );
    
    console.log('Updated invoice payment_date:', updated.payment_date);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();

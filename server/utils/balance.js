import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";

// Helper function to calculate and update member balance from unpaid invoices
export async function calculateAndUpdateMemberBalance(memberId) {
  try {
    await ensureConnection();
    
    // Get all unpaid invoices for this member from MongoDB
    const unpaidInvoices = await InvoiceModel.find({
      memberId: memberId,
      status: { $in: ["Unpaid", "Overdue"] }
    });
    
    // Calculate total outstanding
    const outstandingTotal = unpaidInvoices.reduce((sum, inv) => {
      // Handle both "$" and "HK$" formats
      const amount = parseFloat(inv.amount.replace(/HK\$|\$/g, "").replace(",", "")) || 0;
      return sum + amount;
    }, 0);
    
    // Format balance string
    let balanceString = `HK$${outstandingTotal.toFixed(2)}`;
    if (outstandingTotal === 0) {
      balanceString = "HK$0";
    } else {
      // Check if any are overdue
      const hasOverdue = unpaidInvoices.some(inv => inv.status === "Overdue");
      balanceString += hasOverdue ? " Overdue" : " Outstanding";
    }
    
    // Update member balance in MongoDB
    await UserModel.findOneAndUpdate(
      { id: memberId },
      { $set: { balance: balanceString } },
      { new: true }
    );
    
    console.log(`✓ Updated balance for member ${memberId}: ${balanceString}`);
    return balanceString;
  } catch (error) {
    console.error(`Error updating balance for member ${memberId}:`, error);
    throw error;
  }
}


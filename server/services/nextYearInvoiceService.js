import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import UserModel from "../models/User.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { calculateFees, shouldChargeMembershipFee, shouldChargeJanazaFee, SUBSCRIPTION_TYPES } from "../utils/subscriptionTypes.js";

/**
 * Extract year from invoice period string
 * Supports formats like:
 * - "2025"
 * - "Jan 2025 Yearly Subscription + Janaza Fund"
 * - "2025 Yearly Subscription"
 * @param {string} period - Invoice period string
 * @returns {number|null} - Extracted year or null if not found
 */
function extractYearFromPeriod(period) {
  if (!period) return null;
  
  // Try to match 4-digit year
  const yearMatch = period.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0], 10);
  }
  
  return null;
}

/**
 * Check if today is January 1st of a specific year
 * @param {number} year - Year to check
 * @returns {boolean}
 */
function isJanuaryFirst(year) {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === 0 && // January (0-indexed)
    today.getDate() === 1
  );
}

/**
 * Create invoice for next year for a member
 * @param {Object} member - Member object
 * @param {number} lastPaidYear - Last paid subscription year
 * @param {string} subscriptionType - Subscription type (Lifetime or Yearly + Janaza Fund)
 * @returns {Object|null} - Created invoice or null if failed
 */
async function createNextYearInvoice(member, lastPaidYear, subscriptionType) {
  try {
    const nextYear = lastPaidYear + 1;
    
    // Check if invoice for next year already exists
    const existingInvoice = await InvoiceModel.findOne({
      memberId: member.id,
      period: { $regex: String(nextYear), $options: 'i' },
      status: { $ne: "Rejected" }
    });

    if (existingInvoice) {
      console.log(`⏭️ Skipping invoice creation: Invoice for year ${nextYear} already exists for ${member.name} (${member.id})`);
      return null;
    }

    // Calculate fees based on subscription type and whether lifetime membership is paid
    const fees = calculateFees(subscriptionType, member.lifetimeMembershipPaid || false);
    const invoiceAmount = `HK$${fees.totalFee}`;
    
    // Determine invoice period
    let invoicePeriod = String(nextYear);
    if (subscriptionType === SUBSCRIPTION_TYPES.ANNUAL_MEMBER) {
      invoicePeriod = `${nextYear} Annual Member Subscription`;
    } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER) {
      invoicePeriod = `${nextYear} Lifetime Janaza Fund Member Subscription`;
    } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP) {
      invoicePeriod = member.lifetimeMembershipPaid 
        ? `${nextYear} Lifetime Membership - Janaza Fund`
        : `${nextYear} Lifetime Membership - Full Payment`;
    } else {
      // Legacy support
      invoicePeriod = subscriptionType === 'Yearly + Janaza Fund' 
        ? `${nextYear} Yearly Subscription + Janaza Fund`
        : `${nextYear} Lifetime Subscription`;
    }

    // Calculate due date (Jan 1st of the year after next year)
    const dueDate = new Date(nextYear + 1, 0, 1);
    const dueDateFormatted = dueDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(',', '');

    // Determine invoice type
    let invoiceType = "combined";
    if (fees.membershipFee > 0 && fees.janazaFee > 0) {
      invoiceType = "combined";
    } else if (fees.membershipFee > 0) {
      invoiceType = "membership";
    } else if (fees.janazaFee > 0) {
      invoiceType = "janaza";
    }
    
    // Special case for lifetime membership first payment
    if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP && !member.lifetimeMembershipPaid) {
      invoiceType = "lifetime_membership";
    }

    // Create invoice
    const invoiceData = {
      id: `INV-${nextYear}-${Math.floor(100 + Math.random() * 900)}`,
      memberId: member.id,
      memberName: member.name,
      memberEmail: member.email,
      period: invoicePeriod,
      amount: invoiceAmount,
      membershipFee: fees.membershipFee,
      janazaFee: fees.janazaFee,
      invoiceType: invoiceType,
      status: "Unpaid",
      due: dueDateFormatted,
      method: "",
      reference: "",
    };

    const newInvoice = new InvoiceModel(invoiceData);
    await newInvoice.save();

    // Update member balance
    await calculateAndUpdateMemberBalance(member.id);

    console.log(`✓ Created invoice ${newInvoice.id} for year ${nextYear} for ${member.name} (${member.id})`);
    return newInvoice;
  } catch (error) {
    console.error(`❌ Error creating next year invoice for ${member.name} (${member.id}):`, error);
    return null;
  }
}

/**
 * Main function to check and create next year invoices
 * This function should be called on January 1st of each year
 */
export async function checkAndCreateNextYearInvoices() {
  try {
    await ensureConnection();
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0 = January
    const currentDate = today.getDate();

    console.log(`\n🔄 ===== Checking and creating next year invoices =====`);
    console.log(`⏰ Current date: ${today.toLocaleDateString()}`);
    
    // Only process if today is January 1st (any year)
    if (currentMonth !== 0 || currentDate !== 1) {
      console.log(`⏭️ Skipping next year invoice creation: Today is not January 1st (${today.toLocaleDateString()})`);
      return {
        success: true,
        message: `Not January 1st. Today is ${today.toLocaleDateString()}`,
        created: 0,
        skipped: 0,
        errors: 0
      };
    }

    console.log(`✓ Today is January 1st, ${currentYear}. Checking for members with invoices from last year...`);

    // Find all invoices (both paid and unpaid) to determine last subscription year
    // We create next year invoice regardless of payment status
    const allInvoices = await InvoiceModel.find({
      status: { $ne: "Rejected" } // Exclude only rejected invoices
    }).sort({ createdAt: -1 });

    if (allInvoices.length === 0) {
      console.log('⏭️ No invoices found. Skipping next year invoice creation.');
      return {
        success: true,
        message: 'No invoices found',
        created: 0,
        skipped: 0,
        errors: 0
      };
    }

    // Group invoices by member and find the latest subscription year for each member
    // This includes both paid and unpaid invoices
    const memberLastSubscriptionYear = new Map();
    const memberSubscriptionTypes = new Map();

    for (const invoice of allInvoices) {
      const year = extractYearFromPeriod(invoice.period);
      if (!year) continue;

      const memberId = invoice.memberId;
      const currentLastYear = memberLastSubscriptionYear.get(memberId);

      // Keep track of the latest subscription year for each member (regardless of payment status)
      if (!currentLastYear || year > currentLastYear) {
        memberLastSubscriptionYear.set(memberId, year);
        
        // Also track subscription type from the invoice period
        let subscriptionType = 'Lifetime'; // Default
        const periodLower = invoice.period.toLowerCase();
        if (periodLower.includes('annual member')) {
          subscriptionType = SUBSCRIPTION_TYPES.ANNUAL_MEMBER;
        } else if (periodLower.includes('lifetime janaza fund member')) {
          subscriptionType = SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER;
        } else if (periodLower.includes('lifetime membership')) {
          subscriptionType = SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP;
        } else if (periodLower.includes('janaza') && periodLower.includes('yearly')) {
          subscriptionType = 'Yearly + Janaza Fund'; // Legacy
        }
        memberSubscriptionTypes.set(memberId, subscriptionType);
      }
    }

    console.log(`📊 Found ${memberLastSubscriptionYear.size} members with invoices (paid or unpaid)`);

    let invoicesCreated = 0;
    let invoicesSkipped = 0;
    let errors = 0;

    // Process each member
    for (const [memberId, lastSubscriptionYear] of memberLastSubscriptionYear.entries()) {
      try {
        // Check if today is January 1st of the year after last subscription year
        // Example: If last subscription year is 2025, check if today is Jan 1, 2026
        const targetYear = lastSubscriptionYear + 1;
        const today = new Date();
        
        // Only create invoice if today is January 1st of the target year
        if (today.getFullYear() !== targetYear || today.getMonth() !== 0 || today.getDate() !== 1) {
          // This member's next invoice should be created in a different year
          continue;
        }

        // Get member details
        const member = await UserModel.findOne({ id: memberId });
        if (!member) {
          console.log(`⚠️ Member not found: ${memberId}`);
          errors++;
          continue;
        }

        // Get subscription type (prefer from member, fallback to invoice)
        const subscriptionType = member.subscriptionType || memberSubscriptionTypes.get(memberId) || 'Lifetime';

        // Create next year invoice (regardless of previous invoice payment status)
        const createdInvoice = await createNextYearInvoice(member, lastSubscriptionYear, subscriptionType);
        
        if (createdInvoice) {
          invoicesCreated++;
          console.log(`✓ Created invoice for ${member.name} - Previous year (${lastSubscriptionYear}) payment status: Not checked (invoice created regardless)`);
        } else {
          invoicesSkipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing member ${memberId}:`, error);
        errors++;
      }
    }

    console.log(`✅ Next year invoice creation completed:`);
    console.log(`   - Created: ${invoicesCreated}`);
    console.log(`   - Skipped: ${invoicesSkipped}`);
    console.log(`   - Errors: ${errors}\n`);

    return {
      success: true,
      message: `Next year invoice creation completed for ${currentYear}`,
      created: invoicesCreated,
      skipped: invoicesSkipped,
      errors: errors
    };
  } catch (error) {
    console.error('❌ Error in checkAndCreateNextYearInvoices:', error);
    return {
      success: false,
      message: error.message,
      created: 0,
      skipped: 0,
      errors: 1
    };
  }
}


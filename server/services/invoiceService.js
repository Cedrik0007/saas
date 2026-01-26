import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";
import PaymentModel from "../models/Payment.js";
import { calculateAndUpdateMemberBalance } from "../utils/balance.js";
import { calculateFees, shouldChargeMembershipFee, shouldChargeJanazaFee, SUBSCRIPTION_TYPES } from "../utils/subscriptionTypes.js";

// Helper function to create a subscription invoice
async function createSubscriptionInvoice(member, subscriptionType, customPeriod = null) {
  try {
    // Calculate fees based on subscription type and whether lifetime membership is paid
    const fees = calculateFees(subscriptionType, member.lifetimeMembershipPaid || false);
    const invoiceAmount = `HK$${fees.totalFee}`;
    
    // Determine invoice period
    let invoicePeriod = customPeriod;
    if (!invoicePeriod) {
      if (subscriptionType === SUBSCRIPTION_TYPES.ANNUAL_MEMBER) {
        invoicePeriod = 'Annual Member Subscription';
      } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER) {
        invoicePeriod = 'Lifetime Janaza Fund Member Subscription';
      } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP) {
        invoicePeriod = member.lifetimeMembershipPaid ? 'Lifetime Membership - Janaza Fund' : 'Lifetime Membership - Full Payment';
      } else {
        // Legacy support
        invoicePeriod = subscriptionType === 'Yearly + Janaza Fund' ? 'Yearly Subscription + Janaza Fund' : 'Lifetime Subscription';
      }
    }

    // Final check for existing invoice for the same member and period (prevent duplicates)
    const existingInvoice = await InvoiceModel.findOne({
      memberId: member.id,
      period: invoicePeriod,
      status: { $ne: "Rejected" }
    });

    if (existingInvoice) {
      console.log(`⏭️ Skipping invoice creation: An invoice for "${invoicePeriod}" already exists for ${member.name} (${member.id})`);
      return null;
    }

    // Calculate due date (1 year for both types)
    const dueDate = new Date();
    dueDate.setFullYear(dueDate.getFullYear() + 1);

    // Format due date
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
      id: `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      memberRef: member._id,
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

    console.log(`✓ Invoice created: ${newInvoice.id} for ${member.name} - ${invoiceAmount} due ${dueDateFormatted}`);
    return newInvoice;
  } catch (error) {
    console.error(`Error creating invoice for ${member.name}:`, error);
    throw error;
  }
}

// Function to automatically generate invoices for subscriptions based on payment dates
export async function generateSubscriptionInvoices() {
  try {
    console.log('\n🔄 ===== Starting automatic invoice generation =====');
    await ensureConnection();

    // Get all active members
    const activeMembers = await UserModel.find({ status: 'Active' });
    console.log(`📋 Found ${activeMembers.length} active members to check`);

    let invoicesCreated = 0;
    let invoicesSkipped = 0;

    for (const member of activeMembers) {
      try {
        const subscriptionType = member.subscriptionType || 'Lifetime';

        // Find the last paid payment for this member
        const lastPayment = await PaymentModel.findOne({
          memberId: member.id,
          status: 'Paid'
        }).sort({ createdAt: -1 });

        if (!lastPayment) {
          // No payment found, check if they have any unpaid invoice first
          const unpaidInvoice = await InvoiceModel.findOne({
            memberId: member.id,
            status: { $in: ["Unpaid", "Pending Verification", "Overdue"] }
          }).sort({ createdAt: -1 });

          if (unpaidInvoice) {
            // Has unpaid invoice - don't create another one
            console.log(`⏭️ Skipping ${member.name} - already has unpaid invoice (${unpaidInvoice.id})`);
            invoicesSkipped++;
            continue;
          }

          // No unpaid invoice, check if they have any invoice
          const lastInvoice = await InvoiceModel.findOne({
            memberId: member.id
          }).sort({ createdAt: -1 });

          if (!lastInvoice) {
            // No invoice exists, create initial invoice
            console.log(`📝 No invoice/payment found for ${member.name} (${member.id}), creating initial invoice...`);
            await createSubscriptionInvoice(member, subscriptionType);
            invoicesCreated++;
            continue;
          } else {
            // Has invoice but no payment - check if invoice is old enough
            const invoiceDate = new Date(lastInvoice.createdAt);
            const now = new Date();
            const timeDiff = now - invoiceDate;

            const periodMs = 365 * 24 * 60 * 60 * 1000; // Both types are yearly

            if (timeDiff >= periodMs) {
              console.log(`📝 Creating invoice for ${member.name} based on old invoice date...`);
              await createSubscriptionInvoice(member, subscriptionType);
              invoicesCreated++;
            } else {
              invoicesSkipped++;
            }
            continue;
          }
        }

        // Use payment date to calculate next invoice date
        const paymentDate = new Date(lastPayment.createdAt);
        const now = new Date();
        const timeSincePayment = now - paymentDate;

        let shouldCreate = false;
        let periodName = '';
        const periodMs = 365 * 24 * 60 * 60 * 1000; // Both types are yearly

        if (timeSincePayment >= periodMs) {
          shouldCreate = true;
          const monthYear = now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
          
          // Determine period name based on subscription type
          if (subscriptionType === SUBSCRIPTION_TYPES.ANNUAL_MEMBER) {
            periodName = `${monthYear} Annual Member Subscription`;
          } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER) {
            periodName = `${monthYear} Lifetime Janaza Fund Member Subscription`;
          } else if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP) {
            periodName = member.lifetimeMembershipPaid 
              ? `${monthYear} Lifetime Membership - Janaza Fund`
              : `${monthYear} Lifetime Membership - Full Payment`;
          } else {
            // Legacy support
            periodName = subscriptionType === 'Yearly + Janaza Fund'
              ? `${monthYear} Yearly Subscription + Janaza Fund`
              : `${monthYear} Lifetime Subscription`;
          }
        }

        // Check if there's already an unpaid invoice for current period
        if (shouldCreate) {
          const currentMonth = now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
          const existingUnpaid = await InvoiceModel.findOne({
            memberId: member.id,
            status: { $in: ['Unpaid', 'Overdue'] },
            period: { $regex: currentMonth, $options: 'i' }
          });

          if (existingUnpaid) {
            console.log(`⏭️ Skipping ${member.name} - already has unpaid invoice for current period`);
            invoicesSkipped++;
            continue;
          }

          console.log(`✅ Creating ${subscriptionType} invoice for ${member.name} (${member.id}) based on payment date`);
          await createSubscriptionInvoice(member, subscriptionType, periodName);
          invoicesCreated++;
        } else {
          const daysSincePayment = Math.floor(timeSincePayment / (24 * 60 * 60 * 1000));
          const daysNeeded = 365; // Both types are yearly
          console.log(`⏭️ Skipping ${member.name} - last payment was ${daysSincePayment} days ago (needs ${daysNeeded} days)`);
          invoicesSkipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing member ${member.name} (${member.id}):`, error);
      }
    }

    console.log(`✅ Invoice generation completed: ${invoicesCreated} created, ${invoicesSkipped} skipped`);
    return { created: invoicesCreated, skipped: invoicesSkipped };
  } catch (error) {
    console.error('❌ Error in automatic invoice generation:', error);
    throw error;
  }
}


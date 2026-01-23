/**
 * Subscription type configurations
 * Defines membership fees and Janaza fund fees for each subscription type
 */

export const SUBSCRIPTION_TYPES = {
  ANNUAL_MEMBER: "Annual Member",
  LIFETIME_JANAZA_FUND_MEMBER: "Lifetime Janaza Fund Member",
  LIFETIME_MEMBERSHIP: "Lifetime Membership",
};

/**
 * Get subscription type configuration
 * @param {string} subscriptionType - Subscription type name
 * @returns {Object} Configuration object with membershipFee, janazaFee, and description
 */
export function getSubscriptionConfig(subscriptionType) {
  switch (subscriptionType) {
    case SUBSCRIPTION_TYPES.ANNUAL_MEMBER:
      return {
        membershipFee: 250, // HK$250 per year
        janazaFee: 250, // HK$250 per year
        totalFee: 500, // HK$500 per year
        description: "Annual Member - Membership fee: HK$250/year, Janaza fund fee: HK$250/year",
        membershipRenews: true,
        janazaRenews: true,
      };
    
    case SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER:
      return {
        membershipFee: 0, // No membership fee
        janazaFee: 250, // HK$250 per year
        totalFee: 250, // HK$250 per year
        description: "Lifetime Janaza Fund Member - Membership fee: HK$0, Janaza fund fee: HK$250/year",
        membershipRenews: false,
        janazaRenews: true,
      };
    
    case SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP:
      return {
        membershipFee: 5000, // HK$5,000 one-time payment
        janazaFee: 250, // HK$250 per year
        totalFee: 5250, // HK$5,250 (first year), then HK$250/year
        description: "Lifetime Membership - Membership fee: HK$5,000 (one-time), Janaza fund fee: HK$250/year",
        membershipRenews: false,
        janazaRenews: true,
      };
    
    default:
      // Legacy "Lifetime" subscription type (backward compatibility)
      return {
        membershipFee: 0,
        janazaFee: 250,
        totalFee: 250,
        description: "Lifetime Subscription - HK$250/year",
        membershipRenews: false,
        janazaRenews: true,
      };
  }
}

/**
 * Calculate fees for a subscription type
 * @param {string} subscriptionType - Subscription type name
 * @param {boolean} lifetimeMembershipPaid - Whether lifetime membership fee has been paid
 * @returns {Object} Object with membershipFee, janazaFee, and totalFee
 */
export function calculateFees(subscriptionType, lifetimeMembershipPaid = false) {
  const config = getSubscriptionConfig(subscriptionType);
  
  // If lifetime membership is already paid, only charge Janaza fee
  if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP && lifetimeMembershipPaid) {
    return {
      membershipFee: 0,
      janazaFee: config.janazaFee,
      totalFee: config.janazaFee,
    };
  }
  
  return {
    membershipFee: config.membershipFee,
    janazaFee: config.janazaFee,
    totalFee: config.totalFee,
  };
}

/**
 * Check if membership fee should be charged for renewal
 * @param {string} subscriptionType - Subscription type name
 * @param {boolean} lifetimeMembershipPaid - Whether lifetime membership fee has been paid
 * @returns {boolean}
 */
export function shouldChargeMembershipFee(subscriptionType, lifetimeMembershipPaid = false) {
  const config = getSubscriptionConfig(subscriptionType);
  
  if (subscriptionType === SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP && lifetimeMembershipPaid) {
    return false; // Already paid lifetime membership
  }
  
  return config.membershipRenews;
}

/**
 * Check if Janaza fee should be charged for renewal
 * @param {string} subscriptionType - Subscription type name
 * @returns {boolean}
 */
export function shouldChargeJanazaFee(subscriptionType) {
  const config = getSubscriptionConfig(subscriptionType);
  return config.janazaRenews;
}


/**
 * Subscription type configurations
 * Defines membership fees and Janaza fund fees for each subscription type
 */

export const SUBSCRIPTION_TYPES = {
  // Official (locked) names
  ANNUAL_MEMBER: "Annual Member",
  LIFETIME_MEMBER_JANAZA_FUND: "Lifetime Member + Janaza Fund",

  // Legacy aliases (kept for backward compatibility in code + old data)
  LIFETIME_JANAZA_FUND_MEMBER: "Lifetime Member + Janaza Fund",
  LIFETIME_MEMBERSHIP: "Lifetime Member + Janaza Fund",
};

const OFFICIAL_TYPES = new Set([
  SUBSCRIPTION_TYPES.ANNUAL_MEMBER,
  SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND,
]);

/**
 * Normalize legacy/variant subscription type strings to the locked official values.
 * This does NOT rewrite database values; it's for calculations + display mapping.
 */
export function normalizeSubscriptionType(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return SUBSCRIPTION_TYPES.ANNUAL_MEMBER;
  }

  const asString = String(rawValue);
  if (OFFICIAL_TYPES.has(asString)) {
    return asString;
  }

  const trimmed = asString.trim();
  if (OFFICIAL_TYPES.has(trimmed)) {
    return trimmed;
  }

  const lowered = trimmed.toLowerCase();

  // Annual variants
  if (lowered.includes('annual') || lowered.includes('yearly')) {
    return SUBSCRIPTION_TYPES.ANNUAL_MEMBER;
  }

  // Any lifetime/janaza variants normalize to the single official lifetime type
  if (lowered.includes('lifetime') || lowered.includes('janaza')) {
    return SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND;
  }

  return SUBSCRIPTION_TYPES.ANNUAL_MEMBER;
}

/**
 * Get subscription type configuration
 * @param {string} subscriptionType - Subscription type name
 * @returns {Object} Configuration object with membershipFee, janazaFee, and description
 */
export function getSubscriptionConfig(subscriptionType) {
  const normalizedType = normalizeSubscriptionType(subscriptionType);

  switch (normalizedType) {
    case SUBSCRIPTION_TYPES.ANNUAL_MEMBER:
      return {
        membershipFee: 500, // HK$500 per year
        janazaFee: 0, // No janaza fund fee for Annual Members
        totalFee: 500, // HK$500 per year
        description: "Annual Member - HK$500/year",
        membershipRenews: true,
        janazaRenews: false,
      };

    case SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND:
      return {
        membershipFee: 5000, // HK$5,000 one-time payment
        janazaFee: 250, // HK$250 per year
        totalFee: 5250, // HK$5,250 (first year/upgrade), then HK$250/year
        description: "Lifetime Member + Janaza Fund - HK$5,000 (one-time) + HK$250/year",
        membershipRenews: false,
        janazaRenews: true,
      };
    
    default:
      return getSubscriptionConfig(SUBSCRIPTION_TYPES.ANNUAL_MEMBER);
  }
}

/**
 * Calculate fees for a subscription type
 * @param {string} subscriptionType - Subscription type name
 * @param {boolean} lifetimeMembershipPaid - Whether lifetime membership fee has been paid
 * @returns {Object} Object with membershipFee, janazaFee, and totalFee
 */
export function calculateFees(subscriptionType, lifetimeMembershipPaid = false) {
  const normalizedType = normalizeSubscriptionType(subscriptionType);
  const config = getSubscriptionConfig(normalizedType);

  // If lifetime membership is already paid, only charge the yearly Janaza fee
  if (normalizedType === SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND && lifetimeMembershipPaid) {
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
 * Calculate fees using the member record (supports janazaOnly without changing stored subscriptionType values).
 * @param {Object} member
 * @returns {{membershipFee:number, janazaFee:number, totalFee:number}}
 */
export function calculateFeesForMember(member) {
  const normalizedType = normalizeSubscriptionType(member?.subscriptionType);
  const config = getSubscriptionConfig(normalizedType);

  if (normalizedType === SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND) {
    const janazaOnly = !!member?.janazaOnly;
    const lifetimeMembershipPaid = !!member?.lifetimeMembershipPaid;

    if (janazaOnly || lifetimeMembershipPaid) {
      return {
        membershipFee: 0,
        janazaFee: config.janazaFee,
        totalFee: config.janazaFee,
      };
    }
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
  const normalizedType = normalizeSubscriptionType(subscriptionType);
  const config = getSubscriptionConfig(normalizedType);
  return config.membershipRenews;
}

/**
 * Check if Janaza fee should be charged for renewal
 * @param {string} subscriptionType - Subscription type name
 * @returns {boolean}
 */
export function shouldChargeJanazaFee(subscriptionType) {
  const normalizedType = normalizeSubscriptionType(subscriptionType);
  const config = getSubscriptionConfig(normalizedType);
  return config.janazaRenews;
}

/**
 * Dashboard/member list display rule:
 * Show ONLY the current yearly payable amount (never show HK$5,000).
 */
export function getYearlyPayableAmount(subscriptionType) {
  const normalizedType = normalizeSubscriptionType(subscriptionType);
  if (normalizedType === SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND) {
    return 250;
  }
  return 500;
}


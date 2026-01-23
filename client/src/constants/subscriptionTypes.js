export const SUBSCRIPTION_TYPES = Object.freeze({
  ANNUAL_MEMBER: "Annual Member",
  LIFETIME_JANAZA_FUND_MEMBER: "Lifetime Janaza Fund Member",
  LIFETIME_MEMBERSHIP: "Lifetime Membership",
});

export const SUBSCRIPTION_TYPE_LABELS = {
  [SUBSCRIPTION_TYPES.ANNUAL_MEMBER]: "Annual Member - HK$500",
  [SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER]: "Lifetime Member Janaza fund - HK$250",
  [SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP]: "Lifetime membership Janaza fund - HK$5000+HK$250",
};

export const SUBSCRIPTION_TYPE_AMOUNTS = {
  [SUBSCRIPTION_TYPES.ANNUAL_MEMBER]: 500,
  [SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER]: 250,
  [SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP]: 5250,
};

export const SUBSCRIPTION_TYPE_OPTIONS = Object.values(SUBSCRIPTION_TYPES).map((value) => ({
  value,
  label: SUBSCRIPTION_TYPE_LABELS[value] || value,
}));

const LEGACY_LABEL_MAP = {
  "Annual Member - HK$500": SUBSCRIPTION_TYPES.ANNUAL_MEMBER,
  "Annual Member - HK$500/year": SUBSCRIPTION_TYPES.ANNUAL_MEMBER,
  "Yearly + Janaza Fund": SUBSCRIPTION_TYPES.ANNUAL_MEMBER,
  "Lifetime": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER,
  "Lifetime Member Janaza fund": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER,
  "Lifetime Member Janaza fund - HK$250": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER,
  "Lifetime Janaza fund": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER,
  "Lifetime membership Janaza fund": SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP,
  "Lifetime membership Janaza fund - HK$5000+HK$250": SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP,
};

const CANONICAL_TYPES = new Set(Object.values(SUBSCRIPTION_TYPES));
const DEFAULT_SUBSCRIPTION_TYPE = SUBSCRIPTION_TYPES.ANNUAL_MEMBER;

export function normalizeSubscriptionType(rawValue) {
  if (rawValue == null) {
    return DEFAULT_SUBSCRIPTION_TYPE;
  }

  const trimmed = String(rawValue).trim();
  if (!trimmed) {
    return DEFAULT_SUBSCRIPTION_TYPE;
  }

  if (CANONICAL_TYPES.has(trimmed)) {
    return trimmed;
  }

  if (LEGACY_LABEL_MAP[trimmed]) {
    return LEGACY_LABEL_MAP[trimmed];
  }

  const lowered = trimmed.toLowerCase();
  if (lowered.includes("yearly") || lowered.includes("annual")) {
    return SUBSCRIPTION_TYPES.ANNUAL_MEMBER;
  }
  if (lowered.includes("5000") || lowered.includes("premium")) {
    return SUBSCRIPTION_TYPES.LIFETIME_MEMBERSHIP;
  }
  if (lowered.includes("lifetime")) {
    return SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND_MEMBER;
  }

  return DEFAULT_SUBSCRIPTION_TYPE;
}

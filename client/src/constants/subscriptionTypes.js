export const SUBSCRIPTION_TYPES = Object.freeze({
  ANNUAL_MEMBER: "Annual Member",
  LIFETIME_JANAZA_FUND: "Lifetime Janaza Fund",
  LIFETIME_MEMBER_JANAZA_FUND: "Lifetime Member + Janaza Fund",
});

export const SUBSCRIPTION_TYPE_LABELS = {
  [SUBSCRIPTION_TYPES.ANNUAL_MEMBER]: "Annual Member (HK$500 / year)",
  [SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND]: "Lifetime Janaza Fund (HK$250 / year)",
  [SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND]: "Lifetime Member + Janaza Fund (HK$5,250 first year, HK$250 / year)",
};

export const SUBSCRIPTION_TYPE_AMOUNTS = {
  [SUBSCRIPTION_TYPES.ANNUAL_MEMBER]: 500,
  [SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND]: 250,
  [SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND]: 5250,
};

export const SUBSCRIPTION_TYPE_OPTIONS = Object.values(SUBSCRIPTION_TYPES).map((value) => ({
  value,
  label: SUBSCRIPTION_TYPE_LABELS[value] || value,
}));

export const SUBSCRIPTION_TYPE_DISPLAY_PARTS = Object.freeze({
  [SUBSCRIPTION_TYPES.ANNUAL_MEMBER]: {
    name: "Annual Member",
    amountText: " (HK$500 / year)",
  },
  [SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND]: {
    name: "Lifetime Janaza Fund",
    amountText: " (HK$250 / year)",
  },
  [SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND]: {
    name: "Lifetime Member + Janaza Fund",
    amountText: " (HK$5,250 first year, HK$250 / year)",
  },
});

export function getSubscriptionTypeDisplayParts(subscriptionType) {
  const normalized = normalizeSubscriptionType(subscriptionType);
  return (
    SUBSCRIPTION_TYPE_DISPLAY_PARTS[normalized]
    || {
      name: String(subscriptionType ?? ""),
      amountText: "",
    }
  );
}

const LEGACY_LABEL_MAP = {
  "Annual Member - HK$500": SUBSCRIPTION_TYPES.ANNUAL_MEMBER,
  "Annual Member - HK$500/year": SUBSCRIPTION_TYPES.ANNUAL_MEMBER,
  "Yearly + Janaza Fund": SUBSCRIPTION_TYPES.ANNUAL_MEMBER,
  "Lifetime": SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND,
  "Lifetime Janaza fund": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND,
  "Lifetime Janaza Fund": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND,
  "Lifetime Janaza Fund Member": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND,
  "Lifetime Member Janaza fund": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND,
  "Lifetime Member Janaza fund - HK$250": SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND,
  "Lifetime Member + Janaza Fund": SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND,
  "Lifetime Membership": SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND,
  "Lifetime membership Janaza fund": SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND,
  "Lifetime membership Janaza fund - HK$5000+HK$250": SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND,
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
  if (lowered.includes("janaza") && lowered.includes("lifetime")) {
    return SUBSCRIPTION_TYPES.LIFETIME_JANAZA_FUND;
  }
  if (lowered.includes("lifetime")) {
    return SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND;
  }

  return DEFAULT_SUBSCRIPTION_TYPE;
}

/**
 * Universal number formatting utility
 * Supports locale selection for worldwide users
 */

/**
 * Get the user's preferred locale from localStorage
 * Defaults to browser locale or 'en-US' if not set
 */
export function getUserLocale() {
  try {
    const saved = localStorage.getItem("userLocale");
    if (saved) {
      return saved;
    }
    // Try to detect browser locale
    const browserLocale = navigator.language || navigator.userLanguage;
    if (browserLocale) {
      return browserLocale;
    }
  } catch (error) {
    console.error("Error getting user locale:", error);
  }
  return "en-US"; // Fallback to en-US
}

/**
 * Format a number according to user's locale preference
 * @param {number} value - The number to format
 * @param {object} options - Intl.NumberFormat options
 * @returns {string} Formatted number string
 */
export function formatNumber(value, options = {}) {
  try {
    const locale = getUserLocale();
    const defaultOptions = {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options,
    };
    return new Intl.NumberFormat(locale, defaultOptions).format(value);
  } catch (error) {
    console.error("Error formatting number:", error);
    // Fallback to simple string conversion
    return String(value || 0);
  }
}

/**
 * Format a currency amount according to user's locale preference
 * @param {number} value - The amount to format
 * @param {string} currency - Currency code (default: 'USD')
 * @param {object} options - Additional Intl.NumberFormat options
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, currency = "USD", options = {}) {
  try {
    const locale = getUserLocale();
    const defaultOptions = {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    };
    return new Intl.NumberFormat(locale, defaultOptions).format(value);
  } catch (error) {
    console.error("Error formatting currency:", error);
    // Fallback formatting
    const formatted = parseFloat(value || 0).toFixed(2);
    return `$${formatted}`;
  }
}

/**
 * Set the user's preferred locale
 * @param {string} locale - Locale code (e.g., 'en-US', 'en-IN', 'fr-FR')
 */
export function setUserLocale(locale) {
  try {
    localStorage.setItem("userLocale", locale);
    // Dispatch custom event to notify components of locale change
    window.dispatchEvent(new CustomEvent("localeChanged", { detail: { locale } }));
  } catch (error) {
    console.error("Error setting user locale:", error);
  }
}

/**
 * Get list of common locales with their display names
 * @returns {Array} Array of {value, label} objects
 */
export function getAvailableLocales() {
  return [
    { value: "en-US", label: "English (United States)" },
    { value: "en-IN", label: "English (India)" },
    { value: "en-GB", label: "English (United Kingdom)" },
    { value: "en-AU", label: "English (Australia)" },
    { value: "en-CA", label: "English (Canada)" },
    { value: "fr-FR", label: "French (France)" },
    { value: "de-DE", label: "German (Germany)" },
    { value: "es-ES", label: "Spanish (Spain)" },
    { value: "es-MX", label: "Spanish (Mexico)" },
    { value: "it-IT", label: "Italian (Italy)" },
    { value: "pt-BR", label: "Portuguese (Brazil)" },
    { value: "pt-PT", label: "Portuguese (Portugal)" },
    { value: "nl-NL", label: "Dutch (Netherlands)" },
    { value: "ru-RU", label: "Russian (Russia)" },
    { value: "ja-JP", label: "Japanese (Japan)" },
    { value: "ko-KR", label: "Korean (Korea)" },
    { value: "zh-CN", label: "Chinese (Simplified)" },
    { value: "zh-TW", label: "Chinese (Traditional)" },
    { value: "ar-SA", label: "Arabic (Saudi Arabia)" },
    { value: "hi-IN", label: "Hindi (India)" },
  ];
}





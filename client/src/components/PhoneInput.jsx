import { useState, useRef, useEffect } from "react";
import "./PhoneInput.css";

// Country data with dial codes
const countries = [
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰", minLength: 8, maxLength: 8 },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳", minLength: 11, maxLength: 11 },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸", minLength: 10, maxLength: 10 },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧", minLength: 10, maxLength: 10 },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳", minLength: 10, maxLength: 10 },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬", minLength: 8, maxLength: 8 },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾", minLength: 9, maxLength: 10 },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭", minLength: 9, maxLength: 9 },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭", minLength: 10, maxLength: 10 },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩", minLength: 9, maxLength: 12 },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺", minLength: 9, maxLength: 9 },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿", minLength: 8, maxLength: 10 },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵", minLength: 10, maxLength: 11 },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷", minLength: 9, maxLength: 11 },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼", minLength: 9, maxLength: 9 },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳", minLength: 9, maxLength: 10 },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦", minLength: 10, maxLength: 10 },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪", minLength: 10, maxLength: 11 },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷", minLength: 9, maxLength: 9 },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹", minLength: 9, maxLength: 10 },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸", minLength: 9, maxLength: 9 },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱", minLength: 9, maxLength: 9 },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪", minLength: 9, maxLength: 9 },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭", minLength: 9, maxLength: 9 },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹", minLength: 10, maxLength: 13 },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪", minLength: 9, maxLength: 9 },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴", minLength: 8, maxLength: 8 },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰", minLength: 8, maxLength: 8 },
  { code: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮", minLength: 9, maxLength: 10 },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱", minLength: 9, maxLength: 9 },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷", minLength: 10, maxLength: 11 },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽", minLength: 10, maxLength: 10 },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷", minLength: 10, maxLength: 10 },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦", minLength: 9, maxLength: 9 },
  { code: "AE", name: "UAE", dialCode: "+971", flag: "🇦🇪", minLength: 9, maxLength: 9 },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦", minLength: 9, maxLength: 9 },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱", minLength: 9, maxLength: 9 },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷", minLength: 10, maxLength: 10 },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺", minLength: 10, maxLength: 10 },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬", minLength: 10, maxLength: 10 },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬", minLength: 10, maxLength: 10 },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪", minLength: 9, maxLength: 9 },
];

// Parse existing phone number to extract country and number
const parsePhoneNumber = (phone) => {
  if (!phone) return { country: countries[0], number: "" };
  
  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, "");
  
  // Try to match dial code
  for (const country of countries) {
    if (cleaned.startsWith(country.dialCode)) {
      const number = cleaned.substring(country.dialCode.length);
      return { country, number };
    }
  }
  
  // Default to first country if no match
  return { country: countries[0], number: cleaned.replace(/[^\d]/g, "") };
};

const PhoneInput = ({
  value = "",
  onChange,
  onBlur,
  required = false,
  placeholder = "Enter phone number",
  className = "",
  style = {},
  error = null,
  label = null,
  id = null,
  "aria-invalid": ariaInvalid = false,
  onError = null, // Callback for Notie errors
}) => {
  const parsed = parsePhoneNumber(value);
  const [selectedCountry, setSelectedCountry] = useState(parsed.country);
  const [phoneNumber, setPhoneNumber] = useState(parsed.number);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Update when external value changes
  useEffect(() => {
    const parsed = parsePhoneNumber(value);
    setSelectedCountry(parsed.country);
    setPhoneNumber(parsed.number);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter countries based on search - search by name, dial code, or country code
  const filteredCountries = countries.filter(
    (country) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      
      // Search by name
      if (country.name.toLowerCase().includes(query)) return true;
      
      // Search by dial code
      if (country.dialCode.includes(searchQuery)) return true;
      
      // Search by country code
      if (country.code.toLowerCase().includes(query)) return true;
      
      return false;
    }
  );

  // Handle country selection
  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery("");
    
    // Format the full phone number
    const fullNumber = phoneNumber ? `${country.dialCode}${phoneNumber}` : "";
    onChange?.({ target: { value: fullNumber } });
    
    // Focus back on input
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Handle phone number input
  const handleNumberChange = (e) => {
    const input = e.target.value;
    // Only allow digits - no length limit
    const digitsOnly = input.replace(/\D/g, "");
    
    setPhoneNumber(digitsOnly);
    
    // Format the full phone number
    const fullNumber = digitsOnly ? `${selectedCountry.dialCode}${digitsOnly}` : "";
    onChange?.({ target: { value: fullNumber } });
  };

  // Validate phone number - count only numeric digits, ignore formatting
  // validateRequired: if false, skip required validation (for blur events)
  const validateNumber = (validateRequired = true) => {
    if (!phoneNumber) {
      return (validateRequired && required) ? "Phone number is required" : null;
    }
    
    // Extract only numeric digits from the phone number (ignore any formatting)
    const numericDigits = phoneNumber.replace(/\D/g, "");
    const length = numericDigits.length;
    
    // Only check minimum length, no maximum limit
    if (length < selectedCountry.minLength) {
      return `Phone number must be at least ${selectedCountry.minLength} digits for ${selectedCountry.name}`;
    }
    
    return null;
  };

  const validationError = validateNumber(true); // Always validate required for display state
  const hasError = validationError || (className && className.includes("admin-phone-input-error"));

  // Trigger Notie error via callback when validation fails on blur
  // Only validate format/length on blur, not required (required validation only on submit)
  const handleBlur = (e) => {
    // Only validate format/length, skip required validation on blur
    const error = validateNumber(false);
    if (error && onError) {
      onError(error);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div className="phone-input-container">
      {label && (
        <div className="phone-input-label-wrapper">
          {typeof label === "string" ? (
            <span className="phone-input-label-text">
              {label}
            </span>
          ) : (
            label
          )}
        </div>
      )}
      
      <div className="phone-input-wrapper">
        {/* Country Selector */}
        <div className="phone-input-country-selector" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`phone-input-country-button ${hasError ? "phone-input-country-button-error" : ""}`}
          >
            <span className={`fi fi-${selectedCountry.code.toLowerCase()} phone-input-country-flag`}></span>
            <span className="phone-input-country-code">
              {selectedCountry.dialCode}
            </span>
            <i className={`fas fa-chevron-down phone-input-country-chevron ${isDropdownOpen ? "phone-input-country-chevron-open" : ""}`}></i>
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="phone-input-country-dropdown">
              {/* Search Input */}
              <div className="phone-input-country-search">
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="phone-input-country-search-input"
                  autoFocus
                />
              </div>

              {/* Country List */}
              <div className="phone-input-country-list">
                {filteredCountries.length === 0 ? (
                  <div className="phone-input-country-empty">
                    No countries found
                  </div>
                ) : (
                  filteredCountries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className={`phone-input-country-item ${selectedCountry.code === country.code ? "phone-input-country-item-selected" : ""}`}
                    >
                      <span className={`fi fi-${country.code.toLowerCase()} phone-input-country-item-flag`}></span>
                      <span className="phone-input-country-item-name">{country.name}</span>
                      <span className="phone-input-country-item-code">
                        {country.dialCode}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Phone Number Input */}
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="numeric"
          required={required}
          value={phoneNumber}
          onChange={handleNumberChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`phone-input-field ${className || ""} ${hasError ? "phone-input-field-error" : ""}`}
          aria-invalid={ariaInvalid || !!validationError}
          onInvalid={(e) => e.preventDefault()}
        />
      </div>

    </div>
  );
};

export default PhoneInput;

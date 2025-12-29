import { useState, useRef, useEffect } from "react";

// Country data with flag emojis and dial codes
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

  // Filter countries based on search
  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery) ||
      country.code.toLowerCase().includes(searchQuery.toLowerCase())
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
  const validateNumber = () => {
    if (!phoneNumber) {
      return required ? "Phone number is required" : null;
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

  const validationError = validateNumber();
  
  // Trigger Notie error via callback when validation fails on blur
  const handleBlur = (e) => {
    const error = validateNumber();
    if (error && onError) {
      onError(error);
    }
    // Update border color based on validation
    if (!error) {
      e.target.style.borderColor = "#ddd";
    } else {
      e.target.style.borderColor = "#ef4444";
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <div style={{ marginBottom: "8px" }}>
          {typeof label === "string" ? (
            <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#333" }}>
              {label}
            </span>
          ) : (
            label
          )}
        </div>
      )}
      
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
        }}
      >
        {/* Country Selector */}
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 12px",
              border: `1px solid ${validationError || (style?.border && style.border.includes("#ef4444")) ? "#ef4444" : "#ddd"}`,
              borderRight: "none",
              borderTopLeftRadius: "8px",
              borderBottomLeftRadius: "8px",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontSize: "1rem",
              transition: "border-color 0.2s",
              minWidth: "120px",
            }}
            onFocus={(e) => {
              if (!validationError) e.target.style.borderColor = "#5a31ea";
            }}
            onBlur={(e) => {
              if (!validationError) e.target.style.borderColor = "#ddd";
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>{selectedCountry.flag}</span>
            <span style={{ fontSize: "0.875rem", color: "#333" }}>
              {selectedCountry.dialCode}
            </span>
            <i
              className="fas fa-chevron-down"
              style={{
                fontSize: "0.75rem",
                color: "#666",
                marginLeft: "auto",
                transition: "transform 0.2s",
                transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                zIndex: 1000,
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                marginTop: "4px",
                minWidth: "280px",
                maxHeight: "300px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Search Input */}
              <div style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                <input
                  type="text"
                  placeholder="Search country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                  }}
                  autoFocus
                />
              </div>

              {/* Country List */}
              <div
                style={{
                  maxHeight: "240px",
                  overflowY: "auto",
                }}
              >
                {filteredCountries.length === 0 ? (
                  <div
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "#666",
                      fontSize: "0.875rem",
                    }}
                  >
                    No countries found
                  </div>
                ) : (
                  filteredCountries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px",
                        border: "none",
                        backgroundColor:
                          selectedCountry.code === country.code ? "#f3f4f6" : "transparent",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        textAlign: "left",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCountry.code !== country.code) {
                          e.target.style.backgroundColor = "#f9fafb";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCountry.code !== country.code) {
                          e.target.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <span style={{ fontSize: "1.2rem" }}>{country.flag}</span>
                      <span style={{ flex: 1, color: "#333" }}>{country.name}</span>
                      <span style={{ color: "#666", fontSize: "0.875rem" }}>
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
          className={className}
          aria-invalid={ariaInvalid || !!validationError}
          style={{
            flex: 1,
            padding: "12px 16px",
            border: style?.border || `1px solid ${validationError ? "#ef4444" : "#ddd"}`,
            borderTopRightRadius: "8px",
            borderBottomRightRadius: "8px",
            borderLeft: "none",
            fontSize: "1rem",
            transition: "border-color 0.2s",
            ...(style?.border ? { border: style.border } : {}),
          }}
          onFocus={(e) => {
            if (!validationError) e.target.style.borderColor = "#5a31ea";
          }}
          onInvalid={(e) => e.preventDefault()}
        />
      </div>

    </div>
  );
};

export default PhoneInput;


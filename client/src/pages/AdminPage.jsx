  import { useState, useEffect, useRef, useMemo } from "react";
  import { useNavigate, useSearchParams } from "react-router-dom";
  import { SiteHeader } from "../components/SiteHeader.jsx";
  import { SiteFooter } from "../components/SiteFooter.jsx";
  import { Table } from "../components/Table.jsx";
  import { Pagination } from "../components/Pagination.jsx";
  import { Notie } from "../components/Notie.jsx";
  import { Tooltip } from "../components/Tooltip.jsx";
  import PhoneInput from "../components/PhoneInput.jsx";
  import { useApp } from "../context/AppContext.jsx";
  import jsPDF from "jspdf";
  import { statusClass } from "../statusClasses";
  import { formatNumber, formatCurrency, getAvailableLocales } from "../utils/numberFormat.js";


  function AdminPage() {
    const {
      members,
      admins,
      invoices,
      payments,
      recentPayments,
      paymentHistory,
      communicationLog,
      paymentMethods,
      metrics,
      reminderRules,
      automationEnabled,
      setAutomationEnabled,
      reminderTemplates,
      organizationInfo,
      fetchAdmins,
      fetchInvoices,
      fetchPayments,
      fetchMembers,
      selectedMember,
      setSelectedMember,
      addMember,
      updateMember,
      deleteMember,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      addCommunication,
      updatePaymentMethod,
      updateReminderRule,
      updateReminderTemplate,
      updateOrganizationInfo,
      userLocale,
      updateUserLocale,
      addAdminUser,
      updateAdminUser,
      deleteAdminUser,
      resetAllData,
      addPayment,
      reminderLogs,
      fetchReminderLogs,
      passwordResetRequests,
      fetchPasswordResetRequests,
      donations,
      fetchDonations,
      addDonation,
      deleteDonation,
      loading,
    } = useApp();


    // Get current admin role from sessionStorage and normalize legacy values
    const rawAdminRole = sessionStorage.getItem('adminRole') || 'Viewer';
    let currentAdminRole = rawAdminRole;
    // Normalize legacy role names
    if (rawAdminRole === "Super Admin") {
      currentAdminRole = "Owner";
    } else if (rawAdminRole === "Admin") {
      currentAdminRole = "Finance Admin";
    } else if (rawAdminRole === "Finance" || rawAdminRole === "Staff") {
      // Map old Finance/Staff roles to Finance Admin
      currentAdminRole = "Finance Admin";
    }
    const isAdmin = currentAdminRole === "Owner" || currentAdminRole === "Finance Admin";
    const isOwner = currentAdminRole === "Owner";
    const isViewer = currentAdminRole === "Viewer";
    const isFinanceRole = currentAdminRole === "Owner" || currentAdminRole === "Finance Admin";
    const isAdminOrOwner = isAdmin || isOwner;

    // Portal labelling based on role
    const portalTitleByRole = {
      Owner: "Owner Portal",
      "Finance Admin": "Finance Admin Portal",
      Viewer: "Viewer Portal",
    };
    const portalSubtitleByRole = {
      Owner: "Full system administration access",
      "Finance Admin": "Finance operations and reporting",
      Viewer: "Read-only access to view data",
    };
    const currentPortalTitle = portalTitleByRole[currentAdminRole] || "Admin Portal";
    const currentPortalSubtitle = portalSubtitleByRole[currentAdminRole] || "Administration";

    // Grouped navigation structure
    const navigationGroups = [
      {
        id: "members-group",
        label: "Members",
        icon: "fa-users",
        items: [
          { id: "members", label: "Members List", roles: ["Owner", "Finance Admin", "Viewer"] },
          { id: "member-detail", label: "Member Details", roles: ["Owner", "Finance Admin", "Viewer"] },
          { id: "invoice-builder", label: "Subscriptions", roles: ["Owner", "Finance Admin"] },
        ]
      },
      {
        id: "finance",
        label: "Finance",
        icon: "fa-dollar-sign",
        items: [
          { id: "invoices", label: "Invoices", roles: ["Owner", "Finance Admin"] },
          { id: "payments", label: "Payments", roles: ["Owner", "Finance Admin"] },
          { id: "donations", label: "Donations", roles: ["Owner", "Finance Admin"] },
        ]
      },
      {
        id: "communication",
        label: "Communication",
        icon: "fa-comments",
        items: [
          { id: "automation", label: "Reminders", roles: ["Owner", "Finance Admin"] },
          { id: "communications", label: "Reminder Logs", roles: ["Owner", "Finance Admin", "Viewer"] },
        ]
      },
      {
        id: "reports-group",
        label: "Reports",
        icon: "fa-chart-bar",
        items: [
          { id: "reports", label: "Financial Reports", roles: ["Owner", "Finance Admin", "Viewer"] },
          { id: "export-reports", label: "Export Reports", roles: ["Owner", "Finance Admin"] },
        ]
      },
      {
        id: "settings",
        label: "Settings",
        icon: "fa-cog",
        items: [
          { id: "users", label: "Users", roles: ["Owner", "Finance Admin"] },
          { id: "roles", label: "Roles", roles: ["Owner"] },
          { id: "org-settings", label: "Organization Settings", roles: ["Owner", "Finance Admin"] },
        ]
      },
    ];

    // Flatten sections for URL routing compatibility
    const sections = [
      { id: "dashboard", label: "Dashboard" },
      ...navigationGroups.flatMap(group => group.items),
    ];

    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize activeSection from URL or default to dashboard
    const [activeSection, setActiveSection] = useState(() => {
      const sectionFromUrl = searchParams.get('section');
      const isValidSection = sectionFromUrl && sections.find(s => s.id === sectionFromUrl);
      return isValidSection ? sectionFromUrl : sections[0].id;
    });
    const [activeTab, setActiveTab] = useState("Invoices");
    // Track which navigation groups are expanded (default all collapsed on login)
    const [expandedGroups, setExpandedGroups] = useState(() => {
      const expanded = {};
      navigationGroups.forEach(group => {
        expanded[group.id] = false; // Default all groups collapsed
      });
      return expanded;
    });
    const [showMemberForm, setShowMemberForm] = useState(false);
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [notieMessage, setNotieMessage] = useState(null);
    const [notieType, setNotieType] = useState("success");
    const [lastCreatedInvoice, setLastCreatedInvoice] = useState(null);
    const [showInvoiceSuccessCard, setShowInvoiceSuccessCard] = useState(false);

    // Import preview state
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [importPreviewData, setImportPreviewData] = useState([]);
    const [importFileName, setImportFileName] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [importErrors, setImportErrors] = useState([]);

    // Confirmation dialog state
    const [confirmationDialog, setConfirmationDialog] = useState({
      isOpen: false,
      message: "",
      onConfirm: null,
      onCancel: null,
      confirmButtonText: "Confirm", // Default button text
    });

    // Form states
    // Get today's date in YYYY-MM-DD format for date input
    const getTodayDate = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const [memberForm, setMemberForm] = useState({
      name: "",
      email: "",
      phone: "",
      native: "",
      status: "Active",
      balance: "250", // default for Lifetime (numeric string)
      nextDue: getTodayDate(), // Default to today's date
      subscriptionYear: new Date().getFullYear().toString(),
      lastPayment: "",
      subscriptionType: "Lifetime",
    });

    // Member validation state for red borders - progressive validation
    const [memberFieldErrors, setMemberFieldErrors] = useState({
      name: false,
      email: false,
      phone: false,
      nextDue: false,
      lastPayment: false,
    });
    const [currentInvalidField, setCurrentInvalidField] = useState(null); // Track which field to highlight

    const [isMemberSubmitting, setIsMemberSubmitting] = useState(false);
    const [isDonationSubmitting, setIsDonationSubmitting] = useState(false);

    const validateMemberField = (field, value, options = {}) => {
      let error = "";

      switch (field) {
        case "name":
          if (!value.trim()) error = "Name is required.";
          else if (value.trim().length < 2) error = "Name must be at least 2 characters.";
          break;

        case "email":
          if (!value.trim()) error = "Email is required.";
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
            error = "Please enter a valid email address.";
          }
          break;

        case "phone":
          // Phone validation - check required and format
          if (!value || value.trim() === "") {
            error = "WhatsApp number is required.";
          } else {
            // Extract country code and number from phone value (format: +919876543210)
            const phoneStr = value.trim();
            // Remove all non-digit characters except +
            const cleaned = phoneStr.replace(/[^\d+]/g, "");
            
            // Check if it starts with + and has country code
            if (!cleaned.startsWith("+")) {
              error = "Phone number must include country code (e.g., +91 for India).";
            } else {
              // Extract digits after +
              const digitsOnly = cleaned.substring(1);
              
              // Find matching country by dial code
              const countries = [
                { dialCode: "+852", minLength: 8, maxLength: 8, name: "Hong Kong" },
                { dialCode: "+86", minLength: 11, maxLength: 11, name: "China" },
                { dialCode: "+1", minLength: 10, maxLength: 10, name: "US/Canada" },
                { dialCode: "+44", minLength: 10, maxLength: 10, name: "UK" },
                { dialCode: "+91", minLength: 10, maxLength: 10, name: "India" },
                { dialCode: "+65", minLength: 8, maxLength: 8, name: "Singapore" },
                { dialCode: "+60", minLength: 9, maxLength: 10, name: "Malaysia" },
                { dialCode: "+66", minLength: 9, maxLength: 9, name: "Thailand" },
                { dialCode: "+63", minLength: 10, maxLength: 10, name: "Philippines" },
                { dialCode: "+62", minLength: 9, maxLength: 12, name: "Indonesia" },
              ];
              
              let matchedCountry = null;
              for (const country of countries) {
                if (cleaned.startsWith(country.dialCode)) {
                  matchedCountry = country;
                  break;
                }
              }
              
              if (matchedCountry) {
                // Extract number part (after country code)
                const numberPart = digitsOnly.substring(matchedCountry.dialCode.length - 1);
                if (numberPart.length < matchedCountry.minLength) {
                  error = `Phone number must be at least ${matchedCountry.minLength} digits for ${matchedCountry.name}.`;
                } else if (numberPart.length > matchedCountry.maxLength) {
                  error = `Phone number must be at most ${matchedCountry.maxLength} digits for ${matchedCountry.name}.`;
                }
              } else {
                // Generic validation - at least 8 digits after country code
                const numberPart = digitsOnly.length > 3 ? digitsOnly.substring(3) : digitsOnly;
                if (numberPart.length < 8) {
                  error = "Phone number must be at least 8 digits.";
                } else if (numberPart.length > 15) {
                  error = "Phone number is too long (maximum 15 digits).";
                }
              }
            }
          }
          break;

        case "nextDue": {
          if (!value) {
            error = "Start date is required.";
          } else if (isNaN(new Date(value).getTime())) {
            error = "Please select a valid start date.";
          }
          break;
        }

        case "lastPayment": {
          if (value && isNaN(new Date(value).getTime())) {
            error = "Please select a valid end date.";
          }
          break;
        }

        default:
          break;
      }

      return error;
    };

    // Check if form is valid (for disabling submit button)
    const isMemberFormValid = () => {
      const fieldOrder = editingMember
        ? ["name", "email", "phone"] // Edit Member: no date fields
        : ["name", "email", "phone", "nextDue", "lastPayment"]; // Add Member: includes date fields

      for (const field of fieldOrder) {
        const error = validateMemberField(field, memberForm[field]);
        if (error) {
          return false;
        }
      }
      return true;
    };

    // Progressive validation - validate one field at a time, starting from name
    const validateMemberForm = () => {
      // Define field order for validation (only validate fields that exist in the form)
      const fieldOrder = editingMember
        ? ["name", "email", "phone"] // Edit Member: no date fields
        : ["name", "email", "phone", "nextDue", "lastPayment"]; // Add Member: includes date fields

      // Clear all errors first
      setMemberFieldErrors({
        name: false,
        email: false,
        phone: false,
        nextDue: false,
        lastPayment: false,
      });

      // Find first invalid field starting from the beginning
      for (const field of fieldOrder) {
        const error = validateMemberField(field, memberForm[field]);
        if (error) {
          // Set only this field as invalid
          setMemberFieldErrors(prev => ({ ...prev, [field]: true }));
          setCurrentInvalidField(field);
          showToast(error, "error");
          // Focus on invalid field
          setTimeout(() => {
            const formElement = document.querySelector('form.form-grid');
            if (!formElement) return;

            const fieldIndex = fieldOrder.indexOf(field);
            let targetInput = null;

            if (fieldIndex === 0) {
              // Name field - first required text input
              targetInput = formElement.querySelector('input[type="text"][required]');
            } else if (fieldIndex === 1) {
              // Email field
              targetInput = formElement.querySelector('input[type="email"]');
            } else if (fieldIndex === 2) {
              // Phone field - focus on phone input
              targetInput = formElement.querySelector('input[type="tel"]');
            } else if (fieldIndex === 3) {
              // nextDue field - first date input
              const dateInputs = formElement.querySelectorAll('input[type="date"]');
              targetInput = dateInputs[0];
            } else if (fieldIndex === 4) {
              // lastPayment field - second date input
              const dateInputs = formElement.querySelectorAll('input[type="date"]');
              targetInput = dateInputs[1];
            }

            if (targetInput) {
              targetInput.focus();
              targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          return false;
        }
      }

      // All fields valid
      setMemberFieldErrors({
        name: false,
        email: false,
        phone: false,
        nextDue: false,
        lastPayment: false,
      });
      setCurrentInvalidField(null);
      return true;
    };

    const handleMemberFieldChange = (field, rawValue) => {
      let value = rawValue;

      if (field === "phone") {
        // PhoneInput already returns international format (+919876543210), so keep it as is
        value = rawValue;
      } else if (field === "balance") {
        value = rawValue.replace(/\D/g, "");
      } else if (field === "subscriptionType") {
        // Auto-update balance when subscription changes
        if (rawValue === "Yearly + Janaza Fund") {
          value = rawValue;
          setMemberForm(prev => ({
            ...prev,
            subscriptionType: rawValue,
            balance: "500",
          }));
        } else {
          value = rawValue;
          setMemberForm(prev => ({
            ...prev,
            subscriptionType: rawValue,
            balance: "250",
          }));
        }

        // No need to run generic update below for subscriptionType
        return;
      }

      setMemberForm(prev => ({
        ...prev,
        [field]: value,
      }));

      const error = validateMemberField(
        field,
        value,
        field === "password" ? { editingMember } : {}
      );
      // Errors are now shown via Notie, no need to store in state
    };

    const [adminsForm, setAdminsForm] = useState({
      name: "",
      email: "",
      password: "",
    });

    // Get current month and year in "MMM YYYY" format
    const getCurrentPeriod = () => {
      const now = new Date();
      return now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const [invoiceForm, setInvoiceForm] = useState({
      memberId: "",
      period: getCurrentPeriod(),
      amount: "250", // numeric string
      invoiceType: "Lifetime",
      due: "",
      notes: "",
      subscriptionYear: new Date().getFullYear().toString(),
    });

    // Auto-generate invoice numbers like INV-2025-001 based on existing invoices
    const generateInvoiceId = () => {
      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;
      const existingIds = (invoices || [])
        .map((inv) => inv.id)
        .filter(Boolean)
        .filter((id) => id.startsWith(prefix));

      const maxSeq = existingIds.reduce((max, id) => {
        const parts = id.split("-");
        const seqStr = parts[2] || "";
        const seqNum = parseInt(seqStr, 10);
        if (isNaN(seqNum)) return max;
        return Math.max(max, seqNum);
      }, 0);

      const nextSeq = String(maxSeq + 1).padStart(3, "0");
      return `${prefix}${nextSeq}`;
    };

    const nextInvoiceId = useMemo(() => generateInvoiceId(), [invoices]);

    // Donation form validation state for progressive validation
    const [donationFieldErrors, setDonationFieldErrors] = useState({
      donorName: false,
      amount: false,
      method: false,
      date: false,
      screenshot: false,
    });
    const [currentInvalidDonationField, setCurrentInvalidDonationField] = useState(null);

    const [showDonationForm, setShowDonationForm] = useState(false);
    const [donationForm, setDonationForm] = useState({
      donorName: "",
      isMember: false,
      memberId: "",
      amount: "",
      method: "",
      date: "",
      notes: "",
      reference: "",
      screenshot: "",
    });
    const [donationImageFile, setDonationImageFile] = useState(null);
    const [donationImagePreview, setDonationImagePreview] = useState(null);

    const [orgForm, setOrgForm] = useState(organizationInfo);
    const [showAdminForm, setShowAdminForm] = useState(false);
    const [adminForm, setAdminForm] = useState({ name: "", email: "", phone: "", password: "", role: "Viewer", status: "Active" });
    const [showAddAdminPassword, setShowAddAdminPassword] = useState(false);
    const [adminEmailError, setAdminEmailError] = useState("");
    const [adminFieldErrors, setAdminFieldErrors] = useState({
      name: false,
      email: false,
      phone: false,
      password: false,
    });
    const [currentInvalidAdminField, setCurrentInvalidAdminField] = useState(null);

    // Email validation function
    const validateAdminEmail = (email) => {
      if (!email || !email.trim()) {
        return "Email is required";
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return "Please enter a valid email address";
      }
      return "";
    };

    // Validate admin field
    const validateAdminField = (field, value) => {
      let error = "";

      switch (field) {
        case "name":
          if (!value.trim()) error = "Name is required.";
          else if (value.trim().length < 2) error = "Name must be at least 2 characters.";
          break;

        case "email":
          error = validateAdminEmail(value);
          break;

        case "phone":
          // Phone validation - check required and format
          if (!value || value.trim() === "") {
            error = "Mobile number is required.";
          } else {
            // Extract country code and number from phone value (format: +919876543210)
            const phoneStr = value.trim();
            // Remove all non-digit characters except +
            const cleaned = phoneStr.replace(/[^\d+]/g, "");
            
            // Check if it starts with + and has country code
            if (!cleaned.startsWith("+")) {
              error = "Phone number must include country code (e.g., +91 for India).";
            } else {
              // Extract digits after +
              const digitsOnly = cleaned.substring(1);
              
              // Common country codes and their min/max lengths
              const countries = [
                { dialCode: "+852", minLength: 8, maxLength: 8, name: "Hong Kong" },
                { dialCode: "+86", minLength: 11, maxLength: 11, name: "China" },
                { dialCode: "+1", minLength: 10, maxLength: 10, name: "US/Canada" },
                { dialCode: "+44", minLength: 10, maxLength: 10, name: "UK" },
                { dialCode: "+91", minLength: 10, maxLength: 10, name: "India" },
                { dialCode: "+65", minLength: 8, maxLength: 8, name: "Singapore" },
                { dialCode: "+60", minLength: 9, maxLength: 10, name: "Malaysia" },
                { dialCode: "+66", minLength: 9, maxLength: 9, name: "Thailand" },
                { dialCode: "+63", minLength: 10, maxLength: 10, name: "Philippines" },
                { dialCode: "+62", minLength: 9, maxLength: 12, name: "Indonesia" },
              ];
              
              let matchedCountry = null;
              for (const country of countries) {
                if (cleaned.startsWith(country.dialCode)) {
                  matchedCountry = country;
                  break;
                }
              }
              
              if (matchedCountry) {
                // Extract number part (after country code)
                const numberPart = digitsOnly.substring(matchedCountry.dialCode.length - 1);
                if (numberPart.length < matchedCountry.minLength) {
                  error = `Phone number must be at least ${matchedCountry.minLength} digits for ${matchedCountry.name}.`;
                } else if (numberPart.length > matchedCountry.maxLength) {
                  error = `Phone number must be at most ${matchedCountry.maxLength} digits for ${matchedCountry.name}.`;
                }
              } else {
                // Generic validation - at least 8 digits after country code
                const numberPart = digitsOnly.length > 3 ? digitsOnly.substring(3) : digitsOnly;
                if (numberPart.length < 8) {
                  error = "Phone number must be at least 8 digits.";
                } else if (numberPart.length > 15) {
                  error = "Phone number is too long (maximum 15 digits).";
                }
              }
            }
          }
          break;

        case "password":
          if (!value || value.trim() === "") {
            error = "Password is required.";
          } else if (value.trim().length < 6) {
            error = "Password must be at least 6 characters.";
          }
          break;

        default:
          break;
      }

      return error;
    };

    // Progressive validation for admin form
    const validateAdminForm = () => {
      const fieldOrder = ["name", "email", "phone", "password"];

      // Clear all errors first
      setAdminFieldErrors({
        name: false,
        email: false,
        phone: false,
        password: false,
      });

      // Find first invalid field starting from the beginning
      for (const field of fieldOrder) {
        const error = validateAdminField(field, adminForm[field]);
        if (error) {
          // Set only this field as invalid
          setAdminFieldErrors(prev => ({ ...prev, [field]: true }));
          setCurrentInvalidAdminField(field);
          showToast(error, "error");
          // Focus on invalid field
          setTimeout(() => {
            const formElement = document.querySelector('form.settings-form');
            if (!formElement) return;

            const fieldIndex = fieldOrder.indexOf(field);
            let targetInput = null;

            if (fieldIndex === 0) {
              // Name field
              targetInput = formElement.querySelector('input[type="text"]');
            } else if (fieldIndex === 1) {
              // Email field
              targetInput = formElement.querySelector('input[type="email"]');
            } else if (fieldIndex === 2) {
              // Phone field
              targetInput = formElement.querySelector('input[type="tel"]');
            } else if (fieldIndex === 3) {
              // Password field
              targetInput = formElement.querySelector('input[type="password"], input[type="text"][placeholder*="password" i]');
            }

            if (targetInput) {
              targetInput.focus();
              targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          return false;
        }
      }

      // All fields valid
      setAdminFieldErrors({
        name: false,
        email: false,
        phone: false,
        password: false,
      });
      setCurrentInvalidAdminField(null);
      return true;
    };

    // Email template state
    const [emailTemplate, setEmailTemplate] = useState({
      subject: "Payment Reminder - Outstanding Balance",
      htmlTemplate: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1a1a1a; border-bottom: 2px solid #5a31ea; padding-bottom: 10px;">
      Payment Reminder - Outstanding Balance
    </h2>
    <p>Dear {{member_name}},</p>
    <p>This is a friendly reminder about your outstanding subscription payments.</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Member ID:</strong> {{member_id}}</p>
      <p><strong>Email:</strong> {{member_email}}</p>
      <p><strong>Total Outstanding:</strong> <span style="color: #ef4444; font-size: 18px; font-weight: bold;">\${{total_due}}</span></p>
    </div>
                              <h3 style="color: #1a1a1a;">Outstanding Invoices ({{invoice_count}}):</h3>
    <ul style="list-style: none; padding: 0;">
      {{invoice_list}}
    </ul>
    <div style="background: #f8f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>💳 Payment Methods Available:</strong></p>
      <ul>
        {{payment_methods}}
      </ul>
    </div>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{portal_link}}" style="background: #5a31ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Access Member Portal
      </a>
    </p>
    <p>Please settle your outstanding balance at your earliest convenience.</p>
    <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
  </div>`,
    });

    // Email automation settings state
    const [emailSettings, setEmailSettings] = useState({
      emailService: "gmail",
      emailUser: "",
      emailPassword: "kuil uhbe zlqq oymd",
      scheduleTime: "09:00", // 24-hour format for storage
      scheduleEnabled: true,
      reminderInterval: 7, // days between reminders
    });
    const [schedulePeriod, setSchedulePeriod] = useState("AM"); // AM or PM
    const [testingEmail, setTestingEmail] = useState(false);
    const [emailConfigStatus, setEmailConfigStatus] = useState('not_connected');
    const [showEmailPassword, setShowEmailPassword] = useState(false);
    const [dateRange, setDateRange] = useState(() => {
      const today = new Date();
      return {
        from: `${today.getFullYear()}-01-01`,
        to: `${today.getFullYear()}-12-31`,
      };
    });
    const [uploadingQR, setUploadingQR] = useState({});
    const [selectedPeriod, setSelectedPeriod] = useState("This Year");
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
    const [paymentModalData, setPaymentModalData] = useState({
      paymentMethod: "", // "Cash" or "Online" - empty by default
      imageFile: null,
      imagePreview: null,
      imageUrl: "",
      reference: "", // Reference number for online payments
      selectedAdminId: "", // Selected admin ID for cash payment
      adminMobile: "", // Mobile number for selected admin
    });
    const [uploadingPaymentModal, setUploadingPaymentModal] = useState(false);
    const [paymentModalErrors, setPaymentModalErrors] = useState({
      image: false,
      reference: false,
      selectedAdminId: false,
      adminMobile: false,
    });
    const [currentInvalidPaymentModalField, setCurrentInvalidPaymentModalField] = useState(null);
    const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
    const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);
    const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
    const [selectedPasswordResetRequest, setSelectedPasswordResetRequest] = useState(null);
    const [passwordResetForm, setPasswordResetForm] = useState({ newPassword: "" });
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const chartContainerRef = useRef(null);

    // Helper function to update mouse position from chart container
    const updateChartMousePosition = (e) => {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };

    // Helper component for Dashboard KPI Card
    const DashboardKPICard = ({ icon, iconClass, label, value, description, onClick, valueClass = "" }) => (
      <button
        type="button"
        className="admin-dashboard-kpi-card admin-dashboard-kpi-button"
        onClick={onClick}
      >
        <p className="admin-dashboard-kpi-label">
          <i className={`${icon} ${iconClass || "admin-dashboard-kpi-icon"}`}></i>
          {label}
        </p>
        <h4 className={`admin-dashboard-kpi-value ${valueClass}`}>{value}</h4>
        {description && <small className="admin-dashboard-kpi-description">{description}</small>}
      </button>
    );
    const [sendingEmails, setSendingEmails] = useState({}); // Track which member is sending
    const [sendingToAll, setSendingToAll] = useState(false);
    const [sendingWhatsApp, setSendingWhatsApp] = useState({}); // Track which member is sending WhatsApp
    const [sendingWhatsAppToAll, setSendingWhatsAppToAll] = useState(false);
    const [showTemplatePreview, setShowTemplatePreview] = useState(false);
    const [showChannelSelection, setShowChannelSelection] = useState(false);
    const [selectedReminderLogItem, setSelectedReminderLogItem] = useState(null);
    const [pendingReminderAction, setPendingReminderAction] = useState(null); // { type: 'single'|'bulk', memberData?: member }
    const [selectedChannels, setSelectedChannels] = useState([]); // Track selected channels for bulk send (can be multiple)
    const [paymentStatusFilter, setPaymentStatusFilter] = useState("All"); // All, Pending, Completed, Rejected
    const [paymentSearchTerm, setPaymentSearchTerm] = useState(""); // Search filter for payments
    const [paymentYearFilter, setPaymentYearFilter] = useState("All"); // Year filter for payments
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("All"); // All, Paid, Unpaid, Overdue, Pending
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState(""); // Search filter for invoices
    const [invoiceYearFilter, setInvoiceYearFilter] = useState("All"); // Year filter for invoices
    const [reportFilter, setReportFilter] = useState("all"); // all, payments, donations
    const [donorTypeFilter, setDonorTypeFilter] = useState("all"); // all, member, non-member
    const [transactionsSearch, setTransactionsSearch] = useState("");
    const [transactionsPage, setTransactionsPage] = useState(1);
    const [transactionsPageSize, setTransactionsPageSize] = useState(10);
    const [memberSearchTerm, setMemberSearchTerm] = useState(""); // Search filter for members
    const [memberStatusFilter, setMemberStatusFilter] = useState("All"); // Status filter for members
    const [memberYearFilter, setMemberYearFilter] = useState("All"); // Year filter for members
    const [memberSortByOutstanding, setMemberSortByOutstanding] = useState("none"); // Sort by outstanding amount
    const [memberNotes, setMemberNotes] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("memberNotes") || "{}");
      } catch {
        return {};
      }
    });
    const [memberNoteDraft, setMemberNoteDraft] = useState("");
    const [invoiceMemberSearch, setInvoiceMemberSearch] = useState(""); // Search filter for invoice member select
    const [donationMemberSearch, setDonationMemberSearch] = useState(""); // Search filter for donation member select
    const [showMemberDropdown, setShowMemberDropdown] = useState(false); // Show/hide member dropdown
    const [showDonationMemberDropdown, setShowDonationMemberDropdown] = useState(false); // Show/hide donation member dropdown
    const [showDonationPaymentMethodDropdown, setShowDonationPaymentMethodDropdown] = useState(false); // Show/hide donation payment method dropdown
    const [showImagePopup, setShowImagePopup] = useState(false); // Show/hide image popup
    const [selectedImageUrl, setSelectedImageUrl] = useState(""); // Selected image URL for popup
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu toggle

    // Payment form state
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    // Payment form validation state for progressive validation
    const [paymentFieldErrors, setPaymentFieldErrors] = useState({
      memberId: false,
      amount: false,
      method: false,
      screenshot: false,
    });
    const [currentInvalidPaymentField, setCurrentInvalidPaymentField] = useState(null);

    const [paymentForm, setPaymentForm] = useState({
      memberId: "",
      member: "",
      invoiceId: "",
      amount: "",
      method: "",
      reference: "",
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }),
      status: "Pending",
      screenshot: "",
      notes: "",
    });

    // Pagination states
    const [membersPage, setMembersPage] = useState(1);
    const [membersPageSize, setMembersPageSize] = useState(10);
    const [paymentsPage, setPaymentsPage] = useState(1);
    const [paymentsPageSize, setPaymentsPageSize] = useState(10);
    const [paymentsSearchTerm, setPaymentsSearchTerm] = useState(""); // search filter for payments
    const [donationsPage, setDonationsPage] = useState(1);
    const [donationsPageSize, setDonationsPageSize] = useState(10);
    const [donationYearFilter, setDonationYearFilter] = useState(new Date().getFullYear().toString()); // Year filter for donations, default to current year
    const [remindersPage, setRemindersPage] = useState(1);
    const [remindersPageSize, setRemindersPageSize] = useState(10);
    const [outstandingMembersPage, setOutstandingMembersPage] = useState(1);
    const [outstandingMembersPageSize, setOutstandingMembersPageSize] = useState(5);
    const [invoicesPage, setInvoicesPage] = useState(1);
    const [invoicesPageSize, setInvoicesPageSize] = useState(10);
    const [remindersStatusFilter, setRemindersStatusFilter] = useState("All"); // All, Delivered, Failed, Pending
    const [remindersChannelFilter, setRemindersChannelFilter] = useState("All"); // All, Email, WhatsApp

    const navigate = useNavigate();

    // Sync URL with activeSection changes
    useEffect(() => {
      const currentSection = searchParams.get('section');
      if (currentSection !== activeSection) {
        setSearchParams({ section: activeSection }, { replace: false });
      }
    }, [activeSection, searchParams, setSearchParams]);

    // Handle browser back/forward buttons
    useEffect(() => {
      const handlePopState = () => {
        // Read section from current URL
        const urlParams = new URLSearchParams(window.location.search);
        const sectionFromUrl = urlParams.get('section');
        const isValidSection = sectionFromUrl && sections.find(s => s.id === sectionFromUrl);
        if (isValidSection && sectionFromUrl !== activeSection) {
          setActiveSection(sectionFromUrl);
        } else if (!sectionFromUrl && activeSection !== sections[0].id) {
          setActiveSection(sections[0].id);
        }
      };

      // Listen for popstate events (back/forward button)
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }, [activeSection]);

    // Refresh reminder logs when opening the global Reminders Log section
    useEffect(() => {
      if (activeSection === "communications") {
        fetchReminderLogs();
        fetchPasswordResetRequests();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection]); // Only depend on activeSection to prevent infinite loops

    // Helper function to check if a member exists in the members list
    const isMemberInList = (memberIdentifier) => {
      if (!memberIdentifier) return false;
      const identifier = String(memberIdentifier).toLowerCase().trim();
      return members.some(m => 
        m.id?.toLowerCase() === identifier ||
        m.email?.toLowerCase() === identifier ||
        m.name?.toLowerCase() === identifier ||
        String(m.id || "").toLowerCase() === identifier ||
        String(m.email || "").toLowerCase() === identifier ||
        String(m.name || "").toLowerCase() === identifier
      );
    };

    // Helper function to check if an invoice belongs to a member in the list
    const isInvoiceMemberInList = (invoice) => {
      if (!invoice) return false;
      return members.some(m => 
        m.id === invoice.memberId || 
        m.email === invoice.memberEmail || 
        m.name === invoice.memberName ||
        String(m.id || "") === String(invoice.memberId || "") ||
        String(m.email || "").toLowerCase() === String(invoice.memberEmail || "").toLowerCase() ||
        String(m.name || "").toLowerCase() === String(invoice.memberName || "").toLowerCase()
      );
    };

    // Helper function to check if a payment belongs to a member in the list
    // Priority: 1) ID, 2) Email, 3) Name
    // For total collected amount calculation, this ensures email-based matching is prioritized
    const isPaymentMemberInList = (payment) => {
      if (!payment || !payment.member) return false;
      const paymentMember = String(payment.member).toLowerCase().trim();
      
      // First try to match by ID
      const matchedById = members.find(m => 
        String(m.id || "").toLowerCase() === paymentMember
      );
      if (matchedById) return true;
      
      // Then try to match by email (prioritized over name for accurate total collected)
      const matchedByEmail = members.find(m => 
        String(m.email || "").toLowerCase() === paymentMember
      );
      if (matchedByEmail) return true;
      
      // Finally try to match by name (fallback)
      return members.some(m => 
        String(m.name || "").toLowerCase() === paymentMember
      );
    };

    // Check if donation belongs to a member in the members list
    const isDonationMemberInList = (donation) => {
      if (!donation) return false;
      // If donation is not from a member, exclude it
      if (!donation.isMember || !donation.memberId) return false;
      // Check if the memberId exists in the members list
      return members.some(m => 
        String(m.id || "").toLowerCase() === String(donation.memberId || "").toLowerCase() ||
        (donation.donorName && String(m.name || "").toLowerCase() === String(donation.donorName || "").toLowerCase()) ||
        (donation.donorEmail && String(m.email || "").toLowerCase() === String(donation.donorEmail || "").toLowerCase())
      );
    };

    // Calculate monthly collections from paymentHistory
    const calculateMonthlyCollections = () => {
      const now = new Date();
      const months = [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      // Get last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        const monthLabel = monthNames[date.getMonth()];

        // Filter payments for this month (only completed/paid and from members in the list)
        const monthPayments = paymentHistory.filter((payment) => {
          // Only count completed or paid payments
          const isCompleted = payment.status === "Completed" || payment.status === "Paid";
          if (!isCompleted) return false;
          if (!payment.date) return false;
          const paymentDate = new Date(payment.date);
          const isInMonth = paymentDate.getMonth() === date.getMonth() &&
            paymentDate.getFullYear() === date.getFullYear();
          if (!isInMonth) return false;
          // Only include payments from members in the members list
          return isPaymentMemberInList(payment);
        });

        // Calculate total for this month
        const total = monthPayments.reduce((sum, payment) => {
          const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
          return sum + amount;
        }, 0);

        months.push({
          month: monthLabel,
          monthKey: monthKey,
          value: total,
          count: monthPayments.length,
          payments: monthPayments // Store payment details for tooltip
        });
      }

      // Calculate max value for percentage calculation
      const maxValue = Math.max(...months.map(m => m.value), 1);

      // Convert to percentage for chart display
      return months.map(m => ({
        ...m,
        percentage: maxValue > 0 ? (m.value / maxValue) * 100 : 0
      }));
    };

    // Calculate dashboard metrics from actual data
    const calculateDashboardMetrics = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      // Create Sets for member lookup
      const memberIds = new Set(members.map(m => m.id).filter(Boolean));
      const memberEmails = new Set(members.map(m => m.email?.toLowerCase()).filter(Boolean));
      const memberNames = new Set(members.map(m => m.name?.toLowerCase()).filter(Boolean));

      // Calculate Total Collected - from paymentHistory (only completed/paid)
      // Only count payments from members in the members list
      const allPayments = (paymentHistory || []).filter(payment => 
        isPaymentMemberInList(payment)
      );
      const totalCollectedAllTime = allPayments.reduce((sum, payment) => {
        // Only count completed or paid payments
        if (payment.status === "Completed" || payment.status === "Paid") {
          const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
          return sum + amount;
        }
        return sum;
      }, 0);

      // Calculate collected this month
      const thisMonthPayments = allPayments.filter((payment) => {
        // Only count completed or paid payments
        const isCompleted = payment.status === "Completed" || payment.status === "Paid";
        if (!isCompleted) return false;
        if (!payment.date) return false;
        const paymentDate = new Date(payment.date);
        return paymentDate.getMonth() === currentMonth &&
          paymentDate.getFullYear() === currentYear;
      });
      const collectedThisMonth = thisMonthPayments.reduce((sum, payment) => {
        // Only count completed or paid payments
        if (payment.status === "Completed" || payment.status === "Paid") {
          const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
          return sum + amount;
        }
        return sum;
      }, 0);

      // Calculate collected this year
      const thisYearPayments = allPayments.filter((payment) => {
        // Only count completed or paid payments
        const isCompleted = payment.status === "Completed" || payment.status === "Paid";
        if (!isCompleted) return false;
        if (!payment.date) return false;
        const paymentDate = new Date(payment.date);
        return paymentDate.getFullYear() === currentYear;
      });
      const collectedThisYear = thisYearPayments.reduce((sum, payment) => {
        // Only count completed or paid payments
        if (payment.status === "Completed" || payment.status === "Paid") {
          const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
          return sum + amount;
        }
        return sum;
      }, 0);

      // Calculate Total Outstanding - from members' balance field (not from invoices)
      // Parse member balance which might be in formats like: "$250 Outstanding", "$250", "$0", "$250 Overdue"
      const totalOutstanding = members.reduce((sum, member) => {
        if (!member.balance) return sum;

        // Extract numeric value from balance string
        // Handles formats like: "$250 Outstanding", "$250", "$0", "$250 Overdue"
        const balanceStr = member.balance.toString();
        const numericValue = parseFloat(balanceStr.replace(/[^0-9.]/g, '') || 0);

        // Only count if balance is greater than 0
        return sum + (numericValue > 0 ? numericValue : 0);
      }, 0);

      // Calculate Overdue Members - members with overdue invoices OR members with Overdue status
      // First, get all overdue invoices
      const overdueInvoices = invoices.filter(inv => {
        const isMemberInvoice =
          (inv.memberId && memberIds.has(inv.memberId)) ||
          (inv.memberEmail && memberEmails.has(inv.memberEmail?.toLowerCase())) ||
          (inv.memberName && memberNames.has(inv.memberName?.toLowerCase()));

        return isMemberInvoice && inv.status === "Overdue";
      });

      // Create sets to track members with overdue invoices
      const overdueMemberIdsFromInvoices = new Set();
      const overdueMemberEmailsFromInvoices = new Set();
      const overdueMemberNamesFromInvoices = new Set();

      overdueInvoices.forEach(inv => {
        if (inv.memberId) overdueMemberIdsFromInvoices.add(inv.memberId);
        if (inv.memberEmail) overdueMemberEmailsFromInvoices.add(inv.memberEmail.toLowerCase());
        if (inv.memberName) overdueMemberNamesFromInvoices.add(inv.memberName.toLowerCase());
      });

      // Count unique overdue members - either from invoices or from status
      const overdueMemberSet = new Set();

      members.forEach(member => {
        let isOverdue = false;

        // Check if member has overdue invoice
        const hasOverdueInvoice =
          (member.id && overdueMemberIdsFromInvoices.has(member.id)) ||
          (member.email && overdueMemberEmailsFromInvoices.has(member.email?.toLowerCase())) ||
          (member.name && overdueMemberNamesFromInvoices.has(member.name?.toLowerCase()));

        if (hasOverdueInvoice) {
          isOverdue = true;
        } else {
          // Check if member has explicit "Overdue" status
          if (member.status === "Overdue") {
            isOverdue = true;
          } else if (member.status !== "Inactive" && member.status !== "Pending") {
            // Check derived status (same logic as in members list)
            if (member.balance) {
              const balanceStr = member.balance.toString();
              const numericOutstanding = parseFloat(balanceStr.replace(/[^0-9.]/g, "") || 0);

              // Only mark as overdue if payment_status is unpaid AND next_due_date has passed
              if (member.payment_status === "unpaid" && numericOutstanding > 0) {
                if (member.next_due_date) {
                  try {
                    const dueDate = new Date(member.next_due_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dueDate.setHours(0, 0, 0, 0);

                    // Only mark as overdue if due date has passed
                    if (dueDate < today) {
                      isOverdue = true;
                    }
                  } catch (e) {
                    // If date parsing fails, check balance string
                    if (balanceStr.toLowerCase().includes("overdue")) {
                      isOverdue = true;
                    }
                  }
                } else if (balanceStr.toLowerCase().includes("overdue")) {
                  // No due date but balance string says "overdue"
                  isOverdue = true;
                }
              } else if (balanceStr.toLowerCase().includes("overdue")) {
                // Fallback: if balance string explicitly says "overdue"
                isOverdue = true;
              }
            }
          }
        }

        // Add to set using ID, email, or name as identifier
        if (isOverdue) {
          if (member.id) {
            overdueMemberSet.add(member.id);
          } else if (member.email) {
            overdueMemberSet.add(`email:${member.email.toLowerCase()}`);
          } else if (member.name) {
            overdueMemberSet.add(`name:${member.name.toLowerCase()}`);
          }
        }
      });

      const overdueMembersCount = overdueMemberSet.size;

      // Calculate Unpaid Members - members with unpaid or overdue invoices
      const unpaidMemberSet = new Set();
      members.forEach(member => {
        // Get all invoices for this member
        const memberInvoices = invoices.filter(inv => 
          (inv.memberId && inv.memberId === member.id) ||
          (inv.memberEmail && member.email && inv.memberEmail.toLowerCase() === member.email.toLowerCase()) ||
          (inv.memberName && member.name && inv.memberName.toLowerCase() === member.name.toLowerCase())
        );

        // Check if member has any unpaid or overdue invoices
        // Use effective status (considering completed payments)
        const hasUnpaidInvoice = memberInvoices.some(inv => {
          // Check if there's a completed payment for this invoice
          const relatedPayment = paymentHistory.find(
            (p) => p.invoiceId === inv.id && (p.status === "Completed" || p.status === "Paid")
          );
          const effectiveStatus = relatedPayment ? "Paid" : inv.status;
          return effectiveStatus === "Unpaid" || effectiveStatus === "Overdue";
        });

        // Also check if member has outstanding balance
        if (member.balance) {
          const balanceStr = member.balance.toString();
          const numericValue = parseFloat(balanceStr.replace(/[^0-9.]/g, '') || 0);
          if (numericValue > 0 || hasUnpaidInvoice) {
            if (member.id) {
              unpaidMemberSet.add(member.id);
            } else if (member.email) {
              unpaidMemberSet.add(`email:${member.email.toLowerCase()}`);
            } else if (member.name) {
              unpaidMemberSet.add(`name:${member.name.toLowerCase()}`);
            }
          }
        } else if (hasUnpaidInvoice) {
          if (member.id) {
            unpaidMemberSet.add(member.id);
          } else if (member.email) {
            unpaidMemberSet.add(`email:${member.email.toLowerCase()}`);
          } else if (member.name) {
            unpaidMemberSet.add(`name:${member.name.toLowerCase()}`);
          }
        }
      });
      const unpaidMembersCount = unpaidMemberSet.size;

      // Calculate expected annual (all members * expected per member)
      // Assuming $800 per member per year as mentioned in the UI
      const expectedAnnual = members.length * 800;

      // Calculate Total Subscription Amount (from payments only, not donations)
      const totalSubscriptionAmount = allPayments.reduce((sum, payment) => {
        // Only count completed or paid payments
        if (payment.status === "Completed" || payment.status === "Paid") {
          const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
          return sum + amount;
        }
        return sum;
      }, 0);

      // Calculate Total Donation Amount (from donations)
      const totalDonationAmount = (Array.isArray(donations) ? donations : []).reduce((sum, donation) => {
        if (!donation) return sum;
        const amount = parseFloat(donation.amount?.replace(/[^0-9.]/g, '') || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      // Calculate Total Collected as subscription amount + donation amount
      const totalCollected = totalSubscriptionAmount + totalDonationAmount;

      return {
        totalCollected: totalCollected,
        collectedMonth: collectedThisMonth,
        collectedYear: collectedThisYear,
        outstanding: totalOutstanding,
        overdueMembers: overdueMembersCount,
        unpaidMembers: unpaidMembersCount,
        expectedAnnual: expectedAnnual,
        totalSubscriptionAmount: totalSubscriptionAmount,
        totalDonationAmount: totalDonationAmount
      };
    };

    // Get recent payments from paymentHistory
    // Helper function to format payment method display
    const getPaymentMethodDisplay = (payment) => {
      // If paidToAdmin exists, it's a cash payment
      if (payment.paidToAdmin || payment.paidToAdminName) {
        return "Cash";
      }

      // If method is "Cash to Admin", show as "Cash"
      if (payment.method === "Cash to Admin") {
        return "Cash";
      }

      // For online payment methods (Screenshot, Bank Transfer, FPS, PayMe, etc.)
      // Show as "Online Payment"
      const onlineMethods = ["Screenshot", "Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card", "Online Payment"];
      if (onlineMethods.includes(payment.method)) {
        return "Online Payment";
      }

      // Return method as-is if it doesn't match above
      return payment.method || "-";
    };

    const getRecentPayments = () => {
      // Use payments from finance section, filter to only show payments from members in the members list
      return (payments || [])
        .filter(payment => 
          // Only include payments from members in the members list
          isPaymentMemberInList(payment)
        )
        .filter(payment => payment.status === "Paid" || payment.status === "Completed" || payment.status === "Pending Verification" || payment.status === "Pending")
        .sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0);
          const dateB = new Date(b.date || b.createdAt || 0);
          return dateB - dateA;
        })
        .slice(0, 3) // Show only 3 recent payments
        .map(payment => {
          // Find member for this payment - prioritize email matching for accurate total collected
          // Priority: 1) ID, 2) Email (prioritized), 3) Name (fallback)
          let member = null;
          
          // Try ID first
          if (payment.memberId) {
            member = members.find(m => m.id === payment.memberId);
          }
          
          // Try email second (prioritized over name for total collected accuracy)
          if (!member) {
            if (payment.memberEmail) {
              member = members.find(m => 
                m.email && m.email.toLowerCase() === payment.memberEmail.toLowerCase()
              );
            }
            // Also try payment.member as email
            if (!member && payment.member) {
              member = members.find(m => 
                m.email && m.email.toLowerCase() === String(payment.member || "").toLowerCase()
              );
            }
          }
          
          // Fallback to name matching only if email didn't match
          if (!member) {
            member = members.find(m => 
              m.name === payment.member ||
              String(m.name || "").toLowerCase() === String(payment.member || "").toLowerCase()
            );
          }

          // Get Subscription Year from member's invoices
          let subscriptionYear = "-";
          if (member) {
            const memberInvoices = invoices.filter(inv => 
              inv.memberId === member.id || 
              inv.memberEmail === member.email || 
              inv.memberName === member.name
            ).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            
            if (memberInvoices.length > 0) {
              const latestInvoice = memberInvoices[0];
              if (latestInvoice.period) {
                const periodStr = String(latestInvoice.period).trim();
                const yearMatch = periodStr.match(/\d{4}/);
                if (yearMatch) {
                  subscriptionYear = yearMatch[0];
                }
              }
            }
          }

          // Get Native from member
          const native = member?.native || "-";

          // Get Joined Year from member
          const joinedYear = member?.start_date
            ? new Date(member.start_date).getFullYear()
            : (member?.createdAt ? new Date(member.createdAt).getFullYear() : "-");

          return {
            Member: payment.member || "Unknown",
            Period: payment.period || "-",
            Amount: payment.amount
              ? formatCurrency(parseFloat(payment.amount.replace(/[^0-9.]/g, '') || 0))
              : formatCurrency(0),
            Method: getPaymentMethodDisplay(payment),
            Status: payment.status || "Pending",
            "Subscription Year": subscriptionYear,
            Native: native,
            "Joined Year": joinedYear,
          };
        });
    };

    // Make monthly collections data reactive to changes in paymentHistory and members
    const monthlyCollectionsData = useMemo(() => {
      return calculateMonthlyCollections();
    }, [paymentHistory, members]);
    // Make recent payments data reactive to changes in payments, members, and invoices
    const recentPaymentsData = useMemo(() => {
      return getRecentPayments();
    }, [payments, members, invoices]);
    // Make dashboard metrics reactive to changes in invoices, payments, and members
    const dashboardMetrics = useMemo(() => {
      return calculateDashboardMetrics();
    }, [invoices, paymentHistory, members]);

    // Dashboard last updated timestamp (changes when core data changes)
    const dashboardLastUpdated = useMemo(() => {
      return new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }, [members, invoices, paymentHistory, payments]);

    // Sync member note draft when selected member changes
    useEffect(() => {
      if (selectedMember) {
        setMemberNoteDraft(memberNotes[selectedMember.id] || "");
      }
    }, [selectedMember, memberNotes]);

    // Auto-expand parent group when activeSection changes (e.g., from URL)
    useEffect(() => {
      const parentGroup = navigationGroups.find(group =>
        group.items.some(item => item.id === activeSection)
      );
      if (parentGroup) {
        setExpandedGroups(prev => {
          // Only update if not already expanded (maintain accordion behavior)
          if (prev[parentGroup.id]) return prev;
          // Close all other groups and open only this one (accordion behavior)
          const newState = {};
          navigationGroups.forEach(g => {
            newState[g.id] = g.id === parentGroup.id;
          });
          return newState;
        });
      }
    }, [activeSection]);

    // Calculate report stats based on date range from real database data
    const calculateReportStats = () => {
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999); // Include entire end date

      // Filter payments within date range (only completed/paid payments count)
      // Also filter to only show payments from members in the members list
      const paymentsInRange = paymentHistory.filter(payment => {
        // First check if payment belongs to a member in the list
        if (!isPaymentMemberInList(payment)) return false;
        if (!payment.date) return false;
        const paymentDate = new Date(payment.date);
        // Only count completed/paid payments in financial reports
        const isCompleted = payment.status === "Completed" || payment.status === "Paid";
        return paymentDate >= fromDate && paymentDate <= toDate && isCompleted;
      });

      // Filter donations within date range
      // Show all donations (both member and non-member donations) within the date range
      const donationsInRange = (Array.isArray(donations) ? donations : []).filter(donation => {
        if (!donation) return false;

        try {
          let donationDate = null;

          // Try to parse donation.date first (user-provided date, usually in YYYY-MM-DD format)
          if (donation.date) {
            const dateStr = String(donation.date).trim();

            // Handle ISO format (YYYY-MM-DD) - most common from date input
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              donationDate = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
            } else {
              // Try parsing as general date string
              donationDate = new Date(dateStr);

              // If that fails, try parsing as "DD MMM YYYY" format
              if (isNaN(donationDate.getTime())) {
                const parts = dateStr.split(' ');
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const month = monthNames.indexOf(parts[1]);
                  const year = parseInt(parts[2], 10);
                  if (month !== -1 && !isNaN(day) && !isNaN(year)) {
                    donationDate = new Date(year, month, day);
                  }
                }
              }
            }
          }

          // Fallback to createdAt if date is not available or invalid
          if (!donationDate || isNaN(donationDate.getTime())) {
            if (donation.createdAt) {
              donationDate = new Date(donation.createdAt);
            } else {
              // If no date at all, include it (might be a recent donation without date set)
              // But only if it's within a reasonable recent timeframe (last 30 days)
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return fromDate <= thirtyDaysAgo && toDate >= new Date();
            }
          }

          // Normalize dates to midnight for proper comparison (ignore time)
          const normalizedDonationDate = new Date(donationDate.getFullYear(), donationDate.getMonth(), donationDate.getDate());
          const normalizedFromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
          const normalizedToDate = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

          return normalizedDonationDate >= normalizedFromDate && normalizedDonationDate <= normalizedToDate;
        } catch (e) {
          console.error('Error filtering donation by date:', e, donation);
          // Include donation if date parsing fails (better to show than hide)
          return true;
        }
      });

      // Calculate collected amount from payments
      const paymentsTotal = paymentsInRange.reduce((sum, payment) => {
        const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
        return sum + amount;
      }, 0);

      // Calculate collected amount from donations
      const donationsTotal = donationsInRange.reduce((sum, donation) => {
        const amount = parseFloat(donation.amount?.replace(/[^0-9.]/g, '') || 0);
        return sum + amount;
      }, 0);

      // Total collected (payments + donations)
      const collected = paymentsTotal + donationsTotal;

      // Calculate expected revenue based on members and their subscription types
      // Lifetime: $250/year, Yearly + Janaza Fund: $500/year
      const activeMembers = members.filter(m => m.status === 'Active');
      let expected = 0;

      activeMembers.forEach(member => {
        const subscriptionType = member.subscriptionType || 'Lifetime';
        // Try to get member creation date or use a default
        const memberStartDate = member.createdAt ? new Date(member.createdAt) : new Date('2025-01-01');

        if (subscriptionType === 'Yearly + Janaza Fund') {
          // For yearly + janaza fund: $500 per year
          // Calculate how many years in the date range
          const rangeStart = Math.max(fromDate.getTime(), memberStartDate.getTime());
          const rangeEnd = toDate.getTime();
          const yearsInRange = Math.max(0, (rangeEnd - rangeStart) / (365.25 * 24 * 60 * 60 * 1000));
          expected += Math.ceil(yearsInRange) * 500;
        } else {
          // For lifetime: $250 per year
          const rangeStart = Math.max(fromDate.getTime(), memberStartDate.getTime());
          const rangeEnd = toDate.getTime();
          const yearsInRange = Math.max(0, (rangeEnd - rangeStart) / (365.25 * 24 * 60 * 60 * 1000));
          expected += Math.ceil(yearsInRange) * 250;
        }
      });

      // If no expected calculated, use a default based on active members
      if (expected === 0 && activeMembers.length > 0) {
        // Default: assume lifetime subscription for all ($250/year)
        const yearsInRange = Math.max(0, (toDate - fromDate) / (365.25 * 24 * 60 * 60 * 1000));
        expected = activeMembers.length * 250 * Math.ceil(yearsInRange);
      }

      // Calculate average per member
      const averagePerMember = activeMembers.length > 0
        ? Math.round(collected / activeMembers.length)
        : 0;

      // Calculate payment method breakdown
      const methodCounts = {};
      paymentsInRange.forEach(payment => {
        const method = getPaymentMethodDisplay(payment);
        methodCounts[method] = (methodCounts[method] || 0) + 1;
      });

      const methodMix = Object.entries(methodCounts).map(([label, value]) => ({
        label,
        value
      }));

      // If no methods found, add default empty array
      if (methodMix.length === 0) {
        methodMix.push({ label: 'No payments', value: 0 });
      }

      return {
        collected,
        paymentsTotal,
        donationsTotal,
        paymentsCount: paymentsInRange.length,
        donationsCount: donationsInRange.length,
        expected: expected || 1, // Avoid division by zero
        averagePerMember,
        methodMix,
        transactionCount: paymentsInRange.length + donationsInRange.length,
        paymentsInRange,
        donationsInRange,
      };
    };

    // Calculate real-time report stats
    const reportStats = calculateReportStats();

    // Export CSV function
    const handleExportCSV = () => {
      try {
        // Get payments in date range for detailed export (only from members in the list)
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);

        const paymentsInRange = paymentHistory.filter(payment => {
          // First check if payment belongs to a member in the list
          if (!isPaymentMemberInList(payment)) return false;
          if (!payment.date) return false;
          const paymentDate = new Date(payment.date);
          return paymentDate >= fromDate && paymentDate <= toDate;
        });

        // Create CSV content
        let csvContent = "Financial Report\n";
        csvContent += `Period,${dateRange.from} to ${dateRange.to}\n\n`;
        csvContent += "Summary\n";
        csvContent += `Collected,${formatCurrency(reportStats.collected)}\n`;
        csvContent += `Expected,${formatCurrency(reportStats.expected)}\n`;
        csvContent += `Outstanding,${formatCurrency(dashboardMetrics.outstanding)}\n`;
        csvContent += `Average per Member,${formatCurrency(reportStats.averagePerMember)}\n`;
        csvContent += `Total Transactions,${reportStats.transactionCount}\n\n`;

        // Payment method breakdown - Hidden
        // csvContent += "Payment Method Breakdown\n";
        // reportStats.methodMix.forEach(item => {
        //   csvContent += `${item.label},${item.value}\n`;
        // });

        // Detailed transactions (only completed/paid and from members in the list)
        csvContent += "\nDetailed Transactions (Completed Payments Only)\n";
        csvContent += "Date,Member,Period,Amount,Method,Status,Reference\n";
        paymentsInRange
          .filter(payment => {
            // Only include completed/paid payments from members in the list
            const isCompleted = payment.status === "Completed" || payment.status === "Paid";
            return isCompleted && isPaymentMemberInList(payment);
          })
          .forEach(payment => {
            const date = payment.date || "-";
            const member = payment.member || "Unknown";
            const period = payment.period || "-";
            const amount = payment.amount || "0";
            const method = payment.method || "Cash";
            const status = payment.status || "-";
            const reference = payment.reference || "-";
            csvContent += `"${date}","${member}","${period}","${amount}","${method}","${status}","${reference}"\n`;
          });

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `financial-report-${dateRange.from}-to-${dateRange.to}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("CSV report downloaded successfully!");
      } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast("Failed to export CSV", "error");
      }
    };

    // Guarded export helpers (role-based)
    const handleSecureExportCSV = () => {
      if (!isFinanceRole) {
        showToast("You are not authorized to export reports", "error");
        return;
      }
      handleExportCSV();
    };

    const handleSecureExportPDF = () => {
      if (!isFinanceRole) {
        showToast("You are not authorized to export reports", "error");
        return;
      }
      handleExportPDF();
    };

    // Export PDF function
    const handleExportPDF = () => {
      try {
        const doc = new jsPDF();
        // jsPDF 4.0.0 compatible API
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        let yPos = 20;
        const margin = 20;
        const lineHeight = 7;

        // Title
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Financial Report', margin, yPos);
        yPos += 10;

        // Period
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`Period: ${dateRange.from} to ${dateRange.to}`, margin, yPos);
        yPos += 15;

        // Summary section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Summary', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Collected: ${formatCurrency(reportStats.collected)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Expected: ${formatCurrency(reportStats.expected)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Outstanding: ${formatCurrency(dashboardMetrics.outstanding)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Average per Member: ${formatCurrency(reportStats.averagePerMember)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Total Transactions: ${reportStats.transactionCount}`, margin, yPos);
        yPos += 10;

        // Payment method breakdown - Hidden
        // doc.setFontSize(14);
        // doc.setFont(undefined, 'bold');
        // doc.text('Payment Method Breakdown', margin, yPos);
        // yPos += 8;

        // doc.setFontSize(10);
        // doc.setFont(undefined, 'normal');
        // reportStats.methodMix.forEach(item => {
        //   doc.text(`${item.label}: ${item.value}`, margin, yPos);
        //   yPos += lineHeight;
        // });

        // Check if we need a new page for transactions
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);

        const paymentsInRange = paymentHistory.filter(payment => {
          // First check if payment belongs to a member in the list
          if (!isPaymentMemberInList(payment)) return false;
          if (!payment.date) return false;
          const paymentDate = new Date(payment.date);
          return paymentDate >= fromDate && paymentDate <= toDate;
        });

        if (paymentsInRange.length > 0) {
          yPos += 10;
          if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text('Recent Transactions', margin, yPos);
          yPos += 8;

          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');

          // Table headers
          doc.setFont(undefined, 'bold');
          doc.text('Date', margin, yPos);
          doc.text('Member', margin + 40, yPos);
          doc.text('Amount', margin + 90, yPos);
          doc.text('Method', margin + 130, yPos);
          yPos += lineHeight;

          doc.setFont(undefined, 'normal');
          // Add transactions (limit to fit on page, only completed/paid and from members in the list)
          const completedPayments = paymentsInRange.filter(p => {
            const isCompleted = p.status === "Completed" || p.status === "Paid";
            return isCompleted && isPaymentMemberInList(p);
          });
          const maxTransactions = Math.min(completedPayments.length, Math.floor((pageHeight - yPos - 20) / lineHeight));
          completedPayments.slice(0, maxTransactions).forEach(payment => {
            if (yPos > pageHeight - 20) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(payment.date || "-", margin, yPos);
            doc.text((payment.member || "Unknown").substring(0, 15), margin + 40, yPos);
            doc.text(payment.amount || formatCurrency(0), margin + 90, yPos);
            doc.text(getPaymentMethodDisplay(payment).substring(0, 15), margin + 130, yPos);
            yPos += lineHeight;
          });

          if (completedPayments.length > maxTransactions) {
            doc.text(`... and ${completedPayments.length - maxTransactions} more transactions`, margin, yPos);
          }
        }

        // Footer
        // jsPDF 4.0.0 compatible API
        const totalPages = doc.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.text(`Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`, margin, pageHeight - 10);
        }

        // Save PDF
        doc.save(`financial-report-${dateRange.from}-to-${dateRange.to}.pdf`);
        showToast("PDF report downloaded successfully!");
      } catch (error) {
        console.error('Error exporting PDF:', error);
        showToast("Failed to export PDF", "error");
      }
    };

    // Get recent payments in date range
    const recentPaymentsInRange = paymentHistory
      .filter(payment => {
        if (!payment.date) return false;
        const paymentDate = new Date(payment.date);
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        return paymentDate >= fromDate && paymentDate <= toDate;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });

    // Fetch email settings from server
    const fetchEmailSettings = async () => {
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/email-settings`);
        if (response.ok) {
          const data = await response.json();
          if (data) {
            const scheduleTime = data.scheduleTime || "09:00";
            // Convert 24-hour to 12-hour format for display
            const [hours, minutes] = scheduleTime.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}`;

            setEmailSettings({
              emailService: data.emailService || "gmail",
              emailUser: data.emailUser || "",
              emailPassword: data.emailPassword || "kuil uhbe zlqq oymd",
              scheduleTime: scheduleTime,
              scheduleEnabled: data.scheduleEnabled !== undefined ? data.scheduleEnabled : true,
              reminderInterval: data.reminderInterval || 7,
            });
            setSchedulePeriod(period);
            // Set the time input value (we'll handle this in the component)
            setEmailConfigStatus(data.emailUser ? 'connected' : 'not_connected');

            // Set automationEnabled from database
            if (data.automationEnabled !== undefined) {
              setAutomationEnabled(data.automationEnabled);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching email settings:', error);
      }
    };

    // Save email settings
    const handleSaveEmailSettings = async () => {
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/email-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailSettings),
        });

        if (response.ok) {
          showToast('Email settings saved successfully!');
          setEmailConfigStatus(emailSettings.emailUser ? 'connected' : 'not_connected');
        } else {
          const error = await response.json();
          showToast(error.error || 'Failed to save email settings', 'error');
        }
      } catch (error) {
        console.error('Error saving email settings:', error);
        showToast('Failed to save email settings', 'error');
      }
    };

    // Save all settings
    const [savingAllSettings, setSavingAllSettings] = useState(false);
    const handleSaveAllSettings = async () => {
      setSavingAllSettings(true);
      try {
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const errors = [];

        // Save email settings
        try {
          const emailResponse = await fetch(`${apiUrl}/api/email-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailSettings),
          });
          if (!emailResponse.ok) {
            const error = await emailResponse.json();
            errors.push(error.error || 'Failed to save email settings');
          } else {
            setEmailConfigStatus(emailSettings.emailUser ? 'connected' : 'not_connected');
          }
        } catch (error) {
          errors.push('Failed to save email settings');
        }

        // Save reminder rules
        try {
          for (const rule of reminderRules) {
            await updateReminderRule(rule.id, rule);
          }
        } catch (error) {
          errors.push('Failed to save reminder rules');
        }

        // Save payment methods
        try {
          for (const method of paymentMethods) {
            await updatePaymentMethod(method.id, method);
          }
        } catch (error) {
          errors.push('Failed to save payment methods');
        }

        // Save organization info
        try {
          await updateOrganizationInfo(orgForm);
        } catch (error) {
          errors.push('Failed to save organization info');
        }

        if (errors.length > 0) {
          showToast(`Some settings failed to save: ${errors.join(', ')}`, 'error');
        } else {
          showToast('All settings saved successfully!', 'success');
        }
      } catch (error) {
        console.error('Error saving all settings:', error);
        showToast('Failed to save all settings', 'error');
      } finally {
        setSavingAllSettings(false);
      }
    };

    // Fetch email template from server
    const fetchEmailTemplate = async () => {
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/email-settings/template`);
        if (response.ok) {
          const data = await response.json();
          if (data && (data.subject || data.htmlTemplate)) {
            const defaultTemplate = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1a1a1a; border-bottom: none; padding-bottom: 10px;">
      Payment Reminder - Outstanding Balance
    </h2>
    <p>Dear {{member_name}},</p>
    <p>This is a friendly reminder about your outstanding subscription payments.</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Member ID:</strong> {{member_id}}</p>
      <p><strong>Email:</strong> {{member_email}}</p>
      <p><strong>Total Outstanding:</strong> <span style="color: #ef4444; font-size: 18px; font-weight: bold;">\${{total_due}}</span></p>
    </div>
                              <h3 style="color: #1a1a1a;">Outstanding Invoices ({{invoice_count}}):</h3>
    <ul style="list-style: none; padding: 0;">
      {{invoice_list}}
    </ul>
    <div style="background: #f8f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>💳 Payment Methods Available:</strong></p>
      <ul>
        {{payment_methods}}
      </ul>
    </div>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{portal_link}}" style="background: #5a31ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Access Member Portal
      </a>
    </p>
    <p>Please settle your outstanding balance at your earliest convenience.</p>
    <p>Best regards,<br><strong>Finance Team</strong><br>Subscription Manager HK</p>
  </div>`;
            setEmailTemplate({
              subject: data.subject || "Payment Reminder - Outstanding Balance",
              htmlTemplate: data.htmlTemplate || defaultTemplate,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching email template:', error);
        // Don't block rendering if template fetch fails
      }
    };

    // Preview email template
    const handlePreviewTemplate = () => {
      setShowTemplatePreview(true);
    };

    // Process template with sample data for preview
    const getPreviewTemplate = () => {
      if (!emailTemplate.htmlTemplate) return "";

      return emailTemplate.htmlTemplate
        .replace(/\{\{member_name\}\}/g, "John Doe")
        .replace(/\{\{member_id\}\}/g, "MEMBER001")
        .replace(/\{\{member_email\}\}/g, "john.doe@example.com")
        .replace(/\{\{total_due\}\}/g, "HK$250.00")
        .replace(/\{\{invoice_count\}\}/g, "3")
        .replace(/\{\{invoice_list\}\}/g, `
          <li style="margin-bottom: 10px;">
            <strong>January 2025</strong>: HK$100.00 
            <span style="color: #666;">(Due: 15 Jan 2025)</span> - 
            <strong style="color: #ef4444">Overdue</strong>
          </li>
          <li style="margin-bottom: 10px;">
            <strong>February 2025</strong>: HK$100.00 
            <span style="color: #666;">(Due: 15 Feb 2025)</span> - 
            <strong style="color: #ef4444">Unpaid</strong>
          </li>
          <li style="margin-bottom: 10px;">
            <strong>March 2025</strong>: HK$50.00 
            <span style="color: #666;">(Due: 15 Mar 2025)</span> - 
            <strong style="color: #ef4444">Unpaid</strong>
          </li>
        `)
        .replace(/\{\{payment_methods\}\}/g, `
          <li>FPS: ID 1234567</li>
          <li>PayMe: Scan QR code in portal</li>
          <li>Bank Transfer: HSBC 123-456789-001</li>
        `)
        .replace(/\{\{portal_link\}\}/g, `${window.location.origin}/member`);
    };

    // Save email template
    const handleSaveEmailTemplate = async () => {
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/email-settings/template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailTemplate),
        });

        if (response.ok) {
          showToast('Email template saved successfully!');
        } else {
          const error = await response.json();
          showToast(error.error || 'Failed to save email template', 'error');
        }
      } catch (error) {
        console.error('Error saving email template:', error);
        showToast('Failed to save email template', 'error');
      }
    };

    // Test email configuration
    const handleTestEmail = async () => {
      if (!emailSettings.emailUser || !emailSettings.emailPassword) {
        showToast('Please configure email credentials first', 'error');
        return;
      }

      setTestingEmail(true);
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/email-settings/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailService: emailSettings.emailService,
            emailUser: emailSettings.emailUser,
            emailPassword: emailSettings.emailPassword,
            testEmail: emailSettings.emailUser, // Send test to the configured email
          }),
        });

        if (response.ok) {
          showToast('Test email sent successfully! Check your inbox.');
        } else {
          const error = await response.json();
          showToast(error.error || 'Failed to send test email', 'error');
        }
      } catch (error) {
        console.error('Error testing email:', error);
        showToast('Failed to send test email', 'error');
      } finally {
        setTestingEmail(false);
      }
    };

    // Send manual reminder email to a specific member
    const handleSendManualReminder = async (memberId) => {
      if (!emailSettings.emailUser || !emailSettings.emailPassword) {
        showToast('Please configure email credentials first', 'error');
        return;
      }

      setSendingEmails(prev => ({ ...prev, [memberId]: true }));
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/reminders/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: memberId,
            sendToAll: false
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const member = members.find(m => m.id === memberId);
          
          // Refresh reminder logs to show the new entry
          fetchReminderLogs();
          
          // Log to communication
          const comm = {
            channel: "Email",
            type: "Manual Reminder",
            memberId: memberId,
            memberEmail: member?.email || "",
            memberName: member?.name || "",
            message: `Reminder email sent to ${member?.name || 'member'}`,
            status: "Delivered",
          };
          addCommunication(comm);
          showToast(`Reminder email sent to ${member?.name || 'member'}!`);
        } else {
          showToast(data.error || 'Failed to send reminder email', 'error');
        }
      } catch (error) {
        console.error('Error sending reminder:', error);
        showToast('Failed to send reminder email', 'error');
      } finally {
        setSendingEmails(prev => ({ ...prev, [memberId]: false }));
      }
    };

    // Helper function to calculate member balance based on unpaid invoices
    const calculateMemberBalance = (memberId) => {
      const memberInvoices = invoices.filter(inv =>
        inv.memberId === memberId ||
        (inv.memberEmail && members.find(m => m.id === memberId)?.email?.toLowerCase() === inv.memberEmail.toLowerCase()) ||
        (inv.memberName && members.find(m => m.id === memberId)?.name?.toLowerCase() === inv.memberName.toLowerCase())
      );

      // Use effective invoice status (considering completed payments)
      const unpaidInvoices = memberInvoices.filter(inv => {
        const effectiveStatus = getEffectiveInvoiceStatus(inv);
        return effectiveStatus === "Unpaid" || effectiveStatus === "Overdue";
      });

      const totalOutstanding = unpaidInvoices.reduce((sum, inv) => {
        const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, '') || 0);
        return sum + amount;
      }, 0);

      return totalOutstanding;
    };

    // Payment Approval Functions
    const handleApprovePayment = async (paymentId) => {
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const adminId = sessionStorage.getItem('adminId') || sessionStorage.getItem('adminName') || 'Admin';

        const response = await fetch(`${apiUrl}/api/payments/${paymentId}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, adminName: sessionStorage.getItem('adminName') || 'Admin' }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to approve payment');
        }

        await fetchPayments(); // Refresh payments
        await fetchInvoices(); // Refresh invoices

        // Update member balance after payment approval
        const payment = paymentHistory.find(p => p.id === paymentId) || payments.find(p => p.id === paymentId);
        if (payment && payment.memberId) {
          const newBalance = calculateMemberBalance(payment.memberId);
          const balanceText = newBalance > 0 ? `${formatCurrency(newBalance)} Outstanding` : formatCurrency(0);

          try {
            await updateMember(payment.memberId, { balance: balanceText });
          } catch (error) {
            console.error('Error updating member balance:', error);
          }
        }

        showToast("Payment approved successfully!");
      } catch (error) {
        console.error('Error approving payment:', error);
        showToast(error.message || "Failed to approve payment", "error");
      }
    };

    const handleRejectPayment = async (paymentId) => {
      try {
        const reason = window.prompt("Enter rejection reason (optional):") || "";
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const adminId = sessionStorage.getItem('adminId') || sessionStorage.getItem('adminName') || 'Admin';

        const response = await fetch(`${apiUrl}/api/payments/${paymentId}/reject`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, adminName: sessionStorage.getItem('adminName') || 'Admin', reason }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to reject payment');
        }

        await fetchPayments(); // Refresh payments
        await fetchInvoices(); // Refresh invoices
        showToast("Payment rejected successfully!");
      } catch (error) {
        console.error('Error rejecting payment:', error);
        showToast(error.message || "Failed to reject payment", "error");
      }
    };

    // Progressive validation for payment form
    const validatePaymentForm = () => {
      // Define field order for validation
      const fieldOrder = ["memberId", "amount", "method", "screenshot"];

      // If we have a current invalid field, check if it's now valid
      if (currentInvalidPaymentField) {
        let isValid = true;
        let errorMsg = "";

        if (currentInvalidPaymentField === "memberId" && !paymentForm.memberId) {
          isValid = false;
          errorMsg = "Member is required";
        } else if (currentInvalidPaymentField === "amount" && (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0)) {
          isValid = false;
          errorMsg = "Amount must be a positive number";
        } else if (currentInvalidPaymentField === "method" && !paymentForm.method) {
          isValid = false;
          errorMsg = "Payment method is required";
        } else if (currentInvalidPaymentField === "screenshot" && paymentForm.method === "Cash" && !paymentForm.screenshot) {
          isValid = false;
          errorMsg = "Screenshot upload is required for Cash payments";
        }

        if (isValid) {
          setPaymentFieldErrors(prev => ({ ...prev, [currentInvalidPaymentField]: false }));
          setCurrentInvalidPaymentField(null);
        } else {
          setPaymentFieldErrors(prev => ({ ...prev, [currentInvalidPaymentField]: true }));
          showToast(errorMsg, "error");
          return false;
        }
      }

      // Find first invalid field
      for (const field of fieldOrder) {
        let isValid = true;
        let errorMsg = "";

        if (field === "memberId" && !paymentForm.memberId) {
          isValid = false;
          errorMsg = "Member is required";
        } else if (field === "amount" && (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0)) {
          isValid = false;
          errorMsg = "Amount must be a positive number";
        } else if (field === "method" && !paymentForm.method) {
          isValid = false;
          errorMsg = "Payment method is required";
        } else if (field === "screenshot" && paymentForm.method === "Cash" && !paymentForm.screenshot) {
          isValid = false;
          errorMsg = "Screenshot upload is required for Cash payments";
        }

        if (!isValid) {
          // Clear all errors first
          setPaymentFieldErrors({
            memberId: false,
            amount: false,
            method: false,
            screenshot: false,
          });
          // Set only this field as invalid
          setPaymentFieldErrors(prev => ({ ...prev, [field]: true }));
          setCurrentInvalidPaymentField(field);
          showToast(errorMsg, "error");
          return false;
        }
      }

      // All fields valid
      setPaymentFieldErrors({
        memberId: false,
        amount: false,
        method: false,
        screenshot: false,
      });
      setCurrentInvalidPaymentField(null);
      return true;
    };

    // Payment CRUD handlers
    const handleAddPayment = async (e) => {
      e.preventDefault();

      if (!validatePaymentForm()) {
        // Validation error already shown via Notie
        return;
      }

      try {

        await addPayment(paymentForm);
        showToast("Payment added successfully!");
        setShowPaymentForm(false);
        setPaymentForm({
          memberId: "",
          member: "",
          invoiceId: "",
          amount: "",
          method: "",
          reference: "",
          date: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }),
          status: "Pending",
          screenshot: "",
          notes: "",
        });
        await fetchPayments();
      } catch (error) {
        console.error('Error adding payment:', error);
        showToast(error.message || "Failed to add payment", "error");
      }
    };

    const handleEditPayment = (payment) => {
      setEditingPayment(payment);
      setPaymentForm({
        memberId: payment.memberId || "",
        member: payment.member || "",
        invoiceId: payment.invoiceId || "",
        amount: payment.amount || "",
        method: payment.method || "",
        reference: payment.reference || "",
        date: payment.date || payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }) : new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }),
        status: payment.status || "Pending",
        screenshot: payment.screenshot || "",
        notes: payment.notes || "",
      });
      setShowPaymentForm(true);
    };

    const handleUpdatePayment = async (e) => {
      e.preventDefault();
      try {
        if (!paymentForm.memberId || !paymentForm.amount) {
          showToast("Please fill all required fields", "error");
          return;
        }

        // Validate screenshot for Cash payments
        if (paymentForm.method === "Cash" && !paymentForm.screenshot) {
          showToast("Screenshot upload is required for Cash payments", "error");
          return;
        }

        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const paymentId = editingPayment._id || editingPayment.id;

        const response = await fetch(`${apiUrl}/api/payments/${paymentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentForm),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update payment');
        }

        showToast("Payment updated successfully!");
        setShowPaymentForm(false);
        setEditingPayment(null);
        setPaymentForm({
          memberId: "",
          member: "",
          invoiceId: "",
          amount: "",
          method: "",
          reference: "",
          date: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }),
          status: "Pending",
          screenshot: "",
          notes: "",
        });
        await fetchPayments();
        await fetchInvoices();
      } catch (error) {
        console.error('Error updating payment:', error);
        showToast(error.message || "Failed to update payment", "error");
      }
    };

    const handleDeletePayment = async (paymentId) => {
      showConfirmation(
        "Are you sure you want to delete this payment? This action cannot be undone.",
        async () => {
          try {
            // In development, use empty string to use Vite proxy (localhost:4000)
            // In production, use VITE_API_URL if set
            const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

            const response = await fetch(`${apiUrl}/api/payments/${paymentId}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || 'Failed to delete payment');
            }

            showToast("Payment deleted successfully!");
            await fetchPayments();
            await fetchInvoices();
          } catch (error) {
            console.error('Error deleting payment:', error);
            showToast(error.message || "Failed to delete payment", "error");
          }
        }
      );
    };

    // Send reminder to all outstanding members
    const handleSendToAllOutstanding = async () => {
      if (!isAdminOrOwner) {
        showToast("Only Owner and Finance Admin can send bulk reminders", "error");
        return;
      }
      if (!emailSettings.emailUser || !emailSettings.emailPassword) {
        showToast('Please configure email credentials first', 'error');
        return;
      }

      // Confirmation is handled in handleSendReminderWithChannel before calling this
      setSendingToAll(true);
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/reminders/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sendToAll: true
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // Refresh reminder logs to show the new entries
          fetchReminderLogs();
          showToast(data.message || 'Reminder emails sent successfully!');
        } else {
          showToast(data.error || 'Failed to send reminder emails', 'error');
        }
      } catch (error) {
        console.error('Error sending reminders:', error);
        showToast('Failed to send reminder emails', 'error');
      } finally {
        setSendingToAll(false);
      }
    };

    // Send WhatsApp reminder to all outstanding members
    const handleSendWhatsAppToAllOutstanding = async () => {
      if (!isAdminOrOwner) {
        showToast("Only Owner and Finance Admin can send bulk reminders", "error");
        return;
      }
      const outstandingMembers = members.filter(member => {
        // Check member balance field instead of invoices
        if (!member.balance || !member.phone) return false;

        // Parse balance - handles formats like: "$250 Outstanding", "$250", "$0", "$250 Overdue"
        const balanceStr = member.balance.toString();
        const numericValue = parseFloat(balanceStr.replace(/[^0-9.]/g, '') || 0);

        // Member is outstanding if balance > 0
        return numericValue > 0;
      });

      if (outstandingMembers.length === 0) {
        showToast('No outstanding members with phone numbers found', 'error');
        return;
      }

      // Confirmation is now handled in handleSendReminderWithChannel
      setSendingWhatsAppToAll(true);

      try {
        // Open WhatsApp for each member with a small delay to avoid browser blocking
        for (let i = 0; i < outstandingMembers.length; i++) {
          const member = outstandingMembers[i];

          // Get member's unpaid/overdue invoices
          const memberUnpaidInvoices = invoices.filter(
            (inv) =>
              inv.memberId === member.id &&
              (inv.status === "Unpaid" || inv.status === "Overdue")
          );

          // Calculate total due
          const totalDue = memberUnpaidInvoices.reduce((sum, inv) => {
            if (!inv.amount) return sum;
            // Remove all currency symbols (HK$, $) and commas, then parse
            const amountStr = String(inv.amount).replace(/HK\$|\$|,/g, '').trim();
            const amount = parseFloat(amountStr) || 0;
            return sum + amount;
          }, 0);

          // Create invoice list for WhatsApp
          const invoiceList = memberUnpaidInvoices
            .map(
              (inv, index) =>
                `${index + 1}. *${inv.period}*: ${inv.amount} (Due: ${inv.due}) - _${inv.status}_`
            )
            .join("\n");

          // Create WhatsApp-friendly message (English only)
          const message = `Hi *${member.name}* 👋

  Payment Reminder

  *Total Outstanding:* ${formatCurrency(totalDue)}

  *Invoices (${memberUnpaidInvoices.length}):*
  ${invoiceList}

  *Payment Options:*
  • FPS: ID 1234567
  • PayMe: Scan QR in portal
  • Bank Transfer: HSBC 123-456789-001

  *Pay Online:*
  ${window.location.origin}/member

  Please settle your balance at your earliest convenience.

  Thank you! 🙏

  _Finance Team_
  Subscription Manager HK`;

          // Clean phone number
          const cleanPhone = member.phone.replace(/[^0-9+]/g, "");

          // WhatsApp Click-to-Chat URL
          const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

          // Open WhatsApp with delay between each
          setTimeout(() => {
            window.open(whatsappUrl, '_blank');

            // Log to communication with member metadata
            const comm = {
              channel: "WhatsApp",
              type: "Bulk Outstanding Reminder",
              memberId: member.id,
              memberEmail: member.email,
              memberName: member.name,
              message: `WhatsApp reminder sent to ${member.name} (${member.phone}) - $${totalDue} due (${memberUnpaidInvoices.length} invoice${memberUnpaidInvoices.length > 1 ? "s" : ""})`,
              status: "Delivered",
            };
            addCommunication(comm);
          }, i * 1000); // 1 second delay between each
        }

        showToast(`✓ Opening WhatsApp for ${outstandingMembers.length} members. Please review and send each message.`);
      } catch (error) {
        console.error('Error sending WhatsApp reminders:', error);
        showToast('Failed to open WhatsApp', 'error');
      } finally {
        setSendingWhatsAppToAll(false);
      }
    };

    // Email sending is now handled via nodemailer API endpoint

    // Fetch donations when donations section becomes active
    useEffect(() => {
      if (activeSection === "donations") {
        fetchDonations();
      }
      // We intentionally only depend on activeSection here.
      // fetchDonations comes from context and its identity can change on re-renders,
      // which would cause this effect to run repeatedly and refetch endlessly.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection]);

    // Reset pagination when filters change
    useEffect(() => {
      setMembersPage(1);
    }, [memberSearchTerm]);

    useEffect(() => {
      setPaymentsPage(1);
    }, [paymentStatusFilter]);

    // Reset pagination when switching sections
    useEffect(() => {
      if (activeSection === "members") {
        setMembersPage(1);
      } else if (activeSection === "payment-approvals") {
        setPaymentsPage(1);
      } else if (activeSection === "donations") {
        setDonationsPage(1);
      } else if (activeSection === "reports") {
        setTransactionsPage(1);
      }
    }, [activeSection]);

    // Reset transactions pagination when search or filters change
    useEffect(() => {
      setTransactionsPage(1);
    }, [transactionsSearch, reportFilter, donorTypeFilter]);

    // Handle pagination bounds checking for members
    useEffect(() => {
      const filteredMembers = members.filter(member =>
        !memberSearchTerm ||
        member.name?.toLowerCase().includes(memberSearchTerm.toLowerCase())
      );
      const totalPages = Math.ceil(filteredMembers.length / membersPageSize);
      if (membersPage > totalPages && totalPages > 0) {
        setMembersPage(1);
      }
    }, [members, memberSearchTerm, membersPageSize, membersPage]);

    // Handle pagination bounds checking for payments
    useEffect(() => {
      const filteredPayments = (payments || []).filter(payment => {
        if (paymentStatusFilter === "All") return true;
        return payment.status === paymentStatusFilter;
      });
      const totalPages = Math.ceil(filteredPayments.length / paymentsPageSize);
      if (paymentsPage > totalPages && totalPages > 0) {
        setPaymentsPage(1);
      }
    }, [payments, paymentStatusFilter, paymentsPageSize, paymentsPage]);

    // Handle pagination bounds checking for donations
    useEffect(() => {
      const donationsArray = Array.isArray(donations) ? donations : [];
      const filteredDonations = donationsArray.filter(donation => donation !== null);
      const totalPages = Math.ceil(filteredDonations.length / donationsPageSize);
      if (donationsPage > totalPages && totalPages > 0) {
        setDonationsPage(1);
      }
    }, [donations, donationsPageSize, donationsPage]);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
      if (isMobileMenuOpen) {
        document.body.classList.add('menu-open');
      } else {
        document.body.classList.remove('menu-open');
      }
      return () => {
        document.body.classList.remove('menu-open');
      };
    }, [isMobileMenuOpen]);

    useEffect(() => {
      fetchEmailSettings().catch(err => {
        console.error('Failed to fetch email settings:', err);
        // Don't block rendering if email settings fail to load
      });
      fetchEmailTemplate().catch(err => {
        console.error('Failed to fetch email template:', err);
      });
    }, []);

    // Generate breadcrumb path for current section
    const getBreadcrumbPath = (sectionId) => {
      if (sectionId === "dashboard") {
        return [{ id: "dashboard", label: "Dashboard" }];
      }

      // Find the section in navigation groups and include parent group
      for (const group of navigationGroups) {
        const item = group.items.find(item => item.id === sectionId);
        if (item) {
          return [
            { id: "dashboard", label: "Dashboard" },
            { id: group.id, label: group.label },
            { id: sectionId, label: item.label }
          ];
        }
      }

      // Fallback: just show the section label if found in sections
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        return [
          { id: "dashboard", label: "Dashboard" },
          { id: sectionId, label: section.label }
        ];
      }

      return [{ id: "dashboard", label: "Dashboard" }];
    };

    // Render breadcrumb component with tab-like navigation
    const renderBreadcrumb = (sectionId) => {
      const breadcrumbPath = getBreadcrumbPath(sectionId);

      // Get parent group for tab navigation
      const parentGroup = navigationGroups.find(group =>
        group.items.some(item => item.id === sectionId)
      );

      return (
        <div className="admin-breadcrumb-tabs-container">
          {/* Breadcrumb path - only show if not dashboard */}
          {breadcrumbPath.length > 1 && (
            <div className="admin-breadcrumb-container admin-breadcrumb-container--small">
              {breadcrumbPath.map((item, index) => (
                <span key={item.id}>
                  {index > 0 && <span className="admin-breadcrumb-separator"> &gt; </span>}
                  {index === breadcrumbPath.length - 1 ? (
                    <span className="admin-breadcrumb-current">{item.label}</span>
                  ) : index === 0 ? (
                    <span
                      onClick={() => handleNavClick(item.id)}
                      className="admin-breadcrumb-link--inline admin-breadcrumb-link--no-click"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <span className="admin-breadcrumb-current">
                      {item.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Tab navigation for sibling sections in the same group */}
          {parentGroup && parentGroup.items.length > 1 && (
            <div className="admin-breadcrumb-tabs">
              {parentGroup.items.map((item) => (
                <button
                  key={item.id}
                  className={`admin-breadcrumb-tab ${sectionId === item.id ? "admin-breadcrumb-tab--active" : ""}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    };

    const handleNavClick = (id) => {
      console.log('Navigating to section:', id);
      setActiveSection(id);
      setShowMemberForm(false);
      setShowInvoiceForm(false);
      setShowDonationForm(false);
      // Close mobile menu when navigating
      setIsMobileMenuOpen(false);

      // Auto-expand the parent group if clicking a nested item (maintain accordion behavior)
      const parentGroup = navigationGroups.find(group =>
        group.items.some(item => item.id === id)
      );
      if (parentGroup && !expandedGroups[parentGroup.id]) {
        setExpandedGroups(prev => {
          // Close all other groups and open only this one (accordion behavior)
          const newState = {};
          navigationGroups.forEach(g => {
            newState[g.id] = g.id === parentGroup.id;
          });
          return newState;
        });
      }
    };

    const handleLogout = () => {
      showToast("You have been logged out", "success");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 500);
    };

    // Handle password reset request
    const handlePasswordReset = async (requestId, newPassword) => {
      try {
        const apiUrl = import.meta.env.DEV
          ? ""
          : import.meta.env.VITE_API_URL || "";
        const currentAdminEmail = sessionStorage.getItem("adminEmail") || "Owner";

        const response = await fetch(`${apiUrl}/api/auth/password-reset-requests/${requestId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newPassword,
            handledBy: currentAdminEmail,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          showToast(data.message || "Password updated and email sent successfully");
          // Close modal and reset form
          setShowPasswordResetModal(false);
          setSelectedPasswordResetRequest(null);
          setPasswordResetForm({ newPassword: "" });
          // Refresh password reset requests
          fetchPasswordResetRequests();
        } else {
          showToast(data.error || "Failed to update password", "error");
        }
      } catch (error) {
        console.error("Error updating password:", error);
        showToast("Failed to update password", "error");
      }
    };

    const showToast = (message, type = "success") => {
      setNotieMessage(message);
      setNotieType(type);
      setTimeout(() => setNotieMessage(null), 1000);
    };

    // Show confirmation dialog
    const showConfirmation = (message, onConfirm, onCancel = null, confirmButtonText = "Confirm") => {
      setConfirmationDialog({
        isOpen: true,
        message,
        confirmButtonText,
        onConfirm: () => {
          setConfirmationDialog({ isOpen: false, message: "", onConfirm: null, onCancel: null, confirmButtonText: "Confirm" });
          if (onConfirm) onConfirm();
        },
        onCancel: () => {
          setConfirmationDialog({ isOpen: false, message: "", onConfirm: null, onCancel: null, confirmButtonText: "Confirm" });
          if (onCancel) onCancel();
        },
      });
    };

    // Handle CSV/Excel import for members - shows preview first
    const handleImportMembers = async (file) => {
      try {
        const fileName = file.name.toLowerCase();
        const isCSV = fileName.endsWith('.csv');
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

        if (!isCSV && !isExcel) {
          showToast("Please select a CSV or Excel file (.csv, .xlsx, .xls)", "error");
          return;
        }

        // showToast("Processing file...", "success");

        // Send file to server for parsing (handles both CSV and Excel)
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${apiUrl}/api/members/import`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to parse file');
        }

        const result = await response.json();
        const membersData = result.members || [];
        const errors = result.errors || [];

        if (membersData.length === 0 && errors.length === 0) {
          showToast("No valid member data found in file", "error");
          return;
        }

        // Show preview popup instead of direct import
        setImportPreviewData(membersData);
        setImportErrors(errors);
        setImportFileName(file.name);
        setShowImportPreview(true);
      } catch (error) {
        console.error("File import error:", error);
        showToast(error.message || "Failed to import file. Please check the file format.", "error");
      }
    };

    // Confirm import from preview
    const handleConfirmImport = async () => {
      if (importPreviewData.length === 0) {
        showToast("No data to import", "error");
        return;
      }

      setIsImporting(true);
      try {
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        showToast(`Importing ${importPreviewData.length} members...`, "success");

        // Add members one by one
        for (const memberData of importPreviewData) {
          try {
            await addMember(memberData);
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push(`${memberData.name || memberData.email}: ${error.message || 'Failed'}`);
            console.error(`Failed to add member ${memberData.name}:`, error);
          }
        }

        // Refresh members list and related data
        await Promise.all([
          fetchMembers(),
          fetchInvoices(),
          fetchPayments(),
        ]);

        // Close preview
        setShowImportPreview(false);
        setImportPreviewData([]);
        setImportErrors([]);
        setImportFileName("");

        if (errorCount > 0) {
          showToast(
            `Import completed: ${successCount} added, ${errorCount} failed. Check console for details.`,
            "error"
          );
          console.error("Import errors:", errors);
        } else {
          showToast(`Successfully imported ${successCount} member(s)!`, "success");
        }
      } catch (error) {
        console.error("Import error:", error);
        showToast("Error during import. Please try again.", "error");
      } finally {
        setIsImporting(false);
      }
    };

    // Member CRUD Operations
    const handleAddMember = async (e) => {
      e.preventDefault();

      if (!validateMemberForm()) {
        // Validation error already shown via Notie in validateMemberForm
        return;
      }

      try {
        setIsMemberSubmitting(true);

        const newMember = await addMember(memberForm);



        // Refresh all related data to ensure complete member details are available
        // This ensures invoices, payments, and all member data is up-to-date
        await Promise.all([
          fetchMembers(), // Refresh members list - this will update the members state
          fetchInvoices(), // Refresh invoices (new member might have invoice created)
          fetchPayments(), // Refresh payments
        ]);

        setMemberForm({
          name: "",
          email: "",
          phone: "",
          native: "",
          status: "Active",
          balance: "250",
          nextDue: getTodayDate(), // Reset to today's date
          subscriptionYear: new Date().getFullYear().toString(),
          lastPayment: "",
          subscriptionType: "Lifetime",
        });
        // Clear validation state
        setMemberFieldErrors({
          name: false,
          email: false,
          phone: false,
          nextDue: false,
          lastPayment: false,
        });
        setCurrentInvalidField(null);
        setShowMemberForm(false);
        showToast("Member added successfully!", "success");
      } catch (error) {
        console.error("Failed to add member:", error);
        showToast("Failed to add member. Please try again.", "error");
      } finally {
        setIsMemberSubmitting(false);
      }
    };

    const handleEditMember = (member) => {
      // Clear validation state when opening edit form
      setMemberFieldErrors({
        name: false,
        email: false,
        phone: false,
        nextDue: false,
        lastPayment: false,
      });
      setCurrentInvalidField(null);
      setEditingMember(member);
      // Show only existing member data - use actual values from member object
      // Do NOT include subscription details in Edit Member popup
      setMemberForm({
        name: member.name || "",
        email: member.email || "",
        phone: member.phone || "",
        native: member.native || "",
        status: member.status || "Active",
        // Do not set subscriptionType, balance, nextDue, or lastPayment for editing - these are subscription details
      });
      setShowMemberForm(true);
    };

    const handleUpdateMember = async (e) => {
      e.preventDefault();

      if (!validateMemberForm()) {
        // Validation error already shown via Notie in validateMemberForm
        return;
      }

      try {
        if (!editingMember) {
          showToast("No member selected for editing.", "error");
          return;
        }

        // Only include fields that have actually changed
        const updateData = {};
        const originalMember = editingMember;

        // Compare each field and only include if changed
        if (memberForm.name !== (originalMember.name || "")) {
          updateData.name = memberForm.name;
        }
        if (memberForm.email !== (originalMember.email || "")) {
          updateData.email = memberForm.email;
        }
        if (memberForm.phone !== (originalMember.phone || "")) {
          updateData.phone = memberForm.phone;
        }
        if (memberForm.native !== (originalMember.native || "")) {
          updateData.native = memberForm.native;
        }
        if (memberForm.status !== (originalMember.status || "Active")) {
          updateData.status = memberForm.status;
        }
        // Do not update nextDue, lastPayment, subscriptionType, or balance in Edit Member - these are subscription details

        // Only include password in update if it's provided
        if (memberForm.password && memberForm.password.trim() !== "") {
          updateData.password = memberForm.password;
        }

        // Only send update if there are actual changes
        if (Object.keys(updateData).length === 0) {
          showToast("No changes to update.", "error");
          return;
        }

        await updateMember(editingMember.id, updateData);
        setEditingMember(null);
        setMemberForm({
          name: "",
          email: "",
          phone: "",
          native: "",
          password: "",
          status: "Active",
          balance: "HK$0",
          nextDue: "",
          lastPayment: "",
          subscriptionType: "Lifetime",
        });
        // Clear validation state
        setMemberFieldErrors({
          name: false,
          email: false,
          phone: false,
          nextDue: false,
          lastPayment: false,
        });
        setCurrentInvalidField(null);
        setShowMemberForm(false);
        showToast("Member updated successfully!");
      } catch (error) {
        showToast("Failed to update member. Please try again.", "error");
      }
    };

    const handleDeleteMember = async (id) => {
      showConfirmation(
        "Are you sure you want to delete this member?",
        async () => {
          try {
            await deleteMember(id);
            showToast("Member deleted successfully!");
          } catch (error) {
            showToast("Failed to delete member. Please try again.", "error");
          }
        }
      );
    };

    // Invoice CRUD Operations
    const handleAddInvoice = (e) => {
      e.preventDefault();
      if (!invoiceForm.memberId || !invoiceForm.subscriptionYear) {
        showToast("Please fill all required fields", "error");
        return;
      }

      const amountNum = parseFloat(invoiceForm.amount);
      if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
        showToast("Amount must be a positive number", "error");
        return;
      }

      const member = members.find((m) => m.id === invoiceForm.memberId);

      // Generate period from subscription year and invoice type
      const subscriptionYear = invoiceForm.subscriptionYear;
      const period = subscriptionYear; // Use subscription year as period

      // Check if an invoice for the same period already exists for this member
      const existingInvoice = invoices.find(
        (inv) => inv.memberId === invoiceForm.memberId &&
          inv.period === period &&
          inv.status !== "Rejected"
      );

      if (existingInvoice) {
        showToast(`An invoice for "${period}" already exists for ${member?.name || 'this member'}`, "error");
        return;
      }

      // Calculate due date: 1 year from subscription year (Jan 1st of next year)
      const dueYear = parseInt(subscriptionYear) + 1;
      const dueDate = new Date(dueYear, 0, 1); // Jan 1st of next year
      const dueDateFormatted = dueDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace(',', '');

      const newInvoice = {
        id: generateInvoiceId(),
        memberId: invoiceForm.memberId,
        memberName: member?.name || "",
        period: period,
        amount: formatCurrency(amountNum),
        status: "Unpaid",
        due: dueDateFormatted,
        method: "-",
        reference: "-",
        notes: "",
      };

      addInvoice(newInvoice);

      // Store the created invoice and show success card
      setLastCreatedInvoice({ ...newInvoice, member });
      setShowInvoiceSuccessCard(true);

      setInvoiceForm({
        memberId: "",
        period: getCurrentPeriod(),
        amount: "250",
        invoiceType: "Lifetime",
        due: "",
        notes: "",
        subscriptionYear: new Date().getFullYear().toString(),
      });
      setShowInvoiceForm(false);
      showToast("Invoice created successfully!");
    };

    const handleMarkAsPaid = async (invoiceId, method = "Cash", screenshotUrl = null, referenceNumber = null) => {
      try {
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (!invoice) {
          showToast("Invoice not found", "error");
          return;
        }

        // Don't allow marking already paid invoices
        if (invoice.status === "Paid") {
          showToast("Invoice is already marked as paid", "error");
          return;
        }

        const adminEmail = sessionStorage.getItem('adminEmail');
        const currentAdmin = admins.find(a => a.email === adminEmail);
        const adminId = sessionStorage.getItem('adminId') || currentAdmin?.id || 'Admin';
        const adminName = sessionStorage.getItem('adminName') || currentAdmin?.name || 'Admin';

        // Map UI method to payment_mode (online or cash)
        const paymentMode = method === "Online" ? "online" : "cash";

        // Map UI method to stored payment method + reference
        let paymentMethod = "Cash to Admin";
        let reference;
        if (method === "Online") {
          paymentMethod = "Online Payment";
          // Use provided reference number or generate one
          reference = referenceNumber || `ONL_${Date.now()}`;
        } else {
          reference = `CASH_${Date.now()}`;
        }

        // Calculate payment dates
        const lastPaymentDate = new Date(); // Exact date/time of confirmation

        // Calculate next due year based on the invoice period if possible (e.g. "2025" or "Jan 2025 Yearly...")
        let nextDueYear = lastPaymentDate.getFullYear() + 1;
        const periodStr = String(invoice.period || "").trim();
        const yearMatch = periodStr.match(/\d{4}/);
        if (yearMatch) {
          nextDueYear = parseInt(yearMatch[0]) + 1;
        } else if (periodStr.toLowerCase().includes("yearly") || periodStr.toLowerCase().includes("lifetime")) {
          nextDueYear = lastPaymentDate.getFullYear() + 1;
        }

        const nextDueDate = new Date(nextDueYear, 0, 1); // Jan 1st of next year
        nextDueDate.setHours(0, 0, 0, 0); // Reset time to midnight for consistency

        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

        // Step 1: Create payment record with "Completed" status (matches backend approval flow)
        const paymentResponse = await fetch(`${apiUrl}/api/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoiceId,
            amount: invoice.amount,
            method: paymentMethod,
            reference: reference,
            member: invoice.memberName || "Member",
            memberId: invoice.memberId,
            memberEmail: invoice.memberEmail,
            period: invoice.period,
            status: "Completed", // Use "Completed" to match backend payment approval status
            date: new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            paidToAdmin: adminId,
            paidToAdminName: adminName,
            approvedBy: adminName,
            approvedAt: new Date().toISOString(),
            screenshot: screenshotUrl || invoice.screenshot || null,
          }),
        });

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create payment record');
        }

        const newPayment = await paymentResponse.json();

        // Step 2: Update invoice with payment confirmation fields
        await updateInvoice(invoiceId, {
          status: "Paid",
          method: paymentMethod,
          reference: reference,
          paidToAdmin: adminId,
          paidToAdminName: adminName,
          payment_mode: paymentMode,
          payment_proof: screenshotUrl || invoice.screenshot || null,
          last_payment_date: lastPaymentDate.toISOString(),
        });

        // Step 3: Update member with payment confirmation fields
        if (invoice.memberId) {
          // Format dates for display strings
          const lastPaymentDateFormatted = lastPaymentDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }).replace(',', '');

          const nextDueDateFormatted = nextDueDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }).replace(',', '');

          const memberUpdateResponse = await fetch(`${apiUrl}/api/members/${invoice.memberId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_status: 'paid',
              payment_mode: paymentMode,
              last_payment_date: lastPaymentDate.toISOString(),
              next_due_date: nextDueDate.toISOString(),
              payment_proof: screenshotUrl || invoice.screenshot || null,
              // Also update the display string fields
              lastPayment: lastPaymentDateFormatted,
              nextDue: nextDueDateFormatted,
            }),
          });

          if (!memberUpdateResponse.ok) {
            const errorData = await memberUpdateResponse.json().catch(() => ({ message: 'Failed to update member payment fields' }));
            console.error('Failed to update member payment fields:', errorData.message || memberUpdateResponse.statusText);
            // Continue anyway - invoice is already updated, but show warning
            showToast(`Payment processed, but member update failed: ${errorData.message || 'Unknown error'}`, "error");
          }
        }

        // Step 4: Send payment confirmation email with PDF receipt (optional - don't fail if email fails)
        try {
          const emailResponse = await fetch(`${apiUrl}/api/invoices/${invoiceId}/send-payment-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            if (emailData.success) {
              console.log('✅ Payment confirmation email sent:', emailData.message);
              showToast(`Payment confirmation email sent to ${invoice.memberEmail || 'member'}`, "success");
            } else if (emailData.warning) {
              // Email failed but payment was processed - show warning, not error
              console.warn('⚠️ Payment confirmation email not sent:', emailData.message);
              // Don't show toast for email warnings - payment was successful
            }
          } else {
            // Only log error, don't show to user - payment was successful
            const errorText = await emailResponse.text();
            console.error('❌ Failed to send payment confirmation email:', errorText);
            // Don't show error toast - payment process was successful
          }
        } catch (emailError) {
          // Only log error, don't show to user - payment was successful
          console.error('Error sending payment confirmation email:', emailError);
          // Don't fail the payment process if email fails
        }

        // Step 5: Refresh all data to get updated balances and dates
        await Promise.all([
          fetchInvoices(),
          fetchPayments(),
          fetchMembers(), // Refresh members to get updated balance, next_due_date, and last_payment_date
        ]);

        // Step 6: Update selectedMember if we're currently viewing this member's details
        if (invoice.memberId && selectedMember && selectedMember.id === invoice.memberId) {
          // Fetch the updated member directly to ensure we have the latest data
          const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
          try {
            const memberResponse = await fetch(`${apiUrl}/api/members`);
            if (memberResponse.ok) {
              const allMembers = await memberResponse.json();
              const updatedMember = allMembers.find(m => m.id === invoice.memberId);
              if (updatedMember) {
                setSelectedMember(updatedMember);
              }
            }
          } catch (error) {
            console.warn("Could not refresh selected member:", error);
            // Fallback: find from members state
            const updatedMember = members.find(m => m.id === invoice.memberId);
            if (updatedMember) {
              setSelectedMember(updatedMember);
            }
          }
        }

        // Step 7: Show success message
        if (invoice.memberId) {
          const updatedMember = members.find(m => m.id === invoice.memberId);
          if (updatedMember) {
            // Format dates for display
            const lastPaymentDateStr = updatedMember.last_payment_date
              ? new Date(updatedMember.last_payment_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
              : '-';
            const nextDueDateStr = updatedMember.next_due_date
              ? new Date(updatedMember.next_due_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
              : '-';
            showToast(`Invoice marked as paid (${paymentMethod})! Last payment: ${lastPaymentDateStr}, Next due: ${nextDueDateStr}`, "success");
          } else {
            showToast(`Invoice marked as paid (${paymentMethod})!`, "success");
          }
        } else {
          showToast(`Invoice marked as paid (${paymentMethod})!`, "success");
        }
      } catch (error) {
        console.error('Error marking invoice as paid:', error);
        showToast(error.message || "Failed to mark invoice as paid", "error");
      }
    };

    const handleDeleteInvoice = (id) => {
      const invoice = invoices.find((inv) => inv.id === id);
      if (!invoice) {
        showToast("Invoice not found", "error");
        return;
      }

      // Prevent deletion after payment (Paid/Completed)
      if (invoice.status === "Paid" || invoice.status === "Completed") {
        showToast("Paid invoices cannot be deleted", "error");
        return;
      }

      showConfirmation(
        "Are you sure you want to delete this invoice? This cannot be undone.",
        () => {
          deleteInvoice(id);
          showToast("Invoice deleted successfully!");
        }
      );
    };

    // WhatsApp Reminder (Click-to-Chat)
    const handleSendWhatsAppReminder = (memberData) => {
      if (!memberData) {
        showToast("No member selected", "error");
        return;
      }

      if (!memberData.phone) {
        showToast("This member has no phone number", "error");
        return;
      }

      // Set sending state
      setSendingWhatsApp(prev => ({ ...prev, [memberData.id]: true }));

      // Get member's unpaid/overdue invoices
      const memberUnpaidInvoices = invoices.filter(
        (inv) =>
          inv.memberId === memberData.id &&
          (inv.status === "Unpaid" || inv.status === "Overdue")
      );

      if (memberUnpaidInvoices.length === 0) {
        showToast("This member has no outstanding payments", "error");
        setSendingWhatsApp(prev => ({ ...prev, [memberData.id]: false }));
        return;
      }

      // Calculate total due
      const totalDue = memberUnpaidInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.amount.replace("$", ""));
      }, 0);

      // Create invoice list for WhatsApp
      const invoiceList = memberUnpaidInvoices
        .map(
          (inv, index) =>
            `${index + 1}. *${inv.period}*: ${inv.amount} (Due: ${inv.due}) - _${inv.status}_`
        )
        .join("\n");

      // Create WhatsApp-friendly message (English only)
      const message = `Hi *${memberData.name}* 👋

  Payment Reminder

  *Total Outstanding:* ${formatCurrency(totalDue)}

  *Invoices (${memberUnpaidInvoices.length}):*
  ${invoiceList}

  *Payment Options:*
  • FPS: ID 1234567
  • PayMe: Scan QR in portal
  • Bank Transfer: HSBC 123-456789-001

  *Pay Online:*
  ${window.location.origin}/member

  Please settle your balance at your earliest convenience.

  Thank you! 🙏

  _Finance Team_
  Subscription Manager HK`;

      // Clean phone number (remove all non-numeric except +)
      const cleanPhone = memberData.phone.replace(/[^0-9+]/g, "");

      // WhatsApp Click-to-Chat URL
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp
      window.open(whatsappUrl, '_blank');

      // Log to communication with member metadata
      const comm = {
        channel: "WhatsApp",
        type: "Manual Outstanding Reminder",
        memberId: memberData.id,
        memberEmail: memberData.email,
        memberName: memberData.name,
        message: `WhatsApp reminder sent to ${memberData.name} (${memberData.phone}) - $${totalDue} due (${memberUnpaidInvoices.length} invoice${memberUnpaidInvoices.length > 1 ? "s" : ""})`,
        status: "Delivered",
      };
      addCommunication(comm);

      showToast(`✓ WhatsApp opened for ${memberData.name}! Review and send the message.`);

      // Reset sending state after a short delay
      setTimeout(() => {
        setSendingWhatsApp(prev => ({ ...prev, [memberData.id]: false }));
      }, 2000);
    };

    // Email Reminder (using nodemailer via API)
    // Show channel selection before sending reminder
    const handleRequestReminder = (memberData, isBulk = false, memberId = null) => {
      // For bulk, don't open popup - channels are selected inline
      if (isBulk) {
        return; // Bulk sending is now handled inline with icon buttons
      }

      setPendingReminderAction({
        type: memberId ? 'manual' : 'single',
        memberData: memberData || null,
        memberId: memberId || null
      });
      setSelectedChannels([]); // Reset selected channels
      setShowChannelSelection(true);
    };

    // Handle channel selection (toggle for bulk, send immediately for single)
    const handleSelectChannel = (channel) => {
      if (pendingReminderAction?.type === 'bulk') {
        // For bulk, toggle channel selection
        setSelectedChannels(prev => {
          if (prev.includes(channel)) {
            return prev.filter(c => c !== channel);
          } else {
            return [...prev, channel];
          }
        });
      } else {
        // For single member, send immediately
        handleSendReminderWithChannel(channel);
      }
    };

    // Handle actual sending after channel selection (for bulk)
    const handleSendAllWithSelectedChannels = async () => {
      if (selectedChannels.length === 0) {
        showToast("Please select at least one channel", "error");
        return;
      }

      // Show confirmation for bulk send
      const confirmationMessage = selectedChannels.length === 2
        ? `Are you sure you want to send reminders via Email AND WhatsApp to ALL outstanding members?`
        : selectedChannels.includes('Email')
          ? 'Are you sure you want to send reminder emails to ALL outstanding members?'
          : `Are you sure you want to open WhatsApp for all outstanding members? This will open multiple WhatsApp windows.`;

      showConfirmation(
        confirmationMessage,
        async () => {
          try {
            // Send to all selected channels
            if (selectedChannels.includes('Email')) {
              await handleSendToAllOutstanding();
            }

            if (selectedChannels.includes('WhatsApp')) {
              // Add a small delay if both channels are selected
              if (selectedChannels.includes('Email')) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              await handleSendWhatsAppToAllOutstanding();
            }

            setSelectedChannels([]);
          } catch (error) {
            console.error("Error sending bulk reminders:", error);
          }
        }
      );
    };

    // Handle channel selection and send reminder (for single members)
    const handleSendReminderWithChannel = async (channel) => {
      setShowChannelSelection(false);

      if (pendingReminderAction?.memberData) {
        if (channel === 'Email') {
          await handleSendReminder(pendingReminderAction.memberData);
        } else if (channel === 'WhatsApp') {
          handleSendWhatsAppReminder(pendingReminderAction.memberData);
        }
      } else if (pendingReminderAction?.memberId) {
        // Handle manual reminder by memberId
        if (channel === 'Email') {
          await handleSendManualReminder(pendingReminderAction.memberId);
        } else if (channel === 'WhatsApp') {
          const member = members.find(m => m.id === pendingReminderAction.memberId);
          if (member) {
            handleSendWhatsAppReminder(member);
          }
        }
      }

      setPendingReminderAction(null);
      setSelectedChannels([]);
    };

    const handleSendReminder = async (memberData) => {
      if (!memberData) {
        showToast("No member selected", "error");
        return;
      }

      // Get member's unpaid/overdue invoices
      const memberUnpaidInvoices = invoices.filter(
        (inv) =>
          inv.memberId === memberData.id &&
          (inv.status === "Unpaid" || inv.status === "Overdue")
      );

      if (memberUnpaidInvoices.length === 0) {
        showToast("This member has no outstanding payments", "error");
        return;
      }

      // Calculate total due
      const totalDue = memberUnpaidInvoices.reduce((sum, inv) => {
        if (!inv.amount) return sum;
        // Remove all currency symbols (HK$, $) and commas, then parse
        const amountStr = String(inv.amount).replace(/HK\$|\$|,/g, '').trim();
        const amount = parseFloat(amountStr) || 0;
        return sum + amount;
      }, 0);

      // Create invoice list for email
      const invoiceListText = memberUnpaidInvoices
        .map(
          (inv) => {
            // Convert $ to HK$ in amount for display
            let formattedAmount = inv.amount || 'HK$0';
            formattedAmount = String(formattedAmount).trim();
            if (formattedAmount.includes('$') && !formattedAmount.includes('HK$')) {
              formattedAmount = formattedAmount.replace(/\$/g, 'HK$');
            } else if (!formattedAmount.startsWith('HK$') && !formattedAmount.startsWith('$')) {
              formattedAmount = `HK$${formattedAmount}`;
            }
            return `• ${inv.period}: ${formattedAmount} (Due: ${inv.due}) - ${inv.status}`;
          }
        )
        .join("\n");

      const invoiceListHTML = memberUnpaidInvoices
        .map(
          (inv) => {
            // Convert $ to HK$ in amount for display
            let formattedAmount = inv.amount || 'HK$0';
            formattedAmount = String(formattedAmount).trim();
            if (formattedAmount.includes('$') && !formattedAmount.includes('HK$')) {
              formattedAmount = formattedAmount.replace(/\$/g, 'HK$');
            } else if (!formattedAmount.startsWith('HK$') && !formattedAmount.startsWith('$')) {
              formattedAmount = `HK$${formattedAmount}`;
            }
            return `<li style="margin-bottom: 10px;">
              <strong>${inv.period}</strong>: ${formattedAmount} 
              <span style="color: #666;">(Due: ${inv.due})</span> - 
              <strong style="color: ${inv.status === 'Overdue' ? '#ef4444' : '#ef4444'}">${inv.status}</strong>
            </li>`;
          }
        )
        .join("");

      try {
        showToast("Sending reminder email...");

        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/invoices/send-reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toEmail: memberData.email,
            toName: memberData.name,
            memberId: memberData.id,
            totalDue: formatCurrency(totalDue),
            invoiceCount: memberUnpaidInvoices.length,
            invoiceListText: invoiceListText,
            invoiceListHTML: invoiceListHTML,
            paymentMethods: "FPS, PayMe, or Bank Transfer",
            portalLink: `${window.location.origin}/member`,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to send email");
        }

        console.log("✓ Email sent successfully:", data);

        // Refresh reminder logs to show the new entry
        fetchReminderLogs();

        // Log to communication with member metadata
        const comm = {
          channel: "Email",
          type: "Manual Outstanding Reminder",
          memberId: memberData.id,
          memberEmail: memberData.email,
          memberName: memberData.name,
          message: `Payment reminder: ${memberData.name} (${memberData.email}) - ${formatCurrency(totalDue)} due (${memberUnpaidInvoices.length} invoice${memberUnpaidInvoices.length > 1 ? "s" : ""})`,
          status: "Delivered",
        };
        addCommunication(comm);

        showToast(
          `Reminder email sent to ${memberData.name} for ${formatCurrency(totalDue)} outstanding!`
        );
      } catch (error) {
        console.error("✗ Email send error:", error);

        // Log failed attempt with member metadata
        const comm = {
          channel: "Email",
          type: "Manual Outstanding Reminder",
          memberId: memberData.id,
          memberEmail: memberData.email,
          memberName: memberData.name,
          message: `Reminder attempt to ${memberData.name} - ${formatCurrency(totalDue)} due`,
          status: "Failed",
        };
        addCommunication(comm);

        showToast(
          error.message || "Failed to send email. Please check email configuration.",
          "error"
        );
      }
    };

    const handleViewMemberDetail = async (member) => {
      // Immediately show the member detail for smooth UX
      // Find the best available member data first
      let memberToView = member;

      // Try to find from current members state (most up-to-date)
      if (member.id) {
        const foundMember = members.find(m =>
          (m.id === member.id) ||
          (member.email && m.email && m.email.toLowerCase() === member.email.toLowerCase())
        );
        if (foundMember) {
          memberToView = foundMember;
        }
      }

      // Ensure we have a valid member object
      if (!memberToView || !memberToView.id) {
        console.error("Member not found:", member);
        showToast("Member data not available. Please refresh the page.", "error");
        return;
      }

      // Immediately set the member and switch section for instant feedback
      setSelectedMember(memberToView);
      setActiveSection("member-detail");

      // Refresh data in the background to ensure we have the latest information
      // This doesn't block the UI, making the interaction feel smooth
      try {
        // Refresh all data in parallel without blocking
        Promise.all([
          fetchMembers(),
          fetchInvoices(),
          fetchPayments(),
        ]).then(() => {
          // After data is refreshed, update the selected member with latest data
          // This ensures the detail view shows the most current information
          const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
          
          if (memberToView.id) {
            fetch(`${apiUrl}/api/members`)
              .then(response => {
                if (response.ok) {
                  return response.json();
                }
                return null;
              })
              .then(allMembers => {
                if (allMembers) {
                  const latestMember = allMembers.find(m => m.id === memberToView.id);
                  if (latestMember) {
                    setSelectedMember(latestMember);
                  }
                }
              })
              .catch(fetchError => {
                // Silently fail - we already have the member displayed
                console.warn("Could not fetch latest member data:", fetchError);
              });
          }
        }).catch(error => {
          // Silently fail - we already have the member displayed
          console.warn("Could not refresh data:", error);
        });
      } catch (error) {
        // Silently fail - we already have the member displayed
        console.warn("Error refreshing data:", error);
      }
    };

    // Get member's invoices
    // Helper function to get effective invoice status (considering completed payments)
    const getEffectiveInvoiceStatus = (invoice) => {
      // Check if there's a completed payment for this invoice
      const relatedPayment = (paymentHistory || []).find(
        (p) => p.invoiceId === invoice.id && (p.status === "Completed" || p.status === "Paid")
      );

      // If there's a completed payment, invoice is effectively paid
      if (relatedPayment) {
        return "Paid";
      }

      // Otherwise use the invoice's own status
      return invoice.status;
    };

    const getMemberInvoices = (memberId) => {
      return invoices.filter((inv) => inv.memberId === memberId);
    };

    // Approve pending member
    const handleApproveMember = async (memberId) => {
      try {
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiUrl}/api/members/${memberId}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to approve member');
        }

        // Refresh members list
        await fetchMembers();

        showToast("Member approved successfully! Approval email sent.");
      } catch (error) {
        console.error('Error approving member:', error);
        showToast(error.message || "Failed to approve member", "error");
      }
    };

    // Don't block render with loading screen - show page immediately
    // Data will load in background and update as it arrives

    return (
      <>
        <SiteHeader
          showCTA={false}
          showLogout={true}
          onLogout={handleLogout}
          showMobileMenu={true}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isSticky={true}
        />

        {/* Toast Notification */}
        {/* Confirmation Dialog */}
        {confirmationDialog.isOpen && (
          <div
            className="confirmation-dialog-overlay"
            onClick={(e) => {
              // Prevent closing on background click
              e.stopPropagation();
            }}
          >
            <div
              className="confirmation-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirmation-dialog-content">
                <p className="confirmation-dialog-message">
                  {confirmationDialog.message}
                </p>
              </div>
              <div className="confirmation-dialog-divider"></div>
              <div className="confirmation-dialog-actions">
                <button
                  className="secondary-btn"
                  onClick={confirmationDialog.onCancel || (() => setConfirmationDialog({ isOpen: false, message: "", onConfirm: null, onCancel: null }))}
                >
                  Cancel
                </button>
                <button
                  className="danger-btn admin-confirmation-button-success"
                  onClick={confirmationDialog.onConfirm}
                >
                  {confirmationDialog.confirmButtonText || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Preview Modal */}
        {showTemplatePreview && (
          <div
            className="modal-overlay modal-overlay-high"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTemplatePreview(false);
              }
            }}
          >
            <div
              className="card admin-template-preview-modal modal-container modal-container-800"
              style={{
                maxWidth: "900px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header mb-2xl">
                <h3 className="modal-title">
                  <i className="fas fa-eye text-primary"></i>
                  Email Template Preview
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTemplatePreview(false)}
                  className="close-btn-simple"
                  aria-label="Close template preview"
                >
                  ×
                </button>
              </div>
              <div
                className="admin-template-preview-content"
                dangerouslySetInnerHTML={{ __html: getPreviewTemplate() }}
              />
              <div className="mt-2xl pt-xl border-t flex justify-end">
                <button
                  className="secondary-btn"
                  onClick={() => setShowTemplatePreview(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Channel Selection Modal */}
        {showChannelSelection && (
          <div
            className="modal-overlay modal-overlay-high"
            onClick={() => {
              setShowChannelSelection(false);
              setPendingReminderAction(null);
            }}
          >
            <div
              className="admin-modal-card admin-modal-card--small"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header mb-2xl">
                <h3 className="modal-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-spacing-sm" style={{ verticalAlign: "middle", display: "inline-block" }}>
                    <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="#5a31ea" />
                  </svg>
                  Select Channel
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowChannelSelection(false);
                    setPendingReminderAction(null);
                  }}
                  className="close-btn-simple"
                >
                  ×
                </button>
              </div>
              <p className="mb-2xl text-muted">
                {pendingReminderAction?.type === 'bulk'
                  ? (selectedChannels.length > 0
                    ? `Selected: ${selectedChannels.join(" and ")}. Click "Send" to send reminders to all outstanding members.`
                    : "Select one or both channels to send reminders to all outstanding members:")
                  : `Select the channel to send reminder to ${pendingReminderAction?.memberData?.name || 'member'}:`}
              </p>
              <div className="admin-channel-buttons-container">
                {/* Channel selection buttons - always visible for bulk */}
                {pendingReminderAction?.type === 'bulk' ? (
                  <>
                    <button
                      className={`admin-channel-button ${selectedChannels.includes('Email') ? 'admin-channel-button--selected' : ''}`}
                      onClick={() => handleSelectChannel('Email')}
                    >
                      <div className="admin-channel-button-content">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                          <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="#ffffff" />
                        </svg>
                        <span className="admin-channel-button-text-white">Email</span>
                      </div>
                      {selectedChannels.includes('Email') && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: "8px" }}>
                          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="#ffffff" />
                        </svg>
                      )}
                    </button>
                    <button
                      className={`admin-channel-button ${selectedChannels.includes('WhatsApp') ? 'admin-channel-button--selected' : ''}`}
                      onClick={() => handleSelectChannel('WhatsApp')}
                    >
                      <div className="admin-channel-button-content">
                        <i className="fab fa-whatsapp admin-channel-button-icon-white"></i>
                        <span className="admin-channel-button-text-white">WhatsApp</span>
                      </div>
                      {selectedChannels.includes('WhatsApp') && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: "8px" }}>
                          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="#ffffff" />
                        </svg>
                      )}
                    </button>

                    {/* Send All button - shown when at least one channel is selected */}
                    {selectedChannels.length > 0 && (
                      <button
                        className={`admin-channel-send-button ${(sendingToAll || sendingWhatsAppToAll) ? 'admin-channel-send-button-loading' : ''}`}
                        onClick={handleSendAllWithSelectedChannels}
                        disabled={sendingToAll || sendingWhatsAppToAll}
                      >
                        {sendingToAll || sendingWhatsAppToAll ? (
                          <>
                            <svg
                              className="login-btn-spinner"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                            </svg>
                            Sending...
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                              <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="#ffffff" />
                            </svg>
                            Send
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  // Single member - send immediately
                  <>
                    <button
                      className="admin-channel-action-button"
                      onClick={() => handleSelectChannel('Email')}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                        <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="currentColor" />
                      </svg>
                      Email
                    </button>
                    <button
                      className="admin-channel-action-button admin-channel-action-button--whatsapp"
                      onClick={() => handleSelectChannel('WhatsApp')}
                    >
                      <i className="fab fa-whatsapp admin-channel-action-icon-large"></i>
                      WhatsApp
                    </button>
                  </>
                )}
              </div>
              <div className="admin-modal-footer">
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setShowChannelSelection(false);
                    setPendingReminderAction(null);
                    setSelectedChannels([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <Notie
          message={notieMessage}
          type={notieType}
          onClose={() => setNotieMessage(null)}
          duration={1000}
        />

        <main className="admin-main admin-main--sticky-header">
          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div
              className="mobile-menu-overlay"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>
          )}

          <div className="admin-layout">
            {/* Desktop Sidebar / Mobile Menu */}
            <aside
              className={`admin-menu ${isMobileMenuOpen ? "mobile-open" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="eyebrow light">{currentPortalTitle}</p>
              <nav className="admin-nav-grouped">
                {/* Dashboard - Always visible */}
                <div className="nav-group">
                  <button
                    className={`admin-tab ${activeSection === "dashboard" ? "active" : ""}`}
                    onClick={() => {
                      handleNavClick("dashboard");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <i className="fas fa-chart-line admin-nav-icon"></i>
                    Dashboard
                  </button>
                </div>

                {/* Grouped Navigation Items - accordion style */}
                {navigationGroups.map((group) => (
                  <div key={group.id} className="nav-group">
                    <button
                      className="nav-group-header"
                      onClick={() => {
                        setExpandedGroups(prev => {
                          const isCurrentlyExpanded = prev[group.id];
                          // Accordion behavior: if opening this group, close all others
                          if (!isCurrentlyExpanded) {
                            const newState = {};
                            navigationGroups.forEach(g => {
                              newState[g.id] = g.id === group.id;
                            });
                            return newState;
                          } else {
                            // If closing, just close this one
                            return {
                              ...prev,
                              [group.id]: false
                            };
                          }
                        });
                      }}
                      type="button"
                    >
                      <i className={`fas ${group.icon} admin-nav-icon`}></i>
                      <span className="nav-group-label">{group.label}</span>
                      <i
                        className={`fas fa-chevron-down nav-group-chevron admin-nav-chevron ${expandedGroups[group.id] ? 'expanded' : ''}`}
                      ></i>
                    </button>
                    <div
                      className={`nav-group-items ${expandedGroups[group.id] ? 'expanded' : ''}`}
                    >
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          className={`admin-tab admin-tab-nested ${activeSection === item.id ? "active" : ""}`}
                          onClick={() => {
                            handleNavClick(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>

            <div className="admin-body">
              {/* DASHBOARD */}
              {activeSection === "dashboard" && (
                <article className="screen-card" id="dashboard">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("dashboard")}
                      <h3><i className="fas fa-chart-line admin-section-icon"></i>Dashboard</h3>
                      <p>Key KPIs, monthly collections, recent payments.</p>
                    </div>
                  </header>
                  <div className="admin-dashboard-main-card">
                    <div className="kpi-grid">
                      <DashboardKPICard
                        icon="fas fa-users"
                        label="Total Members"
                        value={formatNumber(members.length)}
                        description="Active members"
                        onClick={() => handleNavClick("members")}
                      />
                      <DashboardKPICard
                        icon="fas fa-dollar-sign"
                        iconClass="admin-dashboard-kpi-icon--green"
                        label="Total Collected"
                        value={formatCurrency(dashboardMetrics.totalCollected || 0)}
                        description="Subscription + Donations"
                        onClick={() => handleNavClick("payments")}
                      />
                      <DashboardKPICard
                        icon="fas fa-credit-card"
                        iconClass="admin-dashboard-kpi-icon--green"
                        label="Total Subscription Amount"
                        value={formatCurrency(dashboardMetrics.totalSubscriptionAmount || 0)}
                        description="From member payments"
                        onClick={() => handleNavClick("payments")}
                      />
                      <DashboardKPICard
                        icon="fas fa-dollar-sign"
                        iconClass="admin-dashboard-kpi-icon--red"
                        label="Total Unpaid Amount"
                        value={formatCurrency(dashboardMetrics.outstanding)}
                        description={`Expected ${formatCurrency(dashboardMetrics.expectedAnnual)}`}
                        onClick={() => handleNavClick("members")}
                        valueClass={dashboardMetrics.outstanding > 0 ? "admin-dashboard-kpi-value--red" : "admin-dashboard-kpi-value--default"}
                      />
                      <DashboardKPICard
                        icon="fas fa-heart"
                        iconClass="admin-dashboard-kpi-icon--red"
                        label="Total Donation"
                        value={formatCurrency(dashboardMetrics.totalDonationAmount || 0)}
                        description={`${Array.isArray(donations) ? donations.filter(d => d).length : 0} donation${(Array.isArray(donations) ? donations.filter(d => d).length : 0) !== 1 ? 's' : ''}`}
                        onClick={() => handleNavClick("donations")}
                      />
                    </div>

                    {/* Last updated timestamp */}
                    <div className="admin-dashboard-last-updated">
                      Last updated: {dashboardLastUpdated}
                    </div>

                    <div className="admin-dashboard-chart-card">
                      <div className="card-header">
                        <div>
                          <h4><i className="fas fa-chart-bar admin-dashboard-chart-header-icon"></i>Monthly Collections · Last 12 Months</h4>
                          <p>Expected contribution is HK$800 per member per year</p>
                        </div>
                      </div>
                      <div
                        ref={chartContainerRef}
                        className="chart admin-dashboard-chart-container"
                        onMouseMove={(e) => {
                          if (hoveredMonth) {
                            updateChartMousePosition(e);
                          }
                        }}
                      >
                        {monthlyCollectionsData.map((item) => (
                          <div
                            key={item.monthKey}
                            className="admin-dashboard-chart-bar"
                            style={{ height: `${item.percentage}%` }}
                            data-month={item.month}
                            onMouseEnter={(e) => {
                              setHoveredMonth(item);
                              updateChartMousePosition(e);
                            }}
                            onMouseMove={(e) => {
                              if (hoveredMonth?.monthKey === item.monthKey) {
                                updateChartMousePosition(e);
                              }
                            }}
                            onMouseLeave={() => setHoveredMonth(null)}
                          >
                          </div>
                        ))}
                        {hoveredMonth && chartContainerRef.current && (() => {
                          // Calculate tooltip dimensions based on payment count
                          const paymentCount = hoveredMonth.payments?.length || 0;
                          const maxTooltipHeight = 400; // Maximum height for tooltip
                          const headerHeight = 40;
                          const summaryHeight = 60;
                          const paymentItemHeight = 70; // Height per payment item
                          const maxVisiblePayments = Math.floor((maxTooltipHeight - headerHeight - summaryHeight) / paymentItemHeight);
                          const tooltipWidth = 220;
                          const tooltipHeight = Math.min(
                            headerHeight + summaryHeight + (paymentCount * paymentItemHeight),
                            maxTooltipHeight
                          );
                          const chartRect = chartContainerRef.current.getBoundingClientRect();
                          const viewportHeight = window.innerHeight;

                          // Position on the left side of the cursor
                          let left = mousePosition.x - tooltipWidth - 15;

                          // Ensure tooltip doesn't go off the left edge
                          if (left < 10) {
                            left = 10;
                          }

                          // Center tooltip vertically relative to cursor
                          let top = mousePosition.y - tooltipHeight / 2;

                          // Prevent vertical overflow - check top edge
                          if (chartRect.top + top < 10) {
                            top = 10 - chartRect.top;
                          }

                          // Prevent bottom overflow
                          const tooltipBottomEdge = chartRect.top + top + tooltipHeight;
                          if (tooltipBottomEdge > viewportHeight - 10) {
                            top = viewportHeight - 10 - chartRect.top - tooltipHeight;
                            // Ensure it doesn't go above viewport
                            if (chartRect.top + top < 10) {
                              top = 10 - chartRect.top;
                            }
                          }

                          const displayPayments = hoveredMonth.payments || [];
                          const hasMorePayments = paymentCount > maxVisiblePayments;

                          return (
                            <div
                              className="admin-dashboard-chart-tooltip"
                              style={{
                                left: `${left}px`,
                                top: `${top}px`,
                                width: `${tooltipWidth}px`,
                                maxHeight: `${maxTooltipHeight}px`,
                                overflowY: hasMorePayments ? 'auto' : 'visible'
                              }}
                            >
                              <div className="admin-dashboard-chart-tooltip-header">
                                <strong>{hoveredMonth.monthKey}</strong>
                              </div>
                              <div className="admin-dashboard-chart-tooltip-content">
                                <div className="admin-dashboard-chart-tooltip-row">
                                  <span>Total Amount:</span>
                                  <strong>{formatCurrency(hoveredMonth.value)}</strong>
                                </div>
                                {hoveredMonth.count > 0 && (
                                  <div className="admin-dashboard-chart-tooltip-row">
                                    <span>Total Payments:</span>
                                    <strong>{hoveredMonth.count} payment{hoveredMonth.count > 1 ? 's' : ''}</strong>
                                  </div>
                                )}
                                {/*{displayPayments.length > 0 && (
                                  <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                                    <div style={{ marginBottom: '8px', fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>
                                      Payment Details:
                                    </div>
                                    <div style={{ maxHeight: hasMorePayments ? '280px' : 'none', overflowY: hasMorePayments ? 'auto' : 'visible' }}>
                                      {displayPayments.slice(0, hasMorePayments ? maxVisiblePayments : displayPayments.length).map((payment, index) => {
                                        const paymentDate = payment.date 
                                          ? new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                          : (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');
                                        const paymentAmount = payment.amount 
                                          ? formatCurrency(parseFloat(payment.amount.replace(/[^0-9.]/g, '') || 0))
                                          : formatCurrency(0);
                                        const paymentMethod = getPaymentMethodDisplay(payment);
                                        const memberName = payment.member || 'Unknown';
                                        
                                        return (
                                          <div 
                                            key={index} 
                                            style={{ 
                                              marginBottom: '10px', 
                                              padding: '8px', 
                                              backgroundColor: 'rgba(255,255,255,0.05)', 
                                              borderRadius: '4px',
                                              fontSize: '0.7rem'
                                            }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Member:</span>
                                              <strong style={{ color: '#fff' }}>{memberName}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Amount:</span>
                                              <strong style={{ color: '#4CAF50' }}>{paymentAmount}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Method:</span>
                                              <span style={{ color: 'rgba(255,255,255,0.9)' }}>{paymentMethod}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Date:</span>
                                              <span style={{ color: 'rgba(255,255,255,0.9)' }}>{paymentDate}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {hasMorePayments && (
                                        <div style={{ 
                                          textAlign: 'center', 
                                          padding: '8px', 
                                          fontSize: '0.7rem', 
                                          color: 'rgba(255,255,255,0.7)',
                                          fontStyle: 'italic'
                                        }}>
                                          ... and {paymentCount - maxVisiblePayments} more payment{paymentCount - maxVisiblePayments > 1 ? 's' : ''}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}*/}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="admin-dashboard-payments-card">
                      <div className="card-header">
                        <h4><i className="fas fa-clock admin-icon" style={{ marginRight: "10px" }}></i>Recent Payments</h4>
                        <button className="text-btn" onClick={() => handleNavClick("members")}>
                          View all
                        </button>
                      </div>
                      <Table
                        columns={["Member", "Amount", "Method", "Status", "Subscription Year", "Native", "Joined Year"]}
                        rows={recentPaymentsData.length > 0 ? recentPaymentsData : [
                          {
                            Member: "No payments yet",
                            Period: "-",
                            Amount: "-",
                            Method: "-",
                            Status: "-",
                            "Subscription Year": "-",
                            Native: "-",
                            "Joined Year": "-",
                          }
                        ]}
                      />
                    </div>
                  </div>
                </article>
              )}

              {/* MEMBERS LIST */}
              {activeSection === "members" && (
                <article className="screen-card" id="members">
                  <header className="screen-card__header">
                    <div className="flex justify-between items-center w-full flex-wrap gap-md">
                      <div>
                        {renderBreadcrumb("members")}
                        <h3>Members List</h3>
                        <p>Manage all members and their subscriptions.</p>
                      </div>
                      {(members || []).filter(m => m.status === 'Pending').length > 0 && (
                        <div style={{
                          padding: "10px 16px",
                          background: "#fee2e2",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: "#ef4444",
                          border: "1px solid #ef4444"
                        }}>
                          ⏳ Pending Approval: {(members || []).filter(m => m.status === 'Pending').length}
                        </div>
                      )}
                      <div className="flex gap-sm flex-wrap">
                        {/* <button
                          className="ghost-btn"
                          onClick={() => {
                            showConfirmation(
                              "This will reset all data to initial values from data.js. Continue?",
                              () => {
                                resetAllData();
                                showToast("Data reset! Showing fresh data from data.js");
                                window.location.reload();
                              }
                            );
                          }}
                          style={{ fontSize: "0.85rem", padding: "8px 16px" }}
                        >
                          🔄 Reset Data
                        </button> */}
                        <button
                          className="secondary-btn"
                          onClick={() => {
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.accept = '.csv,.xlsx,.xls';
                            fileInput.style.display = 'none';
                            fileInput.onchange = async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;

                              await handleImportMembers(file);
                              document.body.removeChild(fileInput);
                            };
                            document.body.appendChild(fileInput);
                            fileInput.click();
                          }}
                          style={{ display: "flex", alignItems: "center", gap: "8px" }}
                        >
                          <i className="fas fa-file-import"></i>
                          Import CSV/Excel
                        </button>
                        <button
                          className="primary-btn"
                          onClick={() => {
                            setShowMemberForm(true);
                            setEditingMember(null);
                            // Reset form with balance matching default subscription type
                            setMemberForm({
                              name: "",
                              email: "",
                              phone: "",
                              native: "",
                              status: "Active",
                              balance: "250", // default based on Lifetime subscription
                              nextDue: getTodayDate(), // Default to today's date
                              subscriptionYear: new Date().getFullYear().toString(),
                              lastPayment: "",
                              subscriptionType: "Lifetime",
                            });
                          }}
                        >
                          + Add Member
                        </button>
                      </div>
                    </div>
                  </header>

                  {/* Member Form - now as popup/modal */}
                  {showMemberForm && (
                    <div
                      className="admin-members-form-overlay"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          // Clear validation state when closing
                          setMemberFieldErrors({
                            name: false,
                            email: false,
                            phone: false,
                            nextDue: false,
                            lastPayment: false,
                          });
                          setCurrentInvalidField(null);
                          setShowMemberForm(false);
                          setEditingMember(null);
                        }
                      }}
                    >
                      <div
                        className="admin-members-form-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="admin-members-form-header">
                          <div className="admin-members-form-header-top">
                            <h4 className="admin-members-form-title">
                              <i className="fas fa-user-plus" aria-hidden="true"></i>
                              {editingMember ? "Edit Member" : "Add New Member"}
                            </h4>
                            <button
                              type="button"
                              className="admin-members-form-close"
                              onClick={() => {
                                // Clear validation state when closing
                                setMemberFieldErrors({
                                  name: false,
                                  email: false,
                                  phone: false,
                                  nextDue: false,
                                  lastPayment: false,
                                });
                                setCurrentInvalidField(null);
                                setShowMemberForm(false);
                                setEditingMember(null);
                              }}
                              aria-label="Close add member form"
                            >
                              ×
                            </button>
                          </div>

                          <form
                            className="form-grid"
                            onSubmit={editingMember ? handleUpdateMember : handleAddMember}
                            noValidate
                          >
                            <label>
                              <span>
                                <i className="fas fa-user admin-members-form-icon" aria-hidden="true"></i>
                                Name <span className="admin-members-form-required">*</span>
                              </span>
                              <input
                                type="text"
                                required
                                value={memberForm.name}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  handleMemberFieldChange("name", newValue);
                                  // Clear error styles immediately when user types
                                  if (newValue.trim()) {
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                  // Clear error when user starts typing
                                  if (memberFieldErrors.name || currentInvalidField === "name") {
                                    setMemberFieldErrors(prev => ({ ...prev, name: false }));
                                    if (currentInvalidField === "name") {
                                      setCurrentInvalidField(null);
                                    }
                                  }
                                }}
                                className={(memberFieldErrors.name && currentInvalidField === "name" && !memberForm.name.trim()) ? "admin-members-form-input-error" : ""}
                                aria-invalid={memberFieldErrors.name && !memberForm.name.trim()}
                                onFocus={(e) => {
                                  if (memberFieldErrors.name && currentInvalidField === "name" && !memberForm.name.trim()) {
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                    e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                  } else if (memberForm.name.trim()) {
                                    // Remove error styles if field has value
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                }}
                                onBlur={(e) => {
                                  if (memberFieldErrors.name && currentInvalidField === "name" && !memberForm.name.trim()) {
                                    e.target.style.borderColor = "#ef4444";
                                  } else {
                                    e.target.style.borderColor = undefined;
                                  }
                                }}
                              />
                            </label>

                            {/* <label>
                              <span>
                                <i className="fas fa-envelope" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                Email <span style={{ color: "#ef4444" }}>*</span>
                              </span>
                              <input
                                type="email"
                                required
                                value={memberForm.email}
                                onChange={(e) => {
                                  handleMemberFieldChange("email", e.target.value);
                                  // Clear error when user starts typing
                                  if (memberFieldErrors.email || currentInvalidField === "email") {
                                    setMemberFieldErrors(prev => ({ ...prev, email: false }));
                                    if (currentInvalidField === "email") {
                                      setCurrentInvalidField(null);
                                    }
                                  }
                                }}
                                style={{
                                  borderColor: (memberFieldErrors.email && currentInvalidField === "email") ? "#ef4444" : undefined,
                                  borderWidth: (memberFieldErrors.email && currentInvalidField === "email") ? "2px" : undefined,
                                  borderStyle: (memberFieldErrors.email && currentInvalidField === "email") ? "solid" : undefined,
                                  outline: (memberFieldErrors.email && currentInvalidField === "email") ? "none" : undefined,
                                  boxShadow: (memberFieldErrors.email && currentInvalidField === "email") ? "0 0 0 2px rgba(239, 68, 68, 0.2)" : undefined,
                                }}
                                aria-invalid={memberFieldErrors.email}
                                onFocus={(e) => {
                                  if (memberFieldErrors.email && currentInvalidField === "email") {
                                    e.target.style.borderColor = "#ef4444";
                                    e.target.style.outline = "none";
                                    e.target.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
                                  }
                                }}
                                onBlur={(e) => {
                                  if (memberFieldErrors.email && currentInvalidField === "email") {
                                    e.target.style.borderColor = "#ef4444";
                                    e.target.style.outline = "none";
                                  }
                                }}
                              />
                              {memberFieldErrors.name && currentInvalidField === "name" && (
                                <span style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "4px", display: "block" }}>
                                  {validateMemberField("name", memberForm.name)}
                                </span>
                              )}
                            </label> */}

                            <label>
                              <span>
                                <i className="fas fa-envelope" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                Email <span style={{ color: "#ef4444" }}>*</span>
                              </span>
                              <input
                                type="email"
                                required
                                value={memberForm.email}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  handleMemberFieldChange("email", newValue);
                                  
                                  // Validate email format
                                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  const isValidEmail = newValue.trim() && emailRegex.test(newValue.trim());
                                  
                                  // Clear error styles only if email is valid
                                  if (isValidEmail) {
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                    // Clear error state if email is valid
                                    if (memberFieldErrors.email || currentInvalidField === "email") {
                                      setMemberFieldErrors(prev => ({ ...prev, email: false }));
                                      if (currentInvalidField === "email") {
                                        setCurrentInvalidField(null);
                                      }
                                    }
                                  } else if (newValue.trim()) {
                                    // If email has value but is invalid, show error border
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                    e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                  }
                                }}
                                style={{
                                  borderColor: (memberFieldErrors.email && currentInvalidField === "email") ? "#ef4444" : undefined,
                                  borderWidth: (memberFieldErrors.email && currentInvalidField === "email") ? "1px" : undefined,
                                  borderStyle: (memberFieldErrors.email && currentInvalidField === "email") ? "solid" : undefined,
                                  outline: (memberFieldErrors.email && currentInvalidField === "email") ? "none" : undefined,
                                  boxShadow: (memberFieldErrors.email && currentInvalidField === "email") ? "0 0 0 2px rgba(239, 68, 68, 0.2)" : undefined,
                                }}
                                aria-invalid={memberFieldErrors.email && currentInvalidField === "email"}
                                onFocus={(e) => {
                                  // Validate email format
                                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  const isValidEmail = memberForm.email.trim() && emailRegex.test(memberForm.email.trim());
                                  
                                  if (memberFieldErrors.email && currentInvalidField === "email" && !isValidEmail) {
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                    e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                  } else if (isValidEmail) {
                                    // Remove error styles if email is valid
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                }}
                                onBlur={(e) => {
                                  // Validate email format on blur
                                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  const isValidEmail = memberForm.email.trim() && emailRegex.test(memberForm.email.trim());
                                  
                                  if (memberFieldErrors.email && currentInvalidField === "email" && !isValidEmail) {
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                  } else if (isValidEmail) {
                                    // Remove error styles if email is valid
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                }}
                              />
                            </label>

                            <div>
                              <PhoneInput
                                label={
                                  <span className="admin-phone-input-label">
                                    <i className="fas fa-phone admin-phone-input-label-icon" aria-hidden="true"></i>
                                    <span className="whatsapp-text">WhatsApp Number</span> <span className="admin-phone-input-required">*</span>
                                  </span>
                                }
                                value={memberForm.phone}
                                onChange={(e) => {
                                  handleMemberFieldChange("phone", e.target.value);
                                  // Clear error when user starts typing
                                  if (memberFieldErrors.phone || currentInvalidField === "phone") {
                                    setMemberFieldErrors(prev => ({ ...prev, phone: false }));
                                    if (currentInvalidField === "phone") {
                                      setCurrentInvalidField(null);
                                    }
                                  }
                                }}
                                onError={(error) => {
                                  showToast(error, "error");
                                  setMemberFieldErrors(prev => ({ ...prev, phone: true }));
                                  setCurrentInvalidField("phone");
                                }}
                                required={true}
                                className={memberFieldErrors.phone && currentInvalidField === "phone" && !memberForm.phone.trim() ? "admin-phone-input-error" : ""}
                                placeholder="Enter phone number"
                              />
                            </div>

                            <label>
                              <span>
                                <i className="fas fa-globe" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                Native
                              </span>
                              <input
                                type="text"
                                value={memberForm.native}
                                onChange={(e) => {
                                  // Only allow alphabets and spaces
                                  const value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                  handleMemberFieldChange("native", value);
                                }}
                                placeholder="Enter Your native "
                                style={{
                                  textTransform: "capitalize"
                                }}
                              />
                            </label>

                            {/* Password removed from Add Member form as requested */}
                            <label>
                              <span>
                                <i className="fas fa-toggle-on" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                Status
                              </span>
                              <select
                                value={memberForm.status}
                                onChange={(e) => handleMemberFieldChange("status", e.target.value)}
                              >
                                <option>Active</option>
                                <option>Inactive</option>
                                {/* <option>Pending</option> */}
                              </select>
                            </label>

                            {!editingMember && (
                              <label>
                                <span>
                                  <i className="fas fa-id-card" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                  Subscription Type
                                </span>
                                <select
                                  value={memberForm.subscriptionType || "Lifetime"}
                                  onChange={(e) => handleMemberFieldChange("subscriptionType", e.target.value)}
                                >
                                  <option value="Lifetime">Lifetime - HK$250/year</option>
                                  <option value="Yearly + Janaza Fund">Yearly + Janaza Fund - HK$500/year</option>
                                </select>
                              </label>
                            )}

                            {!editingMember && (
                              <label>
                                <span>
                                  <i className="fas fa-calendar" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                  Subscription Year
                                </span>
                                <input
                                  type="number"
                                  min="2000"
                                  max="2100"
                                  value={memberForm.subscriptionYear}
                                  onChange={(e) => handleMemberFieldChange("subscriptionYear", e.target.value)}
                                  placeholder="YYYY"
                                />
                              </label>
                            )}

                            {!editingMember && (
                              <label>
                                <span>
                                  <i className="fas fa-wallet" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                  Balance
                                </span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={memberForm.balance}
                                  readOnly
                                  style={{
                                    background: "#f9fafb",
                                    cursor: "not-allowed",
                                    color: "#666"
                                  }}
                                />
                              </label>
                            )}

                            {!editingMember && (
                              <label>
                                <span>
                                  <i className="fas fa-calendar-day" aria-hidden="true" style={{ marginRight: 6 }}></i>
                                  Joining Date <span style={{ color: "#ef4444" }}>*</span>
                                </span>
                                <input
                                  type="date"
                                  value={memberForm.nextDue}
                                  onChange={(e) => {
                                    const selectedDate = e.target.value;
                                    handleMemberFieldChange("nextDue", selectedDate);
                                    // Clear error styles immediately when user selects a date
                                    if (selectedDate) {
                                      e.target.style.setProperty("border-color", "", "important");
                                      e.target.style.setProperty("outline", "", "important");
                                      e.target.style.setProperty("box-shadow", "", "important");
                                    }
                                    // Clear error when user starts typing
                                    if (memberFieldErrors.nextDue || currentInvalidField === "nextDue") {
                                      setMemberFieldErrors(prev => ({ ...prev, nextDue: false }));
                                      if (currentInvalidField === "nextDue") {
                                        setCurrentInvalidField(null);
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const dateValue = e.target.value;
                                    if (dateValue) {
                                      const date = new Date(dateValue);
                                      if (isNaN(date.getTime())) {
                                        showToast("Invalid date format. Please enter a valid date (YYYY-MM-DD)", "error");
                                        return;
                                      }
                                      // Validate date components
                                      const [year, month, day] = dateValue.split('-').map(Number);
                                      if (month < 1 || month > 12) {
                                        showToast("Invalid month. Please enter a month between 01 and 12", "error");
                                        return;
                                      }
                                      if (day < 1 || day > 31) {
                                        showToast("Invalid day. Please enter a valid day for the selected month", "error");
                                        return;
                                      }
                                      // Check if day is valid for the month
                                      const daysInMonth = new Date(year, month, 0).getDate();
                                      if (day > daysInMonth) {
                                        showToast(`Invalid date. ${month}/${year} only has ${daysInMonth} days`, "error");
                                        return;
                                      }
                                    }
                                  }}
                                  style={{
                                    borderRadius: "4px",
                                    width: "100%",
                                    borderColor: (memberFieldErrors.nextDue && currentInvalidField === "nextDue" && !memberForm.nextDue) ? "#ef4444" : undefined,
                                    borderWidth: (memberFieldErrors.nextDue && currentInvalidField === "nextDue" && !memberForm.nextDue) ? "2px" : undefined,
                                    borderStyle: (memberFieldErrors.nextDue && currentInvalidField === "nextDue" && !memberForm.nextDue) ? "solid" : undefined,
                                    outline: (memberFieldErrors.nextDue && currentInvalidField === "nextDue" && !memberForm.nextDue) ? "none" : undefined,
                                    boxShadow: (memberFieldErrors.nextDue && currentInvalidField === "nextDue" && !memberForm.nextDue) ? "0 0 0 2px rgba(239, 68, 68, 0.2)" : undefined,
                                  }}
                                  aria-invalid={memberFieldErrors.nextDue && !memberForm.nextDue}
                                  onFocus={(e) => {
                                    if (memberFieldErrors.nextDue && currentInvalidField === "nextDue" && !memberForm.nextDue) {
                                      e.target.style.setProperty("border-color", "#ef4444", "important");
                                      e.target.style.setProperty("outline", "none", "important");
                                      e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                    } else if (memberForm.nextDue) {
                                      // Remove error styles if field has value
                                      e.target.style.setProperty("border-color", "", "important");
                                      e.target.style.setProperty("outline", "", "important");
                                      e.target.style.setProperty("box-shadow", "", "important");
                                    }
                                  }}
                                />
                              </label>
                            )}


                            <div className="form-actions">
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => {
                                  // Clear validation state when closing
                                  setMemberFieldErrors({
                                    name: false,
                                    email: false,
                                    phone: false,
                                    nextDue: false,
                                    lastPayment: false,
                                  });
                                  setCurrentInvalidField(null);
                                  setShowMemberForm(false);
                                  setEditingMember(null);
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="primary-btn"
                                disabled={isMemberSubmitting}
                                style={{
                                  position: "sticky",
                                  bottom: 0,
                                  backgroundColor: "#5a31ea",
                                  zIndex: 1,
                                }}
                              >
                                {isMemberSubmitting
                                  ? "Saving..."
                                  : editingMember
                                    ? "Update Member"
                                    : "Add Member"}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending Members Section */}
                  {members.filter(m => m.status === 'Pending').length > 0 && (
                    <div style={{
                      background: "#fee2e2",
                      border: "2px solid #ef4444",
                      borderRadius: "12px",
                      padding: "24px",
                      marginBottom: "24px"
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "16px"
                      }}>
                        <h4 className="m-0 text-danger flex items-center gap-sm">
                          ⏳ Pending Approval ({members.filter(m => m.status === 'Pending').length})
                        </h4>
                      </div>
                      <div className="flex flex-col gap-md">
                        {members
                          .filter(m => m.status === 'Pending')
                          .map(member => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-lg bg-white rounded border flex-wrap gap-md"
                              style={{ borderColor: "#ef4444" }}
                            >
                              <div className="flex-1" style={{ minWidth: "300px", flexBasis: "300px" }}>
                                <div className="font-semibold mb-xs text-base">
                                  {member.name}
                                </div>
                                <div className="text-sm text-muted mb-xs">
                                  {member.email}
                                </div>
                                <div className="text-sm text-muted mb-xs">
                                  📱 {member.phone || "No phone"}
                                </div>
                                <div className="text-xs text-danger" style={{ marginTop: "8px" }}>
                                  📅 Subscription: {member.subscriptionType || 'Lifetime'}
                                </div>
                              </div>
                              <div className="flex gap-sm flex-shrink-0">
                                <button
                                  className="primary-btn"
                                  onClick={() => handleApproveMember(member.id)}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  className="ghost-btn"
                                  onClick={() => handleViewMemberDetail(member)}
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Search Filter - Hidden */}
                  {/* <div className="admin-members-search-card">
                    <div className="admin-members-search-container">
                      <label className="admin-members-search-label">
                        <span className="admin-members-search-label-text">🔍 Search Members:</span>
                        <input
                          type="text"
                          placeholder="Search by member name..."
                          value={memberSearchTerm}
                          onChange={(e) => setMemberSearchTerm(e.target.value)}
                          style={{
                            flex: "1",
                            padding: "10px 16px",
                            border: "1px solid #e0e0e0",
                            borderRadius: "4px",
                            fontSize: "0.875rem",
                            outline: "none",
                            transition: "border-color 0.2s"
                          }}
                          onFocus={(e) => e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1), 0 4px 12px rgba(90, 49, 234, 0.12)"}
                          onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
                        />
                      </label>
                      {memberSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setMemberSearchTerm("")}
                          style={{
                            padding: "10px 16px",
                            background: "#f9fafb",
                            border: "1px solid #e0e0e0",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            color: "#666"
                          }}
                        >
                          Clear
                        </button>
                      )}
                      <div className="text-sm text-muted">
                        {(() => {
                          const filtered = members.filter(m => 
                            !memberSearchTerm || 
                            m.name?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                          );
                          return `${filtered.length} of ${members.length} members`;
                        })()}
                      </div>
                    </div>
                  </div> */}

                  <div className="admin-members-table-card">
                    <div className="table-wrapper">
                      {(() => {
                        // Helper function to extract subscription year from member
                        const getMemberSubscriptionYear = (member) => {
                          // First try to get from member's invoices
                          const memberInvoices = invoices.filter(inv => 
                            inv.memberId === member.id || 
                            inv.memberEmail === member.email || 
                            inv.memberName === member.name
                          ).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); // Sort by most recent
                          
                          if (memberInvoices.length > 0) {
                            const latestInvoice = memberInvoices[0];
                            if (latestInvoice.period) {
                              const periodStr = String(latestInvoice.period).trim();
                              const yearMatch = periodStr.match(/\d{4}/);
                              if (yearMatch) {
                                return yearMatch[0];
                              }
                            }
                          }
                          
                          // Fallback to next_due_date or nextDue
                          if (member.next_due_date) {
                            return new Date(member.next_due_date).getFullYear().toString();
                          } else if (member.nextDue) {
                            const nextDueStr = String(member.nextDue).trim();
                            const yearMatch = nextDueStr.match(/\d{4}/);
                            return yearMatch ? yearMatch[0] : (nextDueStr.split('-')[0] || null);
                          }
                          
                          return null;
                        };

                        // Filter members based on search term and status (using derived status)
                        const filteredMembers = members
                          .filter((member) => {
                            if (!memberSearchTerm) return true;
                            
                            const searchLower = memberSearchTerm.toLowerCase();
                            const memberName = member.name?.toLowerCase() || "";
                            const memberEmail = member.email?.toLowerCase() || "";
                            const memberId = member.id?.toLowerCase() || "";
                            const memberPhone = member.phone?.toLowerCase() || "";
                            
                            // Check if search matches name, email, id, or phone
                            if (memberName.includes(searchLower) || 
                                memberEmail.includes(searchLower) || 
                                memberId.includes(searchLower) ||
                                memberPhone.includes(searchLower)) {
                              return true;
                            }
                            
                            // Check if search matches subscription year
                            const subscriptionYear = getMemberSubscriptionYear(member);
                            if (subscriptionYear && subscriptionYear.includes(searchLower)) {
                              return true;
                            }
                            
                            return false;
                          })
                          .filter((member) => {
                            if (memberStatusFilter === "All") return true;

                            const balanceStr = member.balance?.toString() || "";
                            const numericOutstanding = parseFloat(
                              balanceStr.replace(/[^0-9.]/g, "") || 0
                            ) || 0;

                            // Derive status: Active / Inactive only
                            let derivedStatus = "Active";

                            if (member.status === "Inactive") {
                              derivedStatus = "Inactive";
                            } else {
                              derivedStatus = "Active";
                            }

                            return derivedStatus === memberStatusFilter;
                          })
                          .filter((member) => {
                            if (memberYearFilter === "All") return true;
                            
                            const subscriptionYear = getMemberSubscriptionYear(member);
                            if (!subscriptionYear) return false;
                            
                            return subscriptionYear === memberYearFilter;
                          });

                        // No sorting - use filtered members as-is
                        const sortedMembers = filteredMembers;

                        // Calculate pagination
                        const totalPages = Math.ceil(sortedMembers.length / membersPageSize) || 1;
                        const currentPage = Math.min(membersPage, totalPages);
                        const startIndex = (currentPage - 1) * membersPageSize;
                        const endIndex = startIndex + membersPageSize;
                        const paginatedMembers = sortedMembers.slice(startIndex, endIndex);

                        const isOwner = currentAdminRole === "Owner";

                        return (
                          <>
                            {/* Filters above table */}
                            <div className="mb-lg flex gap-md flex-wrap items-center justify-between">
                              <div className="flex gap-md flex-wrap items-center">
                                <label className="font-semibold" style={{ color: "#1a1a1a" }}>Filter by Status:</label>
                                <div style={{
                                  display: "flex",
                                  gap: "4px",
                                  background: "#f3f4f6",
                                  padding: "4px",
                                  borderRadius: "4px",
                                  flexWrap: "wrap"
                                }}>
                                  {[
                                    { value: "All", label: "All" },
                                    { value: "Active", label: "Active" },
                                    { value: "Inactive", label: "Inactive" },
                                  ].map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => setMemberStatusFilter(option.value)}
                                      style={{
                                        padding: "8px 16px",
                                        borderRadius: "4px",
                                        border: "none",
                                        fontSize: "0.875rem",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        background: memberStatusFilter === option.value
                                          ? "#5a31ea"
                                          : "transparent",
                                        color: memberStatusFilter === option.value ? "#ffffff" : "#6b7280",
                                        boxShadow: memberStatusFilter === option.value
                                          ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                          : "none",
                                      }}
                                      onMouseEnter={(e) => {
                                        if (memberStatusFilter !== option.value) {
                                          e.target.style.background = "#e5e7eb";
                                          e.target.style.color = "#374151";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (memberStatusFilter !== option.value) {
                                          e.target.style.background = "transparent";
                                          e.target.style.color = "#6b7280";
                                        }
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-md flex-nowrap items-center" style={{ marginLeft: "16px" }}>
                                  <label className="font-semibold" style={{ color: "#1a1a1a" }}>Filter by Year:</label>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMemberYearFilter("All");
                                        setMembersPage(1);
                                      }}
                                      style={{
                                        padding: "8px 12px",
                                        borderRadius: "4px 0 0 4px",
                                        border: "1px solid #e5e7eb",
                                        borderRight: "none",
                                        background: memberYearFilter === "All" ? "#5a31ea" : "#ffffff",
                                        color: memberYearFilter === "All" ? "#ffffff" : "#6b7280",
                                        fontSize: "0.875rem",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        outline: "none",
                                        transition: "all 0.2s ease",
                                        whiteSpace: "nowrap"
                                      }}
                                      onMouseEnter={(e) => {
                                        if (memberYearFilter !== "All") {
                                          e.target.style.background = "#f3f4f6";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (memberYearFilter !== "All") {
                                          e.target.style.background = "#ffffff";
                                        }
                                      }}
                                    >
                                      All
                                    </button>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                      <input
                                        type="text"
                                        value={memberYearFilter === "All" ? "" : memberYearFilter}
                                        placeholder="Year"
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          // Allow empty, "All", or valid year (4 digits)
                                          if (value === "" || value === "All" || /^\d{0,4}$/.test(value)) {
                                            setMemberYearFilter(value === "" ? "All" : value);
                                            setMembersPage(1);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          // Allow arrow keys to increment/decrement
                                          if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            const currentYear = memberYearFilter === "All" || memberYearFilter === "" ? new Date().getFullYear() : parseInt(memberYearFilter);
                                            if (!isNaN(currentYear)) {
                                              setMemberYearFilter(String(currentYear + 1));
                                              setMembersPage(1);
                                            }
                                          } else if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            const currentYear = memberYearFilter === "All" || memberYearFilter === "" ? new Date().getFullYear() : parseInt(memberYearFilter);
                                            if (!isNaN(currentYear) && currentYear > 1900) {
                                              setMemberYearFilter(String(currentYear - 1));
                                              setMembersPage(1);
                                            }
                                          }
                                        }}
                                        style={{
                                          padding: "8px 32px 8px 12px",
                                          borderRadius: "0",
                                          border: "1px solid #e5e7eb",
                                          borderLeft: "none",
                                          borderRadius: "0 4px 4px 0",
                                          borderRight: "1px sol",
                                          background: "#ffffff",
                                          fontSize: "0.875rem",
                                          fontWeight: "500",
                                          outline: "none",
                                          transition: "border-color 0.2s",
                                          width: "100px",
                                          textAlign: "center"
                                        }}
                                        onFocus={(e) => {
                                          e.target.style.borderColor = "#5a31ea";
                                          e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                                        }}
                                        onBlur={(e) => {
                                          e.target.style.borderColor = "#e5e7eb";
                                          e.target.style.boxShadow = "none";
                                          // Validate year on blur
                                          if (e.target.value && e.target.value !== "All") {
                                            const year = parseInt(e.target.value);
                                            if (isNaN(year) || year < 1900 || year > 2100) {
                                              setMemberYearFilter("All");
                                            }
                                          }
                                        }}
                                      />
                                      <div style={{ 
                                        position: "absolute", 
                                        right: "4px", 
                                        display: "flex", 
                                        flexDirection: "column",
                                        gap: "2px"
                                      }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const currentYear = memberYearFilter === "All" || memberYearFilter === "" ? new Date().getFullYear() : parseInt(memberYearFilter);
                                            if (!isNaN(currentYear)) {
                                              setMemberYearFilter(String(currentYear + 1));
                                              setMembersPage(1);
                                            }
                                          }}
                                          style={{
                                            padding: "2px 4px",
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "10px",
                                            color: "#6b7280",
                                            lineHeight: "1",
                                            transition: "color 0.2s"
                                          }}
                                          onMouseEnter={(e) => {
                                            e.target.style.color = "#5a31ea";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.color = "#6b7280";
                                          }}
                                          title="Increase year"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const currentYear = memberYearFilter === "All" || memberYearFilter === "" ? new Date().getFullYear() : parseInt(memberYearFilter);
                                            if (!isNaN(currentYear) && currentYear > 1900) {
                                              setMemberYearFilter(String(currentYear - 1));
                                              setMembersPage(1);
                                            }
                                          }}
                                          style={{
                                            padding: "2px 4px",
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "10px",
                                            color: "#6b7280",
                                            lineHeight: "1",
                                            transition: "color 0.2s"
                                          }}
                                          onMouseEnter={(e) => {
                                            e.target.style.color = "#5a31ea";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.color = "#6b7280";
                                          }}
                                          title="Decrease year"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <label className="text-l font-semibold" style={{ whiteSpace: "nowrap" }}>
                                  Search:&nbsp;
                                </label>
                                <input
                                  type="text"
                                  placeholder="Search by name,the year"
                                  value={memberSearchTerm}
                                  onChange={(e) => {
                                    setMemberSearchTerm(e.target.value);
                                    setMembersPage(1); // Reset to first page when searching
                                  }}
                                  className="search-input"
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: "4px",
                                    border: "1px solid #e5e7eb",
                                    background: "#ffffff",
                                    fontSize: "0.875rem",
                                    minWidth: "200px",
                                    outline: "none",
                                    transition: "border-color 0.2s"
                                  }}
                                  onFocus={(e) => {
                                    // e.target.style.borderColor = "#5a31ea";
                                    e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                                  }}
                                  onBlur={(e) => {
                                    // e.target.style.borderColor = "#e5e7eb";
                                    e.target.style.boxShadow = "none";
                                  }}
                                />
                                {/* {memberSearchTerm && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMemberSearchTerm("");
                                      setMembersPage(1);
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      background: "#f9fafb",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      fontSize: "0.875rem",
                                      color: "#666"
                                    }}
                                    title="Clear search"
                                  >
                                    ✕
                                  </button>
                                )} */}
                              </div>
                            </div>

                            {/* Empty State */}
                            {sortedMembers.length === 0 ? (
                              <div className="admin-empty-state">
                                <p className="admin-empty-state-message">
                                  {memberStatusFilter !== "All"
                                    ? `No ${memberStatusFilter.toLowerCase()} members found.`
                                    : "No members found."}
                                </p>
                              </div>
                            ) : (
                              <>
                                <Table
                                  columns={[
                                    "Name",
                                    "Native",
                                    "Year",
                                    "Subscription Type",
                                    "Joined Year",
                                    "Status",
                                    "Outstanding",
                                    "Actions",
                                  ]}
                                  rows={paginatedMembers.map((member) => {
                                    // Derive outstanding numeric amount
                                    const balanceStr = member.balance?.toString() || "";
                                    const numericOutstanding = parseFloat(balanceStr.replace(/[^0-9.]/g, "") || 0) || 0;

                                    // Joined Year
                                    const joinedYear = member.start_date
                                      ? new Date(member.start_date).getFullYear()
                                      : (member.createdAt ? new Date(member.createdAt).getFullYear() : "-");

                                    // Get all invoices for this member (used for multiple purposes)
                                    // Ensure invoices is an array before filtering
                                    const invoicesArray = Array.isArray(invoices) ? invoices : [];
                                    const memberInvoices = invoicesArray.filter(inv => 
                                      inv && (
                                        inv.memberId === member.id || 
                                        inv.memberEmail === member.email || 
                                        inv.memberName === member.name
                                      )
                                    );

                                    // Subscription Year - extract from latest invoice period, or fallback to next_due_date/nextDue
                                    let subYear = "-";
                                    if (memberInvoices.length > 0) {
                                      // Get the most recent invoice (by date or use the first one)
                                      const latestInvoice = memberInvoices[0];
                                      if (latestInvoice.period) {
                                        const periodStr = String(latestInvoice.period).trim();
                                        const yearMatch = periodStr.match(/\d{4}/);
                                        if (yearMatch) {
                                          subYear = yearMatch[0];
                                        }
                                      }
                                    }
                                    // Fallback to next_due_date or nextDue if no invoice found or no year in period
                                    if (subYear === "-") {
                                      if (member.next_due_date) {
                                        subYear = new Date(member.next_due_date).getFullYear().toString();
                                      } else if (member.nextDue) {
                                        const nextDueStr = String(member.nextDue).trim();
                                        const yearMatch = nextDueStr.match(/\d{4}/);
                                        subYear = yearMatch ? yearMatch[0] : nextDueStr.split('-')[0] || "-";
                                      }
                                    }

                                    // Derive status: Active / Inactive only
                                    let derivedStatus = "Active";

                                    if (member.status === "Inactive") {
                                      derivedStatus = "Inactive";
                                    } else {
                                      derivedStatus = "Active";
                                    }

                                    const statusBadgeClass =
                                      derivedStatus === "Active"
                                        ? "badge badge-active"
                                        : "badge badge-inactive";

                                    // Count unpaid invoices for this member (using effective status)
                                    // Ensure memberInvoices is defined and is an array
                                    const validMemberInvoices = Array.isArray(memberInvoices) ? memberInvoices : [];
                                    const unpaidInvoices = validMemberInvoices.filter(inv => {
                                      if (!inv) return false;
                                      try {
                                        const effectiveStatus = getEffectiveInvoiceStatus(inv);
                                        return effectiveStatus === "Unpaid" || effectiveStatus === "Overdue";
                                      } catch (error) {
                                        // Fallback to invoice status if getEffectiveInvoiceStatus fails
                                        console.warn("Error getting effective invoice status:", error);
                                        return inv.status === "Unpaid" || inv.status === "Overdue";
                                      }
                                    });
                                    const unpaidInvoiceCount = unpaidInvoices.length;
                                    
                                    // Check if member has 1 or more unpaid invoices
                                    const hasUnpaidInvoices = unpaidInvoiceCount >= 1;

                                    const rowData = {
                                      "Name": member.name,
                                      "Native": member.native || "-",
                                      "Year": subYear,
                                      "Subscription Type": member.subscriptionType || "-",
                                      "Joined Year": joinedYear,
                                      Status: {
                                        render: () => (
                                          <span className={statusBadgeClass}>
                                            {derivedStatus}
                                          </span>
                                        ),
                                      },
                                      Outstanding: {
                                        render: () => (
                                          <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            <span
                                              style={{
                                                color:
                                                  numericOutstanding > 0
                                                    ? derivedStatus === "Overdue"
                                                      ? "#ef4444"
                                                      : "#ef4444"
                                                    : "#111827",
                                                fontWeight: numericOutstanding > 0 ? 600 : 500,
                                              }}
                                            >
                                              HK$
                                              {formatNumber(numericOutstanding, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              })}
                                            </span>
                                          </div>
                                        ),
                                      },
                                      Actions: {
                                        render: () => (
                                          <div className="flex gap-sm flex-wrap justify-center">
                                            <button
                                              className="ghost-btn icon-btn icon-btn--view"
                                              onClick={() => handleViewMemberDetail(member)}
                                              aria-label="View member"
                                            >
                                              <Tooltip text="View member" position="top">
                                              <i className="fas fa-eye" aria-hidden="true"></i>
                                              </Tooltip>
                                            </button>
                                            <button
                                              className="secondary-btn icon-btn icon-btn--edit"
                                              onClick={() => handleEditMember(member)}
                                              aria-label="Edit member"
                                            >
                                              <Tooltip text="Edit member" position="top">
                                              <i className="fas fa-pen" aria-hidden="true"></i>
                                              </Tooltip>
                                            </button>
                                            {isOwner && (
                                              <button
                                                className="ghost-btn icon-btn icon-btn--delete"
                                                style={{ color: "#ef4444" }}
                                                onClick={() => {
                                                  showConfirmation(
                                                    `Delete member ${member.name}? This cannot be undone.`,
                                                    () => handleDeleteMember(member.id)
                                                  );
                                                }}
                                                aria-label="Delete member"
                                              >
                                                <Tooltip text="Delete member" position="top">
                                                  <i className="fas fa-trash" aria-hidden="true"></i>
                                                </Tooltip>
                                              </button>
                                            )}
                                          </div>
                                        ),
                                      },
                                    };

                                    // Apply row background color if member has 1 or more unpaid invoices
                                    // Always set _rowStyle property (even if empty) to ensure it's recalculated on re-render
                                    if (hasUnpaidInvoices) {
                                      rowData._rowStyle = {
                                        backgroundColor: "rgb(254, 242, 242)"
                                      };
                                    } else {
                                      // Explicitly set to undefined to clear any previous styling
                                      rowData._rowStyle = undefined;
                                    }

                                    return rowData;
                                  })}
                                />
                                {sortedMembers.length > 0 && (
                                  <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setMembersPage}
                                    pageSize={membersPageSize}
                                    onPageSizeChange={setMembersPageSize}
                                    totalItems={sortedMembers.length}
                                  />
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              )}

              {/* MEMBER DETAIL */}
              {activeSection === "member-detail" && !selectedMember && (
                <article className="screen-card" id="member-detail">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("member-detail")}
                      <h3>Member Detail</h3>
                      <p>360º view with invoices, payment history, communications.</p>
                    </div>
                  </header>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "80px 40px",
                    textAlign: "center",
                    minHeight: "400px"
                  }}>
                    <div style={{
                      fontSize: "4rem",
                      marginBottom: "24px",
                      color: "#d1d5db",
                      opacity: 0.7
                    }}>
                      <i className="fas fa-user-circle"></i>
                    </div>
                    <h3 style={{
                      fontSize: "1.5rem",
                      fontWeight: "600",
                      color: "#1a1a1a",
                      marginBottom: "12px"
                    }}>
                      No Member Selected
                    </h3>
                    <p style={{
                      fontSize: "1rem",
                      color: "#666",
                      marginBottom: "32px",
                      maxWidth: "500px",
                      lineHeight: "1.6"
                    }}>
                      Please select a member from the members list to view their detailed information, invoices, payment history, and communications.
                    </p>
                    <button
                      className="primary-btn"
                      onClick={() => setActiveSection("members")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <i className="fas fa-users"></i>
                      Go to Members List
                    </button>
                  </div>
                </article>
              )}

              {activeSection === "member-detail" && selectedMember && (
                <article className="screen-card" id="member-detail">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("member-detail")}
                      <h3>Member Detail</h3>
                      <p>360º view with invoices, payment history, communications.</p>
                    </div>
                  </header>
                  <div className="admin-members-detail-card">
                    {/* Member Header */}
                    <div className="admin-members-detail-header">
                      <div className="admin-members-detail-header-info">
                        <div className="admin-members-detail-avatar">
                          {selectedMember.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <h4 className="admin-members-detail-name">
                            {selectedMember.name}
                          </h4>
                          <p className="admin-members-detail-meta">
                            Member ID {selectedMember.id} · {selectedMember.email} · WhatsApp {selectedMember.phone}
                          </p>
                        </div>
                      </div>
                      <div className="admin-members-detail-header-actions">
                        {!isViewer && (
                          <>
                            <button
                              className="secondary-btn"
                              onClick={() => {
                                setInvoiceForm({ ...invoiceForm, memberId: selectedMember.id });
                                setActiveSection("invoice-builder");
                              }}
                            >
                              Create Invoice
                            </button>
                            <button
                              className="primary-btn admin-members-detail-reminder-btn"
                              onClick={() => handleRequestReminder(selectedMember, false)}
                              title="Send reminder"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                                <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="#ffffff" />
                              </svg>
                              Send Reminder
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="kpi-grid">
                      <div className="admin-dashboard-kpi-card">
                        <p className="admin-dashboard-kpi-label">
                          <i className="fas fa-exclamation-triangle admin-dashboard-kpi-icon--red"></i>
                          Outstanding Balance
                        </p>
                        <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--red">
                          {(() => {
                            const memberInvoices = getMemberInvoices(selectedMember.id);
                            const unpaidInvoices = memberInvoices.filter(inv => {
                              const effectiveStatus = getEffectiveInvoiceStatus(inv);
                              return effectiveStatus === "Unpaid" || effectiveStatus === "Overdue";
                            });
                            const outstandingTotal = unpaidInvoices.reduce((sum, inv) => {
                              const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, '') || 0);
                              return sum + amount;
                            }, 0);
                            return `HK$${outstandingTotal.toFixed(2)}`;
                          })()}
                        </h4>
                      </div>
                      <div className="admin-dashboard-kpi-card">
                        <p className="admin-dashboard-kpi-label">
                          <i className="fas fa-calendar-day admin-dashboard-kpi-icon"></i>
                          Next Due Date
                        </p>
                        <h4 className="admin-dashboard-kpi-value">
                          {(() => {
                            // Show '-' if payment_status is unpaid or next_due_date is null
                            if (selectedMember.payment_status === 'unpaid' || !selectedMember.next_due_date) {
                              return '-';
                            }
                            // Format next_due_date if it exists (DD/MM/YYYY format)
                            if (selectedMember.next_due_date) {
                              try {
                                const date = new Date(selectedMember.next_due_date);
                                return date.toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                });
                              } catch (e) {
                                // Fallback to nextDue if date parsing fails
                                return selectedMember.nextDue || '-';
                              }
                            }
                            // Fallback to nextDue field
                            return selectedMember.nextDue || '-';
                          })()}
                        </h4>
                      </div>
                      <div className="admin-dashboard-kpi-card">
                        <p className="admin-dashboard-kpi-label">
                          <i className="fas fa-dollar-sign admin-dashboard-kpi-icon--green"></i>
                          Last Payment
                        </p>
                        <h4 className="admin-dashboard-kpi-value">
                          {(() => {
                            // Use last_payment_date if available, otherwise fallback to lastPayment
                            if (selectedMember.last_payment_date) {
                              try {
                                const date = new Date(selectedMember.last_payment_date);
                                return date.toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                });
                              } catch (e) {
                                return selectedMember.lastPayment || '-';
                              }
                            }
                            return selectedMember.lastPayment || '-';
                          })()}
                        </h4>
                      </div>
                      <div className="admin-dashboard-kpi-card">
                        <p className="admin-dashboard-kpi-label">
                          <i className="fas fa-info-circle admin-dashboard-kpi-icon"></i>
                          Status
                        </p>
                        <h4 className="admin-dashboard-kpi-value">{selectedMember.status}</h4>
                      </div>
                      <div className="admin-dashboard-kpi-card">
                        <p className="admin-dashboard-kpi-label">
                          <i className="fas fa-calendar-check admin-dashboard-kpi-icon"></i>
                          Joining Date
                        </p>
                        <h4 className="admin-dashboard-kpi-value">
                          {selectedMember.start_date ? new Date(selectedMember.start_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          }) : (selectedMember.createdAt ? new Date(selectedMember.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          }) : "-")}
                        </h4>
                      </div>
                    </div>

                    {/* Overdue warning */}
                    {(() => {
                      const memberInvoices = getMemberInvoices(selectedMember.id);
                      const overdueInvoices = memberInvoices.filter(
                        (inv) => getEffectiveInvoiceStatus(inv) === "Overdue"
                      );
                      const outstandingTotal = overdueInvoices.reduce((sum, inv) => {
                        const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, "") || 0);
                        return sum + amount;
                      }, 0);

                      if (overdueInvoices.length === 0 && outstandingTotal <= 0) return null;

                      return (
                        <div
                          style={{
                            marginTop: "20px",
                            padding: "16px 20px",
                            borderRadius: "8px",
                            background:
                              "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            color: "#ef4444",
                            fontSize: "0.875rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <i className="fas fa-exclamation-triangle" aria-hidden="true" style={{ fontSize: "1.125rem" }}></i>
                          <span>
                            This member has{" "}
                            <strong>{overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}</strong>{" "}
                            totaling{" "}
                            <strong>
                              HK$
                              {formatNumber(outstandingTotal, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </strong>
                            . Please follow up as soon as possible.
                          </span>
                        </div>
                      );
                    })()}

                    <div className="tabs">
                      <button
                        className={`tab ${activeTab === "Invoices" ? "active" : ""}`}
                        onClick={() => setActiveTab("Invoices")}
                      >
                        Invoices
                      </button>
                      <button
                        className={`tab ${activeTab === "Payment History" ? "active" : ""}`}
                        onClick={() => setActiveTab("Payment History")}
                      >
                        Payment History
                      </button>
                      <button
                        className={`tab ${activeTab === "Communication" ? "active" : ""}`}
                        onClick={() => setActiveTab("Communication")}
                      >
                        Communication
                      </button>
                      {/* Activity tab hidden */}
                      {/* <button
                        className={`tab ${activeTab === "Activity" ? "active" : ""}`}
                        onClick={() => setActiveTab("Activity")}
                      >
                        Activity
                      </button> */}
                      {/* Notes tab hidden */}
                      {/* <button
                        className={`tab ${activeTab === "Notes" ? "active" : ""}`}
                        onClick={() => setActiveTab("Notes")}
                      >
                        Notes
                      </button> */}
                    </div>

                    {activeTab === "Invoices" && (
                      <div className="tab-panel">
                        <div className="table-header">
                          <div>
                            <h4>Invoices</h4>
                            {(() => {
                              const memberInvoices = getMemberInvoices(selectedMember.id);
                              const unpaidInvoices = memberInvoices.filter(inv => {
                                const effectiveStatus = getEffectiveInvoiceStatus(inv);
                                return effectiveStatus === "Unpaid" || effectiveStatus === "Overdue";
                              });
                              const outstandingTotal = unpaidInvoices.reduce((sum, inv) => {
                                const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, '') || 0);
                                return sum + amount;
                              }, 0);

                              return (
                                <p style={{
                                  margin: "4px 0 0 0",
                                  fontSize: "0.875rem",
                                  color: "#666",
                                  fontWeight: "500"
                                }}>
                                  Total Outstanding: <strong style={{ color: "#1a1a1a" }}>{formatCurrency(outstandingTotal)}</strong>
                                  {unpaidInvoices.length > 0 && (
                                    <span style={{ marginLeft: "8px", color: "#666" }}>
                                      ({unpaidInvoices.length} unpaid invoice{unpaidInvoices.length > 1 ? 's' : ''})
                                    </span>
                                  )}
                                </p>
                              );
                            })()}
                          </div>
                          <div>
                            <button
                              className="secondary-btn"
                              onClick={() => {
                                setInvoiceForm({ ...invoiceForm, memberId: selectedMember.id });
                                setActiveSection("invoice-builder");
                              }}
                            >
                              Create Invoice
                            </button>
                          </div>
                        </div>
                        <Table
                          columns={[
                            "Invoice #",
                            "Year",
                            "Subscription Type",
                            "Amount",
                            "Status",
                            "Due Date",
                            "Actions",
                          ]}
                          rows={getMemberInvoices(selectedMember.id).map((invoice) => {
                            const effectiveStatus = getEffectiveInvoiceStatus(invoice);
                            const isUnpaid = effectiveStatus === "Unpaid" || effectiveStatus === "Overdue";
                            const isPaid =
                              effectiveStatus === "Paid" ||
                              effectiveStatus === "Completed";

                            // Display invoice's own stored due date (never auto-updated)
                            // Each invoice has its own due_date set at creation time and never changes
                            const getDueDateDisplay = () => {
                              // Always use the invoice's own 'due' field - it's stored per invoice and never changes
                              // Never calculate or use today's date - always use the stored invoice.due value
                              if (!invoice.due) {
                                return '-';
                              }
                              
                              // Backend stores due date as "DD MMM YYYY" format (e.g., "01 Jan 2026")
                              // If it's already a formatted string, return it as-is
                              if (typeof invoice.due === 'string') {
                                // Check if it's already in a readable format (contains month name or date separators)
                                if (invoice.due.includes('/') || invoice.due.includes('-') || 
                                    /[A-Za-z]{3}/.test(invoice.due)) {
                                  // It's already formatted (e.g., "01 Jan 2026" or "01/01/2026" or "2026-01-01")
                                  return invoice.due;
                                }
                                
                                // Try to parse and format if it's a date string
                                try {
                                  const date = new Date(invoice.due);
                                  if (!isNaN(date.getTime())) {
                                    // Format as DD/MM/YYYY for consistency
                                    return date.toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    });
                                  }
                                } catch (e) {
                                  // If parsing fails, return the original value
                                }
                              }
                              
                              // Fallback: return the original value
                              return invoice.due || '-';
                            };

                            // Determine subscription type based on invoice amount
                            const invoiceAmount = invoice.amount
                              ? parseFloat(invoice.amount.replace(/[^0-9.]/g, '') || 0)
                              : 0;
                            
                            let subscriptionType = selectedMember?.subscriptionType || invoice.subscriptionType || "-";
                            // If amount is 250, show "Lifetime"; if 500, show "Yearly + Janaza Fund"
                            if (invoiceAmount === 250 || invoiceAmount === 250.00) {
                              subscriptionType = "Lifetime";
                            } else if (invoiceAmount === 500 || invoiceAmount === 500.00) {
                              subscriptionType = "Yearly + Janaza Fund";
                            }

                            return {
                              "Invoice #": invoice.id,
                              "Year": invoice.period || "-",
                              "Subscription Type": subscriptionType,
                              Amount: invoice.amount
                                ? `HK$${formatNumber(invoiceAmount, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                                : "HK$0.00",
                              Status: {
                                render: () => (
                                  <span className={statusClass[invoice.status]}>
                                    {invoice.status}
                                  </span>
                                ),
                              },
                              "Due Date": getDueDateDisplay(),
                              Screenshot: invoice.screenshot ? {
                                render: () => (
                                  <button
                                    onClick={() => {
                                      const newWindow = window.open();
                                      if (newWindow) {
                                        newWindow.document.write(`
                                        <html>
                                          <head><title>Payment Screenshot - ${invoice.id}</title></head>
                                          <body style="margin:0;padding:20px;background:#f9fafb;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                            <img src="${invoice.screenshot}" alt="Payment Screenshot" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                                          </body>
                                        </html>
                                      `);
                                      }
                                    }}
                                    style={{
                                      padding: "4px 10px",
                                      background: "#5a31ea",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: "4px",
                                      fontSize: "0.85rem",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease",
                                      boxShadow: "0 2px 4px rgba(90, 49, 234, 0.3)"
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.background = "#4a28d0";
                                      e.target.style.boxShadow = "0 4px 8px rgba(90, 49, 234, 0.4)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.background = "#5a31ea";
                                      e.target.style.boxShadow = "0 2px 4px rgba(90, 49, 234, 0.3)";
                                    }}
                                    aria-label="View screenshot"
                                  >
                                    <Tooltip text="View screenshot" position="top">
                                    <i className="fas fa-image" aria-hidden="true"></i>
                                    </Tooltip>
                                  </button>
                                )
                              } : "-",
                              Actions: {
                                render: () => (
                                  <div className="flex gap-sm flex-wrap justify-center">
                                    {isUnpaid && !isViewer && (
                                      <button
                                        className="primary-btn"
                                        style={{
                                          padding: "4px 10px",
                                          fontSize: "0.85rem",
                                          background: "#10b981",
                                          border: "none",
                                          color: "#ffffff",
                                          fontWeight: "600",
                                          borderRadius: "4px",
                                          cursor: "pointer",
                                          transition: "all 0.2s ease",
                                          boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)"
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.background = "#059669";
                                          e.target.style.boxShadow = "0 4px 8px rgba(16, 185, 129, 0.4)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.background = "#10b981";
                                          e.target.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.3)";
                                        }}
                                        onClick={() => {
                                          setPaymentModalInvoice(invoice);
                                          setPaymentModalData({
                                            paymentMethod: "",
                                            imageFile: null,
                                            imagePreview: null,
                                            imageUrl: invoice.screenshot || "",
                                            reference: "",
                                            selectedAdminId: "",
                                            adminMobile: "",
                                          });
                                          setPaymentModalErrors({ image: false, reference: false, selectedAdminId: false, adminMobile: false });
                                          setCurrentInvalidPaymentModalField(null);
                                          setShowPaymentModal(true);
                                        }}
                                      >
                                        Pay
                                      </button>
                                    )}
                                    {!isPaid && !isViewer && (
                                      <button
                                        className="ghost-btn icon-btn icon-btn--delete"
                                        onClick={() => {
                                          showConfirmation(
                                            `Delete invoice ${invoice.id}? This cannot be undone.`,
                                            () => handleDeleteInvoice(invoice.id)
                                          );
                                        }}
                                        aria-label="Delete Invoice"
                                      >
                                        <Tooltip text="Delete Invoice" position="top">
                                        <i className="fas fa-trash" aria-hidden="true"></i>
                                        </Tooltip>
                                      </button>
                                    )}
                                  </div>
                                ),
                              },
                            };
                          })}
                        />
                      </div>
                    )}

                    {activeTab === "Payment History" && (
                      <div className="tab-panel tab-panel--payment-history">
                        {(() => {
                          // Filter payment history for selected member
                          const memberPayments = paymentHistory
                            .filter((payment) =>
                              payment.memberId === selectedMember.id ||
                              payment.memberEmail === selectedMember.email ||
                              payment.member === selectedMember.name
                            )
                            .sort((a, b) => {
                              // Sort by date, newest first
                              const dateA = new Date(a.date || 0);
                              const dateB = new Date(b.date || 0);
                              return dateB - dateA;
                            });

                          if (memberPayments.length === 0) {
                            return (
                              <div
                                style={{
                                  textAlign: "center",
                                  padding: "40px 20px",
                                  color: "#666",
                                }}
                              >
                                <p className="m-0 text-base">
                                  No payment history available for this member.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div
                              className="payment-history-list"
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fill, minmax(350px, 1fr))",
                                gap: "20px",
                              }}
                            >
                              {memberPayments.map((item, idx) => {
                                return (
                                  <div
                                    key={idx}
                                    className="payment-history-card"
                                    onClick={() => {
                                      setSelectedPaymentDetails(item);
                                      setShowPaymentDetailsModal(true);
                                    }}
                                    style={{
                                      background: "#fff",
                                      border: "none",
                                      borderRadius: "12px",
                                      padding: "20px",
                                      transition: "all 0.3s ease",
                                      boxShadow:
                                        "0 2px 8px rgba(90, 49, 234, 0.08)",
                                      cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(90, 49, 234, 0.15)";
                                      e.currentTarget.style.transform = "translateY(-2px)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(90, 49, 234, 0.08)";
                                      e.currentTarget.style.transform = "translateY(0)";
                                    }}
                                  >
                                    {/* Card header */}
                                    <div
                                      className="payment-history-card__main"
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        width: "100%",
                                      }}
                                    >
                                      <div>
                                        <div
                                          style={{
                                            fontSize: "1rem",
                                            fontWeight: "600",
                                            color: "#000",
                                          }}
                                        >
                                          {item.member || item.memberName || item.memberId || "-"}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "12px",
                                        }}
                                      >
                                        {item.amount && (
                                          <strong
                                            style={{
                                              fontSize: "1.125rem",
                                              fontWeight: "700",
                                              color: "#5a31ea",
                                            }}
                                          >
                                            {item.amount}
                                          </strong>
                                        )}
                                        {item.status && (
                                          <span
                                            className={`badge ${item.status === "Paid" ||
                                              item.status === "Completed"
                                              ? "badge-paid"
                                              : item.status ===
                                                "Pending Verification" ||
                                                item.status === "Pending"
                                                ? "badge-pending"
                                                : "badge-unpaid"
                                              }`}
                                            style={{
                                              fontSize: "0.75rem",
                                              padding: "4px 10px",
                                            }}
                                          >
                                            {item.status}
                                          </span>
                                        )}
                                        <i
                                          className="fas fa-chevron-right"
                                          style={{
                                            fontSize: "0.875rem",
                                            color: "#999",
                                          }}
                                        ></i>
                                      </div>
                                    </div>

                                    {/* Quick preview info */}
                                    <div
                                      style={{
                                        marginTop: "12px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                          flex: 1,
                                        }}
                                      >
                                        {item.date && (
                                          <span
                                            style={{
                                              fontSize: "0.8125rem",
                                              color: "#666",
                                            }}
                                          >
                                            {item.date}
                                          </span>
                                        )}
                                        <span
                                          style={{
                                            fontSize: "0.8125rem",
                                            color: "#666",
                                          }}
                                        >
                                          {getPaymentMethodDisplay(item)}
                                        </span>
                                      </div>
                                      {item.screenshot && (
                                        <div
                                          style={{
                                            width: "60px",
                                            height: "60px",
                                            borderRadius: "4px",
                                            overflow: "hidden",
                                            border: "2px solid #e0e0e0",
                                            flexShrink: 0,
                                            marginLeft: "12px",
                                          }}
                                        >
                                          <img
                                            src={item.screenshot}
                                            alt="Payment attachment"
                                            style={{
                                              width: "100%",
                                              height: "100%",
                                              objectFit: "cover",
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {activeTab === "Communication" && (
                      <div className="tab-panel">
                        <h4>Communication History</h4>
                        {(() => {
                          // Filter communication log for selected member
                          const memberCommunications = communicationLog
                            .filter((comm) =>
                              comm.memberId === selectedMember.id ||
                              (comm.memberEmail &&
                                selectedMember.email &&
                                comm.memberEmail.toLowerCase() === selectedMember.email.toLowerCase()) ||
                              (comm.memberName &&
                                selectedMember.name &&
                                comm.memberName.toLowerCase() === selectedMember.name.toLowerCase())
                            )
                            .sort((a, b) => {
                              // Sort by date, newest first
                              const dateA = new Date(a.date || a.timestamp || 0);
                              const dateB = new Date(b.date || b.timestamp || 0);
                              return dateB - dateA;
                            });

                          if (memberCommunications.length === 0) {
                            return (
                              <div
                                style={{
                                  textAlign: "center",
                                  padding: "40px 20px",
                                  color: "#666",
                                }}
                              >
                                <p className="m-0 text-base">
                                  No communication history available for this member.
                                </p>
                              </div>
                            );
                          }

                          // Summary: how many reminders and by which channel
                          const totalReminders = memberCommunications.length;
                          const emailCount = memberCommunications.filter(
                            (c) => c.channel === "Email"
                          ).length;
                          const whatsappCount = memberCommunications.filter(
                            (c) => c.channel === "WhatsApp"
                          ).length;

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "12px",
                                  padding: "12px 16px",
                                  borderRadius: "4px",
                                  background: "#f9fafb",
                                  border: "1px solid #e5e7eb",
                                }}
                              >
                                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                                  Reminders sent to this member:
                                </span>
                                <span className="badge badge-paid">
                                  Total: {totalReminders}
                                </span>
                                <span className="badge badge-unpaid">
                                  Email: {emailCount}
                                </span>
                                <span className="badge badge-pending">
                                  WhatsApp: {whatsappCount}
                                </span>
                              </div>

                              <ul className="timeline">
                                {memberCommunications.map((item, idx) => (
                                  <li key={idx}>
                                    <p>
                                      <strong>{item.channel || "-"}</strong>
                                      {item.type ? ` · ${item.type}` : ""}
                                      {" · "}
                                      {item.message || "-"}
                                      {" · "}
                                      {item.date
                                        ? new Date(item.date).toLocaleString()
                                        : item.timestamp
                                          ? new Date(item.timestamp).toLocaleString()
                                          : "-"}
                                    </p>
                                    {item.status && (
                                      <span className={statusClass[item.status] || "badge"}>
                                        {item.status}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Activity tab panel hidden */}
                    {/* {activeTab === "Activity" && (
                      <div className="tab-panel">
                        <h4>Activity Timeline</h4>
                        {(() => {
                          const memberInvoices = getMemberInvoices(selectedMember.id).map((inv) => {
                            const status = getEffectiveInvoiceStatus(inv);
                            const date = inv.createdAt || inv.date || inv.due || null;
                            return {
                              type: "Invoice",
                              date: date ? new Date(date) : null,
                              label: `Invoice ${inv.id || ""} · ${inv.period || ""} · ${
                                inv.amount || ""
                              } · ${status || "-"}`,
                            };
                          });

                          const memberPayments = (paymentHistory || [])
                            .filter(
                              (payment) =>
                                payment.memberId === selectedMember.id ||
                                (payment.memberEmail &&
                                  selectedMember.email &&
                                  payment.memberEmail.toLowerCase() ===
                                    selectedMember.email.toLowerCase()) ||
                                (payment.member &&
                                  selectedMember.name &&
                                  payment.member.toLowerCase() ===
                                    selectedMember.name.toLowerCase())
                            )
                            .map((p) => ({
                              type: "Payment",
                              date: p.date ? new Date(p.date) : null,
                              label: `${p.method || "Payment"} · ${p.amount || ""} · ${
                                p.status || ""
                              }`,
                            }));

                          const memberComms = (communicationLog || [])
                            .filter((item) => {
                              const matchesEmail =
                                item.memberEmail &&
                                selectedMember.email &&
                                item.memberEmail.toLowerCase() ===
                                  selectedMember.email.toLowerCase();
                              const matchesName =
                                item.memberName &&
                                selectedMember.name &&
                                item.memberName.toLowerCase() ===
                                  selectedMember.name.toLowerCase();
                              return matchesEmail || matchesName;
                            })
                            .map((c) => ({
                              type: c.type || c.channel || "Communication",
                              date: c.date ? new Date(c.date) : c.timestamp ? new Date(c.timestamp) : null,
                              label: c.message || "Communication sent",
                            }));

                          const allEvents = [...memberInvoices, ...memberPayments, ...memberComms]
                            .filter((e) => e.date)
                            .sort((a, b) => b.date - a.date);

                          if (allEvents.length === 0) {
                            return (
                              <div
                                style={{
                                  textAlign: "center",
                                  padding: "40px 20px",
                                  color: "#666",
                                }}
                              >
                                <p className="m-0 text-base">
                                  No activity recorded for this member yet.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="payment-history-list">
                              {allEvents.map((event, index) => (
                                <div key={index} className="payment-history-card">
                                  <div className="payment-card-header">
                                    <div className="payment-card-main">
                                      <span className="payment-amount">{event.type}</span>
                                      <span className="payment-meta">
                                        {event.date?.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="payment-card-body">
                                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#4b5563" }}>
                                      {event.label}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )} */}

                    {/* Notes tab panel hidden */}
                    {/* {activeTab === "Notes" && (
                      <div className="tab-panel">
                        <h4>Internal Notes</h4>
                        <p className="text-sm mb-md" style={{ color: "#6b7280" }}>
                          These notes are <strong>internal only</strong> and are not visible to members.
                        </p>
                        <textarea
                          value={memberNoteDraft}
                          onChange={(e) => setMemberNoteDraft(e.target.value)}
                          rows={5}
                          className="settings-form__input"
                          placeholder="Add any internal notes about this member (e.g., context, special arrangements, follow-up actions)..."
                          disabled={isViewer}
                        />
                        {!isViewer && (
                          <div style={{ marginTop: "12px", textAlign: "right" }}>
                            <button
                              className="primary-btn"
                              onClick={() => {
                                const updated = { ...memberNotes, [selectedMember.id]: memberNoteDraft };
                                setMemberNotes(updated);
                                localStorage.setItem("memberNotes", JSON.stringify(updated));
                                showToast("Internal note saved");
                              }}
                            >
                              Save Note
                            </button>
                          </div>
                        )}
                        {isViewer && (
                          <p style={{ marginTop: "8px", fontSize: "0.8rem", color: "#6b7280" }}>
                            You have read-only access. Contact an Owner or Admin to update notes.
                          </p>
                        )}
                      </div>
                    )} */}
                  </div>
                </article>
              )}

              {/* INVOICE BUILDER */}
              {activeSection === "invoice-builder" && (
                <article className="screen-card" id="invoice-builder">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("invoice-builder")}
                      <h3><i className="fas fa-file-invoice" style={{ marginRight: "10px" }}></i>Invoice Builder</h3>
                      <p>Create invoices for Lifetime or Yearly + Janaza Fund subscriptions.</p>
                    </div>
                  </header>

                  {/* Invoice Success Card */}
                  {showInvoiceSuccessCard && lastCreatedInvoice && (
                    <div style={{
                      marginBottom: "24px",
                      padding: "24px",
                      background: "#f0f9ff",
                      borderRadius: "12px",
                      border: "2px solid #5a31ea",
                      boxShadow: "0 4px 12px rgba(90, 49, 234, 0.15)"
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                        className="mb-lg">
                        <div className="flex items-center gap-md">
                          <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "#5a31ea",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px",
                            color: "#fff"
                          }}>
                            ✓
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700", color: "#1a1a1a" }}>
                              Invoice Has Been Created
                            </h4>
                            <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem", color: "#666" }}>
                              Invoice for {lastCreatedInvoice.memberName} - {lastCreatedInvoice.period} ({lastCreatedInvoice.amount})
                            </p>
                          </div>
                        </div>
                        {/* <button
                          className="ghost-btn"
                          onClick={() => {
                            setShowInvoiceSuccessCard(false);
                            setLastCreatedInvoice(null);
                          }}
                          style={{ padding: "8px 12px" }}
                        >
                          ×
                        </button> */}
                      </div>

                      <div className="success-card-actions" style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "12px",
                        marginTop: "16px"
                      }}>
                        <button
                          className="primary-btn"
                          onClick={() => {
                            if (lastCreatedInvoice.member) {
                              handleViewMemberDetail(lastCreatedInvoice.member);
                              setActiveSection("member-detail");
                              setShowInvoiceSuccessCard(false);
                            }
                          }}
                          style={{ padding: "12px 20px", fontSize: "0.9375rem", fontWeight: "600" }}
                        >
                          <i className="fas fa-user" style={{ marginRight: "8px" }}></i>
                          Member Detail
                        </button>

                        {/* <button
                          className="secondary-btn"
                          onClick={() => {
                            if (lastCreatedInvoice.member) {
                              handleViewMemberDetail(lastCreatedInvoice.member);
                              setActiveSection("member-detail");
                              setActiveTab("Invoices");
                              setShowInvoiceSuccessCard(false);
                            }
                          }}
                          style={{ padding: "12px 20px", fontSize: "0.9375rem", fontWeight: "600" }}
                        >
                          <i className="fas fa-file-invoice" style={{ marginRight: "8px" }}></i>
                          View Invoice
                        </button> */}

                        <button
                          className="secondary-btn"
                          onClick={async () => {
                            if (lastCreatedInvoice.member) {
                              await handleSendReminder(lastCreatedInvoice.member);
                            }
                          }}
                          style={{ padding: "12px 20px", fontSize: "0.9375rem", fontWeight: "600" }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                            <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="currentColor" />
                          </svg>
                          Send Reminder
                        </button>

                        <button
                          className="ghost-btn"
                          onClick={() => {
                            setShowInvoiceSuccessCard(false);
                            setLastCreatedInvoice(null);
                          }}
                          style={{ padding: "12px 20px", fontSize: "0.9375rem", fontWeight: "600" }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  <form className="card form-grid" onSubmit={handleAddInvoice} noValidate style={{ padding: "20px", background: "#ffffff", boxShadow: "0 4px 16px rgba(90, 49, 234, 0.1)" }}>
                    <label style={{ marginBottom: "24px" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}>
                        <i className="fas fa-hashtag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                        Invoice Number
                      </span>
                      <input
                        type="text"
                        value={nextInvoiceId}
                        readOnly
                        className="mono-input"
                        style={{ color: "#6b7280", background: "#f3f4f6", cursor: "not-allowed" }}
                      />
                    </label>

                    <label style={{ marginBottom: "24px" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Member <span style={{ color: "#ef4444" }}>*</span></span>
                      <div style={{ position: "relative" }} data-member-dropdown>
                        <div
                          onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                          style={{
                            padding: "14px 16px",
                            border: "1px solid #e5e7eb",
                            borderRadius: "10px",
                            background: "#f8f9ff",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            color: invoiceForm.memberId ? "#1a1a1a" : "#9ca3af",
                            minHeight: "48px",
                            boxShadow: "0 2px 4px rgba(90, 49, 234, 0.08)",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 4px 8px rgba(90, 49, 234, 0.12)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = "0 2px 4px rgba(90, 49, 234, 0.08)";
                          }}
                        >
                          <span>
                            {invoiceForm.memberId
                              ? (() => {
                                const selected = members.find(m => m.id === invoiceForm.memberId);
                                return selected ? `${selected.name} (${selected.id})` : "Select Member";
                              })()
                              : "Select Member"}
                          </span>
                          <span style={{
                            fontSize: "0.75rem",
                            color: "#5a31ea",
                            transition: "transform 0.2s ease",
                            transform: showMemberDropdown ? "rotate(180deg)" : "rotate(0deg)",
                            display: "inline-block"
                          }}>▼</span>
                        </div>

                        {showMemberDropdown && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              background: "#fff",
                              border: "none",
                              borderRadius: "10px",
                              marginTop: "8px",
                              maxHeight: "300px",
                              overflow: "hidden",
                              zIndex: 1000,
                              boxShadow: "0 8px 24px rgba(90, 49, 234, 0.15)"
                            }}
                          >
                            {/* Search Input */}
                            <div style={{
                              padding: "12px",
                              borderBottom: "none",
                              background: "#ffffff",
                              boxShadow: "0 2px 4px rgba(90, 49, 234, 0.05)"
                            }}>
                              <div style={{ position: "relative" }}>
                                <input
                                  type="text"
                                  placeholder=" Search member by name or ID..."
                                  value={invoiceMemberSearch}
                                  onChange={(e) => setInvoiceMemberSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  autoFocus
                                  style={{
                                    width: "100%",
                                    padding: "12px 36px 12px 16px",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "4px",
                                    fontSize: "0.875rem",
                                    outline: "none",
                                    background: "#ffffff",
                                    transition: "all 0.2s",
                                    boxShadow: "0 2px 4px rgba(90, 49, 234, 0.08)",
                                    color: "#1a1a1a"
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1), 0 4px 12px rgba(90, 49, 234, 0.12)";
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.boxShadow = "0 2px 4px rgba(90, 49, 234, 0.08)";
                                  }}
                                />
                                {invoiceMemberSearch && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInvoiceMemberSearch("");
                                    }}
                                    style={{
                                      position: "absolute",
                                      right: "8px",
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: "4px",
                                      color: "#666",
                                      fontSize: "0.875rem",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center"
                                    }}
                                    title="Clear search"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              {invoiceMemberSearch && (
                                <div style={{
                                  marginTop: "8px",
                                  fontSize: "0.75rem",
                                  color: "#666"
                                }}>
                                  {members.filter(member =>
                                    !invoiceMemberSearch ||
                                    member.name?.toLowerCase().includes(invoiceMemberSearch.toLowerCase()) ||
                                    member.id?.toLowerCase().includes(invoiceMemberSearch.toLowerCase())
                                  ).length} member{members.filter(member =>
                                    !invoiceMemberSearch ||
                                    member.name?.toLowerCase().includes(invoiceMemberSearch.toLowerCase()) ||
                                    member.id?.toLowerCase().includes(invoiceMemberSearch.toLowerCase())
                                  ).length !== 1 ? 's' : ''} found
                                </div>
                              )}
                            </div>

                            {/* Member List */}
                            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                              {members
                                .filter(member =>
                                  !invoiceMemberSearch ||
                                  member.name?.toLowerCase().includes(invoiceMemberSearch.toLowerCase()) ||
                                  member.id?.toLowerCase().includes(invoiceMemberSearch.toLowerCase())
                                )
                                .map((member) => (
                                  <div
                                    key={member.id}
                                    onClick={() => {
                                      setInvoiceForm({ ...invoiceForm, memberId: member.id });
                                      setShowMemberDropdown(false);
                                      setInvoiceMemberSearch("");
                                    }}
                                    style={{
                                      padding: "14px 16px",
                                      cursor: "pointer",
                                      borderBottom: "none",
                                      background: invoiceForm.memberId === member.id ? "#f0f4ff" : "#fff",
                                      transition: "all 0.2s",
                                      boxShadow: invoiceForm.memberId === member.id ? "0 2px 4px rgba(90, 49, 234, 0.1)" : "none"
                                    }}
                                    onMouseEnter={(e) => {
                                      if (invoiceForm.memberId !== member.id) {
                                        e.currentTarget.style.background = "#f8f9ff";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (invoiceForm.memberId !== member.id) {
                                        e.currentTarget.style.background = "#fff";
                                      }
                                    }}
                                  >
                                    <div style={{ fontWeight: "500", color: "#1a1a1a" }}>{member.name}</div>
                                    <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>
                                      {member.id} {member.email ? `• ${member.email}` : ""}
                                    </div>
                                  </div>
                                ))}

                              {members.filter(member =>
                                !invoiceMemberSearch ||
                                member.name?.toLowerCase().includes(invoiceMemberSearch.toLowerCase()) ||
                                member.id?.toLowerCase().includes(invoiceMemberSearch.toLowerCase())
                              ).length === 0 && (
                                  <div style={{ padding: "16px", textAlign: "center", color: "#999", fontSize: "0.875rem" }}>
                                    No members found
                                  </div>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                      {!invoiceForm.memberId && (
                        <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "4px", display: "none" }}>
                          Please select a member
                        </span>
                      )}
                    </label>

                    <label style={{ marginBottom: "24px" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-id-card" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Invoice Type <span style={{ color: "#ef4444" }}>*</span></span>
                      <select
                        required
                        value={invoiceForm.invoiceType}
                        onChange={(e) => {
                          const type = e.target.value;
                          const amount = type === "Yearly + Janaza Fund" ? "500" : "250";
                          setInvoiceForm({ ...invoiceForm, invoiceType: type, amount: amount });
                        }}
                        style={{
                          color: "#1a1a1a",
                          background: "#ffffff",
                          boxShadow: "0 2px 4px rgba(90, 49, 234, 0.08)",
                          transition: "all 0.2s"
                        }}
                        className="mono-input"
                        onFocus={(e) => {
                          e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1), 0 4px 12px rgba(90, 49, 234, 0.12)";
                        }}
                        onBlur={(e) => {
                          e.target.style.boxShadow = "0 2px 4px rgba(90, 49, 234, 0.08)";
                        }}
                      >
                        <option value="">Select Invoice Type</option>
                        <option value="Lifetime">Lifetime - HK$250</option>
                        <option value="Yearly + Janaza Fund">Yearly + Janaza Fund - HK$500</option>
                        {/* <option value="Eid">Eid - HK$100</option> */}
                      </select>
                    </label>

                    <label style={{ marginBottom: "24px" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-calendar-alt" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Subscription Year <span style={{ color: "#ef4444" }}>*</span></span>
                      <input
                        type="number"
                        required
                        min="2000"
                        max="2100"
                        value={invoiceForm.subscriptionYear}
                        onChange={(e) => {
                          const year = e.target.value;
                          if (year === "" || (parseInt(year) >= 2000 && parseInt(year) <= 2100)) {
                            setInvoiceForm({ ...invoiceForm, subscriptionYear: year });
                          }
                        }}
                        placeholder="YYYY"
                        className="mono-input"
                        style={{ color: "#1a1a1a" }}
                      />
                    </label>

                    <label style={{ marginBottom: "24px" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount ($) <span style={{ color: "#ef4444" }}>*</span></span>
                      <input
                        type="number"
                        inputMode="numeric"
                        readOnly
                        value={invoiceForm.amount}
                        // onChange={(e) => {
                        //   const value = e.target.value.replace(/\\D/g, "");
                        //   setInvoiceForm({ ...invoiceForm, amount: value });
                        // }}
                        className="mono-input"
                        style={{ color: "#1a1a1a" }}
                      />
                    </label>


                    {/* Live invoice preview */}
                    <div
                      style={{
                        marginBottom: "16px",
                        padding: "16px 18px",
                        borderRadius: "10px",
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        fontSize: "0.875rem",
                        color: "#4b5563",
                      }}
                    >
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#111827" }}>
                        Invoice Preview
                      </h4>
                      <p style={{ margin: "4px 0" }}>
                        <strong>Invoice #:</strong> {nextInvoiceId}
                      </p>
                      <p style={{ margin: "4px 0" }}>
                        <strong>Member:</strong>{" "}
                        {invoiceForm.memberId
                          ? (() => {
                            const selected = members.find((m) => m.id === invoiceForm.memberId);
                            return selected ? `${selected.name} (${selected.id})` : "Not selected";
                          })()
                          : "Not selected"}
                      </p>
                      <p style={{ margin: "4px 0" }}>
                        <strong>Subscription Year:</strong> {invoiceForm.subscriptionYear || "-"}
                      </p>
                      <p style={{ margin: "4px 0" }}>
                        <strong>Amount:</strong>{" "}
                        {invoiceForm.amount
                          ? `HK$${Number(invoiceForm.amount || 0).toFixed(2)}`
                          : "HK$0.00"}
                      </p>
                      <p style={{ margin: "4px 0" }}>
                        <strong>Status:</strong> Unpaid
                      </p>
                      {invoiceForm.notes && (
                        <p style={{ margin: "4px 0" }}>
                          <strong>Notes:</strong> {invoiceForm.notes}
                        </p>
                      )}
                    </div>

                    <div className="form-actions" style={{ marginTop: "8px", gap: "12px" }}>
                      <button type="submit" className="primary-btn" style={{ padding: "14px 28px", fontSize: "1rem", fontWeight: "600" }}>
                        <i className="fas fa-file-invoice" style={{ marginRight: "8px" }}></i>Create Invoice
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={async () => {
                          const member = members.find((m) => m.id === invoiceForm.memberId);
                          if (!member) {
                            showToast("Please select a member", "error");
                            return;
                          }

                          // Validate form first
                          if (!invoiceForm.memberId || !invoiceForm.period || !invoiceForm.due) {
                            showToast("Please fill all required fields", "error");
                            return;
                          }

                          const amountNum = parseFloat(invoiceForm.amount);
                          if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
                            showToast("Amount must be a positive number", "error");
                            return;
                          }

                          // Generate period from subscription year
                          const subscriptionYear = invoiceForm.subscriptionYear;
                          const period = subscriptionYear;
                          
                          // Calculate due date: 1 year from subscription year (Jan 1st of next year)
                          const dueYear = parseInt(subscriptionYear) + 1;
                          const dueDate = new Date(dueYear, 0, 1);
                          const dueDateFormatted = dueDate.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }).replace(',', '');

                          // Create the invoice object from form data
                          const newInvoice = {
                            id: generateInvoiceId(),
                            memberId: invoiceForm.memberId,
                            memberName: member?.name || "",
                            period: period,
                            amount: `HK$${amountNum.toFixed(2)}`,
                            status: "Unpaid",
                            due: dueDateFormatted,
                            method: "-",
                            reference: "-",
                            notes: "",
                          };

                          // Add invoice to state
                          addInvoice(newInvoice);

                          // Store the created invoice and show success card
                          setLastCreatedInvoice({ ...newInvoice, member });
                          setShowInvoiceSuccessCard(true);

                          // Get existing unpaid invoices for this member
                          const existingUnpaidInvoices = invoices.filter(
                            (inv) =>
                              inv.memberId === member.id &&
                              (inv.status === "Unpaid" || inv.status === "Overdue")
                          );

                          // Combine existing unpaid invoices with the newly created one
                          const allUnpaidInvoices = [...existingUnpaidInvoices, newInvoice];

                          // Calculate total due including the new invoice
                          const totalDue = allUnpaidInvoices.reduce((sum, inv) => {
                            return sum + parseFloat(inv.amount.replace("$", ""));
                          }, 0);

                          // Create invoice list for email
                          const invoiceListText = allUnpaidInvoices
                            .map(
                              (inv) => {
                                // Convert $ to HK$ in amount for display
                                let formattedAmount = inv.amount || 'HK$0';
                                formattedAmount = String(formattedAmount).trim();
                                if (formattedAmount.includes('$') && !formattedAmount.includes('HK$')) {
                                  formattedAmount = formattedAmount.replace(/\$/g, 'HK$');
                                } else if (!formattedAmount.startsWith('HK$') && !formattedAmount.startsWith('$')) {
                                  formattedAmount = `HK$${formattedAmount}`;
                                }
                                return `• ${inv.period}: ${formattedAmount} (Due: ${inv.due}) - ${inv.status}`;
                              }
                            )
                            .join("\n");

                          const invoiceListHTML = allUnpaidInvoices
                            .map(
                              (inv) => {
                                // Convert $ to HK$ in amount for display
                                let formattedAmount = inv.amount || 'HK$0';
                                formattedAmount = String(formattedAmount).trim();
                                if (formattedAmount.includes('$') && !formattedAmount.includes('HK$')) {
                                  formattedAmount = formattedAmount.replace(/\$/g, 'HK$');
                                } else if (!formattedAmount.startsWith('HK$') && !formattedAmount.startsWith('$')) {
                                  formattedAmount = `HK$${formattedAmount}`;
                                }
                                return `<li style="margin-bottom: 10px;">
                                  <strong>${inv.period}</strong>: ${formattedAmount} 
                                  <span style="color: #666;">(Due: ${inv.due})</span> - 
                                  <strong>${inv.status}</strong>
                                </li>`;
                              }
                            )
                            .join("");

                          try {
                            showToast("Sending reminder email...");

                            // In development, use empty string to use Vite proxy (localhost:4000)
                            // In production, use VITE_API_URL if set
                            const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
                            const response = await fetch(`${apiUrl}/api/invoices/send-reminder`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                toEmail: member.email,
                                toName: member.name,
                                memberId: member.id,
                                totalDue: `HK$${totalDue.toFixed(2)}`,
                                invoiceCount: allUnpaidInvoices.length,
                                invoiceListText: invoiceListText,
                                invoiceListHTML: invoiceListHTML,
                                paymentMethods: "FPS, PayMe, or Bank Transfer",
                                portalLink: `${window.location.origin}/member`,
                              }),
                            });

                            const data = await response.json();

                            if (!response.ok) {
                              throw new Error(data.error || "Failed to send email");
                            }

                            console.log("✓ Email sent successfully:", data);

                            // Log to communication
                            const comm = {
                              channel: "Email",
                              message: `Payment reminder: ${member.name} (${member.email}) - $${totalDue.toFixed(2)} due (${allUnpaidInvoices.length} invoice${allUnpaidInvoices.length > 1 ? "s" : ""})`,
                              status: "Delivered",
                            };
                            addCommunication(comm);

                            // Reset form
                            setInvoiceForm({
                              memberId: "",
                              period: getCurrentPeriod(),
                              amount: "250",
                              invoiceType: "Lifetime",
                              due: "",
                              notes: "",
                              subscriptionYear: new Date().getFullYear().toString(),
                            });
                            setShowInvoiceForm(false);

                            showToast(
                              `✓ Invoice created and reminder sent to ${member.name} for $${totalDue.toFixed(2)}!`
                            );

                            // Show success card with the created invoice
                            setLastCreatedInvoice({ ...newInvoice, member });
                            setShowInvoiceSuccessCard(true);
                          } catch (error) {
                            console.error("✗ Email send error:", error);

                            // Log failed attempt
                            const comm = {
                              channel: "Email",
                              message: `Reminder attempt to ${member.name} - $${totalDue.toFixed(2)} due`,
                              status: "Failed",
                            };
                            addCommunication(comm);

                            showToast(
                              error.message || "Invoice created but failed to send email. Please check email configuration.",
                              "error"
                            );

                            // Show success card even if email failed
                            setLastCreatedInvoice({ ...newInvoice, member });
                            setShowInvoiceSuccessCard(true);
                          }
                        }}
                      >
                        Create &amp; Send Reminder
                      </button>
                    </div>
                  </form>
                </article>
              )}

              {/* REMINDERS & AUTOMATION */}
              {activeSection === "automation" && (
                <article className="screen-card" id="automation">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("automation")}
                      <h3>Reminders &amp; Automation</h3>
                      <p>Configure automated payment reminders and email templates.</p>
                    </div>
                  </header>

                  {/* Automation Toggle Section */}
                  <div style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    padding: "clamp(24px, 4vw, 32px)",
                    border: "none",
                    marginTop: "24px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
                  }}>
                    <div style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "clamp(16px, 3vw, 24px)",
                      flexWrap: "wrap"
                    }}>
                      <div style={{
                        flex: "1 1 300px",
                        minWidth: "250px"
                      }}>
                        <h4 style={{
                          margin: "0 0 8px 0",
                          fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
                          fontWeight: "700",
                          color: "#000"
                        }}>
                          Automation Control
                        </h4>
                        <p style={{
                          margin: 0,
                          fontSize: "clamp(0.875rem, 2vw, 0.9375rem)",
                          color: "#666",
                          lineHeight: "1.6"
                        }}>
                          Enable or disable automated payment reminders system-wide
                        </p>
                      </div>
                      <div style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "clamp(12px, 2vw, 16px)",
                        flexShrink: 0
                      }}>
                        <span style={{
                          fontSize: "clamp(0.75rem, 1.5vw, 0.875rem)",
                          fontWeight: "600",
                          color: automationEnabled ? "#000" : "#999",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          minWidth: "28px",
                          textAlign: "right"
                        }}>
                          {automationEnabled ? "ON" : "OFF"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={automationEnabled}
                          onClick={async () => {
                            const newValue = !automationEnabled;
                            setAutomationEnabled(newValue);

                            // Save to database
                            try {
                              // In development, use empty string to use Vite proxy (localhost:4000)
                              // In production, use VITE_API_URL if set
                              const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
                              await fetch(`${apiUrl}/api/email-settings`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  ...emailSettings,
                                  automationEnabled: newValue
                                }),
                              });
                              showToast(
                                newValue
                                  ? "Automation enabled!"
                                  : "Automation disabled!"
                              );
                            } catch (error) {
                              console.error('Error saving automation status:', error);
                              showToast('Failed to save automation status', 'error');
                              // Revert on error
                              setAutomationEnabled(!newValue);
                            }
                          }}
                          style={{
                            position: "relative",
                            width: "clamp(60px, 8vw, 72px)",
                            height: "clamp(34px, 5vw, 40px)",
                            borderRadius: "999px",
                            border: "none",
                            background: automationEnabled ? "#5a31ea" : "#f3f4f6",
                            cursor: "pointer",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            outline: "none",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            boxShadow: automationEnabled
                              ? "0 4px 12px rgba(0,0,0,0.15)"
                              : "inset 0 2px 4px rgba(0,0,0,0.1)",
                            WebkitTapHighlightColor: "transparent"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          <span style={{
                            position: "absolute",
                            width: "clamp(26px, 4vw, 30px)",
                            height: "clamp(26px, 4vw, 30px)",
                            borderRadius: "50%",
                            background: automationEnabled ? "#ffffff" : "#5a31ea",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            left: automationEnabled ? "auto" : "4px",
                            right: automationEnabled ? "4px" : "auto",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            border: "1px solid rgba(0,0,0,0.1)"
                          }}></span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Outstanding Members with Manual Send Section */}
                  <div style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    padding: "clamp(24px, 4vw, 32px)",
                    border: "none",
                    marginTop: "24px",
                    boxShadow: "0 4px 12px rgba(90, 49, 234, 0.12)"
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "24px",
                      flexWrap: "wrap",
                      gap: "16px"
                    }}>
                      <div>
                        <h4 style={{
                          margin: "0 0 8px 0",
                          fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
                          fontWeight: "700",
                          color: "#000"
                        }}>
                          Members
                        </h4>
                        <p style={{
                          margin: 0,
                          fontSize: "clamp(0.875rem, 2vw, 0.9375rem)",
                          color: "#666",
                          lineHeight: "1.6"
                        }}>
                          Send manual reminder emails or WhatsApp messages to members with outstanding invoices
                        </p>
                      </div>
                      {(() => {
                        // Calculate outstanding members count
                        const outstandingMembersCount = members.filter((member) => {
                          const memberInvoices = invoices.filter(
                            (inv) =>
                              inv.memberId === member.id &&
                              (inv.status === "Unpaid" || inv.status === "Overdue")
                          );
                          return memberInvoices.length > 0;
                        }).length;

                        // Hide buttons if no outstanding members
                        if (outstandingMembersCount === 0) {
                          return null;
                        }

                        return (
                          <div style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "wrap",
                            alignItems: "center"
                          }}>
                            {/* Email Channel Button - Icon Only */}
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedChannels.includes('Email')) {
                                  setSelectedChannels(prev => prev.filter(c => c !== 'Email'));
                                } else {
                                  setSelectedChannels(prev => [...prev, 'Email']);
                                }
                              }}
                              disabled={sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner}
                              title="Email"
                              style={{
                                padding: "12px",
                                borderRadius: "8px",
                                fontWeight: "600",
                                fontSize: "1.25rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? "not-allowed" : "pointer",
                                transition: "all 0.2s ease",
                                background: selectedChannels.includes('Email')
                                  ? "#5a31ea"
                                  : "#ffffff",
                                color: selectedChannels.includes('Email') ? "#ffffff" : "#6b7280",
                                border: selectedChannels.includes('Email') ? "2px solid #5a31ea" : "2px solid #e5e7eb",
                                boxShadow: selectedChannels.includes('Email')
                                  ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                  : "none",
                                opacity: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? 0.5 : 1,
                                width: "48px",
                                height: "48px",
                              }}
                              onMouseEnter={(e) => {
                                if (!sendingToAll && !sendingWhatsAppToAll && isAdminOrOwner && !selectedChannels.includes('Email')) {
                                  e.target.style.background = "#f3f4f6";
                                  e.target.style.color = "#374151";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!sendingToAll && !sendingWhatsAppToAll && isAdminOrOwner && !selectedChannels.includes('Email')) {
                                  e.target.style.background = "#ffffff";
                                  e.target.style.color = "#6b7280";
                                }
                              }}
                            >
                              <i className="fas fa-envelope"></i>
                            </button>

                            {/* WhatsApp Channel Button - Icon Only with Green Background */}
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedChannels.includes('WhatsApp')) {
                                  setSelectedChannels(prev => prev.filter(c => c !== 'WhatsApp'));
                                } else {
                                  setSelectedChannels(prev => [...prev, 'WhatsApp']);
                                }
                              }}
                              disabled={sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner}
                              title="WhatsApp"
                              style={{
                                padding: "12px",
                                borderRadius: "8px",
                                fontWeight: "600",
                                fontSize: "1.25rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? "not-allowed" : "pointer",
                                transition: "all 0.2s ease",
                                background: selectedChannels.includes('WhatsApp')
                                  ? "#25D366"
                                  : "#ffffff",
                                color: selectedChannels.includes('WhatsApp') ? "#ffffff" : "#25D366",
                                border: selectedChannels.includes('WhatsApp') ? "2px solid #25D366" : "2px solid #25D366",
                                boxShadow: selectedChannels.includes('WhatsApp')
                                  ? "0 2px 8px rgba(37, 211, 102, 0.3)"
                                  : "none",
                                opacity: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? 0.5 : 1,
                                width: "48px",
                                height: "48px",
                              }}
                              onMouseEnter={(e) => {
                                if (!sendingToAll && !sendingWhatsAppToAll && isAdminOrOwner && !selectedChannels.includes('WhatsApp')) {
                                  e.target.style.background = "#dcfce7";
                                  e.target.style.color = "#16a34a";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!sendingToAll && !sendingWhatsAppToAll && isAdminOrOwner && !selectedChannels.includes('WhatsApp')) {
                                  e.target.style.background = "#ffffff";
                                  e.target.style.color = "#25D366";
                                }
                              }}
                            >
                              <i className="fab fa-whatsapp"></i>
                            </button>

                            {/* Send All Button - shown when at least one channel is selected */}
                            {selectedChannels.length > 0 && (
                              <button
                                className="primary-btn"
                                onClick={handleSendAllWithSelectedChannels}
                                disabled={sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner}
                                style={{
                                  padding: "12px 20px",
                                  borderRadius: "4px",
                                  fontWeight: "600",
                                  fontSize: "0.875rem",
                                  opacity: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? 0.5 : 1,
                                  cursor: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? "not-allowed" : "pointer"
                                }}
                              >
                                {sendingToAll || sendingWhatsAppToAll ? "Sending..." : "Send All"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Members List with pagination */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}>
                      {(() => {
                        const outstandingMembers = members
                          .map((member) => {
                            const memberInvoices = invoices.filter(
                              (inv) =>
                                inv.memberId === member.id &&
                                (inv.status === "Unpaid" || inv.status === "Overdue")
                            );
                            if (memberInvoices.length === 0) return null;
                            const totalDue = memberInvoices.reduce((sum, inv) => {
                              const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, "") || 0);
                              return sum + amount;
                            }, 0);
                            const overdueCount = memberInvoices.filter((inv) => inv.status === "Overdue").length;
                            const unpaidCount = memberInvoices.filter((inv) => inv.status === "Unpaid").length;
                            return { member, totalDue, overdueCount, unpaidCount };
                          })
                          .filter(Boolean);

                        if (outstandingMembers.length === 0) {
                          return (
                            <div
                              style={{
                                padding: "24px",
                                textAlign: "center",
                                color: "#666",
                                fontSize: "0.9375rem",
                              }}
                            >
                              No members with outstanding invoices
                            </div>
                          );
                        }

                        const totalPages = Math.max(
                          1,
                          Math.ceil(outstandingMembers.length / outstandingMembersPageSize)
                        );
                        const currentPage = Math.min(outstandingMembersPage, totalPages);
                        const startIndex = (currentPage - 1) * outstandingMembersPageSize;
                        const endIndex = startIndex + outstandingMembersPageSize;
                        const paginatedMembers = outstandingMembers.slice(startIndex, endIndex);

                        return (
                          <>
                            {paginatedMembers.map(({ member, totalDue, overdueCount, unpaidCount }) => {
                              const isSending = sendingEmails[member.id];
                              return (
                                <div
                                  key={member.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "16px",
                                    background: "#f9f9f9",
                                    borderRadius: "4px",
                                    border: "1px solid #e0e0e0",
                                    gap: "16px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div style={{ flex: "1 1 300px", minWidth: "200px" }}>
                                    <div
                                      style={{
                                        fontSize: "1rem",
                                        fontWeight: "600",
                                        color: "#000",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      {member.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.875rem",
                                        color: "#666",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      {member.email}
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "12px",
                                        fontSize: "0.8125rem",
                                        color: "#666",
                                      }}
                                    >
                                      <span>
                                        <strong style={{ color: "#000" }}>
                                          {formatCurrency(totalDue)}
                                        </strong>{" "}
                                        outstanding
                                      </span>
                                      {overdueCount > 0 && (
                                        <span style={{ color: "#ef4444", fontWeight: "600" }}>
                                          {overdueCount} overdue
                                        </span>
                                      )}
                                      {unpaidCount > 0 && (
                                        <span style={{ color: "#ef4444", fontWeight: "600" }}>
                                          {unpaidCount} unpaid
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <button
                                      className="secondary-btn"
                                      onClick={() => handleRequestReminder(member, false)}
                                      disabled={isSending || sendingWhatsApp[member.id]}
                                      style={{
                                        padding: "12px 20px",
                                        borderRadius: "4px",
                                        fontWeight: "600",
                                        fontSize: "0.875rem",
                                        opacity: isSending || sendingWhatsApp[member.id] ? 0.5 : 1,
                                        cursor:
                                          isSending || sendingWhatsApp[member.id] ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      {isSending || sendingWhatsApp[member.id] ? (
                                        "Sending..."
                                      ) : (
                                        <>
                                          <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            style={{ marginRight: "8px", verticalAlign: "middle" }}
                                          >
                                            <path
                                              d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
                                              fill="#5a31ea"
                                            />
                                          </svg>
                                          Send Reminder
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            <Pagination
                              currentPage={currentPage}
                              totalPages={totalPages}
                              onPageChange={setOutstandingMembersPage}
                              pageSize={outstandingMembersPageSize}
                              onPageSizeChange={setOutstandingMembersPageSize}
                              totalItems={outstandingMembers.length}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Email Template Section */}
                  <div style={{ marginTop: "32px" }}>
                    <h4 style={{
                      margin: "0 0 20px 0",
                      fontSize: "1.25rem",
                      fontWeight: "700",
                      color: "#000"
                    }}>
                      Email Template
                    </h4>
                    <div style={{
                      background: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      padding: "32px",
                      boxShadow: "0 4px 12px rgba(90, 49, 234, 0.12)"
                    }}>
                      <div style={{ marginBottom: "24px" }}>
                        <label style={{
                          display: "block",
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: "#333",
                          marginBottom: "8px"
                        }}>
                          Email Subject
                        </label>
                        <input
                          type="text"
                          value={emailTemplate.subject}
                          onChange={(e) => setEmailTemplate({ ...emailTemplate, subject: e.target.value })}
                          placeholder="Payment Reminder - Outstanding Balance"
                          style={{
                            width: "100%",
                            padding: "12px",
                            border: "1.5px solid #e0e0e0",
                            borderRadius: "4px",
                            fontSize: "0.9375rem",
                            fontFamily: "inherit"
                          }}
                        />
                        <small style={{
                          display: "block",
                          marginTop: "6px",
                          fontSize: "0.75rem",
                          color: "#666"
                        }}>
                          You can use placeholders: {'{{member_name}}'}, {'{{total_due}}'}, {'{{invoice_count}}'}
                        </small>
                      </div>
                      <div style={{ marginBottom: "24px" }}>
                        <label style={{
                          display: "block",
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: "#333",
                          marginBottom: "8px"
                        }}>
                          HTML Email Template
                        </label>
                        <textarea
                          value={emailTemplate.htmlTemplate}
                          onChange={(e) => setEmailTemplate({ ...emailTemplate, htmlTemplate: e.target.value })}
                          rows={20}
                          style={{
                            width: "100%",
                            padding: "14px",
                            border: "1.5px solid #e0e0e0",
                            borderRadius: "10px",
                            fontSize: "0.875rem",
                            fontFamily: "monospace",
                            resize: "vertical",
                            transition: "all 0.2s ease"
                          }}
                          onFocus={(e) => {
                            e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1), 0 4px 12px rgba(90, 49, 234, 0.12)";
                            e.target.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.05)";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#e0e0e0";
                            e.target.style.boxShadow = "none";
                          }}
                          placeholder="Enter HTML email template..."
                        />
                        <div className="mt-md p-md bg-gray-50 rounded text-xs text-muted">
                          <strong>Available Placeholders:</strong>
                          <ul className="m-0" style={{ marginTop: "8px", paddingLeft: "20px" }}>
                            <li><code>{'{{member_name}}'}</code> - Member's full name</li>
                            <li><code>{'{{member_id}}'}</code> - Member ID</li>
                            <li><code>{'{{member_email}}'}</code> - Member email</li>
                            <li><code>{'{{total_due}}'}</code> - Total outstanding amount</li>
                            <li><code>{'{{invoice_count}}'}</code> - Number of unpaid invoices</li>
                            <li><code>{'{{invoice_list}}'}</code> - HTML list of invoices</li>
                            <li><code>{'{{payment_methods}}'}</code> - Payment methods list</li>
                            <li><code>{'{{portal_link}}'}</code> - Member portal URL</li>
                          </ul>
                        </div>
                      </div>
                      <div style={{
                        display: "flex",
                        gap: "12px",
                        paddingTop: "16px",
                        borderTop: "1px solid #e0e0e0"
                      }}>
                        <button
                          className="secondary-btn"
                          onClick={handlePreviewTemplate}
                          style={{
                            padding: "12px 24px",
                            borderRadius: "4px",
                            fontWeight: "600"
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="currentColor" />
                          </svg>
                          Preview Template
                        </button>
                        <button
                          className="primary-btn"
                          onClick={handleSaveEmailTemplate}
                          style={{
                            padding: "12px 24px",
                            borderRadius: "4px",
                            fontWeight: "600"
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                            <path d="M17 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V7L17 3ZM19 19H5V5H16.17L19 7.83V19ZM12 12C10.34 12 9 13.34 9 15S10.34 18 12 18 15 16.66 15 15 13.66 12 12 12ZM6 6H15V10H6V6Z" fill="#ffffff" />
                          </svg>
                          Save Email Template
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Email Automation Configuration Section */}
                  <div id="email-config-section" style={{ marginTop: "32px" }}>
                    <h4 style={{
                      margin: "0 0 20px 0",
                      fontSize: "1.25rem",
                      fontWeight: "700",
                      color: "#000"
                    }}>
                      Email Automation Configuration
                    </h4>
                    <div style={{
                      background: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      padding: "32px",
                      boxShadow: "0 4px 12px rgba(90, 49, 234, 0.12)"
                    }}>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: "24px",
                        marginBottom: "24px"
                      }}>
                        <div>
                          <label style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#333",
                            marginBottom: "8px"
                          }}>
                            Email Service
                          </label>
                          <select
                            value={emailSettings.emailService}
                            onChange={(e) => setEmailSettings({ ...emailSettings, emailService: e.target.value })}
                            style={{
                              width: "100%",
                              padding: "12px",
                              border: "1.5px solid #e0e0e0",
                              borderRadius: "4px",
                              fontSize: "0.9375rem",
                              fontFamily: "inherit"
                            }}
                          >
                            <option value="gmail">Gmail</option>
                            {/* <option value="outlook">Outlook</option>
                            <option value="yahoo">Yahoo</option>
                            <option value="custom">Custom SMTP</option> */}
                          </select>
                        </div>
                        <div>
                          <label style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#333",
                            marginBottom: "8px"
                          }}>
                            Email Address <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <input
                            type="email"
                            value={emailSettings.emailUser}
                            onChange={(e) => setEmailSettings({ ...emailSettings, emailUser: e.target.value })}
                            placeholder="your-email@gmail.com"
                            style={{
                              width: "100%",
                              padding: "12px",
                              border: "1.5px solid #e0e0e0",
                              borderRadius: "4px",
                              fontSize: "0.9375rem",
                              fontFamily: "inherit"
                            }}
                          />
                        </div>
                        <div>
                          <label style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#333",
                            marginBottom: "8px"
                          }}>
                            App Password <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <div style={{ position: "relative" }}>
                            <input
                              type={showEmailPassword ? "text" : "password"}
                              value={emailSettings.emailPassword}
                              onChange={(e) => setEmailSettings({ ...emailSettings, emailPassword: e.target.value })}
                              placeholder="Enter app password"
                              style={{
                                width: "100%",
                                padding: "12px",
                                paddingRight: "45px",
                                border: "1.5px solid #e0e0e0",
                                borderRadius: "4px",
                                fontSize: "0.9375rem",
                                fontFamily: "inherit"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowEmailPassword(!showEmailPassword)}
                              style={{
                                position: "absolute",
                                right: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#666",
                              }}
                              aria-label={showEmailPassword ? "Hide password" : "Show password"}
                            >
                              {showEmailPassword ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                  <line x1="1" y1="1" x2="23" y2="23"></line>
                                </svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                  <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                              )}
                            </button>
                          </div>
                          <small style={{
                            display: "block",
                            marginTop: "6px",
                            fontSize: "0.75rem",
                            color: "#666"
                          }}>
                            For Gmail: Use App Password (not regular password)
                          </small>
                        </div>
                        <div>
                          <label style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#333",
                            marginBottom: "8px"
                          }}>
                            Schedule Time
                          </label>
                          <div className="flex gap-sm items-center">
                            <input
                              type="time"
                              value={emailSettings.scheduleTime}
                              onChange={(e) => {
                                const newTime = e.target.value;
                                setEmailSettings({ ...emailSettings, scheduleTime: newTime });
                                // Update period based on hour
                                const [hours] = newTime.split(':').map(Number);
                                setSchedulePeriod(hours >= 12 ? 'PM' : 'AM');
                              }}
                              style={{
                                flex: 1,
                                padding: "12px",
                                border: "1.5px solid #e0e0e0",
                                borderRadius: "4px",
                                fontSize: "0.9375rem",
                                fontFamily: "inherit"
                              }}
                            />
                            <select
                              value={schedulePeriod}
                              onChange={(e) => {
                                const newPeriod = e.target.value;
                                setSchedulePeriod(newPeriod);
                                // Convert 12-hour to 24-hour format
                                const [hours, minutes] = emailSettings.scheduleTime.split(':').map(Number);
                                let newHours = hours;

                                if (newPeriod === 'AM' && hours === 12) {
                                  newHours = 0;
                                } else if (newPeriod === 'PM' && hours !== 12) {
                                  newHours = hours + 12;
                                } else if (newPeriod === 'AM' && hours >= 12) {
                                  newHours = hours - 12;
                                } else if (newPeriod === 'PM' && hours < 12) {
                                  newHours = hours + 12;
                                }

                                const newTime = `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                setEmailSettings({ ...emailSettings, scheduleTime: newTime });
                              }}
                              style={{
                                padding: "12px 16px",
                                border: "1.5px solid #e0e0e0",
                                borderRadius: "4px",
                                fontSize: "0.9375rem",
                                fontFamily: "inherit",
                                background: "white",
                                cursor: "pointer",
                                fontWeight: "500"
                              }}
                            >
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>
                          <small style={{
                            display: "block",
                            marginTop: "6px",
                            fontSize: "0.75rem",
                            color: "#666"
                          }}>
                            Daily reminder time (24-hour format stored: {emailSettings.scheduleTime})
                          </small>
                        </div>
                        <div>
                          <label style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#333",
                            marginBottom: "8px"
                          }}>
                            Reminder Interval (days)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={emailSettings.reminderInterval}
                            onChange={(e) => setEmailSettings({ ...emailSettings, reminderInterval: parseInt(e.target.value) || 7 })}
                            style={{
                              width: "100%",
                              padding: "12px",
                              border: "1.5px solid #e0e0e0",
                              borderRadius: "4px",
                              fontSize: "0.9375rem",
                              fontFamily: "inherit"
                            }}
                          />
                          <small style={{
                            display: "block",
                            marginTop: "6px",
                            fontSize: "0.75rem",
                            color: "#666"
                          }}>
                            Days between reminder emails (min: 1, max: 30)
                          </small>
                        </div>
                      </div>
                      <div style={{
                        display: "flex",
                        gap: "12px",
                        paddingTop: "16px",
                        borderTop: "1px solid #e0e0e0"
                      }}>
                        <button
                          className="secondary-btn"
                          onClick={handleTestEmail}
                          disabled={testingEmail || !emailSettings.emailUser || !emailSettings.emailPassword}
                          style={{
                            padding: "12px 24px",
                            borderRadius: "4px",
                            fontWeight: "600",
                            opacity: (testingEmail || !emailSettings.emailUser || !emailSettings.emailPassword) ? 0.5 : 1,
                            cursor: (testingEmail || !emailSettings.emailUser || !emailSettings.emailPassword) ? "not-allowed" : "pointer"
                          }}
                        >
                          {testingEmail ? (
                            "Sending..."
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="currentColor" />
                              </svg>
                              Test Email
                            </>
                          )}
                        </button>
                        <button
                          className="primary-btn"
                          onClick={handleSaveEmailSettings}
                          style={{
                            padding: "12px 24px",
                            borderRadius: "4px",
                            fontWeight: "600"
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "8px", verticalAlign: "middle" }}>
                            <path d="M17 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V7L17 3ZM19 19H5V5H16.17L19 7.83V19ZM12 12C10.34 12 9 13.34 9 15S10.34 18 12 18 15 16.66 15 15 13.66 12 12 12ZM6 6H15V10H6V6Z" fill="#ffffff" />
                          </svg>
                          Save Email Settings
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="mt-2xl flex justify-end">
                    <button
                      className="primary-btn"
                      onClick={handleSaveAllSettings}
                      disabled={savingAllSettings}
                      style={{
                        padding: "12px 24px",
                        fontSize: "0.9375rem",
                        fontWeight: "600",
                        borderRadius: "4px",
                        color: "#ffffff",
                        opacity: savingAllSettings ? 0.6 : 1,
                        cursor: savingAllSettings ? "not-allowed" : "pointer"
                      }}
                    >
                      {savingAllSettings ? (
                        <span className="flex items-center gap-sm" style={{ color: "#ffffff" }}>
                          <svg
                            style={{
                              animation: "spin 1s linear infinite",
                              width: "16px",
                              height: "16px"
                            }}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : (
                        <span className="flex items-center gap-sm" style={{ color: "#ffffff" }}>
                          <i className="fas fa-save"></i>
                          Save All Settings
                        </span>
                      )}
                    </button>
                  </div>
                </article>
              )}

              {/* GLOBAL REMINDERS / COMMUNICATION LOG */}
              {activeSection === "communications" && (
                <article className="screen-card" id="communications">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("communications")}
                      <h3>Reminders Log</h3>
                      <p>See all reminder emails and WhatsApp messages sent to members.</p>
                    </div>
                  </header>

                  {/* Summary Cards */}
                  {(() => {
                    // Build combined list for summary stats - only include reminders for members in the members list
                    const emailItems = (reminderLogs || [])
                      .filter((log) => {
                        // Only include if member is in the members list
                        const member =
                          members.find((m) => m.id === log.memberId) ||
                          members.find(
                            (m) =>
                              m.email &&
                              log.memberEmail &&
                              m.email.toLowerCase() === log.memberEmail.toLowerCase()
                          );
                        return member !== undefined;
                      })
                      .map((log) => {
                        // Normalize status - handle all status variations and ensure consistent format
                        const logStatus = log.status ? String(log.status).trim() : "";
                        const lowerStatus = logStatus.toLowerCase();
                        let normalizedStatus = "Delivered"; // default
                        if (lowerStatus === "failed") normalizedStatus = "Failed";
                        else if (lowerStatus === "pending") normalizedStatus = "Pending";
                        else if (logStatus) normalizedStatus = logStatus; // preserve original if valid
                        return { status: normalizedStatus };
                      });

                    const whatsappItems = (communicationLog || [])
                      .filter((c) => {
                        // Only include WhatsApp items for members in the members list
                        if (c.channel !== "WhatsApp") return false;
                        const member = members.find(
                          (m) =>
                            m.id === c.memberId ||
                            (m.email && c.memberEmail && m.email.toLowerCase() === c.memberEmail?.toLowerCase()) ||
                            (m.name && c.memberName && m.name.toLowerCase() === c.memberName?.toLowerCase())
                        );
                        return member !== undefined;
                      })
                      .map((c) => {
                        // Normalize status - preserve original status values
                        const cStatus = c.status ? String(c.status).trim() : "";
                        return { status: cStatus || "Delivered" };
                      });

                    const allItemsForSummary = [...emailItems, ...whatsappItems];
                    const total = allItemsForSummary.length;
                    const emailCount = emailItems.length;
                    const whatsappCount = whatsappItems.length;
                    const deliveredCount = allItemsForSummary.filter(item => item.status === "Delivered").length;
                    const failedCount = allItemsForSummary.filter(item => item.status === "Failed").length;
                    const pendingCount = allItemsForSummary.filter(item => item.status === "Pending").length;

                    return (
                      <div className="kpi-grid" style={{ marginBottom: "24px" }}>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-bell admin-dashboard-kpi-icon"></i>
                            Total Reminders
                          </p>
                          <h4 className="admin-dashboard-kpi-value">{formatNumber(total)}</h4>
                        </div>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-envelope admin-dashboard-kpi-icon"></i>
                            Email Reminders
                          </p>
                          <h4 className="admin-dashboard-kpi-value">{formatNumber(emailCount)}</h4>
                        </div>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fab fa-whatsapp admin-dashboard-kpi-icon--green"></i>
                            WhatsApp Reminders
                          </p>
                          <h4 className="admin-dashboard-kpi-value">{formatNumber(whatsappCount)}</h4>
                        </div>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-check-circle admin-dashboard-kpi-icon--green"></i>
                            Delivered
                          </p>
                          <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--green">{formatNumber(deliveredCount)}</h4>
                        </div>
                        {failedCount > 0 && (
                          <div className="admin-dashboard-kpi-card admin-dashboard-kpi-card--error">
                            <p className="admin-dashboard-kpi-label admin-dashboard-kpi-label--error">
                              <i className="fas fa-times-circle admin-dashboard-kpi-icon--red"></i>
                              Failed
                            </p>
                            <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--red">{formatNumber(failedCount)}</h4>
                          </div>
                        )}
                        {pendingCount > 0 && (
                          <div className="admin-dashboard-kpi-card admin-dashboard-kpi-card--error">
                            <p className="admin-dashboard-kpi-label admin-dashboard-kpi-label--error">
                              <i className="fas fa-clock admin-dashboard-kpi-icon--red"></i>
                              Pending
                            </p>
                            <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--red">{formatNumber(pendingCount)}</h4>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="admin-communications-filter-card">
                    {/* Filters - Always visible */}
                    <div className="admin-communications-filters-container">
                      <div className="flex gap-md flex-wrap items-center">
                        <label className="font-semibold" style={{ color: "#1a1a1a" }}>Filter by Status:</label>
                        <div style={{
                          display: "flex",
                          gap: "4px",
                          background: "#f3f4f6",
                          padding: "4px",
                          borderRadius: "4px",
                          flexWrap: "wrap"
                        }}>
                          {[
                            { value: "All", label: "All" },
                            { value: "Delivered", label: "Delivered" },
                            { value: "Failed", label: "Failed" },
                            // { value: "Pending", label: "Pending" }
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setRemindersStatusFilter(option.value);
                                setRemindersPage(1);
                              }}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "4px",
                                border: "none",
                                fontSize: "0.875rem",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                background: remindersStatusFilter === option.value
                                  ? "#5a31ea"
                                  : "transparent",
                                color: remindersStatusFilter === option.value ? "#ffffff" : "#6b7280",
                                boxShadow: remindersStatusFilter === option.value
                                  ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                  : "none",
                              }}
                              onMouseEnter={(e) => {
                                if (remindersStatusFilter !== option.value) {
                                  e.target.style.background = "#e5e7eb";
                                  e.target.style.color = "#374151";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (remindersStatusFilter !== option.value) {
                                  e.target.style.background = "transparent";
                                  e.target.style.color = "#6b7280";
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-md flex-wrap items-center">
                        <label className="font-semibold" style={{ color: "#1a1a1a" }}>Filter by Channel:</label>
                        <div style={{
                          display: "flex",
                          gap: "4px",
                          background: "#f3f4f6",
                          padding: "4px",
                          borderRadius: "4px",
                          flexWrap: "wrap"
                        }}>
                          {[
                            { value: "All", label: "All" },
                            { value: "Email", label: "Email" },
                            { value: "WhatsApp", label: "WhatsApp" }
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setRemindersChannelFilter(option.value);
                                setRemindersPage(1);
                              }}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "4px",
                                border: "none",
                                fontSize: "0.875rem",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                background: remindersChannelFilter === option.value
                                  ? "#5a31ea"
                                  : "transparent",
                                color: remindersChannelFilter === option.value ? "#ffffff" : "#6b7280",
                                boxShadow: remindersChannelFilter === option.value
                                  ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                  : "none",
                              }}
                              onMouseEnter={(e) => {
                                if (remindersChannelFilter !== option.value) {
                                  e.target.style.background = "#e5e7eb";
                                  e.target.style.color = "#374151";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (remindersChannelFilter !== option.value) {
                                  e.target.style.background = "transparent";
                                  e.target.style.color = "#6b7280";
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {(() => {
                      // Build combined list:
                      // - Email reminders from backend reminderLogs (automatic + manual)
                      // - WhatsApp reminders from local communicationLog
                      // Only show reminders for members in the members list
                      const emailItems = (reminderLogs || [])
                        .map((log) => {
                        const member =
                          members.find((m) => m.id === log.memberId) ||
                          members.find(
                            (m) =>
                              m.email &&
                              log.memberEmail &&
                              m.email.toLowerCase() === log.memberEmail.toLowerCase()
                          );
                        return {
                            member,
                            memberName: member?.name || log.memberEmail || "-",
                          memberId: log.memberId,
                            memberEmail: log.memberEmail,
                          channel: "Email",
                          type:
                            log.reminderType === "overdue"
                              ? "Overdue (auto/manual)"
                              : "Upcoming (auto/manual)",
                          message: `Email reminder - ${log.amount} · ${log.invoiceCount} invoice(s)`,
                          date: log.sentAt
                            ? new Date(log.sentAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                              : "-",
                          status: (() => {
                            // Normalize status - handle case variations and ensure consistent format
                            const logStatus = log.status ? String(log.status).trim() : "";
                            const lowerStatus = logStatus.toLowerCase();
                            if (lowerStatus === "failed") return "Failed";
                            if (lowerStatus === "pending") return "Pending";
                            return logStatus || "Delivered";
                          })(),
                          rawDate: log.sentAt || null,
                          raw: log,
                        };
                        })
                        .filter((item) => {
                          // Only include if member is in the members list
                          return item.member !== undefined;
                      });

                      const whatsappItems = (communicationLog || [])
                        .filter((c) => c.channel === "WhatsApp")
                        .map((c) => {
                          // Find member for WhatsApp reminder
                          const member = members.find(
                            (m) =>
                              m.id === c.memberId ||
                              (m.email && c.memberEmail && m.email.toLowerCase() === c.memberEmail?.toLowerCase()) ||
                              (m.name && c.memberName && m.name.toLowerCase() === c.memberName?.toLowerCase())
                          );
                          // Normalize status - preserve original status values
                          const cStatus = c.status ? String(c.status).trim() : "";
                          const normalizedStatus = cStatus || "Delivered";
                          return {
                            member,
                            memberName: c.memberName || c.member || "-",
                            memberId: c.memberId,
                            channel: "WhatsApp",
                            type: c.type || "Manual Outstanding Reminder",
                            message: c.message,
                            date: c.date,
                            status: normalizedStatus,
                            rawDate: c.timestamp || null,
                            raw: c,
                          };
                        })
                        .filter((item) => {
                          // Only include if member is in the members list
                          return item.member !== undefined;
                        });

                      let allItems = [...emailItems, ...whatsappItems];

                      // Apply filters
                      allItems = allItems.filter((item) => {
                        // Normalize status for comparison (handle case variations)
                        const normalizedStatus = item.status ? String(item.status).trim() : "Delivered";

                        // Status filter check - case-insensitive comparison
                        let statusOk = false;
                        if (remindersStatusFilter === "All") {
                          statusOk = true;
                        } else {
                          // Case-insensitive comparison to handle status variations
                          const filterStatusLower = remindersStatusFilter.toLowerCase();
                          const itemStatusLower = normalizedStatus.toLowerCase();
                          statusOk = filterStatusLower === itemStatusLower;
                        }

                        // Channel filter check
                        const normalizedChannel = item.channel ? String(item.channel).trim() : "";
                        const channelOk =
                          remindersChannelFilter === "All" ||
                          normalizedChannel === remindersChannelFilter;

                        return statusOk && channelOk;
                      });

                      // Sort newest first by rawDate when available
                      allItems.sort((a, b) => {
                        const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
                        const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
                        return dateB - dateA;
                      });

                      const total = allItems.length;

                      if (total === 0) {
                        // Build unfiltered list to check if there are any reminders at all
                        const allEmailItems = (reminderLogs || []).map((log) => {
                          const logStatus = log.status ? String(log.status).trim() : "";
                          const lowerStatus = logStatus.toLowerCase();
                          let normalizedStatus = "Delivered";
                          if (lowerStatus === "failed") normalizedStatus = "Failed";
                          else if (lowerStatus === "pending") normalizedStatus = "Pending";
                          else if (logStatus) normalizedStatus = logStatus;
                          return { status: normalizedStatus, channel: "Email" };
                        });
                        const allWhatsappItems = (communicationLog || [])
                          .filter((c) => c.channel === "WhatsApp")
                          .map((c) => ({ status: c.status || "Delivered", channel: "WhatsApp" }));
                        const totalUnfiltered = allEmailItems.length + allWhatsappItems.length;

                        let message = "No reminders have been sent yet.";
                        if (totalUnfiltered > 0) {
                          // There are reminders, but they don't match the current filter
                          if (remindersStatusFilter !== "All" && remindersChannelFilter !== "All") {
                            message = `No ${remindersStatusFilter.toLowerCase()} ${remindersChannelFilter.toLowerCase()} reminders found.`;
                          } else if (remindersStatusFilter !== "All") {
                            message = `No ${remindersStatusFilter.toLowerCase()} reminders found.`;
                          } else if (remindersChannelFilter !== "All") {
                            message = `No ${remindersChannelFilter.toLowerCase()} reminders found.`;
                          }
                        }

                        return (
                          <div style={{ padding: "32px 20px", textAlign: "center", color: "#666" }}>
                            <p style={{ margin: 0 }}>{message}</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {/* Paginate results - minimum 10 per page */}
                          {(() => {
                            const pageSize = Math.max(remindersPageSize, 10);
                            const totalPages = Math.max(1, Math.ceil(total / pageSize));
                            const currentPage = Math.min(remindersPage, totalPages);
                            const start = (currentPage - 1) * pageSize;
                            const end = start + pageSize;
                            const pageItems = allItems.slice(start, end);

                            return (
                              <>
                                {/* Desktop Table */}
                                <div style={{ overflowX: "auto" }} className="reminder-logs-table-wrapper">
                                  <table className="table data-table">
                                    <thead>
                                      <tr>
                                        <th>Member</th>
                                        <th>Channel</th>
                                        <th>Type</th>
                                        <th>Message</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pageItems.map((item, idx) => (
                                        <tr
                                          key={`${item.memberId || item.memberName || "row"}-${start + idx}`}
                                        >
                                          <td>
                                            {item.memberName || item.member || "-"}
                                            {item.memberId ? ` (${item.memberId})` : ""}
                                          </td>
                                          <td>{item.channel || "-"}</td>
                                          <td>{item.type || "-"}</td>
                                          <td style={{ maxWidth: "320px", whiteSpace: "normal" }}>
                                            {item.message || "-"}
                                          </td>
                                          <td>{item.date || "-"}</td>
                                          <td>
                                            <span className={statusClass[item.status] || "badge"}>
                                              {item.status || "-"}
                                            </span>
                                          </td>
                                          <td>
                                            <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                                              {/* View full message in modal */}
                                              <button
                                                type="button"
                                                className="icon-btn icon-btn--view"
                                                aria-label="View full message"
                                                onClick={() => {
                                                  setSelectedReminderLogItem(item);
                                                }}
                                              >
                                                <Tooltip text="View full message" position="top">
                                                <i className="fas fa-eye" aria-hidden="true"></i>
                                                </Tooltip>
                                              </button>
                                              {/* Retry failed email reminders */}
                                              {item.channel === "Email" && item.status === "Failed" && !isViewer && (
                                                <button
                                                  type="button"
                                                  className="icon-btn icon-btn--edit"
                                                  aria-label="Retry sending reminder"
                                                  onClick={async () => {
                                                    try {
                                                      // Only backend-stored reminder logs have raw.id or raw._id
                                                      const raw = item.raw;
                                                      const reminderId = raw?._id || raw?.id;
                                                      const apiUrl = import.meta.env.DEV
                                                        ? ""
                                                        : import.meta.env.VITE_API_URL || "";
                                                      const res = await fetch(
                                                        `${apiUrl}/api/reminders/retry`,
                                                        {
                                                          method: "POST",
                                                          headers: { "Content-Type": "application/json" },
                                                          body: JSON.stringify({ reminderId }),
                                                        }
                                                      );
                                                      const data = await res.json();
                                                      if (res.ok) {
                                                        showToast(data.message || "Reminder retry queued");
                                                        // Refresh logs
                                                        if (typeof fetchReminderLogs === "function") {
                                                          fetchReminderLogs();
                                                        }
                                                      } else {
                                                        showToast(
                                                          data.error || "Failed to retry reminder",
                                                          "error"
                                                        );
                                                      }
                                                    } catch (error) {
                                                      console.error("Retry reminder failed", error);
                                                      showToast("Failed to retry reminder", "error");
                                                    }
                                                  }}
                                                >
                                                  <Tooltip text="Retry sending" position="top">
                                                  <i className="fas fa-redo" aria-hidden="true"></i>
                                                  </Tooltip>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="mobile-table-cards reminder-logs-mobile-cards">
                                  {pageItems.map((item, idx) => (
                                    <div
                                      key={`${item.memberId || item.memberName || "row"}-${start + idx}`}
                                      className="mobile-table-card"
                                      onClick={() => setSelectedReminderLogItem(item)}
                                    >
                                      <div className="mobile-table-card-header">
                                        <div className="mobile-table-card-header-content">
                                          <div className="mobile-table-card-title-section">
                                            <div className="mobile-table-card-title">
                                              {item.memberName || item.member || "-"}
                                              {item.memberId ? ` (${item.memberId})` : ""}
                                            </div>
                                            <div className="mobile-table-card-metric">
                                              <i className={`fas ${item.channel === "Email" ? "fa-envelope" : "fa-whatsapp"}`} style={{ fontSize: "0.75rem", marginRight: "4px" }}></i>
                                              <span>{item.channel || "-"}</span>
                                            </div>
                                          </div>
                                          <div className="mobile-table-card-header-right">
                                            <div className="mobile-table-card-status">
                                              <span className={statusClass[item.status] || "badge"}>
                                                {item.status || "-"}
                                              </span>
                                            </div>
                                            <i className="fas fa-chevron-right mobile-table-card-arrow"></i>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Pagination controls */}
                                <Pagination
                                  currentPage={currentPage}
                                  totalPages={totalPages}
                                  onPageChange={setRemindersPage}
                                  pageSize={pageSize}
                                  onPageSizeChange={setRemindersPageSize}
                                  totalItems={total}
                                />
                              </>
                            );
                          })()}

                          {/* Old non-paginated table kept for reference (now replaced by paginated view)
                          <div style={{ overflowX: "auto" }}>
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Member</th>
                                  <th>Channel</th>
                                  <th>Type</th>
                                  <th>Message</th>
                                  <th>Date</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allItems.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      {item.memberName || item.member || "-"}
                                      {item.memberId ? ` (${item.memberId})` : ""}
                                    </td>
                                    <td>{item.channel || "-"}</td>
                                    <td>{item.type || "-"}</td>
                                    <td style={{ maxWidth: "320px", whiteSpace: "normal" }}>
                                      {item.message || "-"}
                                    </td>
                                    <td>{item.date || "-"}</td>
                                    <td>
                                      <span className={statusClass[item.status] || "badge"}>
                                        {item.status || "-"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div> */}
                        </>
                      );
                    })()}
                  </div>
                </article>
              )}

              {/* PASSWORD RESET REQUESTS - Only visible to Owner */}
              {activeSection === "communications" && currentAdminRole === "Owner" && (
                <article className="screen-card" id="password-reset-requests" style={{ marginTop: "24px" }}>
                  <header className="screen-card__header">
                    <div>
                      <h3><i className="fas fa-key" style={{ marginRight: "10px" }}></i>Password Reset Requests</h3>
                      <p>Manage password reset requests from admin users.</p>
                    </div>
                  </header>
                  <div className="card-communications">
                    <div style={{ padding: "24px" }}>
                      {passwordResetRequests && passwordResetRequests.length > 0 ? (
                        <div style={{ overflowX: "auto" }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>User Email</th>
                                <th>User Name</th>
                                <th>Requested At</th>
                                <th>Status</th>
                                <th>Handled By</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {passwordResetRequests
                                .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
                                .map((request) => (
                                  <tr key={request._id}>
                                    <td>{request.userEmail}</td>
                                    <td>{request.userName || "-"}</td>
                                    <td>
                                      {request.requestedAt
                                        ? new Date(request.requestedAt).toLocaleString("en-GB", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                        : "-"}
                                    </td>
                                    <td>
                                      <span
                                        className={
                                          request.status === "Pending"
                                            ? "badge badge--warning"
                                            : request.status === "Approved"
                                              ? "badge badge--success"
                                              : "badge badge--error"
                                        }
                                      >
                                        {request.status || "Pending"}
                                      </span>
                                    </td>
                                    <td>
                                      {request.handledBy
                                        ? `${request.handledBy}${request.handledAt
                                          ? ` - ${new Date(request.handledAt).toLocaleDateString("en-GB")}`
                                          : ""
                                        }`
                                        : "-"}
                                    </td>
                                    <td>
                                      {request.status === "Pending" && (
                                        <button
                                          className="primary-btn"
                                          style={{ fontSize: "0.875rem", padding: "6px 12px" }}
                                          onClick={() => {
                                            setSelectedPasswordResetRequest(request);
                                            setPasswordResetForm({ newPassword: "" });
                                            setShowPasswordResetModal(true);
                                          }}
                                        >
                                          <i className="fas fa-key" style={{ marginRight: "6px" }}></i>
                                          Set Password
                                        </button>
                                      )}
                                      {request.status === "Approved" && request.newPassword && (
                                        <span style={{ fontSize: "0.875rem", color: "#666" }}>
                                          Password sent
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: "#666" }}>
                          <p>No password reset requests found.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )}

              {/* PAYMENT METHODS */}
              {activeSection === "payment-methods" && (
                <article className="screen-card" id="payment-methods">
                  <header className="screen-card__header">
                    <div>
                      <h3>Payment Methods</h3>
                      <p>Configure payment methods and QR codes for member payments.</p>
                    </div>
                    <div style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      padding: "8px 16px",
                      background: "#f8f9fa",
                      borderRadius: "8px",
                      fontSize: "0.875rem"
                    }}>
                      <span style={{ color: "#666" }}>Active Methods:</span>
                      <strong style={{ color: "#000" }}>
                        {paymentMethods.filter(m =>
                          (m.name === "Alipay" || m.name === "PayMe" || m.name === "FPS" || m.name === "Direct Bank Transfer") && m.visible
                        ).length}
                      </strong>
                    </div>
                  </header>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "24px",
                    marginTop: "32px"
                  }}>
                    {paymentMethods
                      .filter((method) =>
                        method.name === "PayMe" ||
                        method.name === "FPS" ||
                        method.name === "Direct Bank Transfer"
                      )
                      .map((method) => {
                        const isQRMethod = method.name === "PayMe";
                        const handleQRUpload = async (e, methodName) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          if (!file.type.startsWith("image/")) {
                            showToast("Please upload an image file", "error");
                            return;
                          }

                          setUploadingQR((prev) => ({ ...prev, [methodName]: true }));
                          try {
                            const apiUrl = import.meta.env.VITE_API_URL || "";
                            const formData = new FormData();
                            formData.append("screenshot", file);
                            formData.append("uploadType", "qr-code"); // Specify this is a QR code upload

                            const uploadResponse = await fetch(`${apiUrl}/api/upload/screenshot`, {
                              method: "POST",
                              body: formData,
                            });

                            if (!uploadResponse.ok) {
                              // Try to get error message from response
                              let errorMessage = "Failed to upload QR code";
                              try {
                                const errorData = await uploadResponse.json();
                                errorMessage = errorData.error || errorMessage;
                                console.error("Upload error response:", errorData);
                              } catch (parseError) {
                                console.error("Failed to parse error response:", parseError);
                                errorMessage = `Upload failed with status ${uploadResponse.status}`;
                              }
                              throw new Error(errorMessage);
                            }

                            const uploadData = await uploadResponse.json();

                            // Check if URL exists in response
                            if (!uploadData.url) {
                              throw new Error("No URL returned from upload. Please try again.");
                            }

                            const qrUrl = uploadData.url;

                            // Update payment method with QR code URL
                            await updatePaymentMethod(methodName, { qrImageUrl: qrUrl });
                            showToast(`${methodName} QR code uploaded successfully!`);
                          } catch (error) {
                            console.error("Error uploading QR code:", error);
                            // Show the actual error message
                            showToast(error.message || "Failed to upload QR code. Please try again.", "error");
                          } finally {
                            setUploadingQR((prev) => ({ ...prev, [methodName]: false }));
                          }
                        };

                        return (
                          <div
                            key={method.name}
                            style={{
                              background: "#fff",
                              border: "none",
                              borderRadius: "20px",
                              padding: "28px",
                              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                              position: "relative",
                              boxShadow: method.visible
                                ? "0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)"
                                : "0 2px 8px rgba(0,0,0,0.04)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "20px",
                              overflow: "hidden"
                            }}
                            onMouseEnter={(e) => {
                              if (method.visible) {
                                e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)";
                                e.currentTarget.style.transform = "translateY(-2px)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (method.visible) {
                                e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)";
                                e.currentTarget.style.transform = "translateY(0)";
                              }
                            }}
                          >
                            {/* Status Badge - Clickable */}
                            <div
                              onClick={async () => {
                                try {
                                  await updatePaymentMethod(method.name, { visible: !method.visible });
                                } catch (error) {
                                  console.error('Error updating payment method:', error);
                                }
                              }}
                              style={{
                                position: "absolute",
                                top: "20px",
                                right: "20px",
                                padding: "6px 14px",
                                borderRadius: "20px",
                                fontSize: "0.7rem",
                                fontWeight: "700",
                                background: method.visible
                                  ? "#e8f5e9"
                                  : "#f5f5f5",
                                color: method.visible ? "#1b5e20" : "#757575",
                                textTransform: "uppercase",
                                letterSpacing: "0.8px",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                userSelect: "none",
                                border: method.visible ? "1px solid #a5d6a7" : "1px solid #e0e0e0",
                                boxShadow: method.visible ? "0 2px 4px rgba(0,0,0,0.1)" : "none"
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.transform = "scale(1.08)";
                                e.target.style.boxShadow = method.visible
                                  ? "0 4px 8px rgba(0,0,0,0.15)"
                                  : "0 2px 4px rgba(0,0,0,0.1)";
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.transform = "scale(1)";
                                e.target.style.boxShadow = method.visible
                                  ? "0 2px 4px rgba(0,0,0,0.1)"
                                  : "none";
                              }}
                            >
                              {method.visible ? "✓ Active" : "○ Inactive"}
                            </div>

                            {/* Method Header */}
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "18px",
                              marginBottom: "4px",
                              paddingBottom: "20px",
                              borderBottom: "1px solid #e5e7eb"
                            }}>
                              <div style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "16px",
                                background: method.name === "PayMe"
                                  ? "#00C300"
                                  : method.name === "FPS"
                                    ? "#0066CC"
                                    : "#E60012",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "28px",
                                fontWeight: "700",
                                color: "#fff",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                                position: "relative"
                              }}>
                                {method.name === "PayMe" ? "P"
                                  : method.name === "FPS" ? "F"
                                    : "B"}
                                {method.visible && (
                                  <div style={{
                                    position: "absolute",
                                    top: "-4px",
                                    right: "-4px",
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "50%",
                                    background: "#4caf50",
                                    border: "2px solid #fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                  }}>
                                    <span style={{ fontSize: "10px", color: "#fff" }}>✓</span>
                                  </div>
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                <h4 style={{
                                  margin: 0,
                                  fontSize: "1.625rem",
                                  fontWeight: "700",
                                  color: "#000",
                                  letterSpacing: "-0.5px",
                                  marginBottom: "6px"
                                }}>
                                  {method.name === "Direct Bank Transfer" ? "Bank Transfer" : method.name}
                                </h4>
                                <p style={{
                                  margin: 0,
                                  fontSize: "0.875rem",
                                  color: "#666",
                                  fontWeight: "500"
                                }}>
                                  {method.name === "PayMe" ? "PayMe by HSBC"
                                    : method.name === "FPS" ? "Faster Payment System"
                                      : "Direct Bank Transfer"}
                                </p>
                              </div>
                            </div>

                            {/* QR Code Display Section for PayMe OR Payment Details for FPS/Bank Transfer */}
                            {isQRMethod ? (
                              <div style={{
                                background: "#f9fafb",
                                borderRadius: "16px",
                                padding: "28px",
                                border: method.qrImageUrl ? "1px solid #e0e0e0" : "2px dashed #d0d0d0",
                                minHeight: "300px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "20px",
                                position: "relative",
                                transition: "all 0.3s ease"
                              }}>
                                {method.qrImageUrl ? (
                                  <>
                                    <div style={{
                                      padding: "16px",
                                      background: "#fff",
                                      borderRadius: "12px",
                                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                                      border: "1px solid #e0e0e0"
                                    }}>
                                      <img
                                        src={method.qrImageUrl}
                                        alt={`${method.name} QR Code`}
                                        style={{
                                          maxWidth: "260px",
                                          maxHeight: "260px",
                                          width: "100%",
                                          height: "auto",
                                          borderRadius: "4px",
                                          display: "block",
                                          objectFit: "contain"
                                        }}
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        const input = document.createElement("input");
                                        input.type = "file";
                                        input.accept = "image/*";
                                        input.onchange = (e) => handleQRUpload(e, method.name);
                                        input.click();
                                      }}
                                      disabled={uploadingQR[method.name]}
                                      style={{
                                        padding: "10px 20px",
                                        background: "#fff",
                                        border: "none",
                                        boxShadow: "0 2px 8px rgba(90, 49, 234, 0.1)",
                                        borderRadius: "4px",
                                        fontSize: "0.875rem",
                                        fontWeight: "600",
                                        cursor: uploadingQR[method.name] ? "not-allowed" : "pointer",
                                        transition: "all 0.2s ease",
                                        color: "#000",
                                        opacity: uploadingQR[method.name] ? 0.6 : 1
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!uploadingQR[method.name]) {
                                          e.target.style.background = "#000";
                                          e.target.style.color = "#fff";
                                          e.target.style.transform = "translateY(-2px)";
                                          e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!uploadingQR[method.name]) {
                                          e.target.style.background = "#fff";
                                          e.target.style.color = "#000";
                                          e.target.style.transform = "translateY(0)";
                                          e.target.style.boxShadow = "none";
                                        }
                                      }}
                                    >
                                      {uploadingQR[method.name] ? "⏳ Uploading..." : "🔄 Change QR Code"}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{
                                      width: "100px",
                                      height: "100px",
                                      borderRadius: "50%",
                                      background: "#f3f4f6",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "40px",
                                      color: "#bbb",
                                      marginBottom: "12px",
                                      border: "2px dashed #d0d0d0"
                                    }}>
                                      📷
                                    </div>
                                    <p style={{
                                      margin: 0,
                                      fontSize: "0.9375rem",
                                      color: "#666",
                                      textAlign: "center",
                                      marginBottom: "4px",
                                      fontWeight: "500"
                                    }}>
                                      No QR code uploaded
                                    </p>
                                    <p style={{
                                      margin: 0,
                                      fontSize: "0.8125rem",
                                      color: "#999",
                                      textAlign: "center",
                                      marginBottom: "16px"
                                    }}>
                                      Upload a QR code image to enable this payment method
                                    </p>
                                    <label
                                      style={{
                                        padding: "12px 24px",
                                        background: "#1a1a1a",
                                        color: "#fff",
                                        borderRadius: "10px",
                                        fontSize: "0.875rem",
                                        fontWeight: "600",
                                        cursor: uploadingQR[method.name] ? "not-allowed" : "pointer",
                                        display: "inline-block",
                                        transition: "all 0.2s ease",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                        opacity: uploadingQR[method.name] ? 0.6 : 1
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!uploadingQR[method.name]) {
                                          e.target.style.transform = "translateY(-2px)";
                                          e.target.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!uploadingQR[method.name]) {
                                          e.target.style.transform = "translateY(0)";
                                          e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                                        }
                                      }}
                                    >
                                      {uploadingQR[method.name] ? "⏳ Uploading..." : "📤 Upload QR Code"}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleQRUpload(e, method.name)}
                                        style={{ display: "none" }}
                                        disabled={uploadingQR[method.name]}
                                      />
                                    </label>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div style={{
                                background: "#f9fafb",
                                borderRadius: "16px",
                                padding: "24px",
                                border: "1px solid #e0e0e0"
                              }}>
                                <div style={{
                                  fontSize: "0.8125rem",
                                  fontWeight: "700",
                                  color: "#666",
                                  marginBottom: "18px",
                                  textTransform: "uppercase",
                                  letterSpacing: "1px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px"
                                }}>
                                  <span>💳</span>
                                  <span>Payment Details</span>
                                </div>
                                <div style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px"
                                }}>
                                  {method.details && method.details.map((detail, index) => (
                                    <div
                                      key={`${method.name}-detail-${index}`}
                                      style={{
                                        padding: "16px 18px",
                                        background: "#fff",
                                        borderRadius: "10px",
                                        fontSize: "0.9375rem",
                                        color: "#333",
                                        borderLeft: "4px solid #5a31ea",
                                        fontWeight: "500",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                        transition: "all 0.2s ease"
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
                                        e.currentTarget.style.transform = "translateX(4px)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
                                        e.currentTarget.style.transform = "translateX(0)";
                                      }}
                                    >
                                      {detail}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Toggle Switch */}
                            <div
                              onClick={async () => {
                                try {
                                  await updatePaymentMethod(method.name, { visible: !method.visible });
                                } catch (error) {
                                  console.error('Error updating payment method:', error);
                                }
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "18px 20px",
                                background: method.visible
                                  ? "#f8f9ff"
                                  : "#f9fafb",
                                borderRadius: "12px",
                                border: `2px solid ${method.visible ? "#2196F3" : "#e0e0e0"}`,
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                                marginTop: "4px"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = method.visible
                                  ? "#bbdefb"
                                  : "#f3f4f6";
                                e.currentTarget.style.borderColor = method.visible ? "#1976D2" : "#ccc";
                                e.currentTarget.style.transform = "scale(1.01)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = method.visible
                                  ? "#f8f9ff"
                                  : "#fafafa";
                                e.currentTarget.style.borderColor = method.visible ? "#2196F3" : "#e0e0e0";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <span style={{
                                  fontSize: "0.9375rem",
                                  fontWeight: "700",
                                  color: method.visible ? "#1565C0" : "#666",
                                  display: "block",
                                  marginBottom: "6px"
                                }}>
                                  {method.visible ? "✓ Enabled for members" : "○ Disabled for members"}
                                </span>
                                <span style={{
                                  fontSize: "0.8125rem",
                                  color: method.visible ? "#1976D2" : "#999",
                                  lineHeight: "1.4"
                                }}>
                                  {method.visible
                                    ? "This payment method is visible to all members"
                                    : "This payment method is hidden from members"}
                                </span>
                              </div>
                              <label
                                className="switch"
                                style={{ margin: 0, marginLeft: "16px" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={method.visible}
                                  onChange={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await updatePaymentMethod(method.name, { visible: e.target.checked });
                                    } catch (error) {
                                      console.error('Error updating payment method:', error);
                                    }
                                  }}
                                  tabIndex={-1}
                                  onFocus={(e) => e.target.blur()}
                                />
                                <span></span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </article>
              )}

              {/* PAYMENT APPROVALS */}
              {activeSection === "payment-approvals" && (
                <article className="screen-card" id="payment-approvals">
                  <header className="screen-card__header">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <h3>Payment Approvals</h3>
                        <p>Review and approve member payment submissions.</p>
                      </div>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          className="primary-btn"
                          onClick={() => {
                            setShowPaymentForm(true);
                            setEditingPayment(null);
                            setPaymentForm({
                              memberId: "",
                              member: "",
                              invoiceId: "",
                              amount: "",
                              method: "",
                              reference: "",
                              date: new Date().toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                              }),
                              status: "Pending",
                              screenshot: "",
                              notes: "",
                            });
                          }}
                        >
                          + Add Payment
                        </button>
                        {/* Status Filter - Segmented Buttons */}
                        <div style={{
                          display: "flex",
                          gap: "4px",
                          background: "#f3f4f6",
                          padding: "4px",
                          borderRadius: "4px",
                          flexWrap: "wrap"
                        }}>
                          {[
                            { value: "All", label: "All" },
                            { value: "Pending", label: "Pending" },
                            { value: "Completed", label: "Approved" },
                            { value: "Rejected", label: "Rejected" }
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setPaymentStatusFilter(option.value)}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "4px",
                                border: "none",
                                fontSize: "0.875rem",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                background: paymentStatusFilter === option.value
                                  ? "#5a31ea"
                                  : "transparent",
                                color: paymentStatusFilter === option.value ? "#ffffff" : "#6b7280",
                                boxShadow: paymentStatusFilter === option.value
                                  ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                  : "none",
                              }}
                              onMouseEnter={(e) => {
                                if (paymentStatusFilter !== option.value) {
                                  e.target.style.background = "#e5e7eb";
                                  e.target.style.color = "#374151";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (paymentStatusFilter !== option.value) {
                                  e.target.style.background = "transparent";
                                  e.target.style.color = "#6b7280";
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <div style={{
                          padding: "10px 16px",
                          background: "#fee2e2",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: "#ef4444",
                          border: "1px solid #ef4444"
                        }}>
                          ⏳ Pending: {(payments || []).filter(p => p.status === 'Pending').length}
                        </div>
                      </div>
                    </div>
                  </header>

                  {/* Payment Form - shown as popup modal */}
                  {showPaymentForm && (
                    <div
                      className="modal-overlay"
                      onClick={(e) => {
                        // 点击遮罩不关闭，避免误操作；只允许通过按钮关闭
                        if (e.target === e.currentTarget) {
                          // 如果你希望点击背景也能关闭，可以在这里调用关闭逻辑
                        }
                      }}
                    >
                      <div
                        className="card modal-container modal-container-640"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="modal-header mb-xl">
                          <h4 className="m-0">
                            {editingPayment ? "Edit Payment" : "Add New Payment"}
                          </h4>
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => {
                              // Clear validation state when closing
                              setPaymentFieldErrors({
                                memberId: false,
                                amount: false,
                                method: false,
                                screenshot: false,
                              });
                              setCurrentInvalidPaymentField(null);
                              setShowPaymentForm(false);
                              setEditingPayment(null);
                              setPaymentForm({
                                memberId: "",
                                member: "",
                                invoiceId: "",
                                amount: "",
                                method: "",
                                reference: "",
                                date: new Date().toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }),
                                status: "Pending",
                                screenshot: "",
                                notes: "",
                              });
                            }}
                            style={{
                              fontSize: "1.5rem",
                              lineHeight: 1,
                              color: "#ef4444",
                              fontWeight: "bold",
                              width: "32px",
                              height: "32px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "4px",
                              border: "1px solid #ef4444",
                              background: "transparent",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = "#fee2e2";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = "transparent";
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <form
                          className="form-grid"
                          onSubmit={editingPayment ? handleUpdatePayment : handleAddPayment}
                          noValidate
                        >
                          <label>
                            <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Member <span style={{ color: "#ef4444" }}>*</span></span>
                            <select
                              value={paymentForm.memberId}
                              onChange={(e) => {
                                const selectedMember = members.find(
                                  (m) => m.id === e.target.value
                                );
                                setPaymentForm({
                                  ...paymentForm,
                                  memberId: e.target.value,
                                  member: selectedMember ? selectedMember.name : "",
                                });
                              }}
                              required
                            >
                              <option value="">Select Member</option>
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name} ({member.id})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span><i className="fas fa-hashtag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Invoice ID</span>
                            <input
                              type="text"
                              value={paymentForm.invoiceId}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  invoiceId: e.target.value,
                                })
                              }
                              placeholder="INV-2025-001"
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount <span style={{ color: "#ef4444" }}>*</span></span>
                            <input
                              type="text"
                              value={paymentForm.amount}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  amount: e.target.value,
                                })
                              }
                              placeholder="HK$50"
                              required
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-credit-card" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Payment Method <span style={{ color: "#ef4444" }}>*</span></span>
                            <select
                              value={paymentForm.method}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  method: e.target.value,
                                })
                              }
                              required
                            >
                              <option value="">Select Method</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="FPS">FPS</option>
                              <option value="PayMe">PayMe</option>
                              <option value="Cash">Cash</option>
                            </select>
                          </label>
                          <label>
                            <span><i className="fas fa-hashtag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Reference Number</span>
                            <input
                              type="text"
                              value={paymentForm.reference}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  reference: e.target.value,
                                })
                              }
                              placeholder="Transaction reference"
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-calendar-day" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Date</span>
                            <input
                              type="text"
                              value={paymentForm.date}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  date: e.target.value,
                                })
                              }
                              placeholder="01 Jan 2025"
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-toggle-on" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Status <span style={{ color: "#ef4444" }}>*</span></span>
                            <select
                              value={paymentForm.status}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  status: e.target.value,
                                })
                              }
                              required
                            >
                              <option value="Pending">Pending</option>
                              <option value="Completed">Completed</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </label>
                          <label>
                            <span><i className="fas fa-image" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Screenshot URL{" "}
                              {paymentForm.method === "Cash" && (
                                <span style={{ color: "#ef4444" }}>*</span>
                              )}</span>
                            <input
                              type="text"
                              value={paymentForm.screenshot}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  screenshot: e.target.value,
                                })
                              }
                              placeholder="https://..."
                              required={paymentForm.method === "Cash"}
                            />
                            {paymentForm.method === "Cash" &&
                              !paymentForm.screenshot && (
                                <small
                                  style={{
                                    color: "#ef4444",
                                    fontSize: "0.75rem",
                                    marginTop: "4px",
                                    display: "block",
                                  }}
                                >
                                  Screenshot is required for Cash payments
                                </small>
                              )}
                          </label>
                          <label style={{ gridColumn: "1 / -1" }}>
                            <span><i className="fas fa-sticky-note" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Notes</span>
                            <textarea
                              value={paymentForm.notes}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  notes: e.target.value,
                                })
                              }
                              rows={3}
                              placeholder="Additional notes..."
                            />
                          </label>
                          <div
                            className="form-actions"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <button
                              type="button"
                              className="ghost-btn"
                              onClick={() => {
                                setShowPaymentForm(false);
                                setEditingPayment(null);
                                setPaymentForm({
                                  memberId: "",
                                  member: "",
                                  invoiceId: "",
                                  amount: "",
                                  method: "",
                                  reference: "",
                                  date: new Date().toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  }),
                                  status: "Pending",
                                  screenshot: "",
                                  notes: "",
                                });
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="primary-btn">
                              {editingPayment ? "Update" : "Add"} Payment
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  <div className="card-payment-approvals">
                    <div className="table-wrapper">
                      {(() => {
                        // Filter and sort payments
                        const filteredPayments = (payments || [])
                          .filter(payment => {
                            if (paymentStatusFilter === "All") return true;
                            return payment.status === paymentStatusFilter;
                          })
                          .sort((a, b) => {
                            // Sort by date, pending first
                            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date || 0);
                            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date || 0);
                            return dateB - dateA;
                          });

                        // Calculate pagination
                        const totalPages = Math.ceil(filteredPayments.length / paymentsPageSize) || 1;
                        const currentPage = Math.min(paymentsPage, totalPages);
                        const startIndex = (currentPage - 1) * paymentsPageSize;
                        const endIndex = startIndex + paymentsPageSize;
                        const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

                        return (
                          <>
                            <Table
                              columns={[
                                "Date",
                                "Member",
                                "Invoice ID",
                                "Amount",
                                "Method",
                                "Screenshot",
                                "Status",
                              ]}
                              rows={paginatedPayments.map((payment) => {
                                const paymentId = payment._id || payment.id;
                                const paymentIdString = paymentId?.toString ? paymentId.toString() : paymentId;

                                return {
                                  Date: payment.date || (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : "-"),
                                  Member: payment.member || "Unknown",
                                  "Invoice ID": payment.invoiceId || "-",
                                  Amount: payment.amount
                                    ? `HK$${formatNumber(parseFloat(payment.amount.replace(/[^0-9.]/g, '') || 0), {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                    : "HK$0.00",
                                  Method: getPaymentMethodDisplay(payment),
                                  Screenshot: {
                                    render: () => payment.screenshot ? (
                                      <a
                                        href={payment.screenshot}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "#000", textDecoration: "none" }}
                                        aria-label="View screenshot"
                                      >
                                        <Tooltip text="View screenshot" position="top">
                                        <i className="fas fa-image" aria-hidden="true"></i>
                                        </Tooltip>
                                      </a>
                                    ) : "-"
                                  },
                                  Status: {
                                    render: () => (
                                      <span className={statusClass[payment.status] || "badge badge-unpaid"}>
                                        {payment.status}
                                      </span>
                                    )
                                  },
                                  Actions: {
                                    render: () => (
                                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                                        {payment.status === "Pending" && (
                                          <>
                                            <button
                                              className="icon-btn icon-btn--view"
                                              onClick={() => {
                                                if (paymentIdString) handleApprovePayment(paymentIdString);
                                              }}
                                              aria-label="Approve payment (By Admin)"
                                            >
                                              <Tooltip text="Approve payment (By Admin)" position="top">
                                              <i className="fas fa-check" aria-hidden="true"></i>
                                              </Tooltip>
                                            </button>
                                            <button
                                              className="icon-btn icon-btn--delete"
                                              onClick={() => {
                                                if (paymentIdString) handleRejectPayment(paymentIdString);
                                              }}
                                              aria-label="Reject payment (By Admin)"
                                            >
                                              <Tooltip text="Reject payment (By Admin)" position="top">
                                              <i className="fas fa-times" aria-hidden="true"></i>
                                              </Tooltip>
                                            </button>
                                          </>
                                        )}
                                        {payment.status === "Rejected" && payment.rejectionReason && (
                                          <span style={{ fontSize: "0.75rem", color: "#666", fontStyle: "italic" }}>
                                            Reason: {payment.rejectionReason}
                                          </span>
                                        )}
                                        {payment.status === "Completed" && (() => {
                                          // Check if paid by admin (cash payment)
                                          const isPaidByAdmin = payment.paidToAdmin || payment.paidToAdminName;
                                          // Check if paid online
                                          const onlineMethods = ["Screenshot", "Bank Transfer", "FPS", "PayMe", "Online Payment"];
                                          const isPaidOnline = onlineMethods.includes(payment.method);

                                          if (isPaidByAdmin) {
                                            return (
                                              <span
                                                className="icon-btn"
                                                style={{
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  fontSize: "0.875rem",
                                                  color: "#4caf50",
                                                  cursor: "default",
                                                  padding: "4px 8px",
                                                }}
                                                title="Paid by Admin (Cash)"
                                                aria-label="Paid by Admin (Cash)"
                                              >
                                                <i className="fas fa-user-shield" aria-hidden="true"></i>
                                              </span>
                                            );
                                          } else if (isPaidOnline) {
                                            return (
                                              <span
                                                className="icon-btn"
                                                style={{
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  fontSize: "0.875rem",
                                                  color: "#2196F3",
                                                  cursor: "default",
                                                  padding: "4px 8px",
                                                }}
                                                title="Paid Online"
                                                aria-label="Paid Online"
                                              >
                                                <i className="fas fa-globe" aria-hidden="true"></i>
                                              </span>
                                            );
                                          } else {
                                            // Fallback: show approved text
                                            return (
                                              <span style={{ fontSize: "0.75rem", color: "#4caf50" }}>
                                                ✓ Approved by {payment.approvedBy || "Admin"}
                                              </span>
                                            );
                                          }
                                        })()}
                                        <button
                                          className="secondary-btn icon-btn icon-btn--edit"
                                          onClick={() => handleEditPayment(payment)}
                                          title="Edit Payment"
                                        >
                                          <i className="fas fa-pen" aria-hidden="true"></i>
                                        </button>
                                        <button
                                          className="ghost-btn icon-btn icon-btn--delete"
                                          onClick={() => {
                                            if (paymentIdString) handleDeletePayment(paymentIdString);
                                          }}
                                          title="Delete Payment"
                                        >
                                          <i className="fas fa-trash" aria-hidden="true"></i>
                                        </button>
                                      </div>
                                    )
                                  },
                                };
                              })}
                            />
                            {totalPages > 0 && filteredPayments.length > 0 && (
                              <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setPaymentsPage}
                                pageSize={paymentsPageSize}
                                onPageSizeChange={setPaymentsPageSize}
                                totalItems={filteredPayments.length}
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              )}

              {/* INVOICES */}
              {activeSection === "invoices" && (
                <article className="screen-card" id="invoices">
                  <header className="screen-card__header">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        {renderBreadcrumb("invoices")}
                        <h3><i className="fas fa-file-invoice" style={{ marginRight: "10px" }}></i>Invoices</h3>
                        <p>View and manage all invoices.</p>
                      </div>
                      <button
                        className="primary-btn"
                        onClick={() => {
                          handleNavClick("invoice-builder");
                          // showToast("Redirecting to Invoice Builder...");
                        }}
                      >
                        <i className="fas fa-plus" style={{ marginRight: "8px" }}></i>Create Invoice
                      </button>
                    </div>
                  </header>

                  {/* Summary Cards - 2 Mini Cards */}
                  {(() => {
                    // Filter invoices to only show those belonging to members in the members list
                    const invoicesList = (invoices || []).filter(inv => 
                      isInvoiceMemberInList(inv)
                    );
                    const totalInvoices = invoicesList.length;
                    const unpaidInvoices = invoicesList.filter(inv => {
                      const status = inv?.status || "Unpaid";
                      return status !== "Paid" && status !== "Completed";
                    });
                    const paidInvoices = invoicesList.filter(inv => {
                      const status = inv?.status || "Unpaid";
                      return status === "Paid" || status === "Completed";
                    });
                    const overdueInvoices = invoicesList.filter(inv => inv?.status === "Overdue");
                    const totalUnpaidAmount = unpaidInvoices.reduce((sum, inv) => {
                      const amount = parseFloat((inv?.amount || "0").replace(/[^0-9.]/g, '') || 0);
                      return sum + amount;
                    }, 0);
                    const totalPaidAmount = paidInvoices.reduce((sum, inv) => {
                      const amount = parseFloat((inv?.amount || "0").replace(/[^0-9.]/g, '') || 0);
                      return sum + amount;
                    }, 0);

                    return (
                      <div className="kpi-grid" style={{ marginBottom: "24px" }}>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-file-invoice admin-dashboard-kpi-icon"></i>
                            Total Invoices
                          </p>
                          <h4 className="admin-dashboard-kpi-value">{formatNumber(totalInvoices)}</h4>
                        </div>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-check-circle admin-dashboard-kpi-icon--green"></i>
                            Paid
                          </p>
                          <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--green">{formatNumber(paidInvoices.length)}</h4>
                        </div>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-exclamation-circle admin-dashboard-kpi-icon--red"></i>
                            Unpaid
                          </p>
                          <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--red">{formatNumber(unpaidInvoices.length)}</h4>
                        </div>
                        {/* Overdue card hidden */}
                        {/* <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-exclamation-triangle admin-dashboard-kpi-icon--red"></i>
                            Overdue
                          </p>
                          <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--red">{formatNumber(overdueInvoices.length)}</h4>
                        </div> */}
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-dollar-sign admin-dashboard-kpi-icon--red"></i>
                            Total Unpaid
                          </p>
                          <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--red">
                            {formatCurrency(totalUnpaidAmount, "HKD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </h4>
                        </div>
                        <div className="admin-dashboard-kpi-card">
                          <p className="admin-dashboard-kpi-label">
                            <i className="fas fa-dollar-sign admin-dashboard-kpi-icon--green"></i>
                            Total Collected
                          </p>
                          <h4 className="admin-dashboard-kpi-value admin-dashboard-kpi-value--green">
                            {formatCurrency(totalPaidAmount, "HKD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </h4>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="card-invoices">
                    <div className="table-wrapper">
                      {(() => {
                        // Filter invoices to only show those belonging to members in the members list
                        let filteredInvoices = (invoices || []).filter(invoice => 
                          isInvoiceMemberInList(invoice)
                        );
                        
                        // Filter invoices by status
                        if (invoiceStatusFilter !== "All") {
                          filteredInvoices = filteredInvoices.filter((invoice) => {
                            const status = invoice.status || "Unpaid";
                            if (invoiceStatusFilter === "Paid") {
                              return status === "Paid" || status === "Completed";
                            } else if (invoiceStatusFilter === "Unpaid") {
                              return status !== "Paid" && status !== "Completed" && status !== "Overdue";
                            } else {
                              return status === invoiceStatusFilter;
                            }
                          });
                        }

                        // Filter invoices by year
                        if (invoiceYearFilter !== "All") {
                          filteredInvoices = filteredInvoices.filter((invoice) => {
                            const periodStr = String(invoice.period || "").trim();
                            const yearMatch = periodStr.match(/\d{4}/);
                            const invoiceYear = yearMatch ? yearMatch[0] : "";
                            return invoiceYear === invoiceYearFilter;
                          });
                        }

                        // Filter invoices by search term (name, year, native)
                        if (invoiceSearchTerm.trim()) {
                          const searchLower = invoiceSearchTerm.toLowerCase();
                          filteredInvoices = filteredInvoices.filter((invoice) => {
                            // Get member for this invoice
                            const member = members.find(m => 
                              m.id === invoice.memberId || 
                              m.email === invoice.memberEmail || 
                              m.name === invoice.memberName
                            );

                            // Search by name
                            const memberName = (invoice.memberName || invoice.member || member?.name || "Unknown").toLowerCase();
                            if (memberName.includes(searchLower)) return true;

                            // Search by year (extract from period)
                            const periodStr = String(invoice.period || "").trim();
                            const yearMatch = periodStr.match(/\d{4}/);
                            const invoiceYear = yearMatch ? yearMatch[0] : "";
                            if (invoiceYear.includes(searchLower)) return true;

                            // Search by native
                            const memberNative = (member?.native || "").toLowerCase();
                            if (memberNative.includes(searchLower)) return true;

                            return false;
                          });
                        }

                        // Calculate pagination
                        const startIndex = (invoicesPage - 1) * invoicesPageSize;
                        const endIndex = startIndex + invoicesPageSize;
                        const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);
                        const totalPages = Math.ceil(filteredInvoices.length / invoicesPageSize);

                        return (
                          <div>
                            {/* Invoice Filters - Status on Left, Search on Right */}
                            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                              {/* Invoice Status Filter - Segmented Buttons (Left) */}
                              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                              <label style={{ fontWeight: "600", color: "#1a1a1a" }}>Filter by Status:</label>
                              <div style={{
                                display: "flex",
                                gap: "4px",
                                background: "#f3f4f6",
                                padding: "4px",
                                borderRadius: "4px",
                                flexWrap: "wrap"
                              }}>
                                {[
                                  { value: "All", label: "All" },
                                  { value: "Paid", label: "Paid" },
                                  { value: "Unpaid", label: "Unpaid" },
                                  { value: "Overdue", label: "Overdue" },
                                  // { value: "Pending", label: "Pending" }
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setInvoiceStatusFilter(option.value)}
                                    style={{
                                      padding: "8px 16px",
                                      borderRadius: "4px",
                                      border: "none",
                                      fontSize: "0.875rem",
                                      fontWeight: "500",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease",
                                      background: invoiceStatusFilter === option.value
                                        ? "#5a31ea"
                                        : "transparent",
                                      color: invoiceStatusFilter === option.value ? "#ffffff" : "#6b7280",
                                      boxShadow: invoiceStatusFilter === option.value
                                        ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                        : "none",
                                    }}
                                    onMouseEnter={(e) => {
                                      if (invoiceStatusFilter !== option.value) {
                                        e.target.style.background = "#e5e7eb";
                                        e.target.style.color = "#374151";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (invoiceStatusFilter !== option.value) {
                                        e.target.style.background = "transparent";
                                        e.target.style.color = "#6b7280";
                                      }
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-md flex-nowrap items-center" style={{ marginLeft: "16px" }}>
                                <label className="font-semibold" style={{ color: "#1a1a1a" }}>Filter by Year:</label>
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInvoiceYearFilter("All");
                                      setInvoicesPage(1);
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      borderRadius: "4px 0 0 4px",
                                      border: "1px solid #e5e7eb",
                                      borderRight: "none",
                                      background: invoiceYearFilter === "All" ? "#5a31ea" : "#ffffff",
                                      color: invoiceYearFilter === "All" ? "#ffffff" : "#6b7280",
                                      fontSize: "0.875rem",
                                      fontWeight: "500",
                                      cursor: "pointer",
                                      outline: "none",
                                      transition: "all 0.2s ease",
                                      whiteSpace: "nowrap"
                                    }}
                                    onMouseEnter={(e) => {
                                      if (invoiceYearFilter !== "All") {
                                        e.target.style.background = "#f3f4f6";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (invoiceYearFilter !== "All") {
                                        e.target.style.background = "#ffffff";
                                      }
                                    }}
                                  >
                                    All
                                  </button>
                                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                    <input
                                      type="text"
                                      value={invoiceYearFilter === "All" ? "" : invoiceYearFilter}
                                      placeholder="Year"
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === "" || value === "All" || /^\d{0,4}$/.test(value)) {
                                          setInvoiceYearFilter(value === "" ? "All" : value);
                                          setInvoicesPage(1);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "ArrowUp") {
                                          e.preventDefault();
                                          const currentYear = invoiceYearFilter === "All" || invoiceYearFilter === "" ? new Date().getFullYear() : parseInt(invoiceYearFilter);
                                          if (!isNaN(currentYear)) {
                                            setInvoiceYearFilter(String(currentYear + 1));
                                            setInvoicesPage(1);
                                          }
                                        } else if (e.key === "ArrowDown") {
                                          e.preventDefault();
                                          const currentYear = invoiceYearFilter === "All" || invoiceYearFilter === "" ? new Date().getFullYear() : parseInt(invoiceYearFilter);
                                          if (!isNaN(currentYear) && currentYear > 1900) {
                                            setInvoiceYearFilter(String(currentYear - 1));
                                            setInvoicesPage(1);
                                          }
                                        }
                                      }}
                                      style={{
                                        padding: "8px 32px 8px 12px",
                                        borderRadius: "0",
                                        border: "1px solid #e5e7eb",
                                        borderLeft: "none",
                                        borderRadius: "0 4px 4px 0",
                                        borderRight: "1px solid #e5e7eb",
                                        background: "#ffffff",
                                        fontSize: "0.875rem",
                                        fontWeight: "500",
                                        outline: "none",
                                        transition: "border-color 0.2s",
                                        width: "100px",
                                        textAlign: "center"
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = "#5a31ea";
                                        e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = "#e5e7eb";
                                        e.target.style.boxShadow = "none";
                                        if (e.target.value && e.target.value !== "All") {
                                          const year = parseInt(e.target.value);
                                          if (isNaN(year) || year < 1900 || year > 2100) {
                                            setInvoiceYearFilter("All");
                                          }
                                        }
                                      }}
                                    />
                                    <div style={{ 
                                      position: "absolute", 
                                      right: "4px", 
                                      display: "flex", 
                                      flexDirection: "column",
                                      gap: "2px"
                                    }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const currentYear = invoiceYearFilter === "All" || invoiceYearFilter === "" ? new Date().getFullYear() : parseInt(invoiceYearFilter);
                                          if (!isNaN(currentYear)) {
                                            setInvoiceYearFilter(String(currentYear + 1));
                                            setInvoicesPage(1);
                                          }
                                        }}
                                        style={{
                                          padding: "2px 4px",
                                          border: "none",
                                          background: "transparent",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "10px",
                                          color: "#6b7280",
                                          lineHeight: "1",
                                          transition: "color 0.2s"
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.color = "#5a31ea";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.color = "#6b7280";
                                        }}
                                        title="Increase year"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const currentYear = invoiceYearFilter === "All" || invoiceYearFilter === "" ? new Date().getFullYear() : parseInt(invoiceYearFilter);
                                          if (!isNaN(currentYear) && currentYear > 1900) {
                                            setInvoiceYearFilter(String(currentYear - 1));
                                            setInvoicesPage(1);
                                          }
                                        }}
                                        style={{
                                          padding: "2px 4px",
                                          border: "none",
                                          background: "transparent",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "10px",
                                          color: "#6b7280",
                                          lineHeight: "1",
                                          transition: "color 0.2s"
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.color = "#5a31ea";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.color = "#6b7280";
                                        }}
                                        title="Decrease year"
                                      >
                                        ▼
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              </div>

                              {/* Invoice Search Filter (Right) */}
                              <div style={{ display: "inline-flex", gap: "8px", flexWrap: "nowrap", alignItems: "center" }}>
                                <label style={{ fontWeight: "600", color: "#1a1a1a" ,whiteSpace: "nowrap" }}> Search:</label>
                                <input
                                  type="text"
                                  placeholder="Search by name, year, or native..."
                                  value={invoiceSearchTerm}
                                  onChange={(e) => {
                                    setInvoiceSearchTerm(e.target.value);
                                    setInvoicesPage(1); // Reset to first page when searching
                                  }}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: "4px",
                                    border: "1px solid #e5e7eb",
                                    background: "#ffffff",
                                    fontSize: "0.875rem",
                                    minWidth: "250px",
                                    outline: "none",
                                    transition: "border-color 0.2s"
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = "#5a31ea";
                                    e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = "#e5e7eb";
                                    e.target.style.boxShadow = "none";
                                  }}
                                />
                                {/* {invoiceSearchTerm && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInvoiceSearchTerm("");
                                      setInvoicesPage(1);
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      background: "transparent",
                                      border: "none",
                                      color: "#6b7280",
                                      cursor: "pointer",
                                      fontSize: "0.875rem",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                    title="Clear search"
                                  >
                                    <i className="fas fa-times"></i> Clear
                                  </button>
                                )} */}
                              </div>
                            </div>

                            {/* Empty State */}
                            {filteredInvoices.length === 0 ? (
                              <div className="admin-empty-state">
                                <p className="admin-empty-state-message">
                                  {invoiceStatusFilter !== "All"
                                    ? `No ${invoiceStatusFilter.toLowerCase()} invoices found.`
                                    : "No invoices found."}
                                </p>
                              </div>
                            ) : (
                              <>
                                {/* Invoice Table */}
                                <div style={{ marginBottom: "20px" }}>
                                  <Table
                                    columns={["Name", "Native", "Year", "Subscription Type", "Joined Year", "Status", "Outstanding", "Actions"]}
                                    rows={paginatedInvoices.map((invoice) => {
                                      const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
                                      const isOverdue = invoice.status === "Overdue";

                                      const member = members.find(m => m.id === invoice.memberId);
                                      const joinedYear = member?.start_date
                                        ? new Date(member.start_date).getFullYear()
                                        : (member?.createdAt ? new Date(member.createdAt).getFullYear() : "-");
                                      
                                      // Find payments for this specific invoice
                                      const invoiceId = invoice.id || invoice._id;
                                      const invoicePayments = (paymentHistory || []).filter(p => {
                                        const paymentInvoiceId = p.invoiceId?.toString() || "";
                                        return paymentInvoiceId === invoiceId?.toString() || 
                                              paymentInvoiceId === invoice.id?.toString() ||
                                              paymentInvoiceId === invoice._id?.toString();
                                      });
                                      
                                      // Calculate outstanding amount for this invoice
                                      // If invoice is paid, show the amount that was paid
                                      // If invoice is unpaid, show the invoice amount
                                      let outstandingAmount = 0;
                                      if (isPaid && invoicePayments.length > 0) {
                                        // If paid, show the total amount paid for this invoice
                                        outstandingAmount = invoicePayments.reduce((sum, p) => {
                                          if (p.status === "Completed" || p.status === "Paid") {
                                            const paidAmount = parseFloat(p.amount?.replace(/[^0-9.]/g, "") || 0);
                                            return sum + paidAmount;
                                          }
                                          return sum;
                                        }, 0);
                                      } else if (!isPaid) {
                                        // If unpaid, show the invoice amount
                                        outstandingAmount = parseFloat(invoice.amount?.replace(/[^0-9.]/g, "") || 0);
                                      }
                                      // If paid but no payment record found, outstandingAmount remains 0
                                      
                                      // Extract year from invoice period
                                      const periodStr = String(invoice.period || "").trim();
                                      const yearMatch = periodStr.match(/\d{4}/);
                                      const subYear = yearMatch ? yearMatch[0] : "-";

                                      return {
                                        "Name": invoice.memberName || invoice.member || "Unknown",
                                        "Native": member?.native || "-",
                                        "Year": subYear,
                                        "Subscription Type": member?.subscriptionType || invoice.subscriptionType || "-",
                                        "Joined Year": joinedYear,
                                        "Status": {
                                          render: () => (
                                            <span className={
                                              invoice.status === "Paid" ? "badge badge-paid" :
                                                invoice.status === "Overdue" ? "badge badge-overdue" :
                                                  invoice.status === "Pending" ? "badge badge-pending" :
                                                    "badge badge-unpaid"
                                            }>
                                              {invoice.status || "Unpaid"}
                                            </span>
                                          ),
                                        },
                                        "Outstanding": {
                                          render: () => {
                                            // Color based on invoice status: red for unpaid, black for paid
                                            const isUnpaid = invoice.status === "Unpaid" || invoice.status === "Overdue" || invoice.status === "Pending" || !invoice.status;
                                            const textColor = isUnpaid ? "#ef4444" : "#111827";
                                            const fontWeight = isUnpaid ? 600 : 500;
                                            
                                            return (
                                            <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                              <span
                                                style={{
                                                    color: textColor,
                                                    fontWeight: fontWeight,
                                                }}
                                              >
                                                  {formatCurrency(outstandingAmount)}
                                              </span>
                                            </div>
                                            );
                                          },
                                        },
                                        "Actions": {
                                          render: () => (
                                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start" }}>
                                              <button
                                                className="icon-btn icon-btn--view"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  const member = members.find(m =>
                                                    m.id === invoice.memberId ||
                                                    m.email === invoice.memberEmail ||
                                                    m.name === invoice.memberName
                                                  );
                                                  if (member) {
                                                    handleViewMemberDetail(member);
                                                    setActiveSection("member-detail");
                                                    setActiveTab("Invoices");
                                                    // showToast(`Viewing invoice ${invoice.id || invoice.invoiceId || 'details'}`, "success");
                                                  } else {
                                                    showToast("Member not found for this invoice", "error");
                                                  }
                                                }}
                                                aria-label="View Invoice Details"
                                              >
                                                <Tooltip text="View Invoice Details" position="top">
                                                <i className="fas fa-eye" aria-hidden="true"></i>
                                                </Tooltip>
                                              </button>
                                              {!isPaid && (
                                                <button
                                                  className="icon-btn icon-btn--delete"
                                                  onClick={() => {
                                                    if (invoice.id || invoice._id) {
                                                      handleDeleteInvoice(invoice.id || invoice._id);
                                                    }
                                                  }}
                                                  aria-label="Delete Invoice"
                                                >
                                                  <Tooltip text="Delete Invoice" position="top">
                                                  <i className="fas fa-trash" aria-hidden="true"></i>
                                                  </Tooltip>
                                                </button>
                                              )}
                                            </div>
                                          ),
                                        },
                                      };
                                    })}
                                  />
                                </div>
                                {totalPages > 0 && invoices.length > 0 && (
                                  <Pagination
                                    currentPage={invoicesPage}
                                    totalPages={totalPages}
                                    onPageChange={setInvoicesPage}
                                    pageSize={invoicesPageSize}
                                    onPageSizeChange={setInvoicesPageSize}
                                    totalItems={filteredInvoices.length}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              )}

              {/* PAYMENTS */}
              {activeSection === "payments" && (
                <article className="screen-card" id="payments">
                  <header className="screen-card__header">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        {renderBreadcrumb("payments")}
                        <h3><i className="fas fa-credit-card" style={{ marginRight: "10px" }}></i>Payments</h3>
                        <p>View and all payment transactions.</p>
                      </div>
                    </div>
                  </header>

                  {/* Payment Form Modal */}
                  {showPaymentForm && (
                    <div
                      className="admin-members-form-overlay"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setShowPaymentForm(false);
                          setEditingPayment(null);
                          setPaymentForm({
                            memberId: "",
                            member: "",
                            invoiceId: "",
                            amount: "",
                            method: "",
                            reference: "",
                            date: new Date().toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            }),
                            status: "Pending",
                            screenshot: "",
                            notes: "",
                          });
                        }
                      }}
                    >
                      <div
                        className="payments-card admin-members-form-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                          <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
                            <i className="fas fa-credit-card" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                            {editingPayment ? "Edit Payment" : "Add New Payment"}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPaymentForm(false);
                              setEditingPayment(null);
                              setPaymentForm({
                                memberId: "",
                                member: "",
                                invoiceId: "",
                                amount: "",
                                method: "",
                                reference: "",
                                date: new Date().toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                }),
                                status: "Pending",
                                screenshot: "",
                                notes: "",
                              });
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              fontSize: "1.5rem",
                              color: "#666",
                              cursor: "pointer",
                              padding: "0",
                              width: "32px",
                              height: "32px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "4px",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = "#f3f4f6";
                              e.target.style.color = "#1a1a1a";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = "transparent";
                              e.target.style.color = "#666";
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <form className="form-grid" onSubmit={editingPayment ? handleUpdatePayment : handleAddPayment} noValidate>
                          <label>
                            <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Member <span style={{ color: "#ef4444" }}>*</span></span>
                            <select
                              ref={(el) => {
                                if (el && editingPayment) {
                                  setTimeout(() => el.focus(), 100);
                                }
                              }}
                              value={paymentForm.memberId}
                              onChange={(e) => {
                                const selectedMember = members.find(m => m.id === e.target.value);
                                setPaymentForm({
                                  ...paymentForm,
                                  memberId: e.target.value,
                                  member: selectedMember ? selectedMember.name : "",
                                });
                              }}
                              required
                            >
                              <option value="">Select Member</option>
                              {members.map(member => (
                                <option key={member.id} value={member.id}>
                                  {member.name} ({member.id})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span><i className="fas fa-hashtag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Invoice ID</span>
                            <input
                              type="text"
                              value={paymentForm.invoiceId}
                              onChange={(e) => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })}
                              placeholder="INV-2025-001"
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount <span style={{ color: "#ef4444" }}>*</span></span>
                            <input
                              type="text"
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                              placeholder="$50"
                              required
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-credit-card" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Payment Method <span style={{ color: "#ef4444" }}>*</span></span>
                            <select
                              value={paymentForm.method}
                              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                              required
                            >
                              <option value="">Select Method</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="FPS">FPS</option>
                              <option value="PayMe">PayMe</option>
                              <option value="Alipay">Alipay</option>
                              <option value="Credit Card">Credit Card</option>
                              <option value="Cash">Cash</option>
                            </select>
                          </label>
                          <label>
                            <span><i className="fas fa-hashtag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Reference Number</span>
                            <input
                              type="text"
                              value={paymentForm.reference}
                              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                              placeholder="Transaction reference"
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-calendar-day" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Date</span>
                            <input
                              type="text"
                              value={paymentForm.date}
                              onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                              placeholder="01 Jan 2025"
                            />
                          </label>
                          <label>
                            <span><i className="fas fa-toggle-on" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Status <span style={{ color: "#ef4444" }}>*</span></span>
                            <select
                              value={paymentForm.status}
                              onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                              required
                            >
                              <option value="Pending">Pending</option>
                              <option value="Completed">Completed</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </label>
                          <label>
                            <span><i className="fas fa-image" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Screenshot URL {paymentForm.method === "Cash" && <span style={{ color: "#ef4444" }}>*</span>}</span>
                            <input
                              type="text"
                              value={paymentForm.screenshot}
                              onChange={(e) => setPaymentForm({ ...paymentForm, screenshot: e.target.value })}
                              placeholder="https://..."
                              required={paymentForm.method === "Cash"}
                            />
                            {paymentForm.method === "Cash" && !paymentForm.screenshot && (
                              <small style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
                                Screenshot is required for Cash payments
                              </small>
                            )}
                          </label>
                          <label style={{ gridColumn: "1 / -1" }}>
                            <span><i className="fas fa-sticky-note" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Notes</span>
                            <textarea
                              value={paymentForm.notes}
                              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                              rows={3}
                              placeholder="Additional notes..."
                            />
                          </label>
                          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                            <button type="button" className="ghost-btn" onClick={() => {
                              setShowPaymentForm(false);
                              setEditingPayment(null);
                              setPaymentForm({
                                memberId: "",
                                member: "",
                                invoiceId: "",
                                amount: "",
                                method: "",
                                reference: "",
                                date: new Date().toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                }),
                                status: "Pending",
                                screenshot: "",
                                notes: "",
                              });
                            }}>
                              Cancel
                            </button>
                            <button type="submit" className="primary-btn">
                              {editingPayment ? "Update" : "Add"} Payment
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  <div className=" card-payments">
                    <div style={{ padding: "2px" }}>
                      {/* Payment Filters */}
                      <div style={{ marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                          <div className="flex gap-md flex-nowrap items-center">
                            <label className="font-semibold" style={{ color: "#1a1a1a" }}>Filter by Year:</label>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentYearFilter("All");
                                  setPaymentsPage(1);
                                }}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "4px 0 0 4px",
                                  border: "1px solid #e5e7eb",
                                  borderRight: "none",
                                  background: paymentYearFilter === "All" ? "#5a31ea" : "#ffffff",
                                  color: paymentYearFilter === "All" ? "#ffffff" : "#6b7280",
                                  fontSize: "0.875rem",
                                  fontWeight: "500",
                                  cursor: "pointer",
                                  outline: "none",
                                  transition: "all 0.2s ease",
                                  whiteSpace: "nowrap"
                                }}
                                onMouseEnter={(e) => {
                                  if (paymentYearFilter !== "All") {
                                    e.target.style.background = "#f3f4f6";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (paymentYearFilter !== "All") {
                                    e.target.style.background = "#ffffff";
                                  }
                                }}
                              >
                                All
                              </button>
                              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <input
                                  type="text"
                                  value={paymentYearFilter === "All" ? "" : paymentYearFilter}
                                  placeholder="Year"
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "" || value === "All" || /^\d{0,4}$/.test(value)) {
                                      setPaymentYearFilter(value === "" ? "All" : value);
                                      setPaymentsPage(1);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      const currentYear = paymentYearFilter === "All" || paymentYearFilter === "" ? new Date().getFullYear() : parseInt(paymentYearFilter);
                                      if (!isNaN(currentYear)) {
                                        setPaymentYearFilter(String(currentYear + 1));
                                        setPaymentsPage(1);
                                      }
                                    } else if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      const currentYear = paymentYearFilter === "All" || paymentYearFilter === "" ? new Date().getFullYear() : parseInt(paymentYearFilter);
                                      if (!isNaN(currentYear) && currentYear > 1900) {
                                        setPaymentYearFilter(String(currentYear - 1));
                                        setPaymentsPage(1);
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: "8px 32px 8px 12px",
                                    borderRadius: "0",
                                    border: "1px solid #e5e7eb",
                                    borderLeft: "none",
                                    borderRadius: "0 4px 4px 0",
                                    borderRight: "1px solid #e5e7eb",
                                    background: "#ffffff",
                                    fontSize: "0.875rem",
                                    fontWeight: "500",
                                    outline: "none",
                                    transition: "border-color 0.2s",
                                    width: "100px",
                                    textAlign: "center"
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = "#5a31ea";
                                    e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = "#e5e7eb";
                                    e.target.style.boxShadow = "none";
                                    if (e.target.value && e.target.value !== "All") {
                                      const year = parseInt(e.target.value);
                                      if (isNaN(year) || year < 1900 || year > 2100) {
                                        setPaymentYearFilter("All");
                                      }
                                    }
                                  }}
                                />
                                <div style={{ 
                                  position: "absolute", 
                                  right: "4px", 
                                  display: "flex", 
                                  flexDirection: "column",
                                  gap: "2px"
                                }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const currentYear = paymentYearFilter === "All" || paymentYearFilter === "" ? new Date().getFullYear() : parseInt(paymentYearFilter);
                                      if (!isNaN(currentYear)) {
                                        setPaymentYearFilter(String(currentYear + 1));
                                        setPaymentsPage(1);
                                      }
                                    }}
                                    style={{
                                      padding: "2px 4px",
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "10px",
                                      color: "#6b7280",
                                      lineHeight: "1",
                                      transition: "color 0.2s"
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.color = "#5a31ea";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.color = "#6b7280";
                                    }}
                                    title="Increase year"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const currentYear = paymentYearFilter === "All" || paymentYearFilter === "" ? new Date().getFullYear() : parseInt(paymentYearFilter);
                                      if (!isNaN(currentYear) && currentYear > 1900) {
                                        setPaymentYearFilter(String(currentYear - 1));
                                        setPaymentsPage(1);
                                      }
                                    }}
                                    style={{
                                      padding: "2px 4px",
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "10px",
                                      color: "#6b7280",
                                      lineHeight: "1",
                                      transition: "color 0.2s"
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.color = "#5a31ea";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.color = "#6b7280";
                                    }}
                                    title="Decrease year"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>
                          <label style={{ fontWeight: "600", color: "#1a1a1a" }}>Search:</label>
                          <input
                            type="text"
                            value={paymentSearchTerm}
                            onChange={(e) => {
                              setPaymentSearchTerm(e.target.value);
                              setPaymentsPage(1);
                            }}
                            placeholder="Search by member, invoice ID, method, or reference..."
                            style={{
                              padding: "10px 12px",
                              borderRadius: "4px",
                              border: "1px solid #e5e7eb",
                              minWidth: "260px",
                              fontSize: "0.95rem",
                              outline: "none",
                              transition: "border-color 0.2s, box-shadow 0.2s",
                              background: "#fff"
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = "#5a31ea";
                              e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = "#e5e7eb";
                              e.target.style.boxShadow = "none";
                            }}
                          />
                          {/* {paymentSearchTerm && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentSearchTerm("");
                                setPaymentsPage(1);
                              }}
                              style={{
                                padding: "8px 12px",
                                background: "#f9fafb",
                                border: "1px solid #e5e7eb",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.875rem",
                                color: "#666"
                              }}
                              title="Clear search"
                            >
                              ✕
                            </button>
                          )} */}
                        </div>
                      </div>

                      {(() => {
                        // First filter to only show payments from members in the members list
                        let filteredPayments = (payments || []).filter(payment => 
                          isPaymentMemberInList(payment)
                        );
                        
                        // Filter payments by year
                        if (paymentYearFilter !== "All") {
                          filteredPayments = filteredPayments.filter((payment) => {
                            const paymentDate = payment.date || payment.createdAt;
                            if (!paymentDate) return false;
                            try {
                              const date = new Date(paymentDate);
                              const year = date.getFullYear().toString();
                              return year === paymentYearFilter;
                            } catch (e) {
                              return false;
                            }
                          });
                        }
                        
                        // Then apply search filter
                        filteredPayments = filteredPayments
                          .filter(payment => {
                            const term = paymentSearchTerm.trim().toLowerCase();
                            if (!term) return true;
                            const member = (payment.member || "").toLowerCase();
                            const invoiceId = (payment.invoiceId || "").toLowerCase();
                            const method = (getPaymentMethodDisplay(payment) || "").toLowerCase();
                            const reference = (payment.reference || "").toLowerCase();
                            const amount = (payment.amount || "").toString().toLowerCase();
                            return (
                              member.includes(term) ||
                              invoiceId.includes(term) ||
                              method.includes(term) ||
                              reference.includes(term) ||
                              amount.includes(term)
                            );
                          })
                          .sort((a, b) => {
                            // Sort by date, pending first
                            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date || 0);
                            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date || 0);
                            return dateB - dateA;
                          });

                        // Calculate pagination
                        const totalPages = Math.ceil(filteredPayments.length / paymentsPageSize) || 1;
                        const currentPage = Math.min(paymentsPage, totalPages);
                        const startIndex = (currentPage - 1) * paymentsPageSize;
                        const endIndex = startIndex + paymentsPageSize;
                        const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

                        if (filteredPayments.length === 0) {
                          return (
                            <div className="admin-empty-state">
                              <p className="admin-empty-state-message">
                                {paymentStatusFilter !== "All"
                                  ? `No ${paymentStatusFilter.toLowerCase()} payments found.`
                                  : "No payments found."}
                              </p>
                            </div>
                          );
                        }

                        return (
                          <>
                            <Table
                              columns={[
                                "Date",
                                "Member",
                                "Year",
                                "Native",
                                "Invoice ID",
                                "Amount",
                                "Method",
                                "Screenshot",
                                "Status",
                              ]}
                              rows={paginatedPayments.map((payment) => {
                                const paymentId = payment._id || payment.id;
                                const paymentIdString = paymentId?.toString ? paymentId.toString() : paymentId;

                                // Extract year from payment date
                                const paymentDate = payment.date || payment.createdAt;
                                let paymentYear = "-";
                                if (paymentDate) {
                                  try {
                                    const date = new Date(paymentDate);
                                    paymentYear = date.getFullYear().toString();
                                  } catch (e) {
                                    paymentYear = "-";
                                  }
                                }

                                // Find member to get native
                                const member = members.find(m => 
                                  m.id === payment.memberId || 
                                  m.email === payment.memberEmail ||
                                  m.name === payment.member ||
                                  String(m.id || "").toLowerCase() === String(payment.member || "").toLowerCase() ||
                                  String(m.email || "").toLowerCase() === String(payment.member || "").toLowerCase() ||
                                  String(m.name || "").toLowerCase() === String(payment.member || "").toLowerCase()
                                );
                                const memberNative = member?.native || "-";

                                return {
                                  Date: payment.date || (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : "-"),
                                  Member: payment.member || "Unknown",
                                  Year: paymentYear,
                                  Native: memberNative,
                                  "Invoice ID": payment.invoiceId || "-",
                                  Amount: payment.amount
                                    ? `HK$${formatNumber(parseFloat(payment.amount.replace(/[^0-9.]/g, '') || 0), {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                    : "HK$0.00",
                                  Method: getPaymentMethodDisplay(payment),
                                  Screenshot: {
                                    render: () => payment.screenshot ? (
                                      <a
                                        href={payment.screenshot}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "#5a31ea", textDecoration: "none" }}
                                      >
                                        <i className="fas fa-image" style={{ marginRight: "4px" }}></i>View
                                      </a>
                                    ) : "-"
                                  },
                                  Status: {
                                    render: () => (
                                      <span className={
                                        payment.status === "Paid" || payment.status === "Completed" ? "badge badge-paid" :
                                          payment.status === "Pending" ? "badge badge-pending" :
                                            payment.status === "Rejected" ? "badge badge-overdue" :
                                              "badge badge-active"
                                      }>
                                        {payment.status}
                                      </span>
                                    )
                                  },
                                };
                              })}
                            />
                            {totalPages > 0 && filteredPayments.length > 0 && (
                              <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setPaymentsPage}
                                pageSize={paymentsPageSize}
                                onPageSizeChange={setPaymentsPageSize}
                                totalItems={filteredPayments.length}
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              )}

              {/* DONATIONS */}
              {activeSection === "donations" && (
                <article className="screen-card" id="donations" style={{ minHeight: "400px" }}>
                  <header className="screen-card__header">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        {renderBreadcrumb("donations")}
                        <h3>Donations</h3>
                        <p>Manage donation records from members and non-members.</p>
                      </div>
                      <button
                        className="primary-btn"
                        onClick={() => setShowDonationForm(true)}
                      >
                        + Add Donation
                      </button>
                    </div>
                  </header>

                  {/* Add Donation Form Modal */}
                  {showDonationForm && (
                    <div
                      className="admin-members-form-overlay"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setIsDonationSubmitting(false);
                          setShowDonationForm(false);
                          setDonationForm({
                            donorName: "",
                            isMember: false,
                            memberId: "",
                            amount: "",
                            method: "",
                            date: "",
                            notes: "",
                            reference: "",
                            screenshot: "",
                          });
                          setDonationImageFile(null);
                          setDonationImagePreview(null);
                          setDonationMemberSearch("");
                          setShowDonationMemberDropdown(false);
                          setShowDonationPaymentMethodDropdown(false);
                        }
                      }}
                    >
                      <div
                        className="admin-members-form-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="modal-header">
                          <h4 className="modal-title">
                            <i className="fas fa-heart" aria-hidden="true"></i>
                            Add Donation
                          </h4>
                          <button
                            type="button"
                            className="close-btn close-btn-danger"
                            onClick={() => {
                              // Clear validation state when closing
                              setDonationFieldErrors({
                                donorName: false,
                                amount: false,
                                method: false,
                                date: false,
                                screenshot: false,
                              });
                              setCurrentInvalidDonationField(null);
                              setIsDonationSubmitting(false);
                              setShowDonationForm(false);
                              setDonationForm({
                                donorName: "",
                                isMember: false,
                                memberId: "",
                                amount: "",
                                method: "",
                                date: "",
                                notes: "",
                                reference: "",
                                screenshot: "",
                              });
                              setDonationImageFile(null);
                              setDonationImagePreview(null);
                              setDonationMemberSearch("");
                              setShowDonationMemberDropdown(false);
                              setShowDonationPaymentMethodDropdown(false);
                            }}
                            aria-label="Close add donation form"
                          >
                            ×
                          </button>
                        </div>
                        <form
                          noValidate
                          onSubmit={async (e) => {
                            e.preventDefault();

                            // Progressive validation for donation form
                            const validateDonationForm = () => {
                              // Define field order for validation
                              const fieldOrder = ["donorName", "amount", "method", "date", "screenshot"];

                              // If we have a current invalid field, check if it's now valid
                              if (currentInvalidDonationField) {
                                let isValid = true;
                                let errorMsg = "";

                                if (currentInvalidDonationField === "donorName" && !donationForm.donorName) {
                                  isValid = false;
                                  errorMsg = "Donor name is required";
                                } else if (currentInvalidDonationField === "amount") {
                                  if (!donationForm.amount) {
                                    isValid = false;
                                    errorMsg = "Amount is required";
                                  } else {
                                    const amountNum = parseFloat(donationForm.amount);
                                    if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
                                      isValid = false;
                                      errorMsg = "Amount must be a positive number";
                                    }
                                  }
                                } else if (currentInvalidDonationField === "method" && !donationForm.method) {
                                  isValid = false;
                                  errorMsg = "Payment method is required";
                                } else if (currentInvalidDonationField === "date" && !donationForm.date) {
                                  isValid = false;
                                  errorMsg = "Date is required";
                                } else if (currentInvalidDonationField === "screenshot") {
                                  if (donationForm.method === "Cash Payment" && !donationForm.screenshot && !donationImageFile) {
                                    isValid = false;
                                    errorMsg = "Proof image is required";
                                  } else if (donationForm.method === "Online Payment" && !donationForm.screenshot && !donationImageFile) {
                                    isValid = false;
                                    errorMsg = "Proof image is required";
                                  }
                                }

                                if (isValid) {
                                  setDonationFieldErrors(prev => ({ ...prev, [currentInvalidDonationField]: false }));
                                  setCurrentInvalidDonationField(null);
                                } else {
                                  setDonationFieldErrors(prev => ({ ...prev, [currentInvalidDonationField]: true }));
                                  showToast(errorMsg, "error");
                                  return false;
                                }
                              }

                              // Find first invalid field
                              for (const field of fieldOrder) {
                                let isValid = true;
                                let errorMsg = "";

                                if (field === "donorName" && !donationForm.donorName) {
                                  isValid = false;
                                  errorMsg = "Donor name is required";
                                } else if (field === "amount") {
                                  if (!donationForm.amount) {
                                    isValid = false;
                                    errorMsg = "Amount is required";
                                  } else {
                                    const amountNum = parseFloat(donationForm.amount);
                                    if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
                                      isValid = false;
                                      errorMsg = "Amount must be a positive number";
                                    }
                                  }
                                } else if (field === "method" && !donationForm.method) {
                                  isValid = false;
                                  errorMsg = "Payment method is required";
                                } else if (field === "date" && !donationForm.date) {
                                  isValid = false;
                                  errorMsg = "Date is required";
                                } else if (field === "screenshot") {
                                  if (donationForm.method === "Cash Payment" && !donationForm.screenshot && !donationImageFile) {
                                    isValid = false;
                                    errorMsg = "Proof image is required";
                                  } else if (donationForm.method === "Online Payment" && !donationForm.screenshot && !donationImageFile) {
                                    isValid = false;
                                    errorMsg = "Proof image is required";
                                  }
                                }

                                if (!isValid) {
                                  // Clear all errors first
                                  setDonationFieldErrors({
                                    donorName: false,
                                    amount: false,
                                    method: false,
                                    date: false,
                                    screenshot: false,
                                  });
                                  // Set only this field as invalid
                                  setDonationFieldErrors(prev => ({ ...prev, [field]: true }));
                                  setCurrentInvalidDonationField(field);
                                  showToast(errorMsg, "error");

                                  // Focus on the invalid field
                                  setTimeout(() => {
                                    if (field === "donorName") {
                                      const inputs = document.querySelectorAll('input[type="text"]');
                                      const donorInput = Array.from(inputs).find(input =>
                                        input.placeholder?.includes("donor name") ||
                                        input.placeholder?.includes("Donor name")
                                      );
                                      donorInput?.focus();
                                      donorInput?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    } else if (field === "amount") {
                                      const input = document.querySelector('input[type="number"][inputmode="numeric"]');
                                      input?.focus();
                                      input?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    } else if (field === "method") {
                                      const selects = document.querySelectorAll('select');
                                      const methodSelect = Array.from(selects).find(select =>
                                        select.options[0]?.text === "Select method"
                                      );
                                      methodSelect?.focus();
                                      methodSelect?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    } else if (field === "date") {
                                      const input = document.querySelector('input[type="date"]');
                                      input?.focus();
                                      input?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    } else if (field === "screenshot") {
                                      const uploadAreas = document.querySelectorAll('[style*="border"]');
                                      const screenshotArea = Array.from(uploadAreas).find(area =>
                                        area.style.border.includes("dashed")
                                      );
                                      screenshotArea?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    }
                                  }, 100);

                                  return false;
                                }
                              }

                              // All fields valid
                              setDonationFieldErrors({
                                donorName: false,
                                amount: false,
                                method: false,
                                date: false,
                                screenshot: false,
                              });
                              setCurrentInvalidDonationField(null);
                              return true;
                            };

                            // Prevent duplicate submission
                            if (isDonationSubmitting) {
                              return;
                            }

                            if (!validateDonationForm()) {
                              // Validation error already shown via Notie
                              return;
                            }

                            // Parse amount to number for formatting
                            const amountNum = parseFloat(donationForm.amount);
                            if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
                              showToast("Amount must be a positive number", "error");
                              return;
                            }

                            setIsDonationSubmitting(true);
                            try {
                              // Upload image if file exists
                              let imageUrl = donationForm.screenshot;
                              if (donationImageFile) {
                                const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
                                const formData = new FormData();
                                formData.append("screenshot", donationImageFile);
                                formData.append("uploadType", "donation-proof");

                                const uploadResponse = await fetch(`${apiUrl}/api/upload/screenshot`, {
                                  method: "POST",
                                  body: formData,
                                });

                                if (!uploadResponse.ok) {
                                  let errorMessage = "Failed to upload image";
                                  try {
                                    const errorData = await uploadResponse.json();
                                    errorMessage = errorData.error || errorMessage;
                                  } catch (parseError) {
                                    errorMessage = `Upload failed with status ${uploadResponse.status}`;
                                  }
                                  throw new Error(errorMessage);
                                }

                                const uploadData = await uploadResponse.json();
                                if (!uploadData.url) {
                                  throw new Error("No URL returned from upload. Please try again.");
                                }
                                imageUrl = uploadData.url;
                              }

                              await addDonation({
                                ...donationForm,
                                amount: amountNum.toFixed(2),
                                screenshot: imageUrl,
                              });
                              showToast("Donation added successfully!");
                              setShowDonationForm(false);
                              setDonationForm({
                                donorName: "",
                                isMember: false,
                                memberId: "",
                                amount: "",
                                method: "",
                                date: "",
                                notes: "",
                                reference: "",
                                screenshot: "",
                              });
                              setDonationImageFile(null);
                              setDonationImagePreview(null);
                              setDonationMemberSearch("");
                              setShowDonationMemberDropdown(false);
                              await fetchDonations();
                            } catch (error) {
                              showToast(error.message || "Failed to add donation", "error");
                            } finally {
                              setIsDonationSubmitting(false);
                            }
                          }}
                        >
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                            <label>
                              <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Donor Name <span style={{ color: "#ef4444" }}>*</span></span>
                              <input
                                type="text"
                                value={donationForm.donorName}
                                onChange={(e) => {
                                  setDonationForm({ ...donationForm, donorName: e.target.value });
                                  if (donationFieldErrors.donorName) {
                                    setDonationFieldErrors(prev => ({ ...prev, donorName: false }));
                                    if (currentInvalidDonationField === "donorName") {
                                      setCurrentInvalidDonationField(null);
                                    }
                                  }
                                }}
                                required
                                placeholder={donationForm.isMember ? "Will be filled automatically when member is selected" : "Enter donor name"}
                                disabled={donationForm.isMember && donationForm.memberId ? true : false}
                                style={{
                                  background: donationForm.isMember && donationForm.memberId ? "#f9fafb" : "#fff",
                                  cursor: donationForm.isMember && donationForm.memberId ? "not-allowed" : "text",
                                  border: donationFieldErrors.donorName ? "2px solid #ef4444" : undefined
                                }}
                              />
                              {donationForm.isMember && donationForm.memberId && (
                                <span style={{ fontSize: "0.75rem", color: "#666", marginTop: "4px", display: "block" }}>
                                  Donor name is automatically set from selected member
                                </span>
                              )}
                            </label>
                            <label>
                              <span><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount <span style={{ color: "#ef4444" }}>*</span></span>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={donationForm.amount}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9.]/g, "");
                                  setDonationForm({ ...donationForm, amount: value });
                                  if (donationFieldErrors.amount) {
                                    setDonationFieldErrors(prev => ({ ...prev, amount: false }));
                                    if (currentInvalidDonationField === "amount") {
                                      setCurrentInvalidDonationField(null);
                                    }
                                  }
                                }}
                                placeholder="100"
                                required
                                style={{
                                  border: donationFieldErrors.amount ? "2px solid #ef4444" : undefined
                                }}
                              />
                            </label>
                          </div>
                          <div style={{ marginBottom: "20px" }}>
                            <label style={{
                              display: "block",
                              fontSize: "0.875rem",
                              fontWeight: "600",
                              color: "#333",
                              marginBottom: "12px"
                            }}>
                              Donor Type
                            </label>
                            <div style={{
                              display: "flex",
                              gap: "12px",
                              flexWrap: "wrap"
                            }}>
                              <button
                                type="button"
                                onClick={() => setDonationForm({ ...donationForm, isMember: true, memberId: "", donorName: donationForm.donorName })}
                                style={{
                                  flex: "1",
                                  minWidth: "150px",
                                  padding: "14px 20px",
                                  borderRadius: "4px",
                                  border: "none",
                                  background: donationForm.isMember ? "#5a31ea" : "#f8f9ff",
                                  color: donationForm.isMember ? "#ffffff" : "#1a1a1a",
                                  boxShadow: donationForm.isMember ? "0 4px 12px rgba(90, 49, 234, 0.3)" : "0 2px 4px rgba(90, 49, 234, 0.08)",
                                  fontWeight: "600",
                                  fontSize: "0.9375rem",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "8px"
                                }}
                                onMouseEnter={(e) => {
                                  if (!donationForm.isMember) {
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(90, 49, 234, 0.15)";
                                    e.currentTarget.style.background = "#f8f8f8";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!donationForm.isMember) {
                                    e.currentTarget.style.borderColor = "#e0e0e0";
                                    e.currentTarget.style.background = "#fff";
                                  }
                                }}
                              >
                                <span style={{ color: donationForm.isMember ? "#ffffff" : "inherit" }}>👤</span>
                                <span style={{ color: donationForm.isMember ? "#ffffff" : "inherit" }}>Member</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDonationForm({ ...donationForm, isMember: false, memberId: "", donorName: donationForm.donorName })}
                                style={{
                                  flex: "1",
                                  minWidth: "150px",
                                  padding: "14px 20px",
                                  borderRadius: "4px",
                                  border: "none",
                                  background: !donationForm.isMember ? "#5a31ea" : "#f8f9ff",
                                  color: !donationForm.isMember ? "#ffffff" : "#1a1a1a",
                                  boxShadow: !donationForm.isMember ? "0 4px 12px rgba(90, 49, 234, 0.3)" : "0 2px 4px rgba(90, 49, 234, 0.08)",
                                  fontWeight: "600",
                                  fontSize: "0.9375rem",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "8px"
                                }}
                                onMouseEnter={(e) => {
                                  if (donationForm.isMember) {
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(90, 49, 234, 0.15)";
                                    e.currentTarget.style.background = "#f8f8f8";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (donationForm.isMember) {
                                    e.currentTarget.style.borderColor = "#e0e0e0";
                                    e.currentTarget.style.background = "#fff";
                                  }
                                }}
                              >
                                <span style={{ color: !donationForm.isMember ? "#ffffff" : "inherit" }}>🌐</span>
                                <span style={{ color: !donationForm.isMember ? "#ffffff" : "inherit" }}>Non-Member</span>
                              </button>
                            </div>
                          </div>
                          {donationForm.isMember && (
                            <div style={{ marginBottom: "16px" }}>
                              <label>
                                Select Member <span style={{ color: "#ef4444" }}>*</span>
                                <div style={{ position: "relative" }} data-donation-member-dropdown>
                                  <div
                                    onClick={() => setShowDonationMemberDropdown(!showDonationMemberDropdown)}
                                    style={{
                                      padding: "10px 16px",
                                      border: "1px solid #e0e0e0",
                                      borderRadius: "4px",
                                      background: "#fff",
                                      cursor: "pointer",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      color: donationForm.memberId ? "#000" : "#999",
                                      minHeight: "42px"
                                    }}
                                  >
                                    <span>
                                      {donationForm.memberId
                                        ? (() => {
                                          const selected = members.find(m => m.id === donationForm.memberId);
                                          return selected ? `${selected.name} (${selected.id})` : "Select Member";
                                        })()
                                        : "Select Member"}
                                    </span>
                                    <span style={{
                                      fontSize: "0.75rem",
                                      color: "#5a31ea",
                                      transition: "transform 0.2s ease",
                                      transform: showDonationMemberDropdown ? "rotate(180deg)" : "rotate(0deg)",
                                      display: "inline-block"
                                    }}>▼</span>
                                  </div>

                                  {showDonationMemberDropdown && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: 0,
                                        right: 0,
                                        background: "#fff",
                                        border: "1px solid #e0e0e0",
                                        borderRadius: "4px",
                                        marginTop: "4px",
                                        maxHeight: "300px",
                                        overflow: "hidden",
                                        zIndex: 1000,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                      }}
                                    >
                                      {/* Search Input */}
                                      <div style={{
                                        padding: "12px",
                                        borderBottom: "1px solid #e0e0e0",
                                        background: "#f9fafb"
                                      }}>
                                        <div style={{ position: "relative" }}>
                                          <input
                                            type="text"
                                            placeholder=" Search member by name or ID..."
                                            value={donationMemberSearch}
                                            onChange={(e) => setDonationMemberSearch(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            autoFocus
                                            style={{
                                              width: "100%",
                                              padding: "10px 36px 10px 12px",
                                              border: "1px solid #e0e0e0",
                                              borderRadius: "4px",
                                              fontSize: "0.875rem",
                                              outline: "none",
                                              background: "#fff",
                                              transition: "border-color 0.2s"
                                            }}
                                            onFocus={(e) => {
                                              e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1), 0 4px 12px rgba(90, 49, 234, 0.12)";
                                              e.target.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.05)";
                                            }}
                                            onBlur={(e) => {
                                              e.target.style.borderColor = "#e0e0e0";
                                              e.target.style.boxShadow = "none";
                                            }}
                                          />
                                          {donationMemberSearch && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDonationMemberSearch("");
                                              }}
                                              style={{
                                                position: "absolute",
                                                right: "8px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                padding: "4px",
                                                color: "#666",
                                                fontSize: "0.875rem",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center"
                                              }}
                                              title="Clear search"
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>
                                        {donationMemberSearch && (
                                          <div style={{
                                            marginTop: "8px",
                                            fontSize: "0.75rem",
                                            color: "#666"
                                          }}>
                                            {members.filter(member =>
                                              !donationMemberSearch ||
                                              member.name?.toLowerCase().includes(donationMemberSearch.toLowerCase()) ||
                                              member.id?.toLowerCase().includes(donationMemberSearch.toLowerCase())
                                            ).length} member{members.filter(member =>
                                              !donationMemberSearch ||
                                              member.name?.toLowerCase().includes(donationMemberSearch.toLowerCase()) ||
                                              member.id?.toLowerCase().includes(donationMemberSearch.toLowerCase())
                                            ).length !== 1 ? 's' : ''} found
                                          </div>
                                        )}
                                      </div>

                                      {/* Member List */}
                                      <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                                        {members
                                          .filter(member =>
                                            !donationMemberSearch ||
                                            member.name?.toLowerCase().includes(donationMemberSearch.toLowerCase()) ||
                                            member.id?.toLowerCase().includes(donationMemberSearch.toLowerCase())
                                          )
                                          .map((member) => (
                                            <div
                                              key={member.id}
                                              onClick={() => {
                                                setDonationForm({
                                                  ...donationForm,
                                                  memberId: member.id,
                                                  donorName: member.name || ""
                                                });
                                                setShowDonationMemberDropdown(false);
                                                setDonationMemberSearch("");
                                              }}
                                              style={{
                                                padding: "12px 16px",
                                                cursor: "pointer",
                                                borderBottom: "1px solid #e5e7eb",
                                                background: donationForm.memberId === member.id ? "#f9fafb" : "#fff",
                                                transition: "background 0.2s"
                                              }}
                                              onMouseEnter={(e) => {
                                                if (donationForm.memberId !== member.id) {
                                                  e.target.style.background = "#f9f9f9";
                                                }
                                              }}
                                              onMouseLeave={(e) => {
                                                if (donationForm.memberId !== member.id) {
                                                  e.target.style.background = "#fff";
                                                }
                                              }}
                                            >
                                              <div style={{ fontWeight: "500", color: "#000" }}>{member.name}</div>
                                              <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>
                                                {member.id} {member.email ? `• ${member.email}` : ""}
                                              </div>
                                            </div>
                                          ))}

                                        {members.filter(member =>
                                          !donationMemberSearch ||
                                          member.name?.toLowerCase().includes(donationMemberSearch.toLowerCase()) ||
                                          member.id?.toLowerCase().includes(donationMemberSearch.toLowerCase())
                                        ).length === 0 && (
                                            <div style={{ padding: "16px", textAlign: "center", color: "#999", fontSize: "0.875rem" }}>
                                              No members found
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {!donationForm.memberId && (
                                  <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "4px", display: "none" }}>
                                    Please select a member
                                  </span>
                                )}
                              </label>
                            </div>
                          )}
                          <label>
                            Payment Method <span style={{ color: "#ef4444" }}>*</span>
                            <div className="donation-payment-method-select-wrapper">
                              <select
                                className="donation-payment-method-select-default"
                                value={donationForm.method}
                                onChange={(e) => {
                                  setDonationForm({ ...donationForm, method: e.target.value });
                                  if (donationFieldErrors.method) {
                                    setDonationFieldErrors(prev => ({ ...prev, method: false }));
                                    if (currentInvalidDonationField === "method") {
                                      setCurrentInvalidDonationField(null);
                                    }
                                  }
                                }}
                                required
                                style={{
                                  border: donationFieldErrors.method ? "2px solid #ef4444" : undefined
                                }}
                              >
                                <option value="">Select method</option>
                                <option value="Online Payment">Online Payment</option>
                                <option value="Cash Payment">Cash Payment</option>
                              </select>

                              {/* Custom dropdown UI for mobile */}
                              <div className="donation-payment-method-select-custom" data-donation-payment-method-dropdown>
                                <div
                                  onClick={() => setShowDonationPaymentMethodDropdown(!showDonationPaymentMethodDropdown)}
                                  style={{
                                    padding: "10px 16px",
                                    border: donationFieldErrors.method ? "2px solid #ef4444" : "1px solid #e0e0e0",
                                    borderRadius: "4px",
                                    background: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    color: donationForm.method ? "#000" : "#999",
                                    minHeight: "42px"
                                  }}
                                >
                                  <span>
                                    {donationForm.method || "Select method"}
                                  </span>
                                  <span style={{
                                    fontSize: "0.75rem",
                                    color: "#5a31ea",
                                    transition: "transform 0.2s ease",
                                    transform: showDonationPaymentMethodDropdown ? "rotate(180deg)" : "rotate(0deg)",
                                    display: "inline-block"
                                  }}>▼</span>
                                </div>

                                {showDonationPaymentMethodDropdown && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "100%",
                                      left: 0,
                                      right: 0,
                                      background: "#fff",
                                      border: "1px solid #e0e0e0",
                                      borderRadius: "4px",
                                      marginTop: "4px",
                                      zIndex: 1000,
                                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div
                                      onClick={() => {
                                        setDonationForm({ ...donationForm, method: "Online Payment" });
                                        setShowDonationPaymentMethodDropdown(false);
                                        if (donationFieldErrors.method) {
                                          setDonationFieldErrors(prev => ({ ...prev, method: false }));
                                          if (currentInvalidDonationField === "method") {
                                            setCurrentInvalidDonationField(null);
                                          }
                                        }
                                      }}
                                      style={{
                                        padding: "12px 16px",
                                        cursor: "pointer",
                                        borderBottom: "1px solid #e5e7eb",
                                        background: donationForm.method === "Online Payment" ? "#f9fafb" : "#fff",
                                        transition: "background 0.2s",
                                        color: "#1a1a1a"
                                      }}
                                      onMouseEnter={(e) => {
                                        if (donationForm.method !== "Online Payment") {
                                          e.currentTarget.style.background = "#f3f4f6";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (donationForm.method !== "Online Payment") {
                                          e.currentTarget.style.background = "#fff";
                                        }
                                      }}
                                    >
                                      Online Payment
                                    </div>
                                    <div
                                      onClick={() => {
                                        setDonationForm({ ...donationForm, method: "Cash Payment" });
                                        setShowDonationPaymentMethodDropdown(false);
                                        if (donationFieldErrors.method) {
                                          setDonationFieldErrors(prev => ({ ...prev, method: false }));
                                          if (currentInvalidDonationField === "method") {
                                            setCurrentInvalidDonationField(null);
                                          }
                                        }
                                      }}
                                      style={{
                                        padding: "12px 16px",
                                        cursor: "pointer",
                                        background: donationForm.method === "Cash Payment" ? "#f9fafb" : "#fff",
                                        transition: "background 0.2s",
                                        color: "#1a1a1a"
                                      }}
                                      onMouseEnter={(e) => {
                                        if (donationForm.method !== "Cash Payment") {
                                          e.currentTarget.style.background = "#f3f4f6";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (donationForm.method !== "Cash Payment") {
                                          e.currentTarget.style.background = "#fff";
                                        }
                                      }}
                                    >
                                      Cash Payment
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </label>

                          {/* Proof Image - Required for Cash Payment */}
                          {donationForm.method === "Cash Payment" && (
                            <label style={{ gridColumn: "1 / -1" }}>
                              Proof Image <span style={{ color: "#ef4444" }}>*</span>
                              <div
                                style={{
                                  border: donationFieldErrors.screenshot ? "2px dashed #ef4444" : "2px dashed #d0d0d0",
                                  borderRadius: "4px",
                                  padding: "24px",
                                  textAlign: "center",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  background: donationImagePreview || donationForm.screenshot ? "#f9fafb" : "#fafafa",
                                }}
                                onMouseEnter={(e) => {
                                  if (!donationFieldErrors.screenshot) {
                                    e.currentTarget.style.borderColor = "#5a31ea";
                                  }
                                  e.currentTarget.style.background = "#f8f9ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = donationFieldErrors.screenshot ? "#ef4444" : "#d0d0d0";
                                  e.currentTarget.style.background = donationImagePreview || donationForm.screenshot ? "#f9fafb" : "#fafafa";
                                }}
                                onClick={() => {
                                  const input = document.createElement("input");
                                  input.type = "file";
                                  input.accept = "image/*";
                                  input.onchange = async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;

                                    if (!file.type.startsWith("image/")) {
                                      showToast("Please upload an image file", "error");
                                      return;
                                    }

                                    // Create preview
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setDonationImageFile(file);
                                      setDonationImagePreview(reader.result);
                                      if (donationFieldErrors.screenshot) {
                                        setDonationFieldErrors(prev => ({ ...prev, screenshot: false }));
                                        if (currentInvalidDonationField === "screenshot") {
                                          setCurrentInvalidDonationField(null);
                                        }
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  };
                                  input.click();
                                }}
                              >
                                {donationImagePreview || donationForm.screenshot ? (
                                  <div style={{ position: "relative", display: "inline-block" }}>
                                    <img
                                      src={donationImagePreview || donationForm.screenshot}
                                      alt="Preview"
                                      style={{
                                        maxWidth: "100%",
                                        maxHeight: "200px",
                                        borderRadius: "4px",
                                        marginBottom: "8px"
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDonationImageFile(null);
                                        setDonationImagePreview(null);
                                        setDonationForm({ ...donationForm, screenshot: "" });
                                        if (donationFieldErrors.screenshot) {
                                          setDonationFieldErrors(prev => ({ ...prev, screenshot: false }));
                                          if (currentInvalidDonationField === "screenshot") {
                                            setCurrentInvalidDonationField(null);
                                          }
                                        }
                                      }}
                                      style={{
                                        position: "absolute",
                                        top: "8px",
                                        right: "8px",
                                        background: "#ef4444",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "50%",
                                        width: "28px",
                                        height: "28px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      ×
                                    </button>
                                    <div style={{ fontSize: "0.875rem", color: "#666", marginTop: "8px" }}>
                                      Click to change image
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <i className="fas fa-cloud-upload-alt" style={{
                                      fontSize: "2rem",
                                      color: "#5a31ea",
                                      marginBottom: "8px"
                                    }}></i>
                                    <div style={{ fontSize: "0.875rem", color: "#666", marginTop: "8px" }}>
                                      Click to upload image
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "4px" }}>
                                      PNG, JPG, GIF up to 10MB
                                    </div>
                                  </>
                                )}
                              </div>
                            </label>
                          )}

                          {/* Proof Image - Also required for Online Payment */}
                          {donationForm.method === "Online Payment" && (
                            <label style={{ gridColumn: "1 / -1" }}>
                              Proof Image <span style={{ color: "#ef4444" }}>*</span>
                              <div
                                style={{
                                  border: donationFieldErrors.screenshot ? "2px dashed #ef4444" : "2px dashed #d0d0d0",
                                  borderRadius: "4px",
                                  padding: "24px",
                                  textAlign: "center",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  background: donationImagePreview || donationForm.screenshot ? "#f9fafb" : "#fafafa",
                                }}
                                onMouseEnter={(e) => {
                                  if (!donationFieldErrors.screenshot) {
                                    e.currentTarget.style.borderColor = "#5a31ea";
                                  }
                                  e.currentTarget.style.background = "#f8f9ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = donationFieldErrors.screenshot ? "#ef4444" : "#d0d0d0";
                                  e.currentTarget.style.background = donationImagePreview || donationForm.screenshot ? "#f9fafb" : "#fafafa";
                                }}
                                onClick={() => {
                                  const input = document.createElement("input");
                                  input.type = "file";
                                  input.accept = "image/*";
                                  input.onchange = async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;

                                    if (!file.type.startsWith("image/")) {
                                      showToast("Please upload an image file", "error");
                                      return;
                                    }

                                    // Create preview
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setDonationImageFile(file);
                                      setDonationImagePreview(reader.result);
                                      if (donationFieldErrors.screenshot) {
                                        setDonationFieldErrors(prev => ({ ...prev, screenshot: false }));
                                        if (currentInvalidDonationField === "screenshot") {
                                          setCurrentInvalidDonationField(null);
                                        }
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  };
                                  input.click();
                                }}
                              >
                                {donationImagePreview || donationForm.screenshot ? (
                                  <div style={{ position: "relative", display: "inline-block" }}>
                                    <img
                                      src={donationImagePreview || donationForm.screenshot}
                                      alt="Preview"
                                      style={{
                                        maxWidth: "100%",
                                        maxHeight: "200px",
                                        borderRadius: "4px",
                                        marginBottom: "8px"
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDonationImageFile(null);
                                        setDonationImagePreview(null);
                                        setDonationForm({ ...donationForm, screenshot: "" });
                                        if (donationFieldErrors.screenshot) {
                                          setDonationFieldErrors(prev => ({ ...prev, screenshot: false }));
                                          if (currentInvalidDonationField === "screenshot") {
                                            setCurrentInvalidDonationField(null);
                                          }
                                        }
                                      }}
                                      style={{
                                        position: "absolute",
                                        top: "8px",
                                        right: "8px",
                                        background: "#ef4444",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "50%",
                                        width: "28px",
                                        height: "28px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      ×
                                    </button>
                                    <div style={{ fontSize: "0.875rem", color: "#666", marginTop: "8px" }}>
                                      Click to change image
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <i className="fas fa-cloud-upload-alt" style={{
                                      fontSize: "2rem",
                                      color: "#5a31ea",
                                      marginBottom: "8px"
                                    }}></i>
                                    <div style={{ fontSize: "0.875rem", color: "#666", marginTop: "8px" }}>
                                      Click to upload image
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "4px" }}>
                                      PNG, JPG, GIF up to 10MB
                                    </div>
                                  </>
                                )}
                              </div>
                            </label>
                          )}

                          <label>
                            <span><i className="fas fa-calendar-day" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Date <span style={{ color: "#ef4444" }}>*</span></span>
                            <input
                              type="date"
                              value={donationForm.date}
                              onChange={(e) => {
                                const selectedDate = e.target.value;
                                setDonationForm({ ...donationForm, date: selectedDate });
                                if (donationFieldErrors.date) {
                                  setDonationFieldErrors(prev => ({ ...prev, date: false }));
                                  if (currentInvalidDonationField === "date") {
                                    setCurrentInvalidDonationField(null);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const dateValue = e.target.value;
                                if (dateValue) {
                                  const date = new Date(dateValue);
                                  if (isNaN(date.getTime())) {
                                    showToast("Invalid date format. Please enter a valid date (YYYY-MM-DD)", "error");
                                    return;
                                  }
                                  // Validate date components
                                  const [year, month, day] = dateValue.split('-').map(Number);
                                  if (month < 1 || month > 12) {
                                    showToast("Invalid month. Please enter a month between 01 and 12", "error");
                                    return;
                                  }
                                  if (day < 1 || day > 31) {
                                    showToast("Invalid day. Please enter a valid day for the selected month", "error");
                                    return;
                                  }
                                  // Check if day is valid for the month
                                  const daysInMonth = new Date(year, month, 0).getDate();
                                  if (day > daysInMonth) {
                                    showToast(`Invalid date. ${month}/${year} only has ${daysInMonth} days`, "error");
                                    return;
                                  }
                                }
                              }}
                              required
                              style={{
                                borderRadius: "4px",
                                width: "100%",
                                border: donationFieldErrors.date ? "2px solid #ef4444" : undefined
                              }}
                            />
                          </label>

                          <label>
                            Notes (Optional)
                            <textarea
                              value={donationForm.notes}
                              onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })}
                              rows={3}
                              placeholder="Additional notes about this donation..."
                            />
                          </label>
                          <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                            <button type="submit" className="primary-btn" disabled={isDonationSubmitting}>
                              {isDonationSubmitting ? "Saving..." : "Save Donation"}
                            </button>
                            <button
                              type="button"
                              className="ghost-btn"
                              onClick={() => {
                                setIsDonationSubmitting(false);
                                setShowDonationForm(false);
                                setDonationForm({
                                  donorName: "",
                                  isMember: false,
                                  memberId: "",
                                  amount: "",
                                  method: "",
                                  date: "",
                                  notes: "",
                                  reference: "",
                                  screenshot: "",
                                });
                                setDonationImageFile(null);
                                setDonationImagePreview(null);
                                setDonationMemberSearch("");
                                setShowDonationMemberDropdown(false);
                                setShowDonationPaymentMethodDropdown(false);
                              }}
                              disabled={isDonationSubmitting}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Total Donation Card */}
                  <div style={{ marginBottom: "24px" }}>
                    {(() => {
                      const donationsArray = Array.isArray(donations) ? donations : [];
                      let filteredDonations = donationsArray.filter(donation => donation !== null);
                      
                      // Filter by year
                      if (donationYearFilter && donationYearFilter !== "All") {
                        filteredDonations = filteredDonations.filter((donation) => {
                          if (!donation) return false;
                          // Get donation date from donation.date or donation.createdAt
                          const donationDate = donation.date || donation.createdAt;
                          if (!donationDate) return false;
                          
                          try {
                            const date = new Date(donationDate);
                            const donationYear = date.getFullYear().toString();
                            return donationYear === donationYearFilter;
                          } catch (e) {
                            return false;
                          }
                        });
                      }
                      
                      const totalDonationAmount = filteredDonations.reduce((sum, d) => {
                        const val = parseFloat(d?.amount || 0);
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0);

                      return (
                        <div className="admin-dashboard-kpi-card" style={{ maxWidth: "400px" }}>
                          <div className="admin-dashboard-kpi-header">
                          
                            <div className="admin-dashboard-kpi-content">
                            
                              <div className="admin-dashboard-kpi-label"><div className="admin-dashboard-kpi-icon admin-dashboard-kpi-icon--green">
                              <i className="fas fa-heart"></i>
                            </div>Total Donation</div>
                              <div className="admin-dashboard-kpi-value">
                                {formatCurrency(totalDonationAmount)}
                              </div>
                              <div className="admin-dashboard-kpi-description">
                                {filteredDonations.length} donation{filteredDonations.length !== 1 ? 's' : ''} recorded
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Donations Table */}
                  <div className="card-donations">
                    {!donations || (Array.isArray(donations) && donations.length === 0) ? (
                      <div style={{
                        textAlign: "center",
                        padding: "60px 20px",
                        color: "#666"
                      }}>
                        <div style={{ fontSize: "48px", marginBottom: "16px" }}>💝</div>
                        <p style={{ margin: 0, fontSize: "1.125rem", fontWeight: "500" }}>No donations yet</p>
                        <p style={{ margin: "8px 0 0 0", fontSize: "0.9375rem", color: "#999" }}>
                          Click "Add Donation" to record your first donation
                        </p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        {(() => {
                          // Filter donations
                          const donationsArray = Array.isArray(donations) ? donations : [];
                          let filteredDonations = donationsArray.filter(donation => donation !== null);

                          // Filter by year
                          if (donationYearFilter && donationYearFilter !== "All") {
                            filteredDonations = filteredDonations.filter((donation) => {
                              if (!donation) return false;
                              // Get donation date from donation.date or donation.createdAt
                              const donationDate = donation.date || donation.createdAt;
                              if (!donationDate) return false;
                              
                              try {
                                const date = new Date(donationDate);
                                const donationYear = date.getFullYear().toString();
                                return donationYear === donationYearFilter;
                              } catch (e) {
                                return false;
                              }
                            });
                          }

                          // Calculate pagination
                          const totalPages = Math.ceil(filteredDonations.length / donationsPageSize) || 1;
                          const currentPage = Math.min(donationsPage, totalPages);
                          const startIndex = (currentPage - 1) * donationsPageSize;
                          const endIndex = startIndex + donationsPageSize;
                          const paginatedDonations = filteredDonations.slice(startIndex, endIndex);

                          return (
                            <>
                              <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                                  <label style={{ fontWeight: "600", color: "#1a1a1a" }}>Filter by Year:</label>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDonationYearFilter(new Date().getFullYear().toString());
                                        setDonationsPage(1);
                                      }}
                                      style={{
                                        padding: "8px 12px",
                                        borderRadius: "4px 0 0 4px",
                                        border: "1px solid #e5e7eb",
                                        borderRight: "none",
                                        background: donationYearFilter === new Date().getFullYear().toString() ? "#5a31ea" : "#ffffff",
                                        color: donationYearFilter === new Date().getFullYear().toString() ? "#ffffff" : "#6b7280",
                                        fontSize: "0.875rem",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        outline: "none",
                                        transition: "all 0.2s ease",
                                        whiteSpace: "nowrap"
                                      }}
                                      onMouseEnter={(e) => {
                                        if (donationYearFilter !== new Date().getFullYear().toString()) {
                                          e.target.style.background = "#f3f4f6";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (donationYearFilter !== new Date().getFullYear().toString()) {
                                          e.target.style.background = "#ffffff";
                                        }
                                      }}
                                    >
                                      All
                                    </button>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                      <input
                                        type="text"
                                        value={donationYearFilter}
                                        placeholder="Year"
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          if (value === "" || /^\d{0,4}$/.test(value)) {
                                            setDonationYearFilter(value || new Date().getFullYear().toString());
                                            setDonationsPage(1);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            const currentYear = donationYearFilter === "" ? new Date().getFullYear() : parseInt(donationYearFilter);
                                            if (!isNaN(currentYear)) {
                                              setDonationYearFilter(String(currentYear + 1));
                                              setDonationsPage(1);
                                            }
                                          } else if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            const currentYear = donationYearFilter === "" ? new Date().getFullYear() : parseInt(donationYearFilter);
                                            if (!isNaN(currentYear) && currentYear > 1900) {
                                              setDonationYearFilter(String(currentYear - 1));
                                              setDonationsPage(1);
                                            }
                                          }
                                        }}
                                        style={{
                                          padding: "8px 32px 8px 12px",
                                          borderRadius: "0",
                                          border: "1px solid #e5e7eb",
                                          borderLeft: "none",
                                          borderRadius: "0 4px 4px 0",
                                          borderRight: "1px solid #e5e7eb",
                                          background: "#ffffff",
                                          fontSize: "0.875rem",
                                          fontWeight: "500",
                                          outline: "none",
                                          transition: "border-color 0.2s",
                                          width: "100px",
                                          textAlign: "center"
                                        }}
                                        onFocus={(e) => {
                                          e.target.style.borderColor = "#5a31ea";
                                          e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                                        }}
                                        onBlur={(e) => {
                                          e.target.style.borderColor = "#e5e7eb";
                                          e.target.style.boxShadow = "none";
                                          if (e.target.value) {
                                            const year = parseInt(e.target.value);
                                            if (isNaN(year) || year < 1900 || year > 2100) {
                                              setDonationYearFilter(new Date().getFullYear().toString());
                                            }
                                          } else {
                                            setDonationYearFilter(new Date().getFullYear().toString());
                                          }
                                        }}
                                      />
                                      <div style={{ 
                                        position: "absolute", 
                                        right: "4px", 
                                        display: "flex", 
                                        flexDirection: "column",
                                        gap: "2px"
                                      }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const currentYear = donationYearFilter === "" ? new Date().getFullYear() : parseInt(donationYearFilter);
                                            if (!isNaN(currentYear)) {
                                              setDonationYearFilter(String(currentYear + 1));
                                              setDonationsPage(1);
                                            }
                                          }}
                                          style={{
                                            padding: "2px 4px",
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "10px",
                                            color: "#6b7280",
                                            lineHeight: "1",
                                            transition: "color 0.2s"
                                          }}
                                          onMouseEnter={(e) => {
                                            e.target.style.color = "#5a31ea";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.color = "#6b7280";
                                          }}
                                          title="Increase year"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const currentYear = donationYearFilter === "" ? new Date().getFullYear() : parseInt(donationYearFilter);
                                            if (!isNaN(currentYear) && currentYear > 1900) {
                                              setDonationYearFilter(String(currentYear - 1));
                                              setDonationsPage(1);
                                            }
                                          }}
                                          style={{
                                            padding: "2px 4px",
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "10px",
                                            color: "#6b7280",
                                            lineHeight: "1",
                                            transition: "color 0.2s"
                                          }}
                                          onMouseEnter={(e) => {
                                            e.target.style.color = "#5a31ea";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.color = "#6b7280";
                                          }}
                                          title="Decrease year"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  onClick={async () => {
                                    try {
                                      // Dynamically import exceljs to avoid module resolution issues
                                      const ExcelJS = (await import("exceljs")).default;
                                      
                                      // Prepare data for Excel export
                                      const rows = filteredDonations.map((d) => ({
                                        Date:
                                          d.date ||
                                          (d.createdAt
                                            ? new Date(d.createdAt).toLocaleDateString("en-GB", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                            })
                                            : "-"),
                                        "Donor Name": d.donorName || "",
                                        Type: d.isMember ? "Member" : "Non-Member",
                                        Amount: d.amount ? `HK$${formatNumber(Number(d.amount), {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}` : "HK$0.00",
                                        Method: d.method || "",
                                        Notes: (d.notes || "").replace(/\r?\n/g, " "),
                                      }));

                                      // Create workbook and worksheet
                                      const workbook = new ExcelJS.Workbook();
                                      const worksheet = workbook.addWorksheet("Donations");

                                      // Add headers
                                      worksheet.columns = [
                                        { header: "Date", key: "Date", width: 12 },
                                        { header: "Donor Name", key: "Donor Name", width: 25 },
                                        { header: "Type", key: "Type", width: 12 },
                                        { header: "Amount", key: "Amount", width: 15 },
                                        { header: "Method", key: "Method", width: 15 },
                                        { header: "Notes", key: "Notes", width: 40 },
                                      ];

                                      // Add rows
                                      worksheet.addRows(rows);

                                      // Generate Excel file
                                      const buffer = await workbook.xlsx.writeBuffer();
                                      const blob = new Blob([buffer], { 
                                        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                                      });
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement("a");
                                      const ts = new Date().toISOString().slice(0, 10);
                                      link.href = url;
                                      link.download = `donations-report-${ts}.xlsx`;
                                      link.click();
                                      window.URL.revokeObjectURL(url);
                                      
                                      showToast("Donations report exported as Excel");
                                    } catch (error) {
                                      console.error("Export donations Excel failed", error);
                                      showToast("Failed to export donations report", "error");
                                    }
                                  }}
                                >
                                  📥 Export as Excel
                                </button>
                              </div>

                              <Table
                                columns={["Date", "Donor Name", "Type", "Amount", "Method", "Screenshot", "Notes"]}
                                rows={paginatedDonations.map((donation) => {
                                  if (!donation) return null;
                                  const donationDate =
                                    donation.date ||
                                    (donation.createdAt
                                      ? new Date(donation.createdAt).toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })
                                      : "-");

                                  return {
                                    Date: donationDate,
                                    "Donor Name": donation.donorName || "Unknown",
                                    Type: donation.isMember ? (
                                      <span className="badge badge-active">Member</span>
                                    ) : (
                                      <span className="badge badge-inactive">Non-Member</span>
                                    ),
                                    Amount: donation.amount
                                      ? `HK$${formatNumber(Number(donation.amount), {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                      : "HK$0.00",
                                    Method: donation.method || "-",
                                    Screenshot: {
                                      render: () => donation.screenshot ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            setSelectedImageUrl(donation.screenshot);
                                            setShowImagePopup(true);
                                          }}
                                          style={{
                                            background: "none",
                                            border: "none",
                                            color: "#000",
                                            textDecoration: "none",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            cursor: "pointer",
                                            padding: 0,
                                            fontSize: "inherit"
                                          }}
                                          aria-label="View screenshot"
                                        >
                                          <Tooltip text="View screenshot" position="top">
                                          <i className="fas fa-image" aria-hidden="true"></i>
                                          </Tooltip>
                                          <span>View</span>
                                        </button>
                                      ) : "-"
                                    },
                                    Notes: donation.notes || "-",
                                  };
                                }).filter((row) => row !== null)}
                              />
                              {totalPages > 0 && filteredDonations.length > 0 && (
                                <Pagination
                                  currentPage={currentPage}
                                  totalPages={totalPages}
                                  onPageChange={setDonationsPage}
                                  pageSize={donationsPageSize}
                                  onPageSizeChange={setDonationsPageSize}
                                  totalItems={filteredDonations.length}
                                />
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </article>
              )}

              {/* REPORTS */}
              {activeSection === "reports" && (
                <article className="screen-card" id="reports">
                  <header className="screen-card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      {renderBreadcrumb("reports")}
                      <h3><i className="fas fa-chart-line" style={{ marginRight: "10px" }}></i>Financial Reports</h3>
                      <p>Comprehensive financial overview and payment analytics.</p>
                    </div>
                    {isFinanceRole && (
                      <div className="financial-reports-export-buttons" style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={handleSecureExportCSV}
                          title="Export CSV"
                          style={{
                            padding: "12px",
                            borderRadius: "8px",
                            fontWeight: "600",
                            fontSize: "1.25rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            background: "#ffffff",
                            color: "#5a31ea",
                            border: "2px solid #e5e7eb",
                            boxShadow: "none",
                            width: "48px",
                            height: "48px",
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = "#5a31ea";
                            e.target.style.color = "#ffffff";
                            e.target.style.border = "2px solid #5a31ea";
                            e.target.style.boxShadow = "0 2px 8px rgba(90, 49, 234, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "#ffffff";
                            e.target.style.color = "#5a31ea";
                            e.target.style.border = "2px solid #e5e7eb";
                            e.target.style.boxShadow = "none";
                          }}
                        >
                          <i className="fas fa-file-csv"></i>
                        </button>
                        <button
                          type="button"
                          onClick={handleSecureExportPDF}
                          title="Export PDF"
                          style={{
                            padding: "12px",
                            borderRadius: "8px",
                            fontWeight: "600",
                            fontSize: "1.25rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            background: "#ffffff",
                            color: "#5a31ea",
                            border: "2px solid #e5e7eb",
                            boxShadow: "none",
                            width: "48px",
                            height: "48px",
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = "#5a31ea";
                            e.target.style.color = "#ffffff";
                            e.target.style.border = "2px solid #5a31ea";
                            e.target.style.boxShadow = "0 2px 8px rgba(90, 49, 234, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "#ffffff";
                            e.target.style.color = "#5a31ea";
                            e.target.style.border = "2px solid #e5e7eb";
                            e.target.style.boxShadow = "none";
                          }}
                        >
                          <i className="fas fa-file-pdf"></i>
                        </button>
                      </div>
                    )}
                  </header>

                  {/* Date Range Selector - Modern Design */}
                  <div className="card card-reports" style={{ marginBottom: "24px", padding: "20px", background: "#ffffff" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
                      <div style={{ flex: "1", minWidth: "200px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
                          <i className="fas fa-calendar-alt" style={{ marginRight: "6px", color: "#5a31ea" }}></i>
                          Date From
                        </label>
                        <input
                          type="date"
                          value={dateRange.from}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            setDateRange({ ...dateRange, from: selectedDate });
                          }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            borderRadius: "8px",
                            border: "2px solid #e5e7eb",
                            fontSize: "0.9375rem",
                            background: "#ffffff",
                            transition: "all 0.2s ease"
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "#5a31ea";
                            e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#e5e7eb";
                            e.target.style.boxShadow = "none";
                          }}
                        />
                      </div>
                      <div style={{ flex: "1", minWidth: "200px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
                          <i className="fas fa-calendar-check" style={{ marginRight: "6px", color: "#5a31ea" }}></i>
                          Date To
                        </label>
                        <input
                          type="date"
                          value={dateRange.to}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            setDateRange({ ...dateRange, to: selectedDate });
                          }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            borderRadius: "8px",
                            border: "2px solid #e5e7eb",
                            fontSize: "0.9375rem",
                            background: "#ffffff",
                            transition: "all 0.2s ease"
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "#5a31ea";
                            e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#e5e7eb";
                            e.target.style.boxShadow = "none";
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {["This Year", "This Quarter", "This Month"].map((period) => (
                          <button
                            key={period}
                            onClick={() => {
                              setSelectedPeriod(period);
                              const today = new Date();
                              if (period === "This Year") {
                                setDateRange({
                                  from: `${today.getFullYear()}-01-01`,
                                  to: `${today.getFullYear()}-12-31`,
                                });
                              } else if (period === "This Quarter") {
                                const quarter = Math.floor(today.getMonth() / 3);
                                const startMonth = quarter * 3;
                                setDateRange({
                                  from: `${today.getFullYear()}-${String(startMonth + 1).padStart(2, "0")}-01`,
                                  to: `${today.getFullYear()}-${String(startMonth + 3).padStart(2, "0")}-31`,
                                });
                              } else {
                                setDateRange({
                                  from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
                                  to: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-31`,
                                });
                              }
                            }}
                            style={{
                              padding: "12px 20px",
                              borderRadius: "8px",
                              fontSize: "0.875rem",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              background: selectedPeriod === period
                                ? "#5a31ea"
                                : "#ffffff",
                              color: selectedPeriod === period ? "#ffffff" : "#6b7280",
                              border: selectedPeriod === period ? "none" : "2px solid #e5e7eb",
                              boxShadow: selectedPeriod === period
                                ? "0 4px 12px rgba(90, 49, 234, 0.3)"
                                : "none"
                            }}
                            onMouseEnter={(e) => {
                              if (selectedPeriod !== period) {
                                e.target.style.background = "#f3f4f6";
                                e.target.style.borderColor = "#d1d5db";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedPeriod !== period) {
                                e.target.style.background = "#ffffff";
                                e.target.style.borderColor = "#e5e7eb";
                              }
                            }}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics - Clean Minimal KPI Cards */}
                  <div className="kpi-grid" style={{ marginBottom: "24px" }}>
                    {/* Total Collected card hidden */}
                    {/* <div className="card kpi">
                      <p>
                        <i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                        Total Collected
                      </p>
                      <h4>
                        HK${reportStats.collected.toLocaleString()}
                      </h4>
                      <small>
                        {Math.round((reportStats.collected / reportStats.expected) * 100)}% of HK${reportStats.expected.toLocaleString()} expected
                      </small>
                    </div> */}
                    <div className="card kpi">
                      <p>
                        <i className="fas fa-chart-line" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                        Total Amount
                      </p>
                      <h4>
                        {formatCurrency(reportStats.collected)}
                      </h4>
                      <small>Subscriptions + Donations</small>
                    </div>
                    <div className="card kpi">
                      <p>
                        <i className="fas fa-credit-card" style={{ marginRight: "8px", color: "#10b981" }}></i>
                        Total Subscription Amount
                      </p>
                      <h4>
                        {formatCurrency(reportStats.paymentsTotal)}
                      </h4>
                      <small>{reportStats.paymentsCount} payment{reportStats.paymentsCount !== 1 ? 's' : ''}</small>
                    </div>
                    <div className="card kpi">
                      <p>
                        <i className="fas fa-heart" style={{ marginRight: "8px", color: "#ef4444" }}></i>
                        Total Donation Amount
                      </p>
                      <h4>
                        {formatCurrency(reportStats.donationsTotal)}
                      </h4>
                      <small>{reportStats.donationsCount} donation{reportStats.donationsCount !== 1 ? 's' : ''}</small>
                    </div>
                    <div className="card kpi">
                      <p>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: "8px", color: "#ef4444" }}></i>
                        Unpaid Members
                      </p>
                      <h4>
                        {formatNumber(dashboardMetrics.unpaidMembers || 0)}
                      </h4>
                      <small>{formatCurrency(dashboardMetrics.outstanding)} outstanding</small>
                    </div>
                    {/* Avg per Member card hidden */}
                    {/* <div className="card kpi">
                      <p>
                        <i className="fas fa-users" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                        Avg per Member
                      </p>
                      <h4>
                        HK${reportStats.averagePerMember}
                      </h4>
                      <small>Goal: HK$800</small>
                    </div> */}
                    {/* Transactions card hidden */}
                    {/* <div className="card kpi">
                      <p>
                        <i className="fas fa-exchange-alt" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                        Transactions
                      </p>
                      <h4>
                        {reportStats.transactionCount}
                      </h4>
                      <small>In selected period</small>
                    </div> */}
                  </div>

                  {/* Charts Section - Clean Design */}
                  <div className="admin-reports-charts-grid">
                    {/* Collected vs Outstanding Chart */}
                    <div className="admin-reports-chart-card--collected">
                      <div className="admin-settings-section-header">
                        <h4 className="admin-settings-section-title">
                          Collected vs Outstanding
                        </h4>
                        <p className="admin-settings-section-description">
                          Financial overview for selected period
                        </p>
                      </div>
                      {(() => {
                        const total = reportStats.collected + dashboardMetrics.outstanding;
                        const collectedHeight = Math.max(60, Math.round((reportStats.collected / total) * 200) || 0);
                        const outstandingHeight = Math.max(60, Math.round((dashboardMetrics.outstanding / total) * 200) || 0);
                        const collectedPercent = Math.round((reportStats.collected / total) * 100);
                        const outstandingPercent = Math.round((dashboardMetrics.outstanding / total) * 100);

                        return (
                          <div className="admin-reports-collected-chart">
                            <div className="admin-reports-collected-bar-wrapper">
                              <div
                                className="admin-reports-collected-bar"
                                style={{ height: `${collectedHeight}px` }}
                              >
                                {formatCurrency(reportStats.collected)}
                              </div>
                              <div className="admin-reports-collected-label">
                                <span className="admin-reports-collected-label-title">Collected</span>
                                <span className="admin-reports-collected-label-percent">
                                  {collectedPercent}%
                                </span>
                              </div>
                            </div>
                            <div className="admin-reports-collected-bar-wrapper">
                              <div
                                className="admin-reports-collected-bar admin-reports-collected-bar--outstanding"
                                style={{ height: `${outstandingHeight}px` }}
                              >
                                {formatCurrency(dashboardMetrics.outstanding)}
                              </div>
                              <div className="admin-reports-collected-label">
                                <span className="admin-reports-collected-label-title">Outstanding</span>
                                <span className="admin-reports-collected-label-percent">
                                  {outstandingPercent}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Payments Over Time Chart */}
                    <div className="admin-settings-users-card">
                      <div className="admin-settings-section-header">
                        <h4 className="admin-settings-section-title">
                          Payments Over Time
                        </h4>
                        <p className="admin-settings-section-description">
                          Payment trends for selected period
                        </p>
                      </div>
                      <div className="admin-reports-payments-chart">
                        {(() => {
                          // Group payments by week (or day if less than 7 days)
                          const paymentsByPeriod = {};
                          const fromDate = new Date(dateRange.from);
                          const toDate = new Date(dateRange.to);
                          const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));

                          reportStats.paymentsInRange.forEach(payment => {
                            const date = payment.date ? new Date(payment.date) : (payment.createdAt ? new Date(payment.createdAt) : new Date());
                            let period;

                            if (daysDiff <= 7) {
                              // Group by day
                              period = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            } else if (daysDiff <= 30) {
                              // Group by week
                              const weekStart = new Date(date);
                              weekStart.setDate(date.getDate() - date.getDay());
                              period = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            } else {
                              // Group by month
                              period = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                            }

                            if (!paymentsByPeriod[period]) {
                              paymentsByPeriod[period] = 0;
                            }
                            const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
                            paymentsByPeriod[period] += amount;
                          });

                          const periods = Object.keys(paymentsByPeriod).sort((a, b) => {
                            return new Date(a) - new Date(b);
                          }).slice(-10); // Show last 10 periods
                          const maxAmount = Math.max(...periods.map(p => paymentsByPeriod[p]), 1);

                          return (
                            <div className="admin-reports-payments-chart-bars">
                              {periods.length > 0 ? periods.map((period, index) => {
                                const amount = paymentsByPeriod[period];
                                const height = Math.max(30, (amount / maxAmount) * 180);
                                return (
                                  <div key={`${period}-${index}`} className="admin-reports-payments-bar-wrapper">
                                    <div
                                      className="admin-reports-payments-bar"
                                      style={{
                                        height: `${height}px`
                                      }}
                                      title={`${period}: ${formatCurrency(amount)}`}
                                    >
                                      {height > 40 && formatCurrency(Math.round(amount))}
                                    </div>
                                    <span className="admin-reports-payments-label">
                                      {period.length > 10 ? period.substring(0, 8) + '...' : period}
                                    </span>
                                  </div>
                                );
                              }) : (
                                <div className="admin-reports-payments-empty">
                                  No payment data in selected period
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Breakdown - Hidden */}
                  {/* <div className="card card-reports" style={{ 
                    marginBottom: "24px", 
                    padding: "24px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb"
                  }}>
                    <h4 style={{ marginBottom: "20px", fontSize: "1.25rem", fontWeight: "700", color: "#1a1a1a" }}>
                      <i className="fas fa-credit-card" style={{ marginRight: "10px", color: "#5a31ea" }}></i>
                      Payment Method Breakdown
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                      {reportStats.methodMix.map((item) => {
                        const colors = {
                          'FPS': '#10b981',
                          'PayMe': '#25D366',
                          'Bank Transfer': '#3b82f6',
                          'Cash': '#f59e0b',
                          'Other': '#6b7280'
                        };
                        const color = colors[item.label] || '#6b7280';
                        return (
                          <div
                            key={item.label}
                            style={{
                              padding: "16px",
                              borderRadius: "12px",
                              background: "#ffffff",
                              border: `2px solid ${color}`,
                              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                              transition: "all 0.2s ease"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.12)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.08)";
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                              <div
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  background: color,
                                  flexShrink: 0
                                }}
                              ></div>
                              <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#1a1a1a", flex: 1 }}>
                                {item.label}
                              </span>
                            </div>
                            <div style={{ fontSize: "1.25rem", fontWeight: "700", color: color, marginLeft: "24px" }}>
                              {item.value}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div> */}

                  {/* Filters and Transactions Section */}
                  <div className="card card-reports" style={{
                    padding: "24px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb"
                  }}>
                    {/* Filters */}
                    <div style={{ marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "0.9375rem" }}>
                          {/* <i className="fas fa-filter" style={{ marginRight: "6px", color: "#5a31ea" }}></i> */}
                          Filter by Type:
                        </label>
                        <div style={{
                          display: "flex",
                          gap: "4px",
                          background: "#f3f4f6",
                          padding: "4px",
                          borderRadius: "8px",
                          flexWrap: "wrap"
                        }}>
                          {[
                            { value: "all", label: "All" },
                            { value: "payments", label: "Payments" },
                            { value: "donations", label: "Donations" }
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setReportFilter(option.value)}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "6px",
                                border: "none",
                                fontSize: "0.875rem",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                background: reportFilter === option.value
                                  ? "#5a31ea"
                                  : "transparent",
                                color: reportFilter === option.value ? "#ffffff" : "#6b7280",
                                boxShadow: reportFilter === option.value
                                  ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                  : "none",
                              }}
                              onMouseEnter={(e) => {
                                if (reportFilter !== option.value) {
                                  e.target.style.background = "#e5e7eb";
                                  e.target.style.color = "#374151";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (reportFilter !== option.value) {
                                  e.target.style.background = "transparent";
                                  e.target.style.color = "#6b7280";
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {reportFilter === "donations" && (
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                          <label style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "0.9375rem" }}>
                            Filter by Donor Type:
                          </label>
                          <div style={{
                            display: "flex",
                            gap: "4px",
                            background: "#f3f4f6",
                            padding: "4px",
                            borderRadius: "8px",
                            flexWrap: "wrap"
                          }}>
                            {[
                              { value: "all", label: "All" },
                              { value: "member", label: "Members" },
                              { value: "non-member", label: "Non-Members" }
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setDonorTypeFilter(option.value)}
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: "6px",
                                  border: "none",
                                  fontSize: "0.875rem",
                                  fontWeight: "500",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  background: donorTypeFilter === option.value
                                    ? "#5a31ea"
                                    : "transparent",
                                  color: donorTypeFilter === option.value ? "#ffffff" : "#6b7280",
                                  boxShadow: donorTypeFilter === option.value
                                    ? "0 2px 8px rgba(90, 49, 234, 0.3)"
                                    : "none",
                                }}
                                onMouseEnter={(e) => {
                                  if (donorTypeFilter !== option.value) {
                                    e.target.style.background = "#e5e7eb";
                                    e.target.style.color = "#374151";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (donorTypeFilter !== option.value) {
                                    e.target.style.background = "transparent";
                                    e.target.style.color = "#6b7280";
                                  }
                                }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Transactions Table */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                        <h4 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700", color: "#1a1a1a" }}>
                          <i className="fas fa-list" style={{ marginRight: "10px", color: "#5a31ea" }}></i>
                          Transactions
                        </h4>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="text"
                            placeholder="Search transactions..."
                            value={transactionsSearch}
                            onChange={(e) => {
                              setTransactionsSearch(e.target.value);
                              setTransactionsPage(1);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: "8px",
                              border: "1px solid #e5e7eb",
                              fontSize: "0.9375rem",
                              minWidth: "250px",
                              background: "#ffffff"
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ overflow: "hidden", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                        <div className="table-wrapper" style={{ overflowX: "auto", width: "100%", maxWidth: "100%" }}>
                          <Table
                            columns={[
                              "Date",
                              "Type",
                              "Member / Donor",
                              "Invoice ID",
                              "Amount",
                              "Method",
                              "Screenshot",
                              "Status",
                              "Actions",
                            ]}
                            rows={(() => {
                              // Filter payments to only show those from members in the members list
                              const paymentsFromMembers = (reportStats.paymentsInRange || []).filter(p => 
                                isPaymentMemberInList(p)
                              );
                              
                              // Show all donations (both member and non-member donations)
                              const donationsFromMembers = reportStats.donationsInRange || [];
                              
                              // Combine payments and donations
                              const allTransactions = [
                                ...paymentsFromMembers.map(p => ({
                                  ...p,
                                  type: 'Payment',
                                  source: p.member || 'Unknown',
                                  amount: p.amount,
                                  method: p.method,
                                  screenshot: p.screenshot,
                                  status: p.status || 'Completed',
                                  invoiceId: p.invoiceId,
                                  period: p.period,
                                  date: p.date || (p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : "-"),
                                  createdAt: p.createdAt || new Date(p.date || 0),
                                })),
                                ...donationsFromMembers.map(d => ({
                                  ...d,
                                  type: 'Donation',
                                  source: d.donorName,
                                  amount: d.amount,
                                  method: d.method || '-',
                                  screenshot: d.screenshot || null,
                                  status: 'Completed',
                                  invoiceId: null,
                                  period: null,
                                  date: d.date || (d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : "-"),
                                  createdAt: d.createdAt || new Date(d.date || 0),
                                  isMember: d.isMember,
                                }))
                              ].sort((a, b) => {
                                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date || 0);
                                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date || 0);
                                return dateB - dateA;
                              });

                              // Apply filters
                              let filteredTransactions = allTransactions.filter(t => {
                                if (reportFilter === "payments" && t.type !== "Payment") return false;
                                if (reportFilter === "donations" && t.type !== "Donation") return false;
                                if (t.type === "Donation") {
                                  if (donorTypeFilter === "member" && !t.isMember) return false;
                                  if (donorTypeFilter === "non-member" && t.isMember) return false;
                                }
                                return true;
                              });

                              // Apply search filter
                              if (transactionsSearch.trim()) {
                                const searchLower = transactionsSearch.toLowerCase();
                                filteredTransactions = filteredTransactions.filter(t => {
                                  return (
                                    (t.source && t.source.toLowerCase().includes(searchLower)) ||
                                    (t.invoiceId && t.invoiceId.toString().toLowerCase().includes(searchLower)) ||
                                    (t.amount && t.amount.toString().toLowerCase().includes(searchLower)) ||
                                    (t.method && t.method.toLowerCase().includes(searchLower)) ||
                                    (t.status && t.status.toLowerCase().includes(searchLower)) ||
                                    (t.date && t.date.toLowerCase().includes(searchLower))
                                  );
                                });
                              }

                              // Apply pagination
                              const totalTransactions = filteredTransactions.length;
                              const totalPages = Math.ceil(totalTransactions / transactionsPageSize);
                              const startIndex = (transactionsPage - 1) * transactionsPageSize;
                              const endIndex = startIndex + transactionsPageSize;
                              const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

                              const rows = paginatedTransactions.map((transaction) => {
                                const transactionId = transaction._id || transaction.id;

                                return {
                                  Date: transaction.date || "-",
                                  Type: {
                                    render: () => (
                                      transaction.type === "Payment" ? (
                                        <span className="badge badge-paid">Payment</span>
                                      ) : (
                                        <span className="badge badge-active">Donation</span>
                                      )
                                    ),
                                  },
                                  "Member / Donor": transaction.source || "Unknown",
                                  "Invoice ID": transaction.invoiceId || (transaction.type === "Donation" ? "-" : "-"),
                                  Amount: transaction.amount
                                    ? `HK$${formatNumber(parseFloat(transaction.amount.toString().replace(/[^0-9.]/g, '') || 0), {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                    : "HK$0.00",
                                  Method: transaction.type === "Payment"
                                    ? getPaymentMethodDisplay(transaction)
                                    : (transaction.method || "-"),
                                  Screenshot: {
                                    render: () => transaction.screenshot ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedImageUrl(transaction.screenshot);
                                          setShowImagePopup(true);
                                        }}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#5a31ea",
                                          textDecoration: "none",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          cursor: "pointer",
                                          padding: 0,
                                          fontSize: "inherit"
                                        }}
                                        aria-label="View screenshot"
                                      >
                                        <Tooltip text="View screenshot" position="top">
                                        <i className="fas fa-image" aria-hidden="true"></i>
                                        </Tooltip>
                                        <span>View</span>
                                      </button>
                                    ) : "-"
                                  },
                                  Status: {
                                    render: () => (
                                      <span className={statusClass[transaction.status] || "badge badge-paid"}>
                                        {transaction.status}
                                      </span>
                                    )
                                  },
                                  Actions: {
                                    render: () => (
                                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                                        {transaction.type === "Payment" && transaction.invoiceId && (
                                          <button
                                            className="ghost-btn icon-btn icon-btn--view"
                                            onClick={() => {
                                              const invoice = invoices.find(
                                                (inv) =>
                                                  inv.id === transaction.invoiceId ||
                                                  inv._id === transaction.invoiceId
                                              );
                                              if (!invoice) {
                                                showToast("Invoice not found for this transaction", "error");
                                                return;
                                              }
                                              const member =
                                                members.find((m) => m.id === invoice.memberId) ||
                                                members.find(
                                                  (m) =>
                                                    m.name &&
                                                    invoice.memberName &&
                                                    m.name.toLowerCase() ===
                                                    invoice.memberName.toLowerCase()
                                                );
                                              if (!member) {
                                                showToast("Member not found for this invoice", "error");
                                                return;
                                              }
                                              setSelectedMember(member);
                                              setActiveSection("member-detail");
                                              setActiveTab("Invoices");
                                            }}
                                            aria-label="View Invoice"
                                          >
                                            <Tooltip text="View Invoice" position="top">
                                            <i className="fas fa-eye" aria-hidden="true"></i>
                                            </Tooltip>
                                          </button>
                                        )}
                                      </div>
                                    ),
                                  },
                                };
                              });

                              return rows;
                            })()}
                          />
                        </div>
                        {(() => {
                          // Filter payments to only show those from members in the members list
                          const paymentsFromMembers = (reportStats.paymentsInRange || []).filter(p => 
                            isPaymentMemberInList(p)
                          );
                          
                          // Show all donations (both member and non-member donations)
                          const donationsFromMembers = reportStats.donationsInRange || [];
                          
                          const allTransactions = [
                            ...paymentsFromMembers.map(p => ({
                              ...p,
                              type: 'Payment',
                              source: p.member || 'Unknown',
                              amount: p.amount,
                              method: p.method,
                              screenshot: p.screenshot,
                              status: p.status || 'Completed',
                              invoiceId: p.invoiceId,
                              period: p.period,
                              date: p.date || (p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : "-"),
                              createdAt: p.createdAt || new Date(p.date || 0),
                            })),
                            ...donationsFromMembers.map(d => ({
                              ...d,
                              type: 'Donation',
                              source: d.donorName,
                              amount: d.amount,
                              method: d.method || '-',
                              screenshot: d.screenshot || null,
                              status: 'Completed',
                              invoiceId: null,
                              period: null,
                              date: d.date || (d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : "-"),
                              createdAt: d.createdAt || new Date(d.date || 0),
                              isMember: d.isMember,
                            }))
                          ].sort((a, b) => {
                            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date || 0);
                            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date || 0);
                            return dateB - dateA;
                          });

                          let filteredTransactions = allTransactions.filter(t => {
                            if (reportFilter === "payments" && t.type !== "Payment") return false;
                            if (reportFilter === "donations" && t.type !== "Donation") return false;
                            if (t.type === "Donation") {
                              if (donorTypeFilter === "member" && !t.isMember) return false;
                              if (donorTypeFilter === "non-member" && t.isMember) return false;
                            }
                            return true;
                          });

                          if (transactionsSearch.trim()) {
                            const searchLower = transactionsSearch.toLowerCase();
                            filteredTransactions = filteredTransactions.filter(t => {
                              return (
                                (t.source && t.source.toLowerCase().includes(searchLower)) ||
                                (t.invoiceId && t.invoiceId.toString().toLowerCase().includes(searchLower)) ||
                                (t.amount && t.amount.toString().toLowerCase().includes(searchLower)) ||
                                (t.method && t.method.toLowerCase().includes(searchLower)) ||
                                (t.status && t.status.toLowerCase().includes(searchLower)) ||
                                (t.date && t.date.toLowerCase().includes(searchLower))
                              );
                            });
                          }

                          const totalTransactions = filteredTransactions.length;
                          const totalPages = Math.ceil(totalTransactions / transactionsPageSize);
                          const currentPage = Math.min(transactionsPage, totalPages || 1);

                          return (
                            <Pagination
                              currentPage={currentPage}
                              totalPages={totalPages || 1}
                              onPageChange={setTransactionsPage}
                              pageSize={transactionsPageSize}
                              onPageSizeChange={(size) => {
                                setTransactionsPageSize(size);
                                setTransactionsPage(1);
                              }}
                              totalItems={totalTransactions}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* EXPORT REPORTS */}
              {activeSection === "export-reports" && (
                <article className="screen-card" id="export-reports">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("export-reports")}
                      <h3><i className="fas fa-file-export" style={{ marginRight: "10px" }}></i>Export Reports</h3>
                      <p>Export financial data in various formats.</p>
                    </div>
                  </header>
                  <div className="card-exports">
                    <div style={{ padding: "2px" }}>
                      <div style={{ marginBottom: "24px" }}>
                        <h4 style={{ marginBottom: "12px" }}>Export Options</h4>
                        <p style={{ color: "#666", marginBottom: "20px" }}>
                          Export your financial data in CSV or PDF format. Select a date range to export specific periods.
                        </p>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                        <div className="card card-export-reports" style={{
                          padding: "20px",
                          background: "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          minHeight: "180px"
                        }}>
                          <div>
                            <h4 style={{ marginBottom: "8px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                              <i className="fas fa-file-csv" style={{ color: "#5a31ea" }}></i>
                              CSV Export
                            </h4>
                            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "16px" }}>
                              Export all transactions as a CSV file for Excel or spreadsheet applications.
                            </p>
                          </div>
                          <button
                            className="secondary-btn"
                            onClick={handleSecureExportCSV}
                            style={{ width: "100%", marginTop: "auto" }}
                            disabled={!isFinanceRole}
                            title={isFinanceRole ? "Export CSV" : "Export allowed only for finance roles"}
                          >
                            <i className="fas fa-file-csv" style={{ marginRight: "8px" }}></i>
                            Export CSV
                          </button>
                        </div>

                        <div className="card card-export-reports" style={{
                          padding: "20px",
                          background: "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          minHeight: "180px"
                        }}>
                          <div>
                            <h4 style={{ marginBottom: "8px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                              <i className="fas fa-file-pdf" style={{ color: "#5a31ea" }}></i>
                              PDF Export
                            </h4>
                            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "16px" }}>
                              Generate a formatted PDF report with charts and summaries.
                            </p>
                          </div>
                          <button
                            className="secondary-btn"
                            onClick={handleSecureExportPDF}
                            style={{ width: "100%", marginTop: "auto" }}
                            disabled={!isFinanceRole}
                            title={isFinanceRole ? "Export PDF" : "Export allowed only for finance roles"}
                          >
                            <i className="fas fa-file-pdf" style={{ marginRight: "8px" }}></i>
                            Export PDF
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: "24px", padding: "16px", background: "#f8f9ff", borderRadius: "8px" }}>
                        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "8px" }}>
                          <strong>Note:</strong> For detailed reports with date filters and analytics, visit the Financial Reports section.
                        </p>
                        <button
                          className="ghost-btn"
                          onClick={() => {
                            handleNavClick("reports");
                            showToast("Redirecting to Financial Reports...");
                          }}
                        >
                          <i className="fas fa-chart-bar" style={{ marginRight: "8px" }}></i>
                          Go to Financial Reports
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* ROLES */}
              {activeSection === "roles" && isAdmin && (
                <article className="screen-card" id="roles">
                  <header className="screen-card__header">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        {renderBreadcrumb("roles")}
                        <h3><i className="fas fa-user-shield" style={{ marginRight: "10px" }}></i>Roles</h3>
                        <p>Manage admin roles and permissions.</p>
                      </div>
                    </div>
                  </header>
                  <div className="card-roles">
                    <div style={{ padding: "2px" }}>
                      <div style={{ marginBottom: "20px" }}>
                        <h4 style={{ marginBottom: "12px" }}>Available Roles</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
                          <div style={{ padding: "16px", background: "#f8f9ff", borderRadius: "8px", border: "2px solid #5a31ea" }}>
                            <h5 style={{ margin: "0 0 8px 0", color: "#5a31ea" }}>Owner</h5>
                            <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
                              Full access to all features and settings
                            </p>
                          </div>
                          <div style={{ padding: "16px", background: "#f8f9ff", borderRadius: "8px" }}>
                            <h5 style={{ margin: "0 0 8px 0" }}>Finance Admin</h5>
                            <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
                              Can manage finances, invoices, and payments
                            </p>
                          </div>
                          <div style={{ padding: "16px", background: "#f8f9ff", borderRadius: "8px" }}>
                            <h5 style={{ margin: "0 0 8px 0" }}>Viewer</h5>
                            <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
                              Read-only access to view data
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="table-wrapper">
                        <Table
                          columns={["Name", "Email", "Role", "Status"]}
                          rows={admins.map((admin) => ({
                            Name: admin.name || "-",
                            Email: admin.email || "-",
                            Role: {
                              render: () => (
                                <span className="badge badge-active">
                                  {admin.role || "Viewer"}
                                </span>
                              )
                            },
                            Status: {
                              render: () => (
                                <span className={
                                  admin.status === "Active" ? "badge badge-active" :
                                    admin.status === "Pending" ? "badge badge-pending" :
                                      "badge badge-overdue"
                                }>
                                  {admin.status || "Active"}
                                </span>
                              )
                            },
                            Actions: {
                              render: () => (
                                <div style={{ display: "flex", gap: "8px" }}>
                                  {(admin.role || 'Viewer') !== "Owner" && (admin.role || 'Viewer') !== "Finance Admin" && (
                                    <button
                                      className="ghost-btn icon-btn icon-btn--delete"
                                      style={{ color: "#ef4444" }}
                                      onClick={async () => {
                                        showConfirmation(
                                          `Remove ${admin.name} from admin users?`,
                                          async () => {
                                            try {
                                              await deleteAdminUser(admin.id);
                                              showToast(`${admin.name} removed`);
                                              await fetchAdmins();
                                            } catch (error) {
                                              showToast(error.message || "Failed to delete admin", "error");
                                            }
                                          }
                                        );
                                      }}
                                      title="Delete Admin"
                                    >
                                      <i className="fas fa-trash" aria-hidden="true"></i>
                                    </button>
                                  )}
                                </div>
                              )
                            },
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* ORGANIZATION SETTINGS */}
              {activeSection === "org-settings" && (
                <article className="screen-card" id="org-settings">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("org-settings")}
                      <h3><i className="fas fa-building" style={{ marginRight: "10px" }}></i>Organization Settings</h3>
                      <p>Manage organization information and preferences.</p>
                    </div>
                  </header>
                  <div className="settings-container">
                    <div className="settings-card">
                      <div className="settings-card__header">
                        <h4 className="settings-card__title">Organization Info</h4>
                        <p className="settings-card__subtitle">Update your organization's contact information</p>
                      </div>
                      <form
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateOrganizationInfo(orgForm);
                          showToast("Organization info updated!");
                        }}
                        className="settings-form"
                      >
                        <div className="settings-form__group">
                          <label className="settings-form__label">
                            Organization Name
                            <input
                              type="text"
                              className="settings-form__input"
                              value={orgForm.name}
                              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                              placeholder="Subscription Manager HK"
                            />
                          </label>
                        </div>
                        <div className="settings-form__group">
                          <label className="settings-form__label">
                            Email
                            <input
                              type="email"
                              className="settings-form__input"
                              value={orgForm.email}
                              onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                              placeholder="support@subscriptionhk.org"
                            />
                          </label>
                        </div>
                        <div className="settings-form__group">
                          <label className="settings-form__label">
                            Phone
                            <input
                              type="text"
                              className="settings-form__input"
                              value={orgForm.phone}
                              onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                              placeholder="+852 2800 1122"
                            />
                          </label>
                        </div>
                        <div className="settings-form__group">
                          <label className="settings-form__label">
                            Address
                            <textarea
                              className="settings-form__input"
                              value={orgForm.address}
                              onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                              placeholder="123 Central Street, Hong Kong"
                              rows={3}
                            />
                          </label>
                        </div>
                        <div className="settings-form__group">
                          <label className="settings-form__label">
                            {/* <i className="fas fa-globe" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                            -` */}
                            Number Format Locale 
                            {/* <span style={{ color: "#ef4444" }}>*</span> */}
                          </label>
                          <select
                            className="settings-form__input"
                            value={userLocale}
                            onChange={(e) => {
                              updateUserLocale(e.target.value);
                              showToast("Number format locale updated! Numbers will refresh automatically.", "success");
                            }}
                            style={{
                              padding: "12px",
                              border: "1px solid #e5e7eb",
                              borderRadius: "4px",
                              fontSize: "0.875rem",
                              color: "#1a1a1a",
                              backgroundColor: "#ffffff",
                              cursor: "pointer",
                            }}
                          >
                            {getAvailableLocales().map((locale) => (
                              <option key={locale.value} value={locale.value}>
                                {locale.label}
                              </option>
                            ))}
                          </select>
                          <p style={{ margin: "8px 0 0 0", fontSize: "0.75rem", color: "#666" }}>
                            Choose your preferred number format. Example: {formatNumber(1234567.89, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="settings-form__actions">
                          <button type="submit" className="primary-btn">
                            Save Changes
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </article>
              )}

              {/* SETTINGS */}
              {activeSection === "users" && isAdmin && (
                <article className="screen-card" id="settings">
                  <header className="screen-card__header">
                    <div>
                      {renderBreadcrumb("users")}
                      <h3>Admin Settings</h3>
                      <p>Organization profile and admin accounts.</p>
                    </div>
                  </header>
                  <div className="settings-container">
                    <div className="settings-card">
                      <div className="settings-card__header">
                        <div className="settings-card__header-content">
                          <div>
                            <h4 className="settings-card__title">User Management</h4>
                            <p className="settings-card__subtitle">Manage admin users and their permissions</p>
                          </div>
                          <button
                            className="settings-card__add-btn primary-btn"
                            onClick={() => {
                              if (!isAdmin) {
                                showToast("Only Owner and Finance Admin can add new admin users", "error");
                                return;
                              }
                              setShowAdminForm(true);
                              setAdminForm({ name: "", email: "", phone: "", password: "", role: "Viewer", status: "Active" });
                              setShowAddAdminPassword(false);
                              setAdminEmailError("");
                              setAdminFieldErrors({
                                name: false,
                                email: false,
                                phone: false,
                                password: false,
                              });
                              setCurrentInvalidAdminField(null);
                            }}
                            disabled={!isAdmin}
                            title={isAdmin ? "Add a new admin user" : "Only Owner and Finance Admin can add admins"}
                          >
                            + Add Admin
                          </button>
                        </div>
                      </div>

                      <div className="settings-table-wrapper">
                        <Table
                          columns={["User", "Role", "Status", "Actions"]}
                          rows={admins.map((user) => ({
                            User: user.name,
                            Role: user.role || 'Viewer',
                            Status: {
                              render: () => (
                                <span className={(user.status || 'Active') === "Active" ? "badge badge-active" : "badge badge-inactive"}>
                                  {user.status || 'Active'}
                                </span>
                              ),
                            },
                            Actions: {
                              render: () => (
                                <div className="settings-table__actions" style={{ justifyContent: "center" }}>
                                  {(user.status || 'Active') === "Active" ? (
                                    <button
                                      className="ghost-btn settings-table__action-btn"
                                      onClick={async () => {
                                        try {
                                          await updateAdminUser(user.id, { status: "Inactive" });
                                          showToast(`${user.name} deactivated`);
                                        } catch (error) {
                                          showToast(error.message || "Failed to update admin", "error");
                                        }
                                      }}
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      className="secondary-btn settings-table__action-btn"
                                      onClick={async () => {
                                        try {
                                          await updateAdminUser(user.id, { status: "Active" });
                                          showToast(`${user.name} activated`);
                                        } catch (error) {
                                          showToast(error.message || "Failed to update admin", "error");
                                        }
                                      }}
                                    >
                                      Activate
                                    </button>
                                  )}
                                  {(user.role || 'Viewer') !== "Owner" && (user.role || 'Viewer') !== "Finance Admin" && (
                                    <button
                                      className="ghost-btn icon-btn icon-btn--delete"
                                      onClick={async () => {
                                        showConfirmation(
                                          `Remove ${user.name} from admin users?`,
                                          async () => {
                                            try {
                                              await deleteAdminUser(user.id);
                                              showToast(`${user.name} removed`);
                                              await fetchAdmins();
                                            } catch (error) {
                                              showToast(error.message || "Failed to delete admin", "error");
                                            }
                                          }
                                        );
                                      }}
                                      title="Remove Admin"
                                      aria-label="Remove Admin"
                                    >
                                      <i className="fas fa-trash" aria-hidden="true"></i>
                                    </button>
                                  )}
                                </div>
                              ),
                            },
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Add Admin Modal */}
                  {showAdminForm && (
                    <div
                      className="admin-members-form-overlay"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setShowAdminForm(false);
                          setShowAddAdminPassword(false);
                          setAdminEmailError("");
                          setAdminFieldErrors({
                            name: false,
                            email: false,
                            phone: false,
                            password: false,
                          });
                          setCurrentInvalidAdminField(null);
                        }
                      }}
                    >
                      <div
                        className="admin-members-form-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="modal-header">
                          <h4 className="modal-title">
                            <i className="fas fa-user-plus" aria-hidden="true"></i>
                            Add New Admin
                          </h4>
                          <button
                            type="button"
                            className="close-btn close-btn-danger"
                            onClick={() => {
                              setShowAdminForm(false);
                              setShowAddAdminPassword(false);
                              setAdminEmailError("");
                              setAdminFieldErrors({
                                name: false,
                                email: false,
                                phone: false,
                                password: false,
                              });
                              setCurrentInvalidAdminField(null);
                            }}
                            aria-label="Close add admin form"
                          >
                            ×
                          </button>
                        </div>

                        <form
                          noValidate
                          onSubmit={async (e) => {
                            e.preventDefault();
                            
                            // Validate all fields progressively
                            if (!validateAdminForm()) {
                              // Validation error already shown via Notie in validateAdminForm
                              return;
                            }

                            try {
                              await addAdminUser(adminForm);
                              setShowAdminForm(false);
                              setAdminForm({ name: "", email: "", phone: "", password: "", role: "Viewer", status: "Active" });
                              setShowAddAdminPassword(false);
                              setAdminEmailError("");
                              setAdminFieldErrors({
                                name: false,
                                email: false,
                                phone: false,
                                password: false,
                              });
                              setCurrentInvalidAdminField(null);
                              showToast("Admin user added!");
                            } catch (error) {
                              showToast(error.message || "Failed to add admin user", "error");
                            }
                          }}
                          className="settings-form"
                        >
                          <div className="settings-form__group">
                            <label className="settings-form__label">
                              Name
                              <input
                                type="text"
                                className="settings-form__input"
                                required
                                value={adminForm.name}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setAdminForm({ ...adminForm, name: newValue });
                                  // Clear error when user starts typing
                                  if (adminFieldErrors.name || currentInvalidAdminField === "name") {
                                    setAdminFieldErrors(prev => ({ ...prev, name: false }));
                                    if (currentInvalidAdminField === "name") {
                                      setCurrentInvalidAdminField(null);
                                    }
                                  }
                                  // Clear error styles if field has value
                                  if (newValue.trim()) {
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                }}
                                placeholder="Enter admin name"
                                style={{
                                  borderColor: (adminFieldErrors.name && currentInvalidAdminField === "name" && !adminForm.name.trim()) ? "#ef4444" : undefined,
                                  borderWidth: (adminFieldErrors.name && currentInvalidAdminField === "name" && !adminForm.name.trim()) ? "2px" : undefined,
                                }}
                                aria-invalid={adminFieldErrors.name && currentInvalidAdminField === "name" && !adminForm.name.trim()}
                                onFocus={(e) => {
                                  if (adminFieldErrors.name && currentInvalidAdminField === "name" && !adminForm.name.trim()) {
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                    e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                  } else if (adminForm.name.trim()) {
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <div className="settings-form__group">
                            <label className="settings-form__label">
                              Email
                              <input
                                type="email"
                                className="settings-form__input"
                                required
                                value={adminForm.email}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setAdminForm({ ...adminForm, email: newValue });
                                  
                                  // Validate email format
                                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  const isValidEmail = newValue.trim() && emailRegex.test(newValue.trim());
                                  
                                  // Clear error styles only if email is valid
                                  if (isValidEmail) {
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                    setAdminEmailError("");
                                    if (adminFieldErrors.email || currentInvalidAdminField === "email") {
                                      setAdminFieldErrors(prev => ({ ...prev, email: false }));
                                      if (currentInvalidAdminField === "email") {
                                        setCurrentInvalidAdminField(null);
                                      }
                                    }
                                  } else if (newValue.trim()) {
                                    // If email has value but is invalid, show error border
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                    e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                  }
                                }}
                                onBlur={(e) => {
                                  // Validate on blur
                                  const error = validateAdminEmail(e.target.value);
                                  setAdminEmailError(error);
                                  if (error) {
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                  } else if (e.target.value.trim()) {
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                }}
                                placeholder="Enter admin email"
                                style={{
                                  borderColor: (adminFieldErrors.email && currentInvalidAdminField === "email") ? "#ef4444" : (adminEmailError ? "#ef4444" : undefined),
                                  borderWidth: (adminFieldErrors.email && currentInvalidAdminField === "email") || adminEmailError ? "2px" : undefined,
                                }}
                                aria-invalid={(adminFieldErrors.email && currentInvalidAdminField === "email") || !!adminEmailError}
                                onFocus={(e) => {
                                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  const isValidEmail = adminForm.email.trim() && emailRegex.test(adminForm.email.trim());
                                  
                                  if ((adminFieldErrors.email && currentInvalidAdminField === "email" && !isValidEmail) || (adminEmailError && !isValidEmail)) {
                                    e.target.style.setProperty("border-color", "#ef4444", "important");
                                    e.target.style.setProperty("outline", "none", "important");
                                    e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                  } else if (isValidEmail) {
                                    e.target.style.setProperty("border-color", "", "important");
                                    e.target.style.setProperty("outline", "", "important");
                                    e.target.style.setProperty("box-shadow", "", "important");
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <div className="settings-form__group">
                            <PhoneInput
                              label={
                                <span className="admin-phone-input-label">
                                  {/* <i className="fas fa-phone admin-phone-input-label-icon" aria-hidden="true"></i> */}
                                  <span className="mobile-text">Mobile Number</span> <span className="admin-phone-input-required">*</span>
                                </span>
                              }
                              value={adminForm.phone}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setAdminForm({ ...adminForm, phone: newValue });
                                // Clear error when user starts typing
                                if (adminFieldErrors.phone || currentInvalidAdminField === "phone") {
                                  setAdminFieldErrors(prev => ({ ...prev, phone: false }));
                                  if (currentInvalidAdminField === "phone") {
                                    setCurrentInvalidAdminField(null);
                                  }
                                }
                              }}
                              onError={(error) => {
                                showToast(error, "error");
                                setAdminFieldErrors(prev => ({ ...prev, phone: true }));
                                setCurrentInvalidAdminField("phone");
                              }}
                              required={true}
                              className={adminFieldErrors.phone && currentInvalidAdminField === "phone" ? "admin-phone-input-error" : ""}
                              placeholder="Enter mobile number"
                            />
                          </div>
                          <div className="settings-form__group">
                            <label className="settings-form__label">
                              Password
                              <div style={{ position: "relative" }}>
                                <input
                                  type={showAddAdminPassword ? "text" : "password"}
                                  className="settings-form__input"
                                  required
                                  value={adminForm.password}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    setAdminForm({ ...adminForm, password: newValue });
                                    // Clear error when user starts typing
                                    if (adminFieldErrors.password || currentInvalidAdminField === "password") {
                                      setAdminFieldErrors(prev => ({ ...prev, password: false }));
                                      if (currentInvalidAdminField === "password") {
                                        setCurrentInvalidAdminField(null);
                                      }
                                    }
                                    // Clear error styles if field has value
                                    if (newValue.trim()) {
                                      e.target.style.setProperty("border-color", "", "important");
                                      e.target.style.setProperty("outline", "", "important");
                                      e.target.style.setProperty("box-shadow", "", "important");
                                    }
                                  }}
                                  placeholder="Set a password"
                                  style={{
                                    paddingRight: "40px",
                                    borderColor: (adminFieldErrors.password && currentInvalidAdminField === "password" && !adminForm.password.trim()) ? "#ef4444" : undefined,
                                    borderWidth: (adminFieldErrors.password && currentInvalidAdminField === "password" && !adminForm.password.trim()) ? "2px" : undefined,
                                  }}
                                  aria-invalid={adminFieldErrors.password && currentInvalidAdminField === "password" && !adminForm.password.trim()}
                                  onFocus={(e) => {
                                    if (adminFieldErrors.password && currentInvalidAdminField === "password" && !adminForm.password.trim()) {
                                      e.target.style.setProperty("border-color", "#ef4444", "important");
                                      e.target.style.setProperty("outline", "none", "important");
                                      e.target.style.setProperty("box-shadow", "0 0 0 3px rgba(239, 68, 68, 0.1)", "important");
                                    } else if (adminForm.password.trim()) {
                                      e.target.style.setProperty("border-color", "", "important");
                                      e.target.style.setProperty("outline", "", "important");
                                      e.target.style.setProperty("box-shadow", "", "important");
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowAddAdminPassword(!showAddAdminPassword)}
                                  className="login-password-toggle"
                                  style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}
                                  aria-label={showAddAdminPassword ? "Hide password" : "Show password"}
                                >
                                  <i className={`fas ${showAddAdminPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                                </button>
                              </div>
                            </label>
                          </div>
                          <div className="settings-form__group">
                            <label className="settings-form__label">
                              Role
                              <select
                                className="settings-form__select"
                                value={adminForm.role}
                                onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                              >
                                <option>Owner</option>
                                <option>Finance Admin</option>
                                <option>Viewer</option>
                              </select>
                            </label>
                          </div>

                          <div className="settings-form__actions">
                            <button
                              type="button"
                              className="ghost-btn settings-form__cancel"
                              onClick={() => {
                                setShowAdminForm(false);
                                setShowAddAdminPassword(false);
                                setAdminEmailError("");
                                setAdminFieldErrors({
                                  name: false,
                                  email: false,
                                  phone: false,
                                  password: false,
                                });
                                setCurrentInvalidAdminField(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="primary-btn settings-form__submit-btn">
                              Add Admin
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </article>
              )}
            </div>
          </div>
        </main>

        {/* Payment Modal */}
        {showPaymentModal && paymentModalInvoice && (
          <div
            className="admin-members-form-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPaymentModal(false);
                setPaymentModalInvoice(null);
                setPaymentModalData({
                  paymentMethod: "",
                  imageFile: null,
                  imagePreview: null,
                  imageUrl: "",
                  reference: "",
                  selectedAdminId: "",
                  adminMobile: "",
                });
              }
            }}
          >
            <div
              className="card admin-members-form-container"

              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
                  <i className="fas fa-money-bill-wave" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                  Pay Invoice #{paymentModalInvoice.id}
                </h3>
                <button
                  type="button"
                  className="close-btn close-btn-simple"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentModalInvoice(null);
                    setPaymentModalData({
                      paymentMethod: "",
                      imageFile: null,
                      imagePreview: null,
                      imageUrl: "",
                    });
                  }}
                  aria-label="Close payment modal"
                >
                  ×
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Invoice Info */}
                <div style={{
                  padding: "16px",
                  background: "#f8f9ff",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "#666", fontSize: "0.875rem" }}>Amount:</span>
                    <strong style={{ color: "#1a1a1a", fontSize: "1.125rem" }}>{paymentModalInvoice.amount}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "#666", fontSize: "0.875rem" }}>Joined Date:</span>
                    <span style={{ color: "#1a1a1a" }}>
                      {(() => {
                        const member = members.find(m => 
                          m.id === paymentModalInvoice.memberId || 
                          m.email === paymentModalInvoice.memberEmail || 
                          m.name === paymentModalInvoice.memberName
                        );
                        if (member?.start_date) {
                          return new Date(member.start_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          });
                        } else if (member?.createdAt) {
                          return new Date(member.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          });
                        }
                        return "-";
                      })()}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#666", fontSize: "0.875rem" }}>Status:</span>
                    <span style={{ color: "#1a1a1a" }}>{paymentModalInvoice.status || "Unpaid"}</span>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#333",
                    marginBottom: "12px"
                  }}>
                    Payment Method
                  </label>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setPaymentModalData({
                        ...paymentModalData,
                        paymentMethod: "Cash"
                      })}
                      style={{
                        flex: "1",
                        minWidth: "150px",
                        padding: "12px 20px",
                        borderRadius: "8px",
                        border: "1px solid rgb(224, 224, 224)",
                        background: paymentModalData.paymentMethod === "Cash"
                          ? "#5a31ea"
                          : "#f8f9ff",
                        color: paymentModalData.paymentMethod === "Cash" ? "#ffffff" : "#1a1a1a",
                        boxShadow: paymentModalData.paymentMethod === "Cash"
                          ? "0 4px 12px rgba(90, 49, 234, 0.3)"
                          : "0 2px 4px rgba(90, 49, 234, 0.08)",
                        fontWeight: "600",
                        fontSize: "0.9375rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <i className="fas fa-money-bill-wave"></i>
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentModalData({
                        ...paymentModalData,
                        paymentMethod: "Online"
                      })}
                      style={{
                        flex: "1",
                        minWidth: "150px",
                        padding: "12px 20px",
                        borderRadius: "8px",
                        border: "1px solid rgb(224, 224, 224)",
                        background: paymentModalData.paymentMethod === "Online"
                          ? "#5a31ea"
                          : "#f8f9ff",
                        color: paymentModalData.paymentMethod === "Online" ? "#ffffff" : "#1a1a1a",
                        boxShadow: paymentModalData.paymentMethod === "Online"
                          ? "0 4px 12px rgba(90, 49, 234, 0.3)"
                          : "0 2px 4px rgba(90, 49, 234, 0.08)",
                        fontWeight: "600",
                        fontSize: "0.9375rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <i className="fas fa-globe"></i>
                      Online
                    </button>
                  </div>
                </div>

                {/* Admin Selection - Shown for both Cash and Online */}
                {(paymentModalData.paymentMethod === "Cash" || paymentModalData.paymentMethod === "Online") && (
                  <div style={{ marginBottom: "2px" }}>
                    <div style={{ marginBottom: "2px" }}>
                      <label style={{
                        display: "block",
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        color: "#333",
                        marginBottom: "8px"
                      }}>
                        Choose Admin <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <select
                        value={paymentModalData.selectedAdminId}
                        onChange={(e) => {
                          setPaymentModalData({ ...paymentModalData, selectedAdminId: e.target.value });
                          if (paymentModalErrors.selectedAdminId || currentInvalidPaymentModalField === "selectedAdminId") {
                            setPaymentModalErrors(prev => ({ ...prev, selectedAdminId: false }));
                            if (currentInvalidPaymentModalField === "selectedAdminId") {
                              setCurrentInvalidPaymentModalField(null);
                            }
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: paymentModalErrors.selectedAdminId && currentInvalidPaymentModalField === "selectedAdminId" ? "2px solid #ef4444" : "1px solid #e0e0e0",
                          borderRadius: "8px",
                          fontSize: "0.875rem",
                          background: "#fff",
                          outline: "none",
                          cursor: "pointer",
                          transition: "border-color 0.2s"
                        }}
                        onFocus={(e) => {
                          if (!paymentModalErrors.selectedAdminId || currentInvalidPaymentModalField !== "selectedAdminId") {
                            e.target.style.borderColor = "#5a31ea";
                            e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                          }
                        }}
                        onBlur={(e) => {
                          if (paymentModalErrors.selectedAdminId && currentInvalidPaymentModalField === "selectedAdminId") {
                            e.target.style.borderColor = "#ef4444";
                            e.target.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
                          } else {
                            e.target.style.borderColor = "#e0e0e0";
                            e.target.style.boxShadow = "none";
                          }
                        }}
                      >
                        <option value="">Select an admin</option>
                        {admins.filter(admin => admin.status === "Active").map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.name} ({admin.phone || '-'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Attachment Upload - Required for both payment methods */}
                {(paymentModalData.paymentMethod === "Cash" || paymentModalData.paymentMethod === "Online") && (
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                      color: "#333",
                      marginBottom: "12px"
                    }}>
                      Attachment Image <span style={{ color: "#999", fontSize: "0.75rem" }}>(Optional)</span>
                    </label>
                    <div style={{
                      border: paymentModalErrors.image ? "2px dashed #ef4444" : "2px dashed #d0d0d0",
                      borderRadius: "8px",
                      padding: "20px",
                      textAlign: "center",
                      background: paymentModalErrors.image ? "#fef2f2" : "#fafafa",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: paymentModalErrors.image ? "0 0 0 3px rgba(239, 68, 68, 0.1)" : "none",
                    }}
                      onMouseEnter={(e) => {
                        if (!paymentModalErrors.image) {
                          e.currentTarget.style.borderColor = "#5a31ea";
                          e.currentTarget.style.background = "#f8f9ff";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!paymentModalErrors.image) {
                          e.currentTarget.style.borderColor = "#d0d0d0";
                          e.currentTarget.style.background = "#fafafa";
                        } else {
                          e.currentTarget.style.borderColor = "#ef4444";
                          e.currentTarget.style.background = "#fef2f2";
                        }
                      }}
                      onClick={() => {
                        // Clear error when user clicks to upload
                        if (paymentModalErrors.image) {
                          setPaymentModalErrors({ ...paymentModalErrors, image: false });
                        }
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          if (!file.type.startsWith("image/")) {
                            showToast("Please upload an image file", "error");
                            return;
                          }

                          // Create preview
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPaymentModalData(prev => ({
                              ...prev,
                              imageFile: file,
                              imagePreview: reader.result,
                            }));
                            // Clear error when image is uploaded
                            setPaymentModalErrors(prev => ({ ...prev, image: false }));
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}
                    >
                      {paymentModalData.imagePreview || (paymentModalInvoice.screenshot && !paymentModalData.imageFile) ? (
                        <div style={{ position: "relative" }}>
                          <img
                            src={paymentModalData.imagePreview || paymentModalInvoice.screenshot}
                            alt="Preview"
                            style={{
                              maxWidth: "100%",
                              maxHeight: "200px",
                              borderRadius: "4px",
                              marginBottom: "8px"
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentModalData({
                                ...paymentModalData,
                                imageFile: null,
                                imagePreview: null,
                                imageUrl: "",
                              });
                              // Clear error when image is removed
                              setPaymentModalErrors(prev => ({ ...prev, image: false }));
                            }}
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              background: "#ef4444",
                              color: "#fff",
                              border: "none",
                              borderRadius: "50%",
                              width: "28px",
                              height: "28px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.875rem",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <>
                          <i className="fas fa-cloud-upload-alt" style={{
                            fontSize: "2rem",
                            color: "#5a31ea",
                            marginBottom: "8px"
                          }}></i>
                          <p style={{ margin: "0", color: "#666", fontSize: "0.875rem" }}>
                            Click to upload image
                          </p>
                          <p style={{ margin: "4px 0 0 0", color: "#999", fontSize: "0.75rem" }}>
                            PNG, JPG, GIF up to 5MB
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentModalInvoice(null);
                      setPaymentModalData({
                        paymentMethod: "",
                        imageFile: null,
                        imagePreview: null,
                        imageUrl: "",
                        reference: "",
                        selectedAdminId: "",
                        adminMobile: "",
                      });
                      setPaymentModalErrors({ image: false, reference: false, selectedAdminId: false, adminMobile: false });
                      setCurrentInvalidPaymentModalField(null);
                    }}
                    disabled={uploadingPaymentModal}
                  >
                    Cancel
                  </button>
                  {/* Show Mark as Paid button only when payment method is selected */}
                  {paymentModalData.paymentMethod && (
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={uploadingPaymentModal}
                      onClick={async () => {
                        // Progressive validation for payment modal
                        const validatePaymentModal = () => {
                          // Define field order for validation - only admin is required, image is optional
                          const fieldOrder = ["selectedAdminId"];

                          // If we have a current invalid field, check if it's now valid
                          if (currentInvalidPaymentModalField) {
                            let isValid = true;
                            let errorMsg = "";

                            if (currentInvalidPaymentModalField === "selectedAdminId" && !paymentModalData.selectedAdminId) {
                              isValid = false;
                              errorMsg = "Please select an admin";
                            }

                            if (isValid) {
                              setPaymentModalErrors(prev => ({ ...prev, [currentInvalidPaymentModalField]: false }));
                              setCurrentInvalidPaymentModalField(null);
                            } else {
                              setPaymentModalErrors(prev => ({ ...prev, [currentInvalidPaymentModalField]: true }));
                              showToast(errorMsg, "error");
                              return false;
                            }
                          }

                          // Find first invalid field
                          for (const field of fieldOrder) {
                            let isValid = true;
                            let errorMsg = "";

                            if (field === "selectedAdminId" && !paymentModalData.selectedAdminId) {
                              isValid = false;
                              errorMsg = "Please select an admin";
                            }

                            if (!isValid) {
                              // Clear all errors first
                              setPaymentModalErrors({
                                image: false,
                                reference: false,
                                selectedAdminId: false,
                                adminMobile: false,
                              });
                              // Set only this field as invalid
                              setPaymentModalErrors(prev => ({ ...prev, [field]: true }));
                              setCurrentInvalidPaymentModalField(field);
                              showToast(errorMsg, "error");

                              // Focus on the invalid field
                              setTimeout(() => {
                                if (field === "selectedAdminId") {
                                  const selects = document.querySelectorAll('select');
                                  const adminSelect = Array.from(selects).find(select =>
                                    select.options[0]?.text === "Select an admin"
                                  );
                                  adminSelect?.focus();
                                  adminSelect?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }
                              }, 100);

                              return false;
                            }
                          }

                          // All fields valid
                          setPaymentModalErrors({
                            image: false,
                            reference: false,
                            selectedAdminId: false,
                            adminMobile: false,
                          });
                          setCurrentInvalidPaymentModalField(null);
                          return true;
                        };

                        if (!validatePaymentModal()) {
                          return;
                        }

                        // Show confirmation dialog
                        showConfirmation(
                          `Are you sure you want to mark Invoice #${paymentModalInvoice.id} as paid?`,
                          async () => {
                            setUploadingPaymentModal(true);
                            try {
                              const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
                              let imageUrl = paymentModalData.imageUrl || paymentModalInvoice.screenshot;

                              // Upload image if new file exists
                              if (paymentModalData.imageFile) {
                                const formData = new FormData();
                                formData.append("screenshot", paymentModalData.imageFile);
                                formData.append("uploadType", "invoice-payment-attachment");

                                const uploadResponse = await fetch(`${apiUrl}/api/upload/screenshot`, {
                                  method: "POST",
                                  body: formData,
                                });

                                if (!uploadResponse.ok) {
                                  // Try to get error message from response
                                  let errorMessage = "Failed to upload image";
                                  try {
                                    const errorData = await uploadResponse.json();
                                    errorMessage = errorData.error || errorMessage;
                                    console.error("Upload error response:", errorData);
                                  } catch (parseError) {
                                    console.error("Failed to parse error response:", parseError);
                                    errorMessage = `Upload failed with status ${uploadResponse.status}`;
                                  }
                                  throw new Error(errorMessage);
                                }

                                const uploadData = await uploadResponse.json();
                                if (!uploadData.url) {
                                  throw new Error("No URL returned from upload. Please try again.");
                                }
                                imageUrl = uploadData.url;
                              }

                              // Image is optional, so no validation needed here

                              // Update invoice with screenshot if image was uploaded
                              if (imageUrl && imageUrl !== paymentModalInvoice.screenshot) {
                                await updateInvoice(paymentModalInvoice.id, {
                                  screenshot: imageUrl,
                                });
                              }

                              // Mark invoice as paid - wait for it to complete before closing modal
                              const paymentMethod = paymentModalData.paymentMethod; // Already "Cash" or "Online"
                              await handleMarkAsPaid(paymentModalInvoice.id, paymentMethod, imageUrl, null);

                              // Close modal and reset AFTER payment is successfully processed
                              setShowPaymentModal(false);
                              setPaymentModalInvoice(null);
                              setPaymentModalData({
                                paymentMethod: "",
                                imageFile: null,
                                imagePreview: null,
                                imageUrl: "",
                                reference: "",
                                selectedAdminId: "",
                                adminMobile: "",
                              });
                              setPaymentModalErrors({ image: false, reference: false, selectedAdminId: false, adminMobile: false });
                              setCurrentInvalidPaymentModalField(null);
                              setUploadingPaymentModal(false);

                              // Toast is already shown in handleMarkAsPaid
                            } catch (error) {
                              console.error("Error processing payment:", error);
                              showToast(error.message || "Failed to process payment", "error");
                              
                              // Close modal and reset even on error - use setTimeout to ensure it happens
                              setTimeout(() => {
                                setShowPaymentModal(false);
                                setPaymentModalInvoice(null);
                                setPaymentModalData({
                                  paymentMethod: "",
                                  imageFile: null,
                                  imagePreview: null,
                                  imageUrl: "",
                                  reference: "",
                                  selectedAdminId: "",
                                  adminMobile: "",
                                });
                                setPaymentModalErrors({ image: false, reference: false, selectedAdminId: false, adminMobile: false });
                                setCurrentInvalidPaymentModalField(null);
                                setUploadingPaymentModal(false);
                              }, 100);
                            } finally {
                              // Ensure uploading state is always reset
                              setTimeout(() => {
                                setUploadingPaymentModal(false);
                              }, 200);
                            }
                          },
                          null,
                          "Confirm"
                        );
                      }}
                      style={{
                        opacity: uploadingPaymentModal ? 0.6 : 1,
                        cursor: uploadingPaymentModal ? "not-allowed" : "pointer",
                      }}
                    >
                      {uploadingPaymentModal ? "Processing..." : "Mark as Paid"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reminder Log Details Modal */}
        {selectedReminderLogItem && (
          <div
            className="admin-members-form-overlay"
            onClick={() => setSelectedReminderLogItem(null)}
          >
            <div
              className="admin-members-form-container reminder-log-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-members-form-header">
                <div className="admin-members-form-header-top">
                  <h3 className="admin-members-form-title">
                    <i className="fas fa-eye"></i>
                    Reminder Log Details
                  </h3>
                  <button
                    className="admin-members-form-close"
                    onClick={() => setSelectedReminderLogItem(null)}
                    aria-label="Close"
                  >
                    <i className="fa-solid fa-times" />
                  </button>
                </div>
              </div>

              <div className="reminder-log-modal-content">
                <div className="reminder-log-modal-row">
                  <div className="reminder-log-modal-field">
                    <label className="reminder-log-modal-label">
                      <i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                      Member
                    </label>
                    <div className="reminder-log-modal-value">
                      {selectedReminderLogItem.memberName || selectedReminderLogItem.member || "-"}
                      {selectedReminderLogItem.memberId ? ` (${selectedReminderLogItem.memberId})` : ""}
                    </div>
                  </div>

                  <div className="reminder-log-modal-field">
                    <label className="reminder-log-modal-label">
                      <i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                      Channel
                    </label>
                    <div className="reminder-log-modal-value">{selectedReminderLogItem.channel || "-"}</div>
                  </div>
                </div>

                <div className="reminder-log-modal-row">
                  <div className="reminder-log-modal-field">
                    <label className="reminder-log-modal-label">
                      <i className="fas fa-tag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                      Type
                    </label>
                    <div className="reminder-log-modal-value">{selectedReminderLogItem.type || "-"}</div>
                  </div>

                  <div className="reminder-log-modal-field">
                    <label className="reminder-log-modal-label">
                      <i className="fas fa-calendar" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                      Date
                    </label>
                    <div className="reminder-log-modal-value">{selectedReminderLogItem.date || "-"}</div>
                  </div>
                </div>

                <div className="reminder-log-modal-row">
                  <div className="reminder-log-modal-field">
                    <label className="reminder-log-modal-label">
                      <i className="fas fa-info-circle" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                      Status
                    </label>
                    <div className="reminder-log-modal-value">
                      <span className={statusClass[selectedReminderLogItem.status] || "badge"}>
                        {selectedReminderLogItem.status || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="reminder-log-modal-row">
                  <div className="reminder-log-modal-field reminder-log-modal-field-full">
                    <label className="reminder-log-modal-label">
                      <i className="fas fa-file-alt" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                      Message
                    </label>
                    <div className="reminder-log-modal-value">{selectedReminderLogItem.message || "-"}</div>
                  </div>
                </div>

                {selectedReminderLogItem.channel === "Email" && selectedReminderLogItem.status === "Failed" && !isViewer && (
                  <div className="reminder-log-modal-row">
                    <div className="reminder-log-modal-field reminder-log-modal-actions reminder-log-modal-field-full">
                      <label className="reminder-log-modal-label">Actions</label>
                      <div className="reminder-log-modal-value">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={async () => {
                            try {
                              const raw = selectedReminderLogItem.raw;
                              const reminderId = raw?._id || raw?.id;
                              const apiUrl = import.meta.env.DEV
                                ? ""
                                : import.meta.env.VITE_API_URL || "";
                              const res = await fetch(
                                `${apiUrl}/api/reminders/retry`,
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ reminderId }),
                                }
                              );
                              const data = await res.json();
                              if (res.ok) {
                                showToast(data.message || "Reminder retry queued");
                                if (typeof fetchReminderLogs === "function") {
                                  fetchReminderLogs();
                                }
                                setSelectedReminderLogItem(null);
                              } else {
                                showToast(
                                  data.error || "Failed to retry reminder",
                                  "error"
                                );
                              }
                            } catch (error) {
                              console.error("Retry reminder failed", error);
                              showToast("Failed to retry reminder", "error");
                            }
                          }}
                        >
                          <i className="fas fa-redo" style={{ marginRight: "6px" }}></i>
                          Retry Sending
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Details Modal */}
        {showPaymentDetailsModal && selectedPaymentDetails && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPaymentDetailsModal(false);
                setSelectedPaymentDetails(null);
              }
            }}
          >
            <div
              className="card modal-container"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header mb-2xl">
                <h3 className="modal-title">
                  <i className="fas fa-receipt icon-spacing-sm text-primary"></i>
                  Payment Details
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentDetailsModal(false);
                    setSelectedPaymentDetails(null);
                  }}
                  className="close-btn-simple"
                >
                  ×
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Payment Info Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                }}>
                  {selectedPaymentDetails.date && (
                    <div style={{
                      padding: "16px",
                      background: "#f8f9ff",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0"
                    }}>
                      <span style={{ display: "block", color: "#666", fontSize: "0.875rem", marginBottom: "4px" }}>Date</span>
                      <strong style={{ color: "#1a1a1a", fontSize: "1rem" }}>{selectedPaymentDetails.date}</strong>
                    </div>
                  )}
                  {selectedPaymentDetails.amount && (
                    <div style={{
                      padding: "16px",
                      background: "#f8f9ff",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0"
                    }}>
                      <span style={{ display: "block", color: "#666", fontSize: "0.875rem", marginBottom: "4px" }}>Amount</span>
                      <strong style={{ color: "#5a31ea", fontSize: "1.25rem", fontWeight: "700" }}>{selectedPaymentDetails.amount}</strong>
                    </div>
                  )}
                  {selectedPaymentDetails.status && (
                    <div style={{
                      padding: "16px",
                      background: "#f8f9ff",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0"
                    }}>
                      <span style={{ display: "block", color: "#666", fontSize: "0.875rem", marginBottom: "4px" }}>Status</span>
                      <span
                        className={`badge ${selectedPaymentDetails.status === "Paid" ||
                          selectedPaymentDetails.status === "Completed"
                          ? "badge-paid"
                          : selectedPaymentDetails.status ===
                            "Pending Verification" ||
                            selectedPaymentDetails.status === "Pending"
                            ? "badge-pending"
                            : "badge-unpaid"
                          }`}
                        style={{
                          fontSize: "0.875rem",
                          padding: "6px 12px",
                          display: "inline-block",
                          marginTop: "4px",
                        }}
                      >
                        {selectedPaymentDetails.status}
                      </span>
                    </div>
                  )}
                  <div style={{
                    padding: "16px",
                    background: "#f8f9ff",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0"
                  }}>
                    <span style={{ display: "block", color: "#666", fontSize: "0.875rem", marginBottom: "4px" }}>Payment Method</span>
                    <strong style={{ color: "#1a1a1a", fontSize: "1rem" }}>{getPaymentMethodDisplay(selectedPaymentDetails)}</strong>
                  </div>
                </div>

                {/* Additional Details */}
                <div style={{
                  padding: "20px",
                  background: "#fafafa",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0"
                }}>
                  <h4 style={{ margin: "0 0 16px 0", fontSize: "1rem", fontWeight: "600", color: "#333" }}>Additional Information</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {selectedPaymentDetails.reference &&
                      selectedPaymentDetails.reference !== "N/A" &&
                      selectedPaymentDetails.reference !== "-" && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.875rem", color: "#666" }}>Reference:</span>
                          <strong style={{ fontSize: "0.875rem", fontFamily: "monospace", color: "#1a1a1a" }}>
                            {selectedPaymentDetails.reference}
                          </strong>
                        </div>
                      )}
                    {selectedPaymentDetails.paidToAdminName && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.875rem", color: "#666" }}>Paid to:</span>
                        <strong style={{ fontSize: "0.875rem", color: "#1a1a1a" }}>
                          {selectedPaymentDetails.paidToAdminName}
                        </strong>
                      </div>
                    )}
                    {selectedPaymentDetails.period && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.875rem", color: "#666" }}>Period:</span>
                        <strong style={{ fontSize: "0.875rem", color: "#1a1a1a" }}>
                          {selectedPaymentDetails.period}
                        </strong>
                      </div>
                    )}
                    {selectedPaymentDetails.member && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.875rem", color: "#666" }}>Member:</span>
                        <strong style={{ fontSize: "0.875rem", color: "#1a1a1a" }}>
                          {selectedPaymentDetails.member}
                        </strong>
                      </div>
                    )}
                    {selectedPaymentDetails.memberEmail && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.875rem", color: "#666" }}>Email:</span>
                        <strong style={{ fontSize: "0.875rem", color: "#1a1a1a" }}>
                          {selectedPaymentDetails.memberEmail}
                        </strong>
                      </div>
                    )}
                    {selectedPaymentDetails.invoiceId && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.875rem", color: "#666" }}>Invoice ID:</span>
                        <strong style={{ fontSize: "0.875rem", fontFamily: "monospace", color: "#1a1a1a" }}>
                          {selectedPaymentDetails.invoiceId}
                        </strong>
                      </div>
                    )}
                    {selectedPaymentDetails.notes && (
                      <div style={{ marginTop: "8px", paddingTop: "12px", borderTop: "1px solid #e0e0e0" }}>
                        <span style={{ display: "block", fontSize: "0.875rem", color: "#666", marginBottom: "4px" }}>Notes:</span>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#1a1a1a" }}>
                          {selectedPaymentDetails.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Screenshot */}
                {selectedPaymentDetails.screenshot && (
                  <div>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: "600", color: "#333" }}>
                      <i className="fas fa-image" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                      Payment Screenshot
                    </h4>
                    <div style={{
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "#fafafa",
                    }}>
                      <img
                        src={selectedPaymentDetails.screenshot}
                        alt="Payment Screenshot"
                        style={{
                          width: "100%",
                          height: "auto",
                          display: "block",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          const newWindow = window.open();
                          if (newWindow) {
                            newWindow.document.write(`
                              <html>
                                <head><title>Payment Screenshot</title></head>
                                <body style="margin:0;padding:20px;background:#f9fafb;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                  <img src="${selectedPaymentDetails.screenshot}" alt="Payment Screenshot" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                                </body>
                              </html>
                            `);
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newWindow = window.open();
                        if (newWindow) {
                          newWindow.document.write(`
                            <html>
                              <head><title>Payment Screenshot</title></head>
                              <body style="margin:0;padding:20px;background:#f9fafb;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                <img src="${selectedPaymentDetails.screenshot}" alt="Payment Screenshot" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                              </body>
                            </html>
                          `);
                        }
                      }}
                      className="primary-btn"
                      style={{
                        width: "100%",
                        marginTop: "12px",
                        padding: "12px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <i className="fas fa-expand"></i>
                      Open Screenshot in New Window
                    </button>
                  </div>
                )}

                {/* Close Button */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setShowPaymentDetailsModal(false);
                      setSelectedPaymentDetails(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {showPasswordResetModal && selectedPasswordResetRequest && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPasswordResetModal(false);
                setSelectedPasswordResetRequest(null);
                setPasswordResetForm({ newPassword: "" });
              }
            }}
          >
            <div
              className="card modal-container modal-container-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h4 className="modal-title">
                  <i className="fas fa-key" aria-hidden="true"></i>
                  Set New Password
                </h4>
                <button
                  type="button"
                  className="ghost-btn close-btn close-btn-danger"
                  onClick={() => {
                    setShowPasswordResetModal(false);
                    setSelectedPasswordResetRequest(null);
                    setPasswordResetForm({ newPassword: "" });
                  }}
                  aria-label="Close password reset modal"
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#666", marginBottom: "8px" }}>
                  Set a new password for:
                </p>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: "600", color: "#1a1a1a" }}>
                  {selectedPasswordResetRequest.userEmail}
                </p>
                {selectedPasswordResetRequest.userName && (
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem", color: "#666" }}>
                    {selectedPasswordResetRequest.userName}
                  </p>
                )}
              </div>

              <form
                noValidate
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!passwordResetForm.newPassword || passwordResetForm.newPassword.trim().length < 6) {
                    showToast("Password must be at least 6 characters", "error");
                    return;
                  }
                  await handlePasswordReset(
                    selectedPasswordResetRequest._id,
                    passwordResetForm.newPassword.trim()
                  );
                }}
                className="settings-form"
              >
                <div className="settings-form__group">
                  <label className="settings-form__label">
                    New Password
                    <input
                      type="password"
                      className="settings-form__input"
                      required
                      minLength={6}
                      value={passwordResetForm.newPassword}
                      onChange={(e) =>
                        setPasswordResetForm({ newPassword: e.target.value })
                      }
                      placeholder="Enter new password (min 6 characters)"
                      autoFocus
                    />
                  </label>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#666" }}>
                    Password must be at least 6 characters long. The new password will be sent to the user via email.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setShowPasswordResetModal(false);
                      setSelectedPasswordResetRequest(null);
                      setPasswordResetForm({ newPassword: "" });
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn">
                    <i className="fas fa-key" style={{ marginRight: "6px" }}></i>
                    Set Password & Send Email
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Preview Modal */}
        {showImportPreview && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isImporting) {
                setShowImportPreview(false);
                setImportPreviewData([]);
                setImportErrors([]);
                setImportFileName("");
              }
            }}
          >
            <div
              className="card modal-container"
              style={{ maxWidth: "90vw", width: "1000px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ flexShrink: 0 }}>
                <h4 className="modal-title">
                  <i className="fas fa-file-import" aria-hidden="true" style={{ marginRight: "8px" }}></i>
                  Import Preview - {importFileName}
                </h4>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => {
                    if (!isImporting) {
                      setShowImportPreview(false);
                      setImportPreviewData([]);
                      setImportErrors([]);
                      setImportFileName("");
                    }
                  }}
                  disabled={isImporting}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div style={{ padding: "20px", overflow: "auto", flex: 1 }}>
                <div style={{ marginBottom: "16px", padding: "12px", background: "#f0f7ff", borderRadius: "8px", border: "1px solid #b3d9ff" }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#0066cc" }}>
                    <i className="fas fa-info-circle" style={{ marginRight: "6px" }}></i>
                    <strong>{importPreviewData.length}</strong> valid member(s) found.
                    {importErrors.length > 0 && (
                      <span style={{ marginLeft: "8px", color: "#d32f2f" }}>
                        <strong>{importErrors.length}</strong> row(s) with errors.
                      </span>
                    )}
                    {" "}Please review the data below before confirming the import.
                  </p>
                </div>

                {/* Preview Table */}
                <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333", borderRight: "1px solid #e0e0e0" }}>#</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333", borderRight: "1px solid #e0e0e0" }}>Name</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333", borderRight: "1px solid #e0e0e0" }}>Email</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333", borderRight: "1px solid #e0e0e0" }}>Phone</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333", borderRight: "1px solid #e0e0e0" }}>Native</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333", borderRight: "1px solid #e0e0e0" }}>Subscription Type</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333", borderRight: "1px solid #e0e0e0" }}>Subscription Year</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#333" }}>Start Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewData.map((member, index) => (
                        <tr key={index} style={{ borderBottom: "1px solid #e0e0e0" }}>
                          <td style={{ padding: "12px", borderRight: "1px solid #e0e0e0", color: "#666" }}>{index + 1}</td>
                          <td style={{ padding: "12px", borderRight: "1px solid #e0e0e0", color: "#333", fontWeight: "500" }}>
                            {member.name || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                          </td>
                          <td style={{ padding: "12px", borderRight: "1px solid #e0e0e0", color: "#333" }}>
                            {member.email || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                          </td>
                          <td style={{ padding: "12px", borderRight: "1px solid #e0e0e0", color: "#333" }}>
                            {member.phone || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                          </td>
                          <td style={{ padding: "12px", borderRight: "1px solid #e0e0e0", color: "#333" }}>
                            {member.native || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                          </td>
                          <td style={{ padding: "12px", borderRight: "1px solid #e0e0e0", color: "#333" }}>
                            {member.subscriptionType || <span style={{ color: "#999", fontStyle: "italic" }}>Lifetime</span>}
                          </td>
                          <td style={{ padding: "12px", borderRight: "1px solid #e0e0e0", color: "#333" }}>
                            {member.subscriptionYear || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                          </td>
                          <td style={{ padding: "12px", color: "#333" }}>
                            {member.start_date ? new Date(member.start_date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }) : <span style={{ color: "#999", fontStyle: "italic" }}>Today</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Errors Table */}
                {importErrors.length > 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <div style={{ marginBottom: "12px", padding: "12px", background: "#ffebee", borderRadius: "8px", border: "1px solid #ffcdd2" }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#c62828", fontWeight: "600" }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: "6px" }}></i>
                        Rows with Errors ({importErrors.length})
                      </p>
                    </div>
                    <div style={{ overflowX: "auto", border: "1px solid #ffcdd2", borderRadius: "8px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                        <thead>
                          <tr style={{ background: "#ffebee", borderBottom: "2px solid #ffcdd2" }}>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#c62828", borderRight: "1px solid #ffcdd2" }}>Row #</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#c62828", borderRight: "1px solid #ffcdd2" }}>Name</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#c62828", borderRight: "1px solid #ffcdd2" }}>Email</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#c62828", borderRight: "1px solid #ffcdd2" }}>Phone</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#c62828", borderRight: "1px solid #ffcdd2" }}>Subscription Type</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#c62828" }}>Errors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importErrors.map((errorRow, index) => (
                            <tr key={index} style={{ borderBottom: "1px solid #ffcdd2", background: index % 2 === 0 ? "#fff" : "#fff5f5" }}>
                              <td style={{ padding: "12px", borderRight: "1px solid #ffcdd2", color: "#666", fontWeight: "600" }}>{errorRow.row}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #ffcdd2", color: "#333" }}>
                                {errorRow.data.name || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                              </td>
                              <td style={{ padding: "12px", borderRight: "1px solid #ffcdd2", color: "#333" }}>
                                {errorRow.data.email || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                              </td>
                              <td style={{ padding: "12px", borderRight: "1px solid #ffcdd2", color: "#333" }}>
                                {errorRow.data.phone || <span style={{ color: "#999", fontStyle: "italic" }}>-</span>}
                              </td>
                              <td style={{ padding: "12px", borderRight: "1px solid #ffcdd2", color: "#333" }}>
                                {errorRow.data.subscriptionType || <span style={{ color: "#999", fontStyle: "italic" }}>Lifetime</span>}
                              </td>
                              <td style={{ padding: "12px", color: "#c62828" }}>
                                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                                  {errorRow.errors.map((error, errIndex) => (
                                    <li key={errIndex} style={{ marginBottom: "4px", fontSize: "0.8rem" }}>
                                      {error}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ padding: "20px", borderTop: "1px solid #e0e0e0", display: "flex", justifyContent: "flex-end", gap: "12px", flexShrink: 0 }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    if (!isImporting) {
                      setShowImportPreview(false);
                      setImportPreviewData([]);
                      setImportErrors([]);
                      setImportFileName("");
                    }
                  }}
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleConfirmImport}
                  disabled={isImporting || importPreviewData.length === 0}
                >
                  {isImporting ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: "6px" }}></i>
                      Importing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check" style={{ marginRight: "6px" }}></i>
                      Confirm Import ({importPreviewData.length} members)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Popup Modal */}
        {showImagePopup && (
          <div
            className="modal-overlay modal-overlay-high"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImagePopup(false);
                setSelectedImageUrl("");
              }
            }}
            style={{
              background: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000
            }}
          >
            <div
              style={{
                position: "relative",
                maxWidth: "90vw",
                maxHeight: "90vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImageUrl}
                alt="Donation proof"
                style={{
                  maxWidth: "100%",
                  maxHeight: "90vh",
                  borderRadius: "8px",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)"
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setShowImagePopup(false);
                  setSelectedImageUrl("");
                }}
                style={{
                  position: "absolute",
                  bottom: "16px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#000",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                  transition: "all 0.2s ease",
                  zIndex: 10001
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f5f5f5";
                  e.target.style.transform = "translateX(-50%) scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "#ffffff";
                  e.target.style.transform = "translateX(-50%) scale(1)";
                }}
                
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <SiteFooter />
      </>
    );
  }

  export default AdminPage;
  export { AdminPage };
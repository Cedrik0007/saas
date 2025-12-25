import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { useApp } from "../context/AppContext.jsx";
import { useAutoLogout } from "../hooks/useAutoLogout.js";
import jsPDF from "jspdf";
import {
} from "../data";
import { statusClass } from "../statusClasses";


export function AdminPage() {
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
    addAdminUser,
    updateAdminUser,
    deleteAdminUser,
    resetAllData,
    addPayment,
    reminderLogs,
    fetchReminderLogs,
    donations,
    fetchDonations,
    addDonation,
    deleteDonation,
    loading,
  } = useApp();

  // Get current admin role from sessionStorage and normalize legacy values
  const rawAdminRole = sessionStorage.getItem('adminRole') || 'Viewer';
  let currentAdminRole = rawAdminRole;
  if (rawAdminRole === "Owner") {
    currentAdminRole = "Admin";
  } else if (rawAdminRole === "Finance Admin") {
    currentAdminRole = "Finance";
  }
  const isAdmin = currentAdminRole === "Admin";
  const isOwner = currentAdminRole === "Owner";
  const isViewer = currentAdminRole === "Viewer";
  const isFinanceRole = currentAdminRole === "Admin" || currentAdminRole === "Finance";
  const isAdminOrOwner = isAdmin || isOwner;

  // Portal labelling based on role
  const portalTitleByRole = {
    Admin: "Admin Portal",
    Finance: "Finance Portal",
    Staff: "Staff Portal",
    Viewer: "Viewer Portal",
  };
  const portalSubtitleByRole = {
    Admin: "Full administration access",
    Finance: "Finance operations and reporting",
    Staff: "Member management and reporting",
    Viewer: "Read-only access to view data",
  };
  const currentPortalTitle = portalTitleByRole[currentAdminRole] || "Admin Portal";
  const currentPortalSubtitle = portalSubtitleByRole[currentAdminRole] || "Administration";

  // Grouped navigation structure
  const navigationGroups = [
    {
      id: "members",
      label: "Members",
      icon: "fa-users",
      items: [
        { id: "members", label: "Members List", roles: ["Admin", "Finance", "Staff", "Viewer"] },
        { id: "member-detail", label: "Member Details", roles: ["Admin", "Finance", "Staff", "Viewer"] },
        { id: "invoice-builder", label: "Subscriptions", roles: ["Admin", "Finance"] },
      ]
    },
    {
      id: "finance",
      label: "Finance",
      icon: "fa-dollar-sign",
      items: [
        { id: "invoices", label: "Invoices", roles: ["Admin", "Finance"] },
        { id: "payments", label: "Payments", roles: ["Admin", "Finance"] },
        { id: "donations", label: "Donations", roles: ["Admin", "Finance"] },
      ]
    },
    {
      id: "communication",
      label: "Communication",
      icon: "fa-comments",
      items: [
        { id: "automation", label: "Reminders", roles: ["Admin", "Finance"] },
        { id: "communications", label: "Reminder Logs", roles: ["Admin", "Finance", "Staff", "Viewer"] },
      ]
    },
    {
      id: "reports",
      label: "Reports",
      icon: "fa-chart-bar",
      items: [
        { id: "reports", label: "Financial Reports", roles: ["Admin", "Finance", "Staff", "Viewer"] },
        { id: "export-reports", label: "Export Reports", roles: ["Admin", "Finance"] },
      ]
    },
    {
      id: "settings",
      label: "Settings",
      icon: "fa-cog",
      items: [
        { id: "settings", label: "Users", roles: ["Admin"] },
        { id: "roles", label: "Roles", roles: ["Admin"] },
        { id: "org-settings", label: "Organization Settings", roles: ["Admin", "Finance"] },
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
  const [toast, setToast] = useState(null);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState(null);
  const [showInvoiceSuccessCard, setShowInvoiceSuccessCard] = useState(false);
  
  // Confirmation dialog state
  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
    onCancel: null,
  });
  
  // Form states
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "Active",
    balance: "250", // default for Lifetime (numeric string)
    nextDue: "",
    lastPayment: "",
    subscriptionType: "Lifetime",
  });

  // Add Member validation state
  const [memberErrors, setMemberErrors] = useState({
    name: "",
    email: "",
    phone: "",
    nextDue: "",
    lastPayment: "",
  });

  const [isMemberSubmitting, setIsMemberSubmitting] = useState(false);

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
        if (value && value.length < 8) {
          error = "Phone number must be at least 8 digits.";
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

  const validateMemberForm = () => {
    const newErrors = {
      name: validateMemberField("name", memberForm.name),
      email: validateMemberField("email", memberForm.email),
      phone: validateMemberField("phone", memberForm.phone),
      nextDue: validateMemberField("nextDue", memberForm.nextDue),
      lastPayment: validateMemberField("lastPayment", memberForm.lastPayment),
    };

    setMemberErrors(newErrors);

    const hasError = Object.values(newErrors).some(Boolean);
    return !hasError;
  };

  const handleMemberFieldChange = (field, rawValue) => {
    let value = rawValue;

    if (field === "phone") {
      value = rawValue.replace(/\D/g, "");
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
    setMemberErrors(prev => ({
      ...prev,
      [field]: error,
    }));
  };

  const isMemberFormValid =
    !Object.values(memberErrors).some(Boolean) &&
    memberForm.name.trim() &&
    memberForm.email.trim();

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
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "", role: "Viewer", status: "Active" });
  
  // Email template state
  const [emailTemplate, setEmailTemplate] = useState({
    subject: "Payment Reminder - Outstanding Balance",
    htmlTemplate: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a; border-bottom: 2px solid #5a31ea; padding-bottom: 10px;">
    Payment Reminder - Outstanding Balance
  </h2>
  <p>Dear {{member_name}},</p>
  <p>This is a friendly reminder about your outstanding subscription payments.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Member ID:</strong> {{member_id}}</p>
    <p><strong>Email:</strong> {{member_email}}</p>
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">\${{total_due}}</span></p>
  </div>
  <h3 style="color: #333;">Outstanding Invoices ({{invoice_count}}):</h3>
  <ul style="list-style: none; padding: 0;">
    {{invoice_list}}
  </ul>
  <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>💳 Payment Methods Available:</strong></p>
    <ul>
      {{payment_methods}}
    </ul>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{portal_link}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
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
  const [dateRange, setDateRange] = useState({
    from: "2025-01-01",
    to: "2025-12-31",
  });
  const [uploadingQR, setUploadingQR] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState("This Year");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState({
    paymentMethod: "", // "Admin" or "Online" - empty by default
    imageFile: null,
    imagePreview: null,
    imageUrl: "",
    reference: "", // Reference number for online payments
  });
  const [uploadingPaymentModal, setUploadingPaymentModal] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const chartContainerRef = useRef(null);
  const [sendingEmails, setSendingEmails] = useState({}); // Track which member is sending
  const [sendingToAll, setSendingToAll] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState({}); // Track which member is sending WhatsApp
  const [sendingWhatsAppToAll, setSendingWhatsAppToAll] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showChannelSelection, setShowChannelSelection] = useState(false);
  const [pendingReminderAction, setPendingReminderAction] = useState(null); // { type: 'single'|'bulk', memberData?: member }
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All"); // All, Pending, Completed, Rejected
  const [reportFilter, setReportFilter] = useState("all"); // all, payments, donations
  const [donorTypeFilter, setDonorTypeFilter] = useState("all"); // all, member, non-member
  const [memberSearchTerm, setMemberSearchTerm] = useState(""); // Search filter for members
  const [memberStatusFilter, setMemberStatusFilter] = useState("All"); // Status filter for members
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu toggle
  
  // Payment form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
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
  const [donationsPage, setDonationsPage] = useState(1);
  const [donationsPageSize, setDonationsPageSize] = useState(10);
  const [remindersPage, setRemindersPage] = useState(1);
  const [remindersPageSize, setRemindersPageSize] = useState(10);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState(10);
  const [remindersStatusFilter, setRemindersStatusFilter] = useState("All"); // All, Delivered, Failed
  const [remindersChannelFilter, setRemindersChannelFilter] = useState("All"); // All, Email, WhatsApp

  const navigate = useNavigate();
  
  // Auto-logout on inactivity (15 minutes)
  useAutoLogout(15);

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
    }
  }, [activeSection, fetchReminderLogs]);

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
      
      // Filter payments for this month (only completed/paid)
      const monthPayments = paymentHistory.filter((payment) => {
        // Only count completed or paid payments
        const isCompleted = payment.status === "Completed" || payment.status === "Paid";
        if (!isCompleted) return false;
        if (!payment.date) return false;
        const paymentDate = new Date(payment.date);
        return paymentDate.getMonth() === date.getMonth() && 
               paymentDate.getFullYear() === date.getFullYear();
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
        count: monthPayments.length
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
    const allPayments = paymentHistory || [];
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
    
    // Calculate Overdue Members - members with overdue invoices
    const overdueInvoices = invoices.filter(inv => {
      const isMemberInvoice = 
        (inv.memberId && memberIds.has(inv.memberId)) ||
        (inv.memberEmail && memberEmails.has(inv.memberEmail?.toLowerCase())) ||
        (inv.memberName && memberNames.has(inv.memberName?.toLowerCase()));
      
      return isMemberInvoice && inv.status === "Overdue";
    });
    const overdueMemberIds = new Set(overdueInvoices.map(inv => inv.memberId).filter(Boolean));
    const overdueMembersCount = overdueMemberIds.size;
    
    // Calculate expected annual (all members * expected per member)
    // Assuming $800 per member per year as mentioned in the UI
    const expectedAnnual = members.length * 800;
    
    return {
      totalCollected: totalCollectedAllTime,
      collectedMonth: collectedThisMonth,
      collectedYear: collectedThisYear,
      outstanding: totalOutstanding,
      overdueMembers: overdueMembersCount,
      expectedAnnual: expectedAnnual
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
    
    // For online payment methods (Screenshot, Bank Transfer, FPS, PayMe, Alipay, Credit Card, etc.)
    // Show as "Online Payment"
    const onlineMethods = ["Screenshot", "Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card", "Online Payment"];
    if (onlineMethods.includes(payment.method)) {
      return "Online Payment";
    }
    
    // Return method as-is if it doesn't match above
    return payment.method || "N/A";
  };

  const getRecentPayments = () => {
    return paymentHistory
      .filter(payment => payment.status === "Paid" || payment.status === "Completed" || payment.status === "Pending Verification" || payment.status === "Pending")
      .sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
      })
      .slice(0, 5)
      .map(payment => ({
        Member: payment.member || "Unknown",
        Period: payment.period || "N/A",
        Amount: payment.amount || "$0",
        Method: getPaymentMethodDisplay(payment),
        Status: payment.status || "Pending",
        Date: payment.date || (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "N/A"),
      }));
  };

  const monthlyCollectionsData = calculateMonthlyCollections();
  const recentPaymentsData = getRecentPayments();
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
    const paymentsInRange = paymentHistory.filter(payment => {
      if (!payment.date) return false;
      const paymentDate = new Date(payment.date);
      // Only count completed/paid payments in financial reports
      const isCompleted = payment.status === "Completed" || payment.status === "Paid";
      return paymentDate >= fromDate && paymentDate <= toDate && isCompleted;
    });

    // Filter donations within date range
    const donationsInRange = (Array.isArray(donations) ? donations : []).filter(donation => {
      if (!donation || (!donation.date && !donation.createdAt)) return false;
      try {
        const donationDate = donation.createdAt ? new Date(donation.createdAt) : new Date(donation.date);
        return donationDate >= fromDate && donationDate <= toDate;
      } catch (e) {
        return false;
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
      // Get payments in date range for detailed export
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      
      const paymentsInRange = paymentHistory.filter(payment => {
        if (!payment.date) return false;
        const paymentDate = new Date(payment.date);
        return paymentDate >= fromDate && paymentDate <= toDate;
      });

      // Create CSV content
      let csvContent = "Financial Report\n";
      csvContent += `Period,${dateRange.from} to ${dateRange.to}\n\n`;
      csvContent += "Summary\n";
      csvContent += `Collected,$${reportStats.collected.toFixed(2)}\n`;
      csvContent += `Expected,$${reportStats.expected.toFixed(2)}\n`;
      csvContent += `Outstanding,$${dashboardMetrics.outstanding.toFixed(2)}\n`;
      csvContent += `Average per Member,$${reportStats.averagePerMember.toFixed(2)}\n`;
      csvContent += `Total Transactions,${reportStats.transactionCount}\n\n`;
      
      // Payment method breakdown
      csvContent += "Payment Method Breakdown\n";
      reportStats.methodMix.forEach(item => {
        csvContent += `${item.label},${item.value}\n`;
      });
      
      // Detailed transactions (only completed/paid)
      csvContent += "\nDetailed Transactions (Completed Payments Only)\n";
      csvContent += "Date,Member,Period,Amount,Method,Status,Reference\n";
      paymentsInRange
        .filter(payment => payment.status === "Completed" || payment.status === "Paid")
        .forEach(payment => {
          const date = payment.date || "N/A";
          const member = payment.member || "Unknown";
          const period = payment.period || "N/A";
          const amount = payment.amount || "$0";
          const method = getPaymentMethodDisplay(payment);
          const status = payment.status || "N/A";
          const reference = payment.reference || "N/A";
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
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
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
      doc.text(`Collected: $${reportStats.collected.toFixed(2)}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Expected: $${reportStats.expected.toFixed(2)}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Outstanding: $${dashboardMetrics.outstanding.toFixed(2)}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Average per Member: $${reportStats.averagePerMember.toFixed(2)}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Total Transactions: ${reportStats.transactionCount}`, margin, yPos);
      yPos += 10;

      // Payment method breakdown
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Payment Method Breakdown', margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      reportStats.methodMix.forEach(item => {
        doc.text(`${item.label}: ${item.value}`, margin, yPos);
        yPos += lineHeight;
      });

      // Check if we need a new page for transactions
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      
      const paymentsInRange = paymentHistory.filter(payment => {
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
        // Add transactions (limit to fit on page, only completed/paid)
        const completedPayments = paymentsInRange.filter(p => p.status === "Completed" || p.status === "Paid");
        const maxTransactions = Math.min(completedPayments.length, Math.floor((pageHeight - yPos - 20) / lineHeight));
        completedPayments.slice(0, maxTransactions).forEach(payment => {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(payment.date || "N/A", margin, yPos);
          doc.text((payment.member || "Unknown").substring(0, 15), margin + 40, yPos);
          doc.text(payment.amount || "$0", margin + 90, yPos);
          doc.text(getPaymentMethodDisplay(payment).substring(0, 15), margin + 130, yPos);
          yPos += lineHeight;
        });
        
        if (completedPayments.length > maxTransactions) {
          doc.text(`... and ${completedPayments.length - maxTransactions} more transactions`, margin, yPos);
        }
      }

      // Footer
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
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Member ID:</strong> {{member_id}}</p>
    <p><strong>Email:</strong> {{member_email}}</p>
    <p><strong>Total Outstanding:</strong> <span style="color: #d32f2f; font-size: 18px; font-weight: bold;">\${{total_due}}</span></p>
  </div>
  <h3 style="color: #333;">Outstanding Invoices ({{invoice_count}}):</h3>
  <ul style="list-style: none; padding: 0;">
    {{invoice_list}}
  </ul>
  <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>💳 Payment Methods Available:</strong></p>
    <ul>
      {{payment_methods}}
    </ul>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{portal_link}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
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
      .replace(/\{\{total_due\}\}/g, "$250.00")
      .replace(/\{\{invoice_count\}\}/g, "3")
      .replace(/\{\{invoice_list\}\}/g, `
        <li style="margin-bottom: 10px;">
          <strong>January 2025</strong>: $100.00 
          <span style="color: #666;">(Due: 15 Jan 2025)</span> - 
          <strong style="color: #d32f2f">Overdue</strong>
        </li>
        <li style="margin-bottom: 10px;">
          <strong>February 2025</strong>: $100.00 
          <span style="color: #666;">(Due: 15 Feb 2025)</span> - 
          <strong style="color: #f57c00">Unpaid</strong>
        </li>
        <li style="margin-bottom: 10px;">
          <strong>March 2025</strong>: $50.00 
          <span style="color: #666;">(Due: 15 Mar 2025)</span> - 
          <strong style="color: #f57c00">Unpaid</strong>
        </li>
      `)
      .replace(/\{\{payment_methods\}\}/g, `
        <li>FPS: ID 1234567</li>
        <li>PayMe: Scan QR code in portal</li>
        <li>Bank Transfer: HSBC 123-456789-001</li>
        <li>Credit Card: Pay instantly online</li>
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
        const balanceText = newBalance > 0 ? `$${newBalance.toFixed(2)} Outstanding` : "$0";
        
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

  // Payment CRUD handlers
  const handleAddPayment = async (e) => {
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
      showToast("Only Admin and Owner can send bulk reminders", "error");
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
      showToast("Only Admin and Owner can send bulk reminders", "error");
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
          return sum + parseFloat(inv.amount.replace("$", ""));
        }, 0);

        // Create invoice list for WhatsApp
        const invoiceList = memberUnpaidInvoices
          .map(
            (inv, index) =>
              `${index + 1}. *${inv.period}*: ${inv.amount} (Due: ${inv.due}) - _${inv.status}_`
          )
          .join("\n");

        // Create WhatsApp message
        const message = `السلام عليكم ورحمة الله وبركاته

Dear *${member.name}*,

This is a friendly reminder about your outstanding subscription payments.

*Member ID:* ${member.id}
*Email:* ${member.email}
*Total Outstanding:* $${totalDue}

*📋 Outstanding Invoices (${memberUnpaidInvoices.length}):*
${invoiceList}

*💳 Payment Methods Available:*
• FPS: ID 1234567
• PayMe: Scan QR code in portal
• Bank Transfer: HSBC 123-456789-001
• Credit Card: Pay instantly online

*🔗 Member Portal:*
${window.location.origin}/member

Please settle your outstanding balance at your earliest convenience.

جزاك الله خيرا

_Best regards,_
*Finance Team*
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
    }
  }, [activeSection]);

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
    
    // Find the section in navigation groups
    for (const group of navigationGroups) {
      const item = group.items.find(item => item.id === sectionId);
      if (item) {
        return [
          { id: "dashboard", label: "Dashboard" },
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

  // Render breadcrumb component
  const renderBreadcrumb = (sectionId) => {
    const breadcrumbPath = getBreadcrumbPath(sectionId);
    if (breadcrumbPath.length === 1) {
      return null; // Don't show breadcrumb for dashboard
    }
    
    return (
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px", 
        marginBottom: "8px",
        fontSize: "0.875rem",
        color: "#6b7280"
      }}>
        {breadcrumbPath.map((item, index) => (
          <span key={item.id}>
            {index > 0 && <span style={{ margin: "0 4px" }}> &gt; </span>}
            {index === breadcrumbPath.length - 1 ? (
              <span style={{ color: "#111827", fontWeight: "500" }}>{item.label}</span>
            ) : (
              <span 
                onClick={() => handleNavClick(item.id)}
                style={{ 
                  cursor: "pointer",
                  color: "#5a31ea",
                  fontWeight: "500"
                }}
                onMouseEnter={(e) => e.target.style.textDecoration = "underline"}
                onMouseLeave={(e) => e.target.style.textDecoration = "none"}
              >
                {item.label}
              </span>
            )}
          </span>
        ))}
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
    navigate("/login", { replace: true });
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Show confirmation dialog
  const showConfirmation = (message, onConfirm, onCancel = null) => {
    setConfirmationDialog({
      isOpen: true,
      message,
      onConfirm: () => {
        setConfirmationDialog({ isOpen: false, message: "", onConfirm: null, onCancel: null });
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setConfirmationDialog({ isOpen: false, message: "", onConfirm: null, onCancel: null });
        if (onCancel) onCancel();
      },
    });
  };

  // Member CRUD Operations
  const handleAddMember = async (e) => {
    e.preventDefault();

    if (!validateMemberForm()) {
      showToast("Please fix the errors in the form.", "error");
      return;
    }

    try {
      setIsMemberSubmitting(true);

      await addMember(memberForm);
      setMemberForm({
        name: "",
        email: "",
        phone: "",
        status: "Active",
        balance: "250",
        nextDue: "",
        lastPayment: "",
        subscriptionType: "Lifetime",
      });
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
    setEditingMember(member);
    const subscriptionType = member.subscriptionType || "Lifetime";
    // Balance always matches subscription type amount (not the stored balance)
    const balance = subscriptionType === "Yearly + Janaza Fund" ? "500" : "250";
    setMemberForm({
      ...member,
      subscriptionType: subscriptionType,
      balance: balance,
    });
    setShowMemberForm(true);
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    try {
      // Only include password in update if it's provided
      const updateData = { ...memberForm };
      if (!updateData.password || updateData.password.trim() === "") {
        delete updateData.password; // Don't update password if empty
      }
      await updateMember(editingMember.id, updateData);
      setEditingMember(null);
      setMemberForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        status: "Active",
        balance: "$0",
        nextDue: "",
        lastPayment: "",
        subscriptionType: "Lifetime",
      });
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
    if (!invoiceForm.memberId || !invoiceForm.period || !invoiceForm.due) {
      showToast("Please fill all required fields", "error");
      return;
    }

    const amountNum = parseFloat(invoiceForm.amount);
    if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
      showToast("Amount must be a positive number", "error");
      return;
    }

    const member = members.find((m) => m.id === invoiceForm.memberId);
    const newInvoice = {
      id: generateInvoiceId(),
      memberId: invoiceForm.memberId,
      memberName: member?.name || "",
      period: invoiceForm.period,
      amount: `$${amountNum.toFixed(2)}`,
      status: "Unpaid",
      due: invoiceForm.due,
      method: "-",
      reference: "-",
      notes: invoiceForm.notes || "",
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

      // Step 2: Update invoice to Paid status (this will trigger balance recalculation on backend)
      await updateInvoice(invoiceId, {
        status: "Paid",
        method: paymentMethod,
        reference: reference,
        paidToAdmin: adminId,
        paidToAdminName: adminName,
      });

      // Step 3: Refresh all data to get updated balances
      await Promise.all([
        fetchInvoices(),
        fetchPayments(),
        fetchMembers(), // Refresh members to get updated balance
      ]);

      // Step 4: Get updated member data to verify balance was updated
      if (invoice.memberId) {
        const updatedMember = members.find(m => m.id === invoice.memberId);
        if (updatedMember) {
          showToast(`Invoice marked as paid (${paymentMethod})! Balance updated.`, "success");
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

    // Create WhatsApp message with proper formatting
    const message = `السلام عليكم ورحمة الله وبركاته

Dear *${memberData.name}*,

This is a friendly reminder about your outstanding subscription payments.

*Member ID:* ${memberData.id}
*Email:* ${memberData.email}
*Total Outstanding:* $${totalDue}

*📋 Outstanding Invoices (${memberUnpaidInvoices.length}):*
${invoiceList}

*💳 Payment Methods Available:*
• FPS: ID 1234567
• PayMe: Scan QR code in portal
• Bank Transfer: HSBC 123-456789-001
• Credit Card: Pay instantly online

*🔗 Member Portal:*
${window.location.origin}/member

Please settle your outstanding balance at your earliest convenience.

جزاك الله خيرا

_Best regards,_
*Finance Team*
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
    setPendingReminderAction({ 
      type: isBulk ? 'bulk' : (memberId ? 'manual' : 'single'), 
      memberData: memberData || null,
      memberId: memberId || null
    });
    setShowChannelSelection(true);
  };

  // Handle channel selection and send reminder
  const handleSendReminderWithChannel = async (channel) => {
    setShowChannelSelection(false);
    
    if (pendingReminderAction?.type === 'bulk') {
      // Show confirmation for bulk send
      showConfirmation(
        channel === 'Email' 
          ? 'Are you sure you want to send reminder emails to ALL outstanding members?'
          : `Are you sure you want to open WhatsApp for all outstanding members? This will open multiple WhatsApp windows.`,
        () => {
          if (channel === 'Email') {
            handleSendToAllOutstanding();
          } else if (channel === 'WhatsApp') {
            handleSendWhatsAppToAllOutstanding();
          }
        }
      );
    } else if (pendingReminderAction?.memberData) {
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
      return sum + parseFloat(inv.amount.replace("$", "").replace(",", "") || 0);
    }, 0);

    // Create invoice list for email
    const invoiceListText = memberUnpaidInvoices
      .map(
        (inv) =>
          `• ${inv.period}: ${inv.amount} (Due: ${inv.due}) - ${inv.status}`
      )
      .join("\n");

    const invoiceListHTML = memberUnpaidInvoices
      .map(
        (inv) =>
          `<li style="margin-bottom: 10px;">
            <strong>${inv.period}</strong>: ${inv.amount} 
            <span style="color: #666;">(Due: ${inv.due})</span> - 
            <strong style="color: ${inv.status === 'Overdue' ? '#d32f2f' : '#f57c00'}">${inv.status}</strong>
          </li>`
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
          totalDue: `$${totalDue.toFixed(2)}`,
          invoiceCount: memberUnpaidInvoices.length,
          invoiceListText: invoiceListText,
          invoiceListHTML: invoiceListHTML,
          paymentMethods: "FPS, PayMe, Bank Transfer, Alipay, or Credit Card",
          portalLink: `${window.location.origin}/member`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      console.log("✓ Email sent successfully:", data);

      // Log to communication with member metadata
      const comm = {
        channel: "Email",
        type: "Manual Outstanding Reminder",
        memberId: memberData.id,
        memberEmail: memberData.email,
        memberName: memberData.name,
        message: `Payment reminder: ${memberData.name} (${memberData.email}) - $${totalDue.toFixed(2)} due (${memberUnpaidInvoices.length} invoice${memberUnpaidInvoices.length > 1 ? "s" : ""})`,
        status: "Delivered",
      };
      addCommunication(comm);

      showToast(
        `✓ Reminder email sent to ${memberData.name} for $${totalDue.toFixed(2)} outstanding!`
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
        message: `Reminder attempt to ${memberData.name} - $${totalDue.toFixed(2)} due`,
        status: "Failed",
      };
      addCommunication(comm);

      showToast(
        error.message || "Failed to send email. Please check email configuration.",
        "error"
      );
    }
  };

  const handleViewMemberDetail = (member) => {
    setSelectedMember(member);
    setActiveSection("member-detail");
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

  // Show loading state
  if (loading) {
    return (
      <div className="server-loading">
        <div className="server-loading-spinner"></div>
        <p className="server-loading-text">Loading admin data...</p>
      </div>
    );
  }

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
            <div className="confirmation-dialog-actions">
              <button
                className="secondary-btn"
                onClick={confirmationDialog.onCancel || (() => setConfirmationDialog({ isOpen: false, message: "", onConfirm: null, onCancel: null }))}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                onClick={confirmationDialog.onConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {showTemplatePreview && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: "20px",
          }}
          onClick={() => setShowTemplatePreview(false)}
        >
          <div 
            className="card"
            style={{
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
                <i className="fas fa-eye" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                Email Template Preview
              </h3>
              <button
                type="button"
                onClick={() => setShowTemplatePreview(false)}
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
                  e.target.style.background = "#f0f0f0";
                  e.target.style.color = "#333";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.color = "#666";
                }}
              >
                ×
              </button>
            </div>
            <div 
              dangerouslySetInnerHTML={{ __html: getPreviewTemplate() }}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "24px",
                background: "#fff",
                minHeight: "200px"
              }}
            />
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
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
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: "20px",
          }}
          onClick={() => {
            setShowChannelSelection(false);
            setPendingReminderAction(null);
          }}
        >
          <div 
            className="card"
            style={{
              maxWidth: "500px",
              width: "100%",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
                <i className="fas fa-paper-plane" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                Select Channel
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowChannelSelection(false);
                  setPendingReminderAction(null);
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
                  e.target.style.background = "#f0f0f0";
                  e.target.style.color = "#333";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.color = "#666";
                }}
              >
                ×
              </button>
            </div>
            <p style={{ marginBottom: "24px", color: "#666" }}>
              {pendingReminderAction?.type === 'bulk' 
                ? "Select the channel to send reminders to all outstanding members:"
                : `Select the channel to send reminder to ${pendingReminderAction?.memberData?.name || 'member'}:`}
            </p>
            <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
              <button
                className="primary-btn"
                onClick={() => handleSendReminderWithChannel('Email')}
                style={{
                  padding: "16px 24px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px"
                }}
              >
                <i className="fas fa-envelope" style={{ fontSize: "1.25rem" }}></i>
                Email
              </button>
              <button
                className="primary-btn"
                onClick={() => handleSendReminderWithChannel('WhatsApp')}
                style={{
                  padding: "16px 24px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "1rem",
                  backgroundColor: "#25D366",
                  borderColor: "#25D366",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px"
                }}
              >
                <i className="fab fa-whatsapp" style={{ fontSize: "1.25rem" }}></i>
                WhatsApp
              </button>
            </div>
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowChannelSelection(false);
                  setPendingReminderAction(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 1000,
            background: toast.type === "success" ? "linear-gradient(135deg, #10b981 0%, #34d399 100%)" : "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
            color: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: toast.type === "success" ? "0 4px 12px rgba(16, 185, 129, 0.4)" : "0 4px 12px rgba(239, 68, 68, 0.4)",
            border: "none",
            animation: "slideIn 0.3s ease",
          }}
        >
          {toast.message}
        </div>
      )}

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
            <h3>{currentPortalSubtitle}</h3>
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
                  <i className="fas fa-chart-line" style={{ marginRight: "8px" }}></i>
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
                    <i className={`fas ${group.icon}`} style={{ marginRight: "8px", fontSize: "0.875rem", color: "#666" }}></i>
                    <span className="nav-group-label">{group.label}</span>
                    <i 
                      className={`fas fa-chevron-down nav-group-chevron ${expandedGroups[group.id] ? 'expanded' : ''}`}
                      style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#9ca3af", transition: "transform 0.2s ease" }}
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
                  <h3><i className="fas fa-chart-line" style={{ marginRight: "10px" }}></i>Dashboard</h3>
                  <p>Key KPIs, monthly collections, recent payments.</p>
                </header>
                <div className="card dashboard-card">
                  <div className="kpi-grid">
                    {/* Total Members */}
                    <button
                      type="button"
                      className="card kpi"
                      style={{ textAlign: "left", cursor: "pointer" }}
                      onClick={() => handleNavClick("members")}
                    >
                      <p>
                        <i className="fas fa-users" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                        Total Members
                      </p>
                      <h4>{members.length.toLocaleString("en-US")}</h4>
                      <small>Active members</small>
                    </button>

                    {/* Total Collected */}
                    <button
                      type="button"
                      className="card kpi"
                      style={{ textAlign: "left", cursor: "pointer" }}
                      onClick={() => handleNavClick("payments")}
                    >
                      <p>
                        <i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#10b981" }}></i>
                        Total Collected
                      </p>
                      <h4>
                        $
                        {dashboardMetrics.collectedMonth.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </h4>
                      <small>
                        $
                        {dashboardMetrics.collectedYear.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        YTD
                      </small>
                    </button>

                    {/* Outstanding */}
                    <button
                      type="button"
                      className="card kpi"
                      style={{ textAlign: "left", cursor: "pointer" }}
                      onClick={() => handleNavClick("members")}
                    >
                      <p>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: "8px", color: "#f59e0b" }}></i>
                        Total Outstanding
                      </p>
                      <h4 style={{ color: dashboardMetrics.outstanding > 0 ? "#f59e0b" : "#111827" }}>
                        $
                        {dashboardMetrics.outstanding.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </h4>
                      <small>
                        Expected $
                        {dashboardMetrics.expectedAnnual.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </small>
                    </button>

                    {/* Overdue Members */}
                    <button
                      type="button"
                      className="card kpi"
                      style={{ textAlign: "left", cursor: "pointer" }}
                      onClick={() => handleNavClick("members")}
                    >
                      <p>
                        <i className="fas fa-exclamation-circle" style={{ marginRight: "8px", color: dashboardMetrics.overdueMembers > 0 ? "#f59e0b" : "#6b7280" }}></i>
                        Overdue Members
                      </p>
                      <h4 style={{ color: dashboardMetrics.overdueMembers > 0 ? "#f59e0b" : "#111827" }}>
                        {dashboardMetrics.overdueMembers.toLocaleString("en-US")}
                      </h4>
                      <small>Requires attention</small>
                    </button>
                  </div>

                  {/* Last updated timestamp */}
                  <div style={{ marginTop: "12px", fontSize: "0.75rem", color: "#6b7280" }}>
                    Last updated: {dashboardLastUpdated}
                  </div>

                  <div className="card chart-card">
                    <div className="card-header">
                      <div>
                        <h4><i className="fas fa-chart-bar" style={{ marginRight: "8px" }}></i>Monthly Collections · Last 12 Months</h4>
                        <p>Expected contribution is $800 per member per year</p>
                      </div>
                    </div>
                    <div 
                      ref={chartContainerRef}
                      className="chart" 
                      style={{ position: "relative", overflow: "visible" }}
                      onMouseMove={(e) => {
                        if (hoveredMonth && chartContainerRef.current) {
                          const rect = chartContainerRef.current.getBoundingClientRect();
                          setMousePosition({ 
                            x: e.clientX - rect.left, 
                            y: e.clientY - rect.top 
                          });
                        }
                      }}
                    >
                      {monthlyCollectionsData.map((item) => (
                        <div
                          key={item.monthKey}
                          style={{ 
                            height: `${item.percentage}%`,
                            position: "relative",
                            cursor: "pointer"
                          }}
                          data-month={item.month}
                          onMouseEnter={(e) => {
                            setHoveredMonth(item);
                            if (chartContainerRef.current) {
                              const rect = chartContainerRef.current.getBoundingClientRect();
                              setMousePosition({ 
                                x: e.clientX - rect.left, 
                                y: e.clientY - rect.top 
                              });
                            }
                          }}
                          onMouseMove={(e) => {
                            if (hoveredMonth?.monthKey === item.monthKey && chartContainerRef.current) {
                              const rect = chartContainerRef.current.getBoundingClientRect();
                              setMousePosition({ 
                                x: e.clientX - rect.left, 
                                y: e.clientY - rect.top 
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                        </div>
                      ))}
                      {hoveredMonth && chartContainerRef.current && (() => {
                        // Calculate tooltip position with overflow prevention
                        const tooltipWidth = 220; // Approximate tooltip width
                        const tooltipHeight = 40;
                        const chartRect = chartContainerRef.current.getBoundingClientRect();
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;
                        
                        let left = mousePosition.x + 10;
                        let top = mousePosition.y - 50;
                        
                        // Prevent horizontal overflow - check right edge
                        const tooltipRightEdge = chartRect.left + left + tooltipWidth;
                        if (tooltipRightEdge > viewportWidth - 10) {
                          // Position tooltip to the left of cursor
                          left = mousePosition.x - tooltipWidth - 10;
                        }
                        // Prevent left overflow
                        if (chartRect.left + left < 10) {
                          left = 10;
                        }
                        
                        // Prevent vertical overflow - check top edge
                        if (chartRect.top + top < 10) {
                          top = 10 - chartRect.top;
                        }
                        // Prevent bottom overflow
                        const tooltipBottomEdge = chartRect.top + top + tooltipHeight;
                        if (tooltipBottomEdge > viewportHeight - 10) {
                          top = mousePosition.y - tooltipHeight - 10;
                          // Ensure it doesn't go above viewport
                          if (chartRect.top + top < 10) {
                            top = 10 - chartRect.top;
                          }
                        }
                        
                        return (
                          <div style={{
                            position: "absolute",
                            left: `${left}px`,
                            top: `${top}px`,
                            padding: "8px 12px",
                            background: "#000",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "0.875rem",
                            whiteSpace: "nowrap",
                            zIndex: 1000,
                            pointerEvents: "none",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            maxWidth: "250px"
                          }}>
                            {hoveredMonth.month} {new Date().getFullYear()}: ${hoveredMonth.value.toFixed(2)}
                            {hoveredMonth.count > 0 && ` (${hoveredMonth.count} payment${hoveredMonth.count > 1 ? 's' : ''})`}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="card table-card">
                    <div className="card-header">
                      <h4><i className="fas fa-clock" style={{ marginRight: "8px" }}></i>Recent Payments</h4>
                      <button className="text-btn" onClick={() => handleNavClick("members")}>
                        View all
                      </button>
                    </div>
                    <Table
                      columns={["Member", "Period", "Amount", "Method", "Status", "Date"]}
                      rows={recentPaymentsData.length > 0 ? recentPaymentsData : [
                        {
                          Member: "No payments yet",
                          Period: "-",
                          Amount: "-",
                          Method: "-",
                          Status: "-",
                          Date: "-",
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      {renderBreadcrumb("members")}
                      <h3>Members List</h3>
                      <p>Manage all members and their subscriptions.</p>
                    </div>
                    {(members || []).filter(m => m.status === 'Pending').length > 0 && (
                      <div style={{
                        padding: "10px 16px",
                        background: "#fff3cd",
                        borderRadius: "8px",
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        color: "#856404",
                        border: "1px solid #ffc107"
                      }}>
                        ⏳ Pending Approval: {(members || []).filter(m => m.status === 'Pending').length}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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
                        className="primary-btn"
                        onClick={() => {
                          setShowMemberForm(true);
                          setEditingMember(null);
                          // Reset form with balance matching default subscription type
                          setMemberForm({
                            name: "",
                            email: "",
                            phone: "",
                            status: "Active",
                            balance: "250", // default based on Lifetime subscription
                            nextDue: "",
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
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(0, 0, 0, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10000,
                      padding: "20px",
                    }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setShowMemberForm(false);
                        setEditingMember(null);
                      }
                    }}
                  >
                    <div
                      className="card"
                      style={{
                        maxWidth: "720px",
                        width: "100%",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        background: "#f9fafb",
                        position: "relative",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "16px",
                        }}
                      >
                        <h4
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            margin: 0,
                          }}
                        >
                          <i className="fas fa-user-plus" aria-hidden="true"></i>
                          {editingMember ? "Edit Member" : "Add New Member"}
                        </h4>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setShowMemberForm(false);
                            setEditingMember(null);
                          }}
                          style={{ fontSize: "1.2rem", lineHeight: 1 }}
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
                      <label className={memberErrors.name ? "field-error--wrapper" : ""}>
                        <span>
                          <i className="fas fa-user" aria-hidden="true" style={{ marginRight: 6 }}></i>
                        Name *
                        </span>
                        <input
                          type="text"
                          required
                          value={memberForm.name}
                          onChange={(e) => handleMemberFieldChange("name", e.target.value)}
                          aria-invalid={!!memberErrors.name}
                          aria-describedby={memberErrors.name ? "member-name-error" : undefined}
                        />
                        {memberErrors.name && (
                          <div id="member-name-error" className="field-error">
                            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                            <span>{memberErrors.name}</span>
                          </div>
                        )}
                      </label>

                      <label className={memberErrors.email ? "field-error--wrapper" : ""}>
                        <span>
                          <i className="fas fa-envelope" aria-hidden="true" style={{ marginRight: 6 }}></i>
                        Email *
                        </span>
                        <input
                          type="email"
                          required
                          value={memberForm.email}
                          onChange={(e) => handleMemberFieldChange("email", e.target.value)}
                          aria-invalid={!!memberErrors.email}
                          aria-describedby={memberErrors.email ? "member-email-error" : undefined}
                        />
                        {memberErrors.email && (
                          <div id="member-email-error" className="field-error">
                            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                            <span>{memberErrors.email}</span>
                          </div>
                        )}
                      </label>

                      <label className={memberErrors.phone ? "field-error--wrapper" : ""}>
                        <span>
                          <i className="fas fa-phone" aria-hidden="true" style={{ marginRight: 6 }}></i>
                          WhatsApp Number
                        </span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={memberForm.phone}
                          onChange={(e) => handleMemberFieldChange("phone", e.target.value)}
                          aria-invalid={!!memberErrors.phone}
                          aria-describedby={memberErrors.phone ? "member-phone-error" : undefined}
                        />
                        {memberErrors.phone && (
                          <div id="member-phone-error" className="field-error">
                            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                            <span>{memberErrors.phone}</span>
                        </div>
                        )}
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
                        </select>
                      </label>

                      <label>
                        <span>
                          <i className="fas fa-id-card" aria-hidden="true" style={{ marginRight: 6 }}></i>
                        Subscription Type
                        </span>
                        <select
                          value={memberForm.subscriptionType || "Lifetime"}
                          onChange={(e) => handleMemberFieldChange("subscriptionType", e.target.value)}
                        >
                          <option value="Lifetime">Lifetime - $250/year</option>
                          <option value="Yearly + Janaza Fund">Yearly + Janaza Fund - $500/year</option>
                        </select>
                      </label>

                      <label>
                        <span>
                          <i className="fas fa-wallet" aria-hidden="true" style={{ marginRight: 6 }}></i>
                          Balance
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={memberForm.balance}
                          readOnly
                          style={{
                            background: "#f5f5f5",
                            cursor: "not-allowed",
                            color: "#666"
                          }}
                          title="Balance is automatically set based on subscription type"
                        />
                      </label>

                      <label className={memberErrors.nextDue ? "field-error--wrapper" : ""}>
                        <span>
                          <i className="fas fa-calendar-day" aria-hidden="true" style={{ marginRight: 6 }}></i>
                          Start Date *
                        </span>
                        <input
                          type="date"
                          value={memberForm.nextDue}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            if (selectedDate) {
                              const year = new Date(selectedDate).getFullYear();
                              // Validate year range: 1900 to 2100
                              if (year < 1900 || year > 2100) {
                                showToast("Please select a valid date between 1900 and 2100", "error");
                                return;
                              }
                            }
                            handleMemberFieldChange("nextDue", selectedDate);
                          }}
                          min="1900-01-01"
                          max="2100-12-31"
                          onKeyDown={(e) => e.preventDefault()}
                          onPaste={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.currentTarget.focus();
                            if (e.currentTarget.showPicker) {
                              e.currentTarget.showPicker();
                            }
                          }}
                          aria-invalid={!!memberErrors.nextDue}
                          aria-describedby={memberErrors.nextDue ? "member-nextDue-error" : undefined}
                        />
                        {memberErrors.nextDue && (
                          <div id="member-nextDue-error" className="field-error">
                            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                            <span>{memberErrors.nextDue}</span>
                          </div>
                        )}
                      </label>

                      <label className={memberErrors.lastPayment ? "field-error--wrapper" : ""}>
                        <span>
                          <i className="fas fa-receipt" aria-hidden="true" style={{ marginRight: 6 }}></i>
                          End Date (optional)
                        </span>
                        <input
                          type="date"
                          value={memberForm.lastPayment}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            if (selectedDate) {
                              const year = new Date(selectedDate).getFullYear();
                              // Validate year range: 1900 to 2100
                              if (year < 1900 || year > 2100) {
                                showToast("Please select a valid date between 1900 and 2100", "error");
                                return;
                              }
                            }
                            handleMemberFieldChange("lastPayment", selectedDate);
                          }}
                          min="1900-01-01"
                          max="2100-12-31"
                          onKeyDown={(e) => e.preventDefault()}
                          onPaste={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.currentTarget.focus();
                            if (e.currentTarget.showPicker) {
                              e.currentTarget.showPicker();
                            }
                          }}
                          aria-invalid={!!memberErrors.lastPayment}
                          aria-describedby={memberErrors.lastPayment ? "member-lastPayment-error" : undefined}
                        />
                        {memberErrors.lastPayment && (
                          <div id="member-lastPayment-error" className="field-error">
                            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                            <span>{memberErrors.lastPayment}</span>
                          </div>
                        )}
                      </label>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setShowMemberForm(false);
                            setEditingMember(null);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="primary-btn"
                          disabled={!isMemberFormValid || isMemberSubmitting}
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
                )}

                {/* Pending Members Section */}
                {members.filter(m => m.status === 'Pending').length > 0 && (
                  <div style={{
                    background: "#fff3cd",
                    border: "2px solid #ffc107",
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
                      <h4 style={{ margin: 0, color: "#856404", display: "flex", alignItems: "center", gap: "8px" }}>
                        ⏳ Pending Approval ({members.filter(m => m.status === 'Pending').length})
                      </h4>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {members
                        .filter(m => m.status === 'Pending')
                        .map(member => (
                          <div
                            key={member.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "16px",
                              background: "#fff",
                              borderRadius: "8px",
                              border: "1px solid #ffc107",
                              flexWrap: "wrap",
                              gap: "12px"
                            }}
                          >
                            <div style={{ flex: "1 1 300px" }}>
                              <div style={{ fontWeight: "600", marginBottom: "4px", fontSize: "1rem" }}>
                                {member.name}
                              </div>
                              <div style={{ fontSize: "0.875rem", color: "#666", marginBottom: "4px" }}>
                                {member.email}
                              </div>
                              <div style={{ fontSize: "0.875rem", color: "#666", marginBottom: "4px" }}>
                                📱 {member.phone || "No phone"}
                              </div>
                              <div style={{ fontSize: "0.8125rem", color: "#856404", marginTop: "8px" }}>
                                📅 Subscription: {member.subscriptionType || 'Lifetime'}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                              <button
                                className="primary-btn"
                                onClick={() => handleApproveMember(member.id)}
                                style={{
                                  padding: "10px 20px",
                                  borderRadius: "8px",
                                  fontWeight: "600",
                                  fontSize: "0.875rem"
                                }}
                              >
                                ✓ Approve
                              </button>
                              <button
                                className="ghost-btn"
                                onClick={() => handleViewMemberDetail(member)}
                                style={{
                                  padding: "10px 20px",
                                  borderRadius: "8px",
                                  fontWeight: "600",
                                  fontSize: "0.875rem"
                                }}
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Search Filter */}
                <div className="card" style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 300px", minWidth: "250px" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#666" }}>🔍 Search Members:</span>
                      <input
                        type="text"
                        placeholder="Search by member name..."
                        value={memberSearchTerm}
                        onChange={(e) => setMemberSearchTerm(e.target.value)}
                        style={{
                          flex: "1",
                          padding: "10px 16px",
                          border: "1px solid #e0e0e0",
                          borderRadius: "8px",
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
                          background: "#f5f5f5",
                          border: "1px solid #e0e0e0",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                          color: "#666"
                        }}
                      >
                        Clear
                      </button>
                    )}
                    <div style={{ fontSize: "0.875rem", color: "#666" }}>
                      {(() => {
                        const filtered = members.filter(m => 
                          !memberSearchTerm || 
                          m.name?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                        );
                        return `${filtered.length} of ${members.length} members`;
                      })()}
                    </div>
                  </div>
                </div>

                  <div className="card">
                    <div className="table-wrapper">
                      {(() => {
                        // Filter members based on search term and status (using derived status)
                        const filteredMembers = members
                          .filter((member) =>
                            !memberSearchTerm ||
                            member.name?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                          )
                          .filter((member) => {
                            if (memberStatusFilter === "All") return true;

                            const balanceStr = member.balance?.toString() || "";
                            const numericOutstanding = parseFloat(
                              balanceStr.replace(/[^0-9.]/g, "") || 0
                            ) || 0;

                            const derivedStatus =
                              member.status === "Inactive"
                                ? "Inactive"
                                : member.status === "Pending"
                                ? "Pending"
                                : balanceStr.toLowerCase().includes("overdue") || numericOutstanding > 0
                                ? "Overdue"
                                : "Active";

                            return derivedStatus === memberStatusFilter;
                          });

                        // Sort by outstanding amount if requested
                        const sortedMembers = [...filteredMembers].sort((a, b) => {
                          if (memberSortByOutstanding === "none") return 0;

                          const parseOutstanding = (balance) => {
                            if (!balance) return 0;
                            const str = balance.toString();
                            const num = parseFloat(str.replace(/[^0-9.]/g, "") || 0);
                            return isNaN(num) ? 0 : num;
                          };

                          const aVal = parseOutstanding(a.balance);
                          const bVal = parseOutstanding(b.balance);

                          if (memberSortByOutstanding === "asc") return aVal - bVal;
                          if (memberSortByOutstanding === "desc") return bVal - aVal;
                          return 0;
                        });
                        
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
                            <div style={{ marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                              <label style={{ fontSize: "0.875rem", color: "#666" }}>
                                Status:&nbsp;
                                <select
                                  value={memberStatusFilter}
                                  onChange={(e) => setMemberStatusFilter(e.target.value)}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #e5e7eb",
                                    background: "#ffffff",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  <option value="All">All</option>
                                  <option value="Active">Active</option>
                                  <option value="Overdue">Overdue</option>
                                  <option value="Inactive">Inactive</option>
                                  <option value="Pending">Pending</option>
                                </select>
                              </label>
                              <label style={{ fontSize: "0.875rem", color: "#666" }}>
                                Sort by Outstanding:&nbsp;
                                <select
                                  value={memberSortByOutstanding}
                                  onChange={(e) => setMemberSortByOutstanding(e.target.value)}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #e5e7eb",
                                    background: "#ffffff",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  <option value="none">None</option>
                                  <option value="asc">Lowest first</option>
                                  <option value="desc">Highest first</option>
                                </select>
                              </label>
                            </div>

                            <Table
                              columns={[
                                "Member Name",
                                "Status",
                                "Outstanding",
                                "Actions",
                              ]}
                              rows={paginatedMembers.map((member) => {
                                // Derive outstanding numeric amount
                                const balanceStr = member.balance?.toString() || "";
                                const numericOutstanding = parseFloat(balanceStr.replace(/[^0-9.]/g, "") || 0) || 0;

                                // Derive status: Active / Overdue / Inactive / Pending
                                const derivedStatus =
                                  member.status === "Inactive"
                                    ? "Inactive"
                                    : member.status === "Pending"
                                    ? "Pending"
                                    : balanceStr.toLowerCase().includes("overdue") || numericOutstanding > 0
                                    ? "Overdue"
                                    : "Active";

                                const statusBadgeClass =
                                  derivedStatus === "Active"
                                    ? "badge badge-active"
                                    : derivedStatus === "Overdue"
                                    ? "badge badge-overdue"
                                    : derivedStatus === "Inactive"
                                    ? "badge badge-inactive"
                                    : "badge badge-pending";

                                return {
                                  "Member Name": member.name,
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
                                                  : "#f59e0b"
                                                : "#111827",
                                            fontWeight: numericOutstanding > 0 ? 600 : 500,
                                          }}
                                        >
                                          $
                                          {numericOutstanding.toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </div>
                                    ),
                                  },
                                  Actions: {
                                    render: () => (
                                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        <button
                                          className="ghost-btn icon-btn icon-btn--view"
                                          onClick={() => handleViewMemberDetail(member)}
                                          title="View member"
                                          aria-label="View member"
                                        >
                                          <i className="fas fa-eye" aria-hidden="true"></i>
                                        </button>
                                        <button
                                          className="secondary-btn icon-btn icon-btn--edit"
                                          onClick={() => handleEditMember(member)}
                                          title="Edit member"
                                          aria-label="Edit member"
                                        >
                                          <i className="fas fa-pen" aria-hidden="true"></i>
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
                                            title="Delete member"
                                            aria-label="Delete member"
                                          >
                                            <i className="fas fa-trash" aria-hidden="true"></i>
                                          </button>
                                        )}
                                      </div>
                                    ),
                                  },
                                };
                              })}
                            />
                            {totalPages > 0 && sortedMembers.length > 0 && (
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
                        );
                      })()}
                    </div>
                  </div>
              </article>
            )}

            {/* MEMBER DETAIL */}
            {activeSection === "member-detail" && selectedMember && (
              <article className="screen-card" id="member-detail">
                <header className="screen-card__header">
                  <div>
                    {renderBreadcrumb("member-detail")}
                    <h3>Member Detail</h3>
                    <p>360º view with invoices, payment history, communications.</p>
                  </div>
                </header>
                <div className="card member-detail">
                  <div className="member-header">
                    <div>
                      <span className="avatar">
                        {selectedMember.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <div>
                        <h4>{selectedMember.name}</h4>
                        <p>
                          Member ID {selectedMember.id} · {selectedMember.email} · WhatsApp{" "}
                          {selectedMember.phone}
                        </p>
                      </div>
                    </div>
                    <div className="header-actions">
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
                            className="primary-btn"
                            onClick={() => handleRequestReminder(selectedMember, false)}
                            title="Send reminder"
                          >
                            📨 Send Reminder
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="summary-grid">
                    <div className="summary-card">
                      <p>Outstanding Balance</p>
                      <h4>
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
                          return `$${outstandingTotal.toFixed(2)}`;
                        })()}
                      </h4>
                    </div>
                    <div className="summary-card">
                      <p>Next Due Date</p>
                      <h4>{selectedMember.nextDue}</h4>
                    </div>
                    <div className="summary-card">
                      <p>Last Payment</p>
                      <h4>{selectedMember.lastPayment}</h4>
                    </div>
                    <div className="summary-card">
                      <p>Status</p>
                      <h4>{selectedMember.status}</h4>
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
                          marginTop: "16px",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          background:
                            "linear-gradient(135deg, rgba(248, 113, 113, 0.1) 0%, rgba(239, 68, 68, 0.12) 100%)",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          color: "#b91c1c",
                          fontSize: "0.875rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
                        <span>
                          This member has{" "}
                          <strong>{overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}</strong>{" "}
                          totaling{" "}
                          <strong>
                            $
                            {outstandingTotal.toLocaleString("en-US", {
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
                    <button
                      className={`tab ${activeTab === "Activity" ? "active" : ""}`}
                      onClick={() => setActiveTab("Activity")}
                    >
                      Activity
                    </button>
                    <button
                      className={`tab ${activeTab === "Notes" ? "active" : ""}`}
                      onClick={() => setActiveTab("Notes")}
                    >
                      Notes
                    </button>
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
                                Total Outstanding: <strong style={{ color: "#1a1a1a" }}>${outstandingTotal.toFixed(2)}</strong>
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
                          "Period",
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
                          
                          return {
                          "Invoice #": invoice.id,
                          Period: invoice.period,
                          Amount: invoice.amount,
                          Status: {
                            render: () => (
                              <span className={statusClass[invoice.status]}>
                                {invoice.status}
                              </span>
                            ),
                          },
                          "Due Date": invoice.due,
                          Screenshot: invoice.screenshot ? {
                            render: () => (
                              <button
                                onClick={() => {
                                  const newWindow = window.open();
                                  if (newWindow) {
                                    newWindow.document.write(`
                                      <html>
                                        <head><title>Payment Screenshot - ${invoice.id}</title></head>
                                        <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                          <img src="${invoice.screenshot}" alt="Payment Screenshot" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                                        </body>
                                      </html>
                                    `);
                                  }
                                }}
                                style={{
                                  padding: "4px 10px",
                                  background: "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "0.85rem",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  boxShadow: "0 2px 4px rgba(90, 49, 234, 0.3)"
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.background = "linear-gradient(135deg, #4a28d0 0%, #6b3fff 100%)";
                                  e.target.style.boxShadow = "0 4px 8px rgba(90, 49, 234, 0.4)";
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.background = "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)";
                                  e.target.style.boxShadow = "0 2px 4px rgba(90, 49, 234, 0.3)";
                                }}
                              >
                                  <i className="fas fa-image" aria-hidden="true"></i>
                              </button>
                            )
                          } : "-",
                          Actions: {
                            render: () => (
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  {isUnpaid && !isViewer && (
                                    <button
                                      className="primary-btn"
                                      style={{ 
                                        padding: "4px 10px", 
                                        fontSize: "0.85rem",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px"
                                      }}
                                      onClick={() => {
                                        setPaymentModalInvoice(invoice);
                                        setPaymentModalData({
                                          paymentMethod: "",
                                          imageFile: null,
                                          imagePreview: null,
                                          imageUrl: invoice.screenshot || "",
                                          reference: "",
                                        });
                                        setShowPaymentModal(true);
                                      }}
                                    >
                                      <i className="fas fa-money-bill-wave"></i>
                                      Pay
                                    </button>
                                )}
                                  {!isPaid && !isViewer && (
                                    <button
                                      className="ghost-btn"
                                      style={{ padding: "4px 10px", fontSize: "0.85rem", color: "#ef4444" }}
                                      onClick={() => {
                                        showConfirmation(
                                          `Delete invoice ${invoice.id}? This cannot be undone.`,
                                          () => handleDeleteInvoice(invoice.id)
                                        );
                                      }}
                                    >
                                      Delete
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
                              <p style={{ margin: 0, fontSize: "1rem" }}>
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
                                        {item.member || item.memberName || item.memberId || "N/A"}
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
                                            className={`badge ${
                                            item.status === "Paid" ||
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
                                          borderRadius: "8px",
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
                              <p style={{ margin: 0, fontSize: "1rem" }}>
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
                                borderRadius: "8px",
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
                                    <strong>{item.channel || "N/A"}</strong>
                                    {item.type ? ` · ${item.type}` : ""}
                                    {" · "}
                                    {item.message || "N/A"}
                                    {" · "}
                                    {item.date
                                      ? new Date(item.date).toLocaleString()
                                      : item.timestamp
                                      ? new Date(item.timestamp).toLocaleString()
                                      : "N/A"}
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

                  {activeTab === "Activity" && (
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
                            } · ${status || "N/A"}`,
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
                              <p style={{ margin: 0, fontSize: "1rem" }}>
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
                  )}

                  {activeTab === "Notes" && (
                    <div className="tab-panel">
                      <h4>Internal Notes</h4>
                      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "12px" }}>
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
                  )}
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
                    background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                    borderRadius: "12px",
                    border: "2px solid #5a31ea",
                    boxShadow: "0 4px 12px rgba(90, 49, 234, 0.15)"
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)",
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
                        <i className="fas fa-envelope" style={{ marginRight: "8px" }}></i>
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
                
                <form className="card form-grid" onSubmit={handleAddInvoice} style={{ padding: "40px", background: "linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)", boxShadow: "0 4px 16px rgba(90, 49, 234, 0.1)" }}>
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
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Member *</span>
                    <div style={{ position: "relative" }} data-member-dropdown>
                      <div
                        onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                        style={{
                          padding: "14px 16px",
                          border: "none",
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
                            background: "linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)",
                            boxShadow: "0 2px 4px rgba(90, 49, 234, 0.05)"
                          }}>
                            <div style={{ position: "relative" }}>
                              <input
                                type="text"
                                placeholder="🔍 Search member by name or ID..."
                                value={invoiceMemberSearch}
                                onChange={(e) => setInvoiceMemberSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                autoFocus
                                style={{
                                  width: "100%",
                                  padding: "12px 36px 12px 16px",
                                  border: "none",
                                  borderRadius: "8px",
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
                                    background: invoiceForm.memberId === member.id ? "linear-gradient(135deg, #f0f4ff 0%, #e8f0ff 100%)" : "#fff",
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
                      <span style={{ fontSize: "0.75rem", color: "#d32f2f", marginTop: "4px", display: "none" }}>
                        Please select a member
                      </span>
                    )}
                  </label>

                  <label style={{ marginBottom: "24px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-tag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Invoice Type *</span>
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
                      <option value="Lifetime">Lifetime - $250</option>
                      <option value="Yearly + Janaza Fund">Yearly + Janaza Fund - $500</option>
                      {/* <option value="Eid">Eid - $100</option> */}
                    </select>
                  </label>

                  <label style={{ marginBottom: "24px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-calendar" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Period *</span>
                    <input
                      type="month"
                      required
                      value={invoiceForm.period ? (() => {
                        // Convert "MMM YYYY" format (e.g., "Nov 2025") to "YYYY-MM" for month input
                        if (invoiceForm.period.match(/^[A-Za-z]{3} \d{4}$/)) {
                          const date = new Date(invoiceForm.period + " 01");
                          if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, "0");
                            return `${year}-${month}`;
                          }
                        }
                        // If already in YYYY-MM format, return as is
                        if (invoiceForm.period.match(/^\d{4}-\d{2}$/)) {
                          return invoiceForm.period;
                        }
                        return "";
                      })() : ""}
                      onChange={(e) => {
                        // Convert "YYYY-MM" to "MMM YYYY" format (e.g., "Nov 2025")
                        const date = new Date(e.target.value + "-01");
                        if (!isNaN(date.getTime())) {
                          const formatted = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                          setInvoiceForm({ ...invoiceForm, period: formatted });
                        }
                      }}
                      onKeyDown={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.currentTarget.focus();
                        if (e.currentTarget.showPicker) {
                          e.currentTarget.showPicker();
                        }
                      }}
                      className="mono-input"
                      style={{ color: "#1a1a1a" }}
                    />
                  </label>

                  <label style={{ marginBottom: "24px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount ($) *</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={invoiceForm.amount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\\D/g, "");
                        setInvoiceForm({ ...invoiceForm, amount: value });
                      }}
                      className="mono-input"
                      style={{ color: "#1a1a1a" }}
                    />
                  </label>

                  <label style={{ marginBottom: "24px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-calendar-check" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Due Date *</span>
                    <input
                      type="date"
                      required
                      value={invoiceForm.due}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        if (selectedDate) {
                          const year = new Date(selectedDate).getFullYear();
                          // Validate year range: 1900 to 2100
                          if (year < 1900 || year > 2100) {
                            showToast("Please select a valid date between 1900 and 2100", "error");
                            return;
                          }
                        }
                        setInvoiceForm({ ...invoiceForm, due: selectedDate });
                      }}
                      min="1900-01-01"
                      max="2100-12-31"
                      onKeyDown={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.currentTarget.focus();
                        if (e.currentTarget.showPicker) {
                          e.currentTarget.showPicker();
                        }
                      }}
                      className="mono-input"
                      style={{ color: "#1a1a1a" }}
                    />
                  </label>

                  <label className="notes" style={{ marginBottom: "24px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-sticky-note" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Notes</span>
                    <textarea
                      placeholder="Add context for this invoice"
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      className="mono-input"
                      style={{ color: "#1a1a1a", minHeight: "100px" }}
                    ></textarea>
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
                      <strong>Period:</strong> {invoiceForm.period || "N/A"}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Amount:</strong>{" "}
                      {invoiceForm.amount
                        ? `$${Number(invoiceForm.amount || 0).toFixed(2)}`
                        : "$0.00"}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Due Date:</strong>{" "}
                      {invoiceForm.due
                        ? new Date(invoiceForm.due).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A"}
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

                        // Create the invoice object from form data
                        const newInvoice = {
                          id: generateInvoiceId(),
                          memberId: invoiceForm.memberId,
                          memberName: member?.name || "",
                          period: invoiceForm.period,
                          amount: `$${amountNum.toFixed(2)}`,
                          status: "Unpaid",
                          due: invoiceForm.due,
                          method: "-",
                          reference: "-",
                          notes: invoiceForm.notes || "",
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
                            (inv) =>
                              `• ${inv.period}: ${inv.amount} (Due: ${inv.due}) - ${inv.status}`
                          )
                          .join("\n");

                        const invoiceListHTML = allUnpaidInvoices
                          .map(
                            (inv) =>
                              `<li style="margin-bottom: 10px;">
                                <strong>${inv.period}</strong>: ${inv.amount} 
                                <span style="color: #666;">(Due: ${inv.due})</span> - 
                                <strong>${inv.status}</strong>
                              </li>`
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
                              totalDue: `$${totalDue.toFixed(2)}`,
                              invoiceCount: allUnpaidInvoices.length,
                              invoiceListText: invoiceListText,
                              invoiceListHTML: invoiceListHTML,
                              paymentMethods: "FPS, PayMe, Bank Transfer, Alipay, or Credit Card",
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
                  boxShadow: "0 2px 8px rgba(90, 49, 234, 0.1)",
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
                          background: automationEnabled ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" : "#f0f0f0",
                          boxShadow: automationEnabled ? "0 2px 8px rgba(90, 49, 234, 0.3)" : "0 2px 4px rgba(0,0,0,0.05)",
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
                          background: automationEnabled ? "#ffffff" : "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)",
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
                        Outstanding Members
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
                    <div style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap"
                    }}>
                      <button
                        className="primary-btn"
                        onClick={() => handleRequestReminder(null, true)}
                        disabled={sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "8px",
                          fontWeight: "600",
                          opacity: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? 0.5 : 1,
                          cursor: (sendingToAll || sendingWhatsAppToAll || !isAdminOrOwner) ? "not-allowed" : "pointer"
                        }}
                      >
                        {sendingToAll || sendingWhatsAppToAll ? "Sending..." : "📨 Send Reminder to All"}
                      </button>
                    </div>
                  </div>

                  {/* Members List */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}>
                    {members
                      .filter(member => {
                        // Only show members with outstanding invoices
                        const memberInvoices = invoices.filter(inv => 
                          inv.memberId === member.id && 
                          (inv.status === "Unpaid" || inv.status === "Overdue")
                        );
                        return memberInvoices.length > 0;
                      })
                      .map(member => {
                        const memberInvoices = invoices.filter(inv => 
                          inv.memberId === member.id && 
                          (inv.status === "Unpaid" || inv.status === "Overdue")
                        );
                        const totalDue = memberInvoices.reduce((sum, inv) => {
                          const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, '') || 0);
                          return sum + amount;
                        }, 0);
                        const overdueCount = memberInvoices.filter(inv => inv.status === "Overdue").length;
                        const unpaidCount = memberInvoices.filter(inv => inv.status === "Unpaid").length;
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
                              borderRadius: "8px",
                              border: "1px solid #e0e0e0",
                              gap: "16px",
                              flexWrap: "wrap"
                            }}
                          >
                            <div style={{ flex: "1 1 300px", minWidth: "200px" }}>
                              <div style={{
                                fontSize: "1rem",
                                fontWeight: "600",
                                color: "#000",
                                marginBottom: "4px"
                              }}>
                                {member.name}
                              </div>
                              <div style={{
                                fontSize: "0.875rem",
                                color: "#666",
                                marginBottom: "4px"
                              }}>
                                {member.email}
                              </div>
                              <div style={{
                                display: "flex",
                                gap: "12px",
                                fontSize: "0.8125rem",
                                color: "#666"
                              }}>
                                <span>
                                  <strong style={{ color: "#000" }}>${totalDue.toFixed(2)}</strong> outstanding
                                </span>
                                {overdueCount > 0 && (
                                  <span style={{ color: "#d32f2f", fontWeight: "600" }}>
                                    {overdueCount} overdue
                                  </span>
                                )}
                                {unpaidCount > 0 && (
                                  <span style={{ color: "#f57c00", fontWeight: "600" }}>
                                    {unpaidCount} unpaid
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{
                              display: "flex",
                              gap: "8px",
                              flexShrink: 0
                            }}>
                              <button
                                className="secondary-btn"
                                onClick={() => handleRequestReminder(member, false)}
                                disabled={isSending || sendingWhatsApp[member.id]}
                                style={{
                                  padding: "10px 20px",
                                  borderRadius: "8px",
                                  fontWeight: "600",
                                  fontSize: "0.875rem",
                                  opacity: (isSending || sendingWhatsApp[member.id]) ? 0.5 : 1,
                                  cursor: (isSending || sendingWhatsApp[member.id]) ? "not-allowed" : "pointer"
                                }}
                              >
                                {(isSending || sendingWhatsApp[member.id]) ? "Sending..." : "📨 Send Reminder"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    
                    {members.filter(member => {
                      const memberInvoices = invoices.filter(inv => 
                        inv.memberId === member.id && 
                        (inv.status === "Unpaid" || inv.status === "Overdue")
                      );
                      return memberInvoices.length > 0;
                    }).length === 0 && (
                      <div style={{
                        padding: "24px",
                        textAlign: "center",
                        color: "#666",
                        fontSize: "0.9375rem"
                      }}>
                        No members with outstanding invoices
                      </div>
                    )}
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
                          borderRadius: "8px",
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
                      <div style={{
                        marginTop: "12px",
                        padding: "12px",
                        background: "#f8f9fa",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        color: "#666"
                      }}>
                        <strong>Available Placeholders:</strong>
                        <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
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
                          borderRadius: "8px",
                          fontWeight: "600"
                        }}
                      >
                        👁️ Preview Template
                      </button>
                      <button
                        className="primary-btn"
                        onClick={handleSaveEmailTemplate}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "8px",
                          fontWeight: "600"
                        }}
                      >
                        💾 Save Email Template
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
                            borderRadius: "8px",
                            fontSize: "0.9375rem",
                            fontFamily: "inherit"
                          }}
                        >
                          <option value="gmail">Gmail</option>
                          <option value="outlook">Outlook</option>
                          <option value="yahoo">Yahoo</option>
                          <option value="custom">Custom SMTP</option>
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
                          Email Address *
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
                            borderRadius: "8px",
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
                          App Password *
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
                              borderRadius: "8px",
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
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                              borderRadius: "8px",
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
                              borderRadius: "8px",
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
                            borderRadius: "8px",
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
                          borderRadius: "8px",
                          fontWeight: "600",
                          opacity: (testingEmail || !emailSettings.emailUser || !emailSettings.emailPassword) ? 0.5 : 1,
                          cursor: (testingEmail || !emailSettings.emailUser || !emailSettings.emailPassword) ? "not-allowed" : "pointer"
                        }}
                      >
                        {testingEmail ? "Sending..." : "📧 Test Email"}
                      </button>
                      <button
                        className="primary-btn"
                        onClick={handleSaveEmailSettings}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "8px",
                          fontWeight: "600"
                        }}
                      >
                        💾 Save Email Settings
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="primary-btn"
                    style={{ 
                      padding: "14px 32px",
                      fontSize: "1rem",
                      fontWeight: "700",
                      borderRadius: "10px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      transition: "all 0.2s ease"
                    }}
                    onClick={() => {
                      showToast("All automation settings saved!");
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                    }}
                  >
                    💾 Save All Settings
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

                <div className="card" style={{ marginTop: "20px" }}>
                  {(() => {
                    // Build combined list:
                    // - Email reminders from backend reminderLogs (automatic + manual)
                    // - WhatsApp reminders from local communicationLog
                    const emailItems = (reminderLogs || []).map((log) => {
                      const member =
                        members.find((m) => m.id === log.memberId) ||
                        members.find(
                          (m) =>
                            m.email &&
                            log.memberEmail &&
                            m.email.toLowerCase() === log.memberEmail.toLowerCase()
                        );
                      return {
                        memberName: member?.name || log.memberEmail || "N/A",
                        memberId: log.memberId,
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
                          : "N/A",
                        status: log.status === "failed" ? "Failed" : "Delivered",
                        rawDate: log.sentAt || null,
                        raw: log,
                      };
                    });

                    const whatsappItems = (communicationLog || [])
                      .filter((c) => c.channel === "WhatsApp")
                      .map((c) => ({
                        memberName: c.memberName || c.member || "N/A",
                        memberId: c.memberId,
                        channel: "WhatsApp",
                        type: c.type || "Manual Outstanding Reminder",
                        message: c.message,
                        date: c.date,
                        status: c.status || "Delivered",
                        rawDate: c.timestamp || null,
                        raw: c,
                      }));

                    let allItems = [...emailItems, ...whatsappItems];

                    // Apply filters
                    allItems = allItems.filter((item) => {
                      const statusOk =
                        remindersStatusFilter === "All" ||
                        (remindersStatusFilter === "Delivered" && item.status === "Delivered") ||
                        (remindersStatusFilter === "Failed" && item.status === "Failed");
                      const channelOk =
                        remindersChannelFilter === "All" ||
                        item.channel === remindersChannelFilter;
                      return statusOk && channelOk;
                    });

                    // Sort newest first by rawDate when available
                    allItems.sort((a, b) => {
                      const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
                      const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
                      return dateB - dateA;
                    });

                    const total = allItems.length;
                    const emailCount = emailItems.length;
                    const whatsappCount = whatsappItems.length;

                    if (total === 0) {
                      return (
                        <div style={{ padding: "32px 20px", textAlign: "center", color: "#666" }}>
                          <p style={{ margin: 0 }}>No reminders have been sent yet.</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "12px",
                            marginBottom: "16px",
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                            Summary:
                          </span>
                          <span className="badge badge-paid">Total: {total}</span>
                          <span className="badge badge-unpaid">Email: {emailCount}</span>
                          <span className="badge badge-pending">WhatsApp: {whatsappCount}</span>
                        </div>

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
                            {/* Filters */}
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "12px",
                                marginBottom: "12px",
                                alignItems: "center",
                              }}
                            >
                              <label style={{ fontSize: "0.875rem", color: "#555" }}>
                                Status:&nbsp;
                                <select
                                  value={remindersStatusFilter}
                                  onChange={(e) => {
                                    setRemindersStatusFilter(e.target.value);
                                    setRemindersPage(1);
                                  }}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "1px solid #e5e7eb",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  <option value="All">All</option>
                                  <option value="Delivered">Delivered</option>
                                  <option value="Failed">Failed</option>
                                </select>
                              </label>
                              <label style={{ fontSize: "0.875rem", color: "#555" }}>
                                Channel:&nbsp;
                                <select
                                  value={remindersChannelFilter}
                                  onChange={(e) => {
                                    setRemindersChannelFilter(e.target.value);
                                    setRemindersPage(1);
                                  }}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "1px solid #e5e7eb",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  <option value="All">All</option>
                                  <option value="Email">Email</option>
                                  <option value="WhatsApp">WhatsApp</option>
                                </select>
                              </label>
                            </div>

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
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pageItems.map((item, idx) => (
                                    <tr key={`${item.memberId || item.memberName || "row"}-${start + idx}`}>
                                      <td>
                                        {item.memberName || item.member || "N/A"}
                                        {item.memberId ? ` (${item.memberId})` : ""}
                                      </td>
                                      <td>{item.channel || "N/A"}</td>
                                      <td>{item.type || "-"}</td>
                                      <td style={{ maxWidth: "320px", whiteSpace: "normal" }}>
                                        {item.message || "N/A"}
                                      </td>
                                      <td>{item.date || "N/A"}</td>
                                      <td>
                                        <span className={statusClass[item.status] || "badge"}>
                                          {item.status || "N/A"}
                                        </span>
                                      </td>
                                      <td>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                          {/* View full message in alert-style preview */}
                                          <button
                                            type="button"
                                            className="icon-btn icon-btn--view"
                                            title="View full message"
                                            aria-label="View full message"
                                            onClick={() => {
                                              const fullText = [
                                                `Member: ${item.memberName || "N/A"}`,
                                                `Channel: ${item.channel || "N/A"}`,
                                                `Type: ${item.type || "-"}`,
                                                `Date: ${item.date || "N/A"}`,
                                                "",
                                                "Message:",
                                                item.message || "N/A",
                                              ].join("\n");
                                              window.alert(fullText);
                                            }}
                                          >
                                            <i className="fas fa-eye" aria-hidden="true"></i>
                                          </button>
                                          {/* Retry failed email reminders */}
                                          {item.channel === "Email" && item.status === "Failed" && !isViewer && (
                                            <button
                                              type="button"
                                              className="icon-btn icon-btn--edit"
                                              title="Retry sending"
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
                                              <i className="fas fa-redo" aria-hidden="true"></i>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                              {/* Pagination controls */}
                              <div
                                style={{
                                  marginTop: "16px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                }}
                              >
                                <div style={{ fontSize: "0.875rem", color: "#555" }}>
                                  Showing{" "}
                                  <strong>
                                    {start + 1}-{Math.min(end, total)}
                                  </strong>{" "}
                                  of <strong>{total}</strong> reminders
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    disabled={currentPage <= 1}
                                    onClick={() => setRemindersPage(Math.max(1, currentPage - 1))}
                                  >
                                    Previous
                                  </button>
                                  <span style={{ fontSize: "0.875rem" }}>
                                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    disabled={currentPage >= totalPages}
                                    onClick={() =>
                                      setRemindersPage(Math.min(totalPages, currentPage + 1))
                                    }
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
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
                                    {item.memberName || item.member || "N/A"}
                                    {item.memberId ? ` (${item.memberId})` : ""}
                                  </td>
                                  <td>{item.channel || "N/A"}</td>
                                  <td>{item.type || "-"}</td>
                                  <td style={{ maxWidth: "320px", whiteSpace: "normal" }}>
                                    {item.message || "N/A"}
                                  </td>
                                  <td>{item.date || "N/A"}</td>
                                  <td>
                                    <span className={statusClass[item.status] || "badge"}>
                                      {item.status || "N/A"}
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
                      method.name === "Alipay" || 
                      method.name === "PayMe" || 
                      method.name === "FPS" || 
                      method.name === "Direct Bank Transfer"
                    )
                    .map((method) => {
                      const isQRMethod = method.name === "Alipay" || method.name === "PayMe";
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
                                ? "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)" 
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
                            borderBottom: "1px solid #f0f0f0"
                          }}>
                            <div style={{
                              width: "64px",
                              height: "64px",
                              borderRadius: "16px",
                              background: method.name === "Alipay" 
                                ? "linear-gradient(135deg, #1677FF 0%, #0958d9 100%)"
                                : method.name === "PayMe" 
                                ? "linear-gradient(135deg, #00C300 0%, #009900 100%)"
                                : method.name === "FPS" 
                                ? "linear-gradient(135deg, #0066CC 0%, #004499 100%)"
                                : "linear-gradient(135deg, #E60012 0%, #CC0011 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "28px",
                              fontWeight: "700",
                              color: "#fff",
                              boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                              position: "relative"
                            }}>
                              {method.name === "Alipay" ? "A" 
                                : method.name === "PayMe" ? "P"
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
                                {method.name === "Alipay" ? "Alipay HK" 
                                  : method.name === "PayMe" ? "PayMe by HSBC"
                                  : method.name === "FPS" ? "Faster Payment System"
                                  : "Direct Bank Transfer"}
                              </p>
                            </div>
                          </div>

                          {/* QR Code Display Section for Alipay/PayMe OR Payment Details for FPS/Bank Transfer */}
                          {isQRMethod ? (
                            <div style={{
                              background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
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
                                        borderRadius: "8px",
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
                                      borderRadius: "8px",
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
                                    background: "linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)",
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
                                      background: "linear-gradient(135deg, #000 0%, #333 100%)",
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
                              background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
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
                                ? "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)" 
                                : "#fafafa",
                              borderRadius: "12px",
                              border: `2px solid ${method.visible ? "#2196F3" : "#e0e0e0"}`,
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              marginTop: "4px"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = method.visible 
                                ? "linear-gradient(135deg, #bbdefb 0%, #90caf9 100%)" 
                                : "#f0f0f0";
                              e.currentTarget.style.borderColor = method.visible ? "#1976D2" : "#ccc";
                              e.currentTarget.style.transform = "scale(1.01)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = method.visible 
                                ? "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)" 
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
                        borderRadius: "8px",
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
                              borderRadius: "6px",
                              border: "none",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              background: paymentStatusFilter === option.value
                                ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)"
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
                        background: "#fff3cd",
                        borderRadius: "8px",
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        color: "#856404",
                        border: "1px solid #ffc107"
                      }}>
                        ⏳ Pending: {(payments || []).filter(p => p.status === 'Pending').length}
                      </div>
                    </div>
                  </div>
                </header>

                {/* Payment Form - shown as popup modal */}
                {showPaymentForm && (
                  <div
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(0, 0, 0, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10000,
                      padding: "20px",
                    }}
                    onClick={(e) => {
                      // 点击遮罩不关闭，避免误操作；只允许通过按钮关闭
                      if (e.target === e.currentTarget) {
                        // 如果你希望点击背景也能关闭，可以在这里调用关闭逻辑
                      }
                    }}
                  >
                    <div
                      className="card"
                      style={{
                        maxWidth: "640px",
                        width: "100%",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        position: "relative",
                        background: "#ffffff",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "20px",
                        }}
                      >
                        <h4 style={{ margin: 0 }}>
                          {editingPayment ? "Edit Payment" : "Add New Payment"}
                        </h4>
                        <button
                          className="ghost-btn"
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
                                year: "numeric",
                              }),
                              status: "Pending",
                              screenshot: "",
                              notes: "",
                            });
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <form
                        className="form-grid"
                        onSubmit={editingPayment ? handleUpdatePayment : handleAddPayment}
                      >
                        <label>
                          Member *
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
                          Invoice ID
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
                          Amount *
                          <input
                            type="text"
                            value={paymentForm.amount}
                            onChange={(e) =>
                              setPaymentForm({
                                ...paymentForm,
                                amount: e.target.value,
                              })
                            }
                            placeholder="$50"
                            required
                          />
                        </label>
                        <label>
                          Payment Method *
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
                            <option value="Alipay">Alipay</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Cash">Cash</option>
                          </select>
                        </label>
                        <label>
                          Reference Number
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
                          Date
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
                          Status *
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
                          Screenshot URL{" "}
                          {paymentForm.method === "Cash" && (
                            <span style={{ color: "#ef4444" }}>*</span>
                          )}
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
                          Notes
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

                <div className="card">
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
                              "Actions",
                            ]}
                            rows={paginatedPayments.map((payment) => {
                              const paymentId = payment._id || payment.id;
                              const paymentIdString = paymentId?.toString ? paymentId.toString() : paymentId;
                              
                              return {
                                Date: payment.date || (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                }) : "N/A"),
                                Member: payment.member || "Unknown",
                                "Invoice ID": payment.invoiceId || "N/A",
                                Amount: payment.amount || "$0",
                                Method: getPaymentMethodDisplay(payment),
                                Screenshot: {
                                  render: () => payment.screenshot ? (
                                    <a 
                                      href={payment.screenshot} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ color: "#000", textDecoration: "none" }}
                                      title="View screenshot"
                                      aria-label="View screenshot"
                                    >
                                      <i className="fas fa-image" aria-hidden="true"></i>
                                    </a>
                                  ) : "N/A"
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
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                      {payment.status === "Pending" && (
                                        <>
                                          <button
                                            className="icon-btn icon-btn--view"
                                            onClick={() => {
                                              if (paymentIdString) handleApprovePayment(paymentIdString);
                                            }}
                                            title="Approve payment (By Admin)"
                                            aria-label="Approve payment (By Admin)"
                                          >
                                            <i className="fas fa-check" aria-hidden="true"></i>
                                          </button>
                                          <button
                                            className="icon-btn icon-btn--delete"
                                            onClick={() => {
                                              if (paymentIdString) handleRejectPayment(paymentIdString);
                                            }}
                                            title="Reject payment (By Admin)"
                                            aria-label="Reject payment (By Admin)"
                                          >
                                            <i className="fas fa-times" aria-hidden="true"></i>
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
                                        const onlineMethods = ["Screenshot", "Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card", "Online Payment"];
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
                                      style={{ color: "#ef4444" }}
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
                        showToast("Redirecting to Invoice Builder...");
                      }}
                    >
                      <i className="fas fa-plus" style={{ marginRight: "8px" }}></i>Create Invoice
                    </button>
                  </div>
                </header>
                
                {/* Summary Cards */}
                {(() => {
                  const totalInvoices = invoices.length;
                  const unpaidInvoices = invoices.filter(inv => {
                    const status = inv.status || "Unpaid";
                    return status !== "Paid" && status !== "Completed";
                  });
                  const totalUnpaidAmount = unpaidInvoices.reduce((sum, inv) => {
                    const amount = parseFloat(inv.amount?.replace(/[^0-9.]/g, '') || 0);
                    return sum + amount;
                  }, 0);
                  
                  return (
                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                      gap: "16px", 
                      marginBottom: "24px" 
                    }}>
                      <div style={{
                        background: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "20px",
                        boxShadow: "0 2px 8px rgba(90, 49, 234, 0.1)",
                      }}>
                        <p style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "#666", fontWeight: "500" }}>
                          Total Invoices
                        </p>
                        <h4 style={{ margin: "0", fontSize: "1.75rem", fontWeight: "700", color: "#1a1a1a" }}>
                          {totalInvoices.toLocaleString("en-US")}
                        </h4>
                      </div>
                      <div style={{
                        background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                        border: "1px solid #f59e0b",
                        borderRadius: "8px",
                        padding: "20px",
                        boxShadow: "0 2px 8px rgba(245, 158, 11, 0.2)",
                      }}>
                        <p style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "#92400e", fontWeight: "500" }}>
                          Total Unpaid Amount
                        </p>
                        <h4 style={{ margin: "0", fontSize: "1.75rem", fontWeight: "700", color: "#92400e" }}>
                          ${totalUnpaidAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </h4>
                      </div>
                    </div>
                  );
                })()}
                
                <div className="card">
                  <div className="table-wrapper">
                    {(() => {
                      // Calculate pagination
                      const startIndex = (invoicesPage - 1) * invoicesPageSize;
                      const endIndex = startIndex + invoicesPageSize;
                      const paginatedInvoices = invoices.slice(startIndex, endIndex);
                      const totalPages = Math.ceil(invoices.length / invoicesPageSize);
                      
                      return (
                        <>
                          <Table
                            columns={["Invoice ID", "Member", "Period", "Amount", "Due Date", "Status", "Actions"]}
                            rows={paginatedInvoices.map((invoice) => {
                              const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
                              const isOverdue = invoice.status === "Overdue";
                              const isUnpaid = !isPaid && !isOverdue && (invoice.status === "Unpaid" || !invoice.status);
                              
                              return {
                                "Invoice ID": invoice.id || invoice.invoiceId || "N/A",
                                Member: invoice.memberName || invoice.member || "Unknown",
                                Period: invoice.period || "N/A",
                                Amount: invoice.amount || "$0",
                                "Due Date": invoice.due ? new Date(invoice.due).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                }) : "N/A",
                                Status: {
                                  render: () => (
                                    <span className={
                                      invoice.status === "Paid" ? "badge badge-paid" :
                                      invoice.status === "Overdue" ? "badge badge-overdue" :
                                      invoice.status === "Pending" ? "badge badge-pending" :
                                      "badge badge-unpaid"
                                    }>
                                      {invoice.status || "Unpaid"}
                                    </span>
                                  )
                                },
                                Actions: {
                                  render: () => (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button
                                        className="ghost-btn icon-btn icon-btn--edit"
                                        onClick={() => {
                                          const member = members.find(m => 
                                            m.id === invoice.memberId || 
                                            m.email === invoice.memberEmail ||
                                            m.name === invoice.memberName
                                          );
                                          if (member) {
                                            handleViewMemberDetail(member);
                                            setActiveSection("member-detail");
                                            setActiveTab("Invoices");
                                          }
                                        }}
                                        title="View Invoice Details"
                                      >
                                        <i className="fas fa-eye" aria-hidden="true"></i>
                                      </button>
                                      {!isPaid && (
                                        <button
                                          className="ghost-btn icon-btn icon-btn--delete"
                                          style={{ color: "#ef4444" }}
                                          onClick={() => {
                                            if (invoice.id || invoice._id) {
                                              handleDeleteInvoice(invoice.id || invoice._id);
                                            }
                                          }}
                                          title="Delete Invoice"
                                        >
                                          <i className="fas fa-trash" aria-hidden="true"></i>
                                        </button>
                                      )}
                                    </div>
                                  )
                                },
                                _rowStyle: isOverdue 
                                  ? { background: "linear-gradient(135deg, rgba(254, 243, 199, 0.4) 0%, rgba(254, 226, 226, 0.4) 100%)", borderLeft: "4px solid #ef4444" }
                                  : isUnpaid
                                  ? { background: "rgba(254, 243, 199, 0.3)", borderLeft: "4px solid #f59e0b" }
                                  : {}
                              };
                            })}
                          />
                          {totalPages > 0 && invoices.length > 0 && (
                            <Pagination
                              currentPage={invoicesPage}
                              totalPages={totalPages}
                              onPageChange={setInvoicesPage}
                              pageSize={invoicesPageSize}
                              onPageSizeChange={setInvoicesPageSize}
                              totalItems={invoices.length}
                            />
                          )}
                        </>
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
                      <p>View and manage all payment transactions.</p>
                    </div>
                    <button
                      className="secondary-btn"
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
                      <i className="fas fa-plus" style={{ marginRight: "8px" }}></i>Add Payment
                    </button>
                  </div>
                </header>

                {/* Payment Form Modal */}
                {showPaymentForm && (
                  <div 
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(0, 0, 0, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10000,
                      padding: "20px",
                    }}
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
                      className="card"
                      style={{
                        maxWidth: "800px",
                        width: "100%",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        position: "relative",
                      }}
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
                            e.target.style.background = "#f0f0f0";
                            e.target.style.color = "#333";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "transparent";
                            e.target.style.color = "#666";
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <form className="form-grid" onSubmit={editingPayment ? handleUpdatePayment : handleAddPayment}>
                      <label>
                        Member *
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
                        Invoice ID
                        <input
                          type="text"
                          value={paymentForm.invoiceId}
                          onChange={(e) => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })}
                          placeholder="INV-2025-001"
                        />
                      </label>
                      <label>
                        Amount *
                        <input
                          type="text"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          placeholder="$50"
                          required
                        />
                      </label>
                      <label>
                        Payment Method *
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
                        Reference Number
                        <input
                          type="text"
                          value={paymentForm.reference}
                          onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                          placeholder="Transaction reference"
                        />
                      </label>
                      <label>
                        Date
                        <input
                          type="text"
                          value={paymentForm.date}
                          onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                          placeholder="01 Jan 2025"
                        />
                      </label>
                      <label>
                        Status *
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
                        Screenshot URL {paymentForm.method === "Cash" && <span style={{ color: "#ef4444" }}>*</span>}
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
                        Notes
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

                <div className="card">
                  <div style={{ padding: "24px" }}>
                    {/* Payment Status Filter - Segmented Buttons */}
                    <div style={{ marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                      <label style={{ fontWeight: "600", color: "#1a1a1a" }}>Filter by Status:</label>
                      <div style={{ 
                        display: "flex", 
                        gap: "4px", 
                        background: "#f3f4f6", 
                        padding: "4px", 
                        borderRadius: "8px",
                        flexWrap: "wrap"
                      }}>
                        {[
                          { value: "All", label: "All" },
                          { value: "Pending", label: "Pending" },
                          { value: "Completed", label: "Completed" },
                          { value: "Paid", label: "Paid" },
                          { value: "Rejected", label: "Rejected" }
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setPaymentStatusFilter(option.value)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "6px",
                              border: "none",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              background: paymentStatusFilter === option.value
                                ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)"
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
                    </div>

                    {(() => {
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
                              "Actions",
                            ]}
                            rows={paginatedPayments.map((payment) => {
                              const paymentId = payment._id || payment.id;
                              const paymentIdString = paymentId?.toString ? paymentId.toString() : paymentId;
                              
                              return {
                                Date: payment.date || (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                }) : "N/A"),
                                Member: payment.member || "Unknown",
                                "Invoice ID": payment.invoiceId || "N/A",
                                Amount: payment.amount || "$0",
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
                                  ) : "N/A"
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
                                Actions: {
                                  render: () => (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button
                                        className="ghost-btn icon-btn icon-btn--edit"
                                        onClick={() => handleEditPayment(payment)}
                                        title="Edit Payment"
                                      >
                                        <i className="fas fa-pen" aria-hidden="true"></i>
                                      </button>
                                      <button
                                        className="ghost-btn icon-btn icon-btn--delete"
                                        style={{ color: "#ef4444" }}
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
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(0, 0, 0, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10000,
                      padding: "20px",
                    }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
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
                      }
                    }}
                  >
                    <div 
                      className="card"
                      style={{
                        maxWidth: "800px",
                        width: "100%",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        position: "relative",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                        <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
                          <i className="fas fa-heart" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                          Add Donation
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
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
                            e.target.style.background = "#f0f0f0";
                            e.target.style.color = "#333";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "transparent";
                            e.target.style.color = "#666";
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          if (!donationForm.donorName) {
                            showToast("Donor name is required", "error");
                            return;
                          }
                          if (!donationForm.amount) {
                            showToast("Amount is required", "error");
                            return;
                          }
                          const amountNum = parseFloat(donationForm.amount);
                          if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
                            showToast("Amount must be a positive number", "error");
                            return;
                          }
                          if (!donationForm.method) {
                            showToast("Payment method is required", "error");
                            return;
                          }
                          if (!donationForm.date) {
                            showToast("Date is required", "error");
                            return;
                          }

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

                          // Validate Cash payment method - requires proof image
                          if (donationForm.method === "Cash" && !imageUrl) {
                            showToast("Proof image is required for Cash payments", "error");
                            return;
                          }

                          // Validate Online payment methods - requires reference number AND proof image
                          const onlineMethods = ["Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card"];
                          if (onlineMethods.includes(donationForm.method)) {
                            if (!donationForm.reference.trim()) {
                              showToast("Reference number is required for online payment methods", "error");
                              return;
                            }
                            if (!imageUrl) {
                              showToast("Proof image is required for online payment methods", "error");
                              return;
                            }
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
                        }
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                        <label>
                          Donor Name *
                          <input
                            type="text"
                            value={donationForm.donorName}
                            onChange={(e) => setDonationForm({ ...donationForm, donorName: e.target.value })}
                            required
                            placeholder={donationForm.isMember ? "Will be filled automatically when member is selected" : "Enter donor name"}
                            disabled={donationForm.isMember && donationForm.memberId ? true : false}
                            style={{
                              background: donationForm.isMember && donationForm.memberId ? "#f5f5f5" : "#fff",
                              cursor: donationForm.isMember && donationForm.memberId ? "not-allowed" : "text"
                            }}
                          />
                          {donationForm.isMember && donationForm.memberId && (
                            <span style={{ fontSize: "0.75rem", color: "#666", marginTop: "4px", display: "block" }}>
                              Donor name is automatically set from selected member
                            </span>
                          )}
                        </label>
                        <label>
                          Amount *
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={donationForm.amount}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, "");
                              setDonationForm({ ...donationForm, amount: value });
                            }}
                            placeholder="100"
                            required
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
                              borderRadius: "8px",
                              border: "none",
                              background: donationForm.isMember ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" : "#f8f9ff",
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
                              borderRadius: "8px",
                              border: "none",
                              background: !donationForm.isMember ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" : "#f8f9ff",
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
                            Select Member *
                            <div style={{ position: "relative" }} data-donation-member-dropdown>
                              <div
                                onClick={() => setShowDonationMemberDropdown(!showDonationMemberDropdown)}
                                style={{
                                  padding: "10px 16px",
                                  border: "1px solid #e0e0e0",
                                  borderRadius: "8px",
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
                                    borderRadius: "8px",
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
                                        placeholder="🔍 Search member by name or ID..."
                                        value={donationMemberSearch}
                                        onChange={(e) => setDonationMemberSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        autoFocus
                                        style={{
                                          width: "100%",
                                          padding: "10px 36px 10px 12px",
                                          border: "1px solid #e0e0e0",
                                          borderRadius: "6px",
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
                                            borderBottom: "1px solid #f0f0f0",
                                            background: donationForm.memberId === member.id ? "#f5f5f5" : "#fff",
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
                              <span style={{ fontSize: "0.75rem", color: "#d32f2f", marginTop: "4px", display: "none" }}>
                                Please select a member
                              </span>
                            )}
                          </label>
                        </div>
                      )}
                      <label>
                        Payment Method *
                        <select
                          value={donationForm.method}
                          onChange={(e) => setDonationForm({ ...donationForm, method: e.target.value })}
                          required
                        >
                          <option value="">Select method</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="FPS">FPS</option>
                          <option value="PayMe">PayMe</option>
                          <option value="Alipay">Alipay</option>
                          <option value="Credit Card">Credit Card</option>
                        </select>
                      </label>

                      {/* Reference Number - Required for Online payment methods */}
                      {["Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card"].includes(donationForm.method) && (
                        <label>
                          Reference Number <span style={{ color: "#ef4444" }}>*</span>
                          <input
                            type="text"
                            value={donationForm.reference}
                            onChange={(e) => setDonationForm({ ...donationForm, reference: e.target.value })}
                            placeholder="Transaction reference number"
                            required
                          />
                          {!donationForm.reference.trim() && (
                            <small style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
                              Reference number is required for online payment methods
                            </small>
                          )}
                        </label>
                      )}

                      {/* Proof Image - Required for Cash payment method */}
                      {donationForm.method === "Cash" && (
                        <label style={{ gridColumn: "1 / -1" }}>
                          Proof Image <span style={{ color: "#ef4444" }}>*</span>
                          <div
                            style={{
                              border: "2px dashed #d0d0d0",
                              borderRadius: "8px",
                              padding: "24px",
                              textAlign: "center",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              background: donationImagePreview || donationForm.screenshot ? "#f9fafb" : "#fafafa",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#5a31ea";
                              e.currentTarget.style.background = "#f8f9ff";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#d0d0d0";
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
                                    borderRadius: "8px",
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
                          {!donationImagePreview && !donationForm.screenshot && (
                            <small style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
                              Proof image is required for Cash payments
                            </small>
                          )}
                        </label>
                      )}

                      {/* Proof Image - Also required for Online payment methods */}
                      {["Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card"].includes(donationForm.method) && (
                        <label style={{ gridColumn: "1 / -1" }}>
                          Proof Image <span style={{ color: "#ef4444" }}>*</span>
                          <div
                            style={{
                              border: "2px dashed #d0d0d0",
                              borderRadius: "8px",
                              padding: "24px",
                              textAlign: "center",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              background: donationImagePreview || donationForm.screenshot ? "#f9fafb" : "#fafafa",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#5a31ea";
                              e.currentTarget.style.background = "#f8f9ff";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#d0d0d0";
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
                                    borderRadius: "8px",
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
                          {!donationImagePreview && !donationForm.screenshot && (
                            <small style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
                              Proof image is required for online payment methods
                            </small>
                          )}
                        </label>
                      )}

                      <label>
                        Date *
                        <input
                          type="date"
                          value={donationForm.date}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            if (selectedDate) {
                              const year = new Date(selectedDate).getFullYear();
                              // Validate year range: 1900 to 2100
                              if (year < 1900 || year > 2100) {
                                showToast("Please select a valid date between 1900 and 2100", "error");
                                return;
                              }
                            }
                            setDonationForm({ ...donationForm, date: selectedDate });
                          }}
                          min="1900-01-01"
                          max="2100-12-31"
                          onClick={(e) => {
                            e.currentTarget.focus();
                            if (e.currentTarget.showPicker) {
                              e.currentTarget.showPicker();
                            }
                          }}
                          required
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
                        <button type="submit" className="primary-btn">
                          Save Donation
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
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
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                    </div>
                  </div>
                )}

                {/* Donations Table */}
                <div className="card">
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
                        const filteredDonations = donationsArray.filter(donation => donation !== null);
                        
                        // Calculate pagination
                        const totalPages = Math.ceil(filteredDonations.length / donationsPageSize) || 1;
                        const currentPage = Math.min(donationsPage, totalPages);
                        const startIndex = (currentPage - 1) * donationsPageSize;
                        const endIndex = startIndex + donationsPageSize;
                        const paginatedDonations = filteredDonations.slice(startIndex, endIndex);
                        
                        return (
                          <>
                            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                              <div style={{ fontSize: "0.875rem", color: "#666" }}>
                                Total donations:{" "}
                                <strong>
                                  $
                                  {filteredDonations.reduce((sum, d) => {
                                    const val = parseFloat(d?.amount || 0);
                                    return sum + (isNaN(val) ? 0 : val);
                                  }, 0).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </strong>
                              </div>
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => {
                                  try {
                                    const rows = filteredDonations.map((d) => ({
                                      Date:
                                        d.date ||
                                        (d.createdAt
                                          ? new Date(d.createdAt).toLocaleDateString("en-GB", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                            })
                                          : "N/A"),
                                      DonorName: d.donorName || "",
                                      Type: d.isMember ? "Member" : "Non-Member",
                                      Amount: d.amount || "0",
                                      Method: d.method || "",
                                      Notes: (d.notes || "").replace(/\r?\n/g, " "),
                                    }));

                                    const header = ["Date", "DonorName", "Type", "Amount", "Method", "Notes"];
                                    const csvRows = [
                                      header.join(","),
                                      ...rows.map((r) =>
                                        header
                                          .map((key) => {
                                            const val = r[key] ?? "";
                                            const safe = String(val).replace(/"/g, '""');
                                            return `"${safe}"`;
                                          })
                                          .join(",")
                                      ),
                                    ];

                                    const blob = new Blob([csvRows.join("\n")], {
                                      type: "text/csv;charset=utf-8;",
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = url;
                                    const ts = new Date().toISOString().slice(0, 10);
                                    link.download = `donations-report-${ts}.csv`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(url);
                                    showToast("Donations report exported as CSV");
                                  } catch (error) {
                                    console.error("Export donations CSV failed", error);
                                    showToast("Failed to export donations report", "error");
                                  }
                                }}
                              >
                                📥 Export Donations CSV
                              </button>
                            </div>

                            <Table
                              columns={["Date", "Donor Name", "Type", "Amount", "Method", "Notes", "Actions"]}
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
                                    : "N/A");

                                return {
                                  Date: donationDate,
                                  "Donor Name": donation.donorName || "Unknown",
                                  Type: donation.isMember ? (
                                    <span className="badge badge-active">Member</span>
                                  ) : (
                                    <span className="badge badge-inactive">Non-Member</span>
                                  ),
                                  Amount: donation.amount
                                    ? `$${Number(donation.amount).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    : "$0.00",
                                  Method: donation.method || "-",
                                  Notes: donation.notes || "-",
                                  Actions: {
                                    render: () => (
                                      <button
                                        className="ghost-btn"
                                        style={{ padding: "6px 12px", fontSize: "0.85rem", color: "#ef4444" }}
                                        onClick={async () => {
                                          showConfirmation(
                                            "Are you sure you want to delete this donation?",
                                            async () => {
                                              try {
                                                const donationId = donation._id || donation.id;
                                                await deleteDonation(donationId);
                                                showToast("Donation deleted successfully!");
                                                await fetchDonations();
                                              } catch (error) {
                                                showToast(error.message || "Failed to delete donation", "error");
                                              }
                                            }
                                          );
                                        }}
                                      >
                                        Delete
                                      </button>
                                    ),
                                  },
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
                <header className="screen-card__header">
                  <div>
                    {renderBreadcrumb("reports")}
                    <h3>Reports</h3>
                    <p>Financial overview and payment analytics.</p>
                  </div>
                </header>
                <div className="card reports">
                  <div className="reports-header">
                    <label>
                      Date From
                      <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => {
                          const selectedDate = e.target.value;
                          if (selectedDate) {
                            const year = new Date(selectedDate).getFullYear();
                            // Validate year range: 1900 to 2100
                            if (year < 1900 || year > 2100) {
                              showToast("Please select a valid date between 1900 and 2100", "error");
                              return;
                            }
                          }
                          setDateRange({ ...dateRange, from: selectedDate });
                        }}
                        min="1900-01-01"
                        max="2100-12-31"
                        onClick={(e) => {
                          e.currentTarget.focus();
                          if (e.currentTarget.showPicker) {
                            e.currentTarget.showPicker();
                          }
                        }}
                      />
                    </label>
                    <label>
                      Date To
                      <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => {
                          const selectedDate = e.target.value;
                          if (selectedDate) {
                            const year = new Date(selectedDate).getFullYear();
                            // Validate year range: 1900 to 2100
                            if (year < 1900 || year > 2100) {
                              showToast("Please select a valid date between 1900 and 2100", "error");
                              return;
                            }
                          }
                          setDateRange({ ...dateRange, to: selectedDate });
                        }}
                        min="1900-01-01"
                        max="2100-12-31"
                        onClick={(e) => {
                          e.currentTarget.focus();
                          if (e.currentTarget.showPicker) {
                            e.currentTarget.showPicker();
                          }
                        }}
                      />
                    </label>
                    <div className="chip-group">
                      {["This Year", "This Quarter", "This Month"].map((period) => (
                        <button
                          key={period}
                          className={`chip ${selectedPeriod === period ? "active" : ""}`}
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
                            showToast(`Period set to ${period}`);
                          }}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>

                 

                  <div className="kpi-grid" style={{ marginTop: "20px" }}>
                    <div className="card kpi">
                      <p>Collected vs Expected</p>
                      <h4>
                        ${reportStats.collected.toLocaleString()} / $
                        {reportStats.expected.toLocaleString()}
                      </h4>
                      <small>
                        {Math.round((reportStats.collected / reportStats.expected) * 100)}% of goal
                      </small>
                    </div>
                    <div className="card kpi">
                      <p>Avg per Member</p>
                      <h4>${reportStats.averagePerMember}</h4>
                      <small>Goal $800</small>
                    </div>
                    <div className="card kpi">
                      <p>Total Transactions</p>
                      <h4>{reportStats.transactionCount}</h4>
                      <small>In selected period</small>
                    </div>
                    <div className="card kpi">
                      <p>Outstanding</p>
                      <h4>${dashboardMetrics.outstanding.toLocaleString()}</h4>
                      <small>Pending collection</small>
                    </div>
                  </div>

                  {/* Charts Section */}
                  <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
                    {/* Collected vs Outstanding Chart */}
                    <div className="card" style={{ padding: "24px" }}>
                      <h4 style={{ marginBottom: "20px", fontSize: "1.125rem", fontWeight: "600" }}>Collected vs Outstanding</h4>
                      <div style={{ position: "relative", height: "200px", display: "flex", alignItems: "flex-end", gap: "20px", justifyContent: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flex: 1 }}>
                          <div
                            style={{
                              width: "100%",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              borderRadius: "8px 8px 0 0",
                              minHeight: "40px",
                              height: `${Math.max(10, Math.round((reportStats.collected / (reportStats.collected + dashboardMetrics.outstanding)) * 180) || 0)}px`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: "600",
                              fontSize: "0.875rem",
                              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            ${reportStats.collected.toLocaleString()}
                          </div>
                          <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#10b981" }}>Collected</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flex: 1 }}>
                          <div
                            style={{
                              width: "100%",
                              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                              borderRadius: "8px 8px 0 0",
                              minHeight: "40px",
                              height: `${Math.max(10, Math.round((dashboardMetrics.outstanding / (reportStats.collected + dashboardMetrics.outstanding)) * 180) || 0)}px`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: "600",
                              fontSize: "0.875rem",
                              boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            ${dashboardMetrics.outstanding.toLocaleString()}
                          </div>
                          <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#ef4444" }}>Outstanding</span>
                        </div>
                      </div>
                    </div>

                    {/* Payments Over Time Chart */}
                    <div className="card" style={{ padding: "24px" }}>
                      <h4 style={{ marginBottom: "20px", fontSize: "1.125rem", fontWeight: "600" }}>Payments Over Time</h4>
                      <div style={{ position: "relative", height: "200px" }}>
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
                            <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "100%", justifyContent: "space-between", padding: "0 8px" }}>
                              {periods.length > 0 ? periods.map((period, index) => {
                                const amount = paymentsByPeriod[period];
                                const height = Math.max(20, (amount / maxAmount) * 160);
                                return (
                                  <div key={`${period}-${index}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, minWidth: "40px" }}>
                                    <div
                                      style={{
                                        width: "100%",
                                        background: "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)",
                                        borderRadius: "4px 4px 0 0",
                                        height: `${height}px`,
                                        minHeight: "20px",
                                        display: "flex",
                                        alignItems: "flex-end",
                                        justifyContent: "center",
                                        paddingBottom: "4px",
                                        color: "#fff",
                                        fontSize: "0.7rem",
                                        fontWeight: "600",
                                        boxShadow: "0 2px 8px rgba(90, 49, 234, 0.3)",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                      }}
                                      title={`${period}: $${amount.toFixed(2)}`}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "scaleY(1.05)";
                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(90, 49, 234, 0.4)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "scaleY(1)";
                                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(90, 49, 234, 0.3)";
                                      }}
                                    >
                                      {height > 35 && `$${Math.round(amount)}`}
                                    </div>
                                    <span style={{ fontSize: "0.65rem", color: "#666", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                                      {period.length > 8 ? period.substring(0, 6) + '...' : period}
                                    </span>
                                  </div>
                                );
                              }) : (
                                <div style={{ width: "100%", textAlign: "center", color: "#999", padding: "40px 0" }}>
                                  No payment data in selected period
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Breakdown */}
                  <div className="card" style={{ marginTop: "24px", padding: "24px" }}>
                    <h4 style={{ marginBottom: "16px", fontSize: "1.125rem", fontWeight: "600" }}>Payment Method Breakdown</h4>
                    <ul className="donut-legend" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {reportStats.methodMix.map((item) => (
                        <li key={item.label} style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                          <span
                            className={`legend-dot ${item.label
                              .toLowerCase()
                              .replace(/[^a-z]/g, "")}`}
                            style={{ flexShrink: 0 }}
                          ></span>
                          <span style={{ flex: 1, fontSize: "0.875rem" }}>{item.label}</span>
                          <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#1a1a1a" }}>{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                   {/* Filters */}
                  <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      value={reportFilter}
                      onChange={(e) => setReportFilter(e.target.value)}
                      style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "0.875rem", background: "#fff", cursor: "pointer" }}
                    >
                      <option value="all">All (Payments + Donations)</option>
                      <option value="payments">Payments Only</option>
                      <option value="donations">Donations Only</option>
                    </select>
                    {reportFilter === "donations" && (
                      <select
                        value={donorTypeFilter}
                        onChange={(e) => setDonorTypeFilter(e.target.value)}
                        style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "0.875rem", background: "#fff", cursor: "pointer" }}
                      >
                        <option value="all">All Donors</option>
                        <option value="member">Members Only</option>
                        <option value="non-member">Non-Members Only</option>
                      </select>
                    )}
                  </div>

                  {/* Transactions Table */}
                  <div style={{ marginTop: "24px" }}>
                    <h4 style={{ marginBottom: "16px", fontSize: "1.125rem", fontWeight: "600" }}>Transactions</h4>
                    <div className="card" style={{ overflow: "hidden" }}>
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
                            // Combine payments and donations
                            const allTransactions = [
                              ...(reportStats.paymentsInRange || []).map(p => ({
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
                                }) : "N/A"),
                                createdAt: p.createdAt || new Date(p.date || 0),
                              })),
                              ...(reportStats.donationsInRange || []).map(d => ({
                                ...d,
                                type: 'Donation',
                                source: d.donorName,
                                amount: d.amount,
                                method: d.method || 'N/A',
                                screenshot: d.screenshot || null,
                                status: 'Completed',
                                invoiceId: null,
                                period: null,
                                date: d.date || (d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                }) : "N/A"),
                                createdAt: d.createdAt || new Date(d.date || 0),
                                isMember: d.isMember,
                              }))
                            ].sort((a, b) => {
                              const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date || 0);
                              const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date || 0);
                              return dateB - dateA;
                            });

                            // Apply filters
                            const filteredTransactions = allTransactions.filter(t => {
                              if (reportFilter === "payments" && t.type !== "Payment") return false;
                              if (reportFilter === "donations" && t.type !== "Donation") return false;
                              if (t.type === "Donation") {
                                if (donorTypeFilter === "member" && !t.isMember) return false;
                                if (donorTypeFilter === "non-member" && t.isMember) return false;
                              }
                              return true;
                            });

                            const rows = filteredTransactions.map((transaction) => {
                              const transactionId = transaction._id || transaction.id;
                              
                              return {
                                Date: transaction.date || "N/A",
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
                                "Invoice ID": transaction.invoiceId || (transaction.type === "Donation" ? "N/A" : "N/A"),
                                Amount: transaction.amount || "$0",
                                Method: transaction.type === "Payment" 
                                  ? getPaymentMethodDisplay(transaction)
                                  : (transaction.method || "N/A"),
                                Screenshot: {
                                  render: () => transaction.screenshot ? (
                                    <a 
                                      href={transaction.screenshot} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ color: "#5a31ea", textDecoration: "none" }}
                                      title="View screenshot"
                                      aria-label="View screenshot"
                                    >
                                      <i className="fas fa-image" aria-hidden="true"></i>
                                    </a>
                                  ) : "N/A"
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
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                                          title="View Invoice"
                                        >
                                          <i className="fas fa-eye" aria-hidden="true"></i>
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
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
                    <button
                      className="secondary-btn"
                      onClick={handleSecureExportCSV}
                      disabled={!isFinanceRole}
                      title={isFinanceRole ? "Export CSV" : "Export allowed only for finance roles"}
                    >
                      📥 Export CSV
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={handleSecureExportPDF}
                      disabled={!isFinanceRole}
                      title={isFinanceRole ? "Export PDF" : "Export allowed only for finance roles"}
                    >
                      📄 Export PDF
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        // Force re-render by updating date range slightly
                        setDateRange({ ...dateRange });
                        showToast("Report refreshed with latest data");
                      }}
                    >
                      🔄 Refresh Data
                    </button>
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
                <div className="card">
                  <div style={{ padding: "24px" }}>
                    <div style={{ marginBottom: "24px" }}>
                      <h4 style={{ marginBottom: "12px" }}>Export Options</h4>
                      <p style={{ color: "#666", marginBottom: "20px" }}>
                        Export your financial data in CSV or PDF format. Select a date range to export specific periods.
                      </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                      <div className="card" style={{ padding: "20px", background: "linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)" }}>
                        <h4 style={{ marginBottom: "8px", fontSize: "1rem" }}>📥 CSV Export</h4>
                        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "16px" }}>
                          Export all transactions as a CSV file for Excel or spreadsheet applications.
                        </p>
                        <button
                          className="secondary-btn"
                          onClick={handleSecureExportCSV}
                          style={{ width: "100%" }}
                          disabled={!isFinanceRole}
                          title={isFinanceRole ? "Export CSV" : "Export allowed only for finance roles"}
                        >
                          <i className="fas fa-file-csv" style={{ marginRight: "8px" }}></i>
                          Export CSV
                        </button>
                      </div>

                      <div className="card" style={{ padding: "20px", background: "linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)" }}>
                        <h4 style={{ marginBottom: "8px", fontSize: "1rem" }}>📄 PDF Export</h4>
                        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "16px" }}>
                          Generate a formatted PDF report with charts and summaries.
                        </p>
                        <button
                          className="secondary-btn"
                          onClick={handleSecureExportPDF}
                          style={{ width: "100%" }}
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
                <div className="card">
                  <div style={{ padding: "24px" }}>
                    <div style={{ marginBottom: "20px" }}>
                      <h4 style={{ marginBottom: "12px" }}>Available Roles</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
                        <div style={{ padding: "16px", background: "#f8f9ff", borderRadius: "8px", border: "2px solid #5a31ea" }}>
                          <h5 style={{ margin: "0 0 8px 0", color: "#5a31ea" }}>Admin</h5>
                          <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
                            Full access to all features and settings
                          </p>
                        </div>
                        <div style={{ padding: "16px", background: "#f8f9ff", borderRadius: "8px" }}>
                          <h5 style={{ margin: "0 0 8px 0" }}>Finance</h5>
                          <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
                            Can manage finances, invoices, and payments
                          </p>
                        </div>
                        <div style={{ padding: "16px", background: "#f8f9ff", borderRadius: "8px" }}>
                          <h5 style={{ margin: "0 0 8px 0" }}>Staff</h5>
                          <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
                            Can manage members and view reports, no financial exports
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
                        columns={["Name", "Email", "Role", "Status", "Actions"]}
                        rows={admins.map((admin) => ({
                          Name: admin.name || "N/A",
                          Email: admin.email || "N/A",
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
                                <button
                                  className="ghost-btn icon-btn icon-btn--edit"
                                  onClick={async () => {
                                    try {
                                      // Cycle through the 4 allowed roles: Admin -> Finance -> Staff -> Viewer -> Admin
                                      const roleOrder = ["Admin", "Finance", "Staff", "Viewer"];
                                      const currentRole = admin.role || "Viewer";
                                      const currentIndex = roleOrder.indexOf(currentRole);
                                      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % roleOrder.length;
                                      const newRole = roleOrder[nextIndex];
                                      await updateAdminUser(admin.id, { role: newRole });
                                      showToast(`${admin.name}'s role updated to ${newRole}`);
                                    } catch (error) {
                                      showToast(error.message || "Failed to update role", "error");
                                    }
                                  }}
                                  title="Change Role"
                                >
                                  <i className="fas fa-sync-alt" aria-hidden="true"></i>
                                </button>
                                {(admin.role || 'Viewer') !== "Admin" && (
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
            {activeSection === "settings" && isAdmin && (
              <article className="screen-card" id="settings">
                <header className="screen-card__header">
                  <div>
                    {renderBreadcrumb("settings")}
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
                          className="settings-card__add-btn secondary-btn"
                          onClick={() => {
                            if (!isAdmin) {
                              showToast("Only Admin can add new admin users", "error");
                              return;
                            }
                            setShowAdminForm(true);
                            setAdminForm({ name: "", email: "", password: "", role: "Viewer", status: "Active" });
                          }}
                          disabled={!isAdmin}
                          title={isAdmin ? "Add a new admin user" : "Only Admin can add admins"}
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
                              <div className="settings-table__actions">
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
                                {(user.role || 'Viewer') !== "Admin" && (
                                  <button
                                    className="ghost-btn settings-table__action-btn settings-table__action-btn--danger"
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
                                  >
                                    Remove
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
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0, 0, 0, 0.45)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10000,
                      padding: "20px",
                    }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setShowAdminForm(false);
                      }
                    }}
                  >
                    <div
                      className="card"
                      style={{
                        maxWidth: "600px",
                        width: "100%",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        background: "#f9fafb",
                        position: "relative",
                        padding: "24px 24px 20px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "16px",
                        }}
                      >
                        <h4
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            margin: 0,
                          }}
                        >
                          <i className="fas fa-user-plus" aria-hidden="true"></i>
                          Add New Admin
                        </h4>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setShowAdminForm(false)}
                          style={{ fontSize: "1.2rem", lineHeight: 1 }}
                          aria-label="Close add admin form"
                        >
                          ×
                        </button>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!adminForm.name) {
                            showToast("Please enter admin name", "error");
                            return;
                          }
                          if (!adminForm.email) {
                            showToast("Please enter admin email", "error");
                            return;
                          }
                          if (!adminForm.password) {
                            showToast("Please enter admin password", "error");
                            return;
                          }
                          try {
                            await addAdminUser(adminForm);
                            setShowAdminForm(false);
                            setAdminForm({ name: "", email: "", password: "", role: "Viewer", status: "Active" });
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
                              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                              placeholder="Enter admin name"
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
                              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                              placeholder="Enter admin email"
                            />
                          </label>
                        </div>
                        <div className="settings-form__group">
                          <label className="settings-form__label">
                            Password
                            <input
                              type="password"
                              className="settings-form__input"
                              required
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                              placeholder="Set a password"
                            />
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
                              <option>Admin</option>
                              <option>Finance</option>
                              <option>Staff</option>
                              <option>Viewer</option>
                            </select>
                          </label>
                        </div>

                        <div className="settings-form__actions">
                          <button
                            type="button"
                            className="ghost-btn settings-form__cancel"
                            onClick={() => setShowAdminForm(false)}
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
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPaymentModal(false);
              setPaymentModalInvoice(null);
              setPaymentModalData({
                paymentMethod: "Admin",
                imageFile: null,
                imagePreview: null,
                imageUrl: "",
              });
            }
          }}
        >
          <div 
            className="card"
            style={{
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
                <i className="fas fa-money-bill-wave" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                Pay Invoice #{paymentModalInvoice.id}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentModalInvoice(null);
                  setPaymentModalData({
                    paymentMethod: "Admin",
                    imageFile: null,
                    imagePreview: null,
                    imageUrl: "",
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
                  e.target.style.background = "#f0f0f0";
                  e.target.style.color = "#333";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.color = "#666";
                }}
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
                  <span style={{ color: "#666", fontSize: "0.875rem" }}>Period:</span>
                  <span style={{ color: "#1a1a1a" }}>{paymentModalInvoice.period}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666", fontSize: "0.875rem" }}>Due Date:</span>
                  <span style={{ color: "#1a1a1a" }}>{paymentModalInvoice.due}</span>
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
                      paymentMethod: "Admin" 
                    })}
                    style={{
                      flex: "1",
                      minWidth: "150px",
                      padding: "12px 20px",
                      borderRadius: "8px",
                      border: "none",
                      background: paymentModalData.paymentMethod === "Admin" 
                        ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" 
                        : "#f8f9ff",
                      color: paymentModalData.paymentMethod === "Admin" ? "#ffffff" : "#1a1a1a",
                      boxShadow: paymentModalData.paymentMethod === "Admin" 
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
                    <i className="fas fa-user-shield"></i>
                    Paid to Admin
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
                      border: "none",
                      background: paymentModalData.paymentMethod === "Online" 
                        ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" 
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
                    Paid Online
                  </button>
                </div>
              </div>

              {/* Reference Number Field - Only shown for Online payments */}
              {paymentModalData.paymentMethod === "Online" && (
                <div>
                  <label style={{ 
                    display: "block", 
                    fontSize: "0.875rem", 
                    fontWeight: "600", 
                    color: "#333", 
                    marginBottom: "8px" 
                  }}>
                    Reference Number <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentModalData.reference}
                    onChange={(e) => setPaymentModalData({
                      ...paymentModalData,
                      reference: e.target.value
                    })}
                    placeholder="Enter payment reference number"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#5a31ea";
                      e.target.style.boxShadow = "0 0 0 3px rgba(90, 49, 234, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e0e0e0";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
              )}

              {/* Attachment Upload - Required for both payment methods */}
              {(paymentModalData.paymentMethod === "Admin" || paymentModalData.paymentMethod === "Online") && (
                <div>
                  <label style={{ 
                    display: "block", 
                    fontSize: "0.875rem", 
                    fontWeight: "600", 
                    color: "#333", 
                    marginBottom: "12px" 
                  }}>
                    Attachment Image <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                <div style={{ 
                  border: "2px dashed #d0d0d0",
                  borderRadius: "8px",
                  padding: "20px",
                  textAlign: "center",
                  background: "#fafafa",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#5a31ea";
                  e.currentTarget.style.background = "#f8f9ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#d0d0d0";
                  e.currentTarget.style.background = "#fafafa";
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
                      setPaymentModalData(prev => ({
                        ...prev,
                        imageFile: file,
                        imagePreview: reader.result,
                      }));
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
                          borderRadius: "8px",
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
                    });
                  }}
                  disabled={uploadingPaymentModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={
                    uploadingPaymentModal || 
                    !paymentModalData.paymentMethod || 
                    (!paymentModalData.imageFile && !paymentModalInvoice.screenshot) ||
                    (paymentModalData.paymentMethod === "Online" && !paymentModalData.reference.trim())
                  }
                  onClick={async () => {
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

                          // Validate required fields
                          if (!imageUrl) {
                            throw new Error("Image upload is required for all payments");
                          }

                          if (paymentModalData.paymentMethod === "Online" && !paymentModalData.reference.trim()) {
                            throw new Error("Reference number is required for online payments");
                          }

                          // Update invoice with screenshot if image was uploaded
                          if (imageUrl && imageUrl !== paymentModalInvoice.screenshot) {
                            await updateInvoice(paymentModalInvoice.id, {
                              screenshot: imageUrl,
                            });
                          }

                          // Mark invoice as paid with reference number
                          const paymentMethod = paymentModalData.paymentMethod === "Admin" ? "Cash" : "Online";
                          const referenceNumber = paymentModalData.paymentMethod === "Online" 
                            ? paymentModalData.reference.trim() 
                            : null;
                          await handleMarkAsPaid(paymentModalInvoice.id, paymentMethod, imageUrl, referenceNumber);

                          // Close modal and reset
                          setShowPaymentModal(false);
                          setPaymentModalInvoice(null);
                          setPaymentModalData({
                            paymentMethod: "",
                            imageFile: null,
                            imagePreview: null,
                            imageUrl: "",
                            reference: "",
                          });

                          showToast(`Invoice #${paymentModalInvoice.id} marked as paid!`, "success");
                        } catch (error) {
                          console.error("Error processing payment:", error);
                          showToast(error.message || "Failed to process payment", "error");
                        } finally {
                          setUploadingPaymentModal(false);
                        }
                      }
                    );
                  }}
                  style={{
                    opacity: (uploadingPaymentModal || 
                      !paymentModalData.paymentMethod || 
                      (!paymentModalData.imageFile && !paymentModalInvoice.screenshot) ||
                      (paymentModalData.paymentMethod === "Online" && !paymentModalData.reference.trim())) ? 0.6 : 1,
                    cursor: (uploadingPaymentModal || 
                      !paymentModalData.paymentMethod || 
                      (!paymentModalData.imageFile && !paymentModalInvoice.screenshot) ||
                      (paymentModalData.paymentMethod === "Online" && !paymentModalData.reference.trim())) ? "not-allowed" : "pointer",
                  }}
                >
                  {uploadingPaymentModal ? "Processing..." : "Mark as Paid"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPaymentDetailsModal && selectedPaymentDetails && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPaymentDetailsModal(false);
              setSelectedPaymentDetails(null);
            }
          }}
        >
          <div 
            className="card"
            style={{
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
                <i className="fas fa-receipt" style={{ marginRight: "8px", color: "#5a31ea" }}></i>
                Payment Details
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentDetailsModal(false);
                  setSelectedPaymentDetails(null);
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
                  e.target.style.background = "#f0f0f0";
                  e.target.style.color = "#333";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.color = "#666";
                }}
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
                      className={`badge ${
                        selectedPaymentDetails.status === "Paid" ||
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
                              <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
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
                            <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
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

      <SiteFooter />
    </>
  );
}
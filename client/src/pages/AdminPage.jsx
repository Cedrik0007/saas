import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { useApp } from "../context/AppContext.jsx";
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
    donations,
    fetchDonations,
    addDonation,
    deleteDonation,
    loading,
  } = useApp();

  const sections = [
    { id: "dashboard", label: "Dashboard" },
    { id: "members", label: "Members" },
    { id: "member-detail", label: "Member Detail" },
    { id: "invoice-builder", label: "Invoice Builder" },
    { id: "automation", label: "Reminders" },
    { id: "payment-methods", label: "Payments" },
    { id: "payment-approvals", label: "Payment Approvals" },
    { id: "donations", label: "Donations" },
    { id: "reports", label: "Reports" },
    { id: "settings", label: "Settings" },
  ];

  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [activeTab, setActiveTab] = useState("Invoices");
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Form states
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    status: "Active",
    balance: "$0",
    nextDue: "",
    lastPayment: "",
    subscriptionType: "Monthly",
  });
  
  const [showMemberPassword, setShowMemberPassword] = useState(false);

  const [adminsForm, setAdminsForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    memberId: "",
    period: "",
    amount: "50",
    invoiceType: "Monthly",
    due: "",
    notes: "",
  });

  const [showDonationForm, setShowDonationForm] = useState(false);
  const [donationForm, setDonationForm] = useState({
    donorName: "",
    isMember: false,
    memberId: "",
    amount: "",
    notes: "",
  });

  const [orgForm, setOrgForm] = useState(organizationInfo);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: "", role: "Viewer", status: "Active" });
  
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
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [sendingEmails, setSendingEmails] = useState({}); // Track which member is sending
  const [sendingToAll, setSendingToAll] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState({}); // Track which member is sending WhatsApp
  const [sendingWhatsAppToAll, setSendingWhatsAppToAll] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All"); // All, Pending, Completed, Rejected
  const [reportFilter, setReportFilter] = useState("all"); // all, payments, donations
  const [donorTypeFilter, setDonorTypeFilter] = useState("all"); // all, member, non-member
  const [memberSearchTerm, setMemberSearchTerm] = useState(""); // Search filter for members
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

  const navigate = useNavigate();

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
    // Monthly: $50/month, Yearly: $500/year
    const activeMembers = members.filter(m => m.status === 'Active');
    let expected = 0;
    
    activeMembers.forEach(member => {
      const subscriptionType = member.subscriptionType || 'Monthly';
      // Try to get member creation date or use a default
      const memberStartDate = member.createdAt ? new Date(member.createdAt) : new Date('2025-01-01');
      
      if (subscriptionType === 'Yearly') {
        // For yearly: $500 per year
        // Calculate how many years in the date range
        const rangeStart = Math.max(fromDate.getTime(), memberStartDate.getTime());
        const rangeEnd = toDate.getTime();
        const yearsInRange = Math.max(0, (rangeEnd - rangeStart) / (365.25 * 24 * 60 * 60 * 1000));
        expected += Math.ceil(yearsInRange) * 500;
      } else {
        // For monthly: $50 per month
        const rangeStart = Math.max(fromDate.getTime(), memberStartDate.getTime());
        const rangeEnd = toDate.getTime();
        const monthsInRange = Math.max(0, (rangeEnd - rangeStart) / (30.44 * 24 * 60 * 60 * 1000));
        expected += Math.ceil(monthsInRange) * 50;
      }
    });

    // If no expected calculated, use a default based on active members
    if (expected === 0 && activeMembers.length > 0) {
      // Default: assume monthly subscription for all
      const monthsInRange = Math.ceil((toDate - fromDate) / (30.44 * 24 * 60 * 60 * 1000));
      expected = activeMembers.length * 50 * monthsInRange;
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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

  // Save email template
  const handleSaveEmailTemplate = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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
        showToast(`Reminder email sent to ${members.find(m => m.id === memberId)?.name || 'member'}!`);
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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

      const apiUrl = import.meta.env.VITE_API_URL || '';
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
    if (!window.confirm("Are you sure you want to delete this payment? This action cannot be undone.")) {
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
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
  };

  // Send reminder to all outstanding members
  const handleSendToAllOutstanding = async () => {
    if (!emailSettings.emailUser || !emailSettings.emailPassword) {
      showToast('Please configure email credentials first', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to send reminder emails to ALL outstanding members?')) {
      return;
    }

    setSendingToAll(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
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

    if (!window.confirm(`Are you sure you want to open WhatsApp for ${outstandingMembers.length} outstanding members? This will open multiple WhatsApp windows.`)) {
      return;
    }

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
          
          // Log to communication
          const comm = {
            channel: "WhatsApp",
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

  const handleNavClick = (id) => {
    console.log('Navigating to section:', id);
    setActiveSection(id);
    setShowMemberForm(false);
    setShowInvoiceForm(false);
    setShowDonationForm(false);
    // Close mobile menu when navigating
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    navigate("/login", { replace: true });
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Member CRUD Operations
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberForm.name || !memberForm.email) {
      showToast("Please fill all required fields", "error");
      return;
    }
    try {
      await addMember(memberForm);
      setMemberForm({
        name: "",
        email: "",
        phone: "",
        status: "Active",
        balance: "$0",
        nextDue: "",
        lastPayment: "",
        subscriptionType: "Monthly",
      });
      setShowMemberForm(false);
      showToast("Member added successfully!");
    } catch (error) {
      showToast("Failed to add member. Please try again.", "error");
    }
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setMemberForm({
      ...member,
      password: "", // Don't pre-fill password for security
      subscriptionType: member.subscriptionType || "Monthly",
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
        subscriptionType: "Monthly",
      });
      setShowMemberForm(false);
      showToast("Member updated successfully!");
    } catch (error) {
      showToast("Failed to update member. Please try again.", "error");
    }
  };

  const handleDeleteMember = async (id) => {
    if (window.confirm("Are you sure you want to delete this member?")) {
      try {
        await deleteMember(id);
        showToast("Member deleted successfully!");
      } catch (error) {
        showToast("Failed to delete member. Please try again.", "error");
      }
    }
  };

  // Invoice CRUD Operations
  const handleAddInvoice = (e) => {
    e.preventDefault();
    if (!invoiceForm.memberId || !invoiceForm.period || !invoiceForm.due) {
      showToast("Please fill all required fields", "error");
      return;
    }

    const member = members.find((m) => m.id === invoiceForm.memberId);
    const newInvoice = {
      memberId: invoiceForm.memberId,
      memberName: member?.name || "",
      period: invoiceForm.period,
      amount: `$${invoiceForm.amount}`,
      status: "Unpaid",
      due: invoiceForm.due,
      method: "-",
      reference: "-",
    };

    addInvoice(newInvoice);
    setInvoiceForm({
      memberId: "",
      period: "",
      amount: "50",
      invoiceType: "Monthly",
      due: "",
      notes: "",
    });
    setShowInvoiceForm(false);
    showToast("Invoice created successfully!");
  };

  const handleMarkAsPaid = async (invoiceId, method = "Cash") => {
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
      
      // Map UI method to stored payment method + reference prefix
      let paymentMethod = "Cash to Admin";
      let referencePrefix = "CASH";
      if (method === "Online") {
        paymentMethod = "Online Payment";
        referencePrefix = "ONL";
      }
      const reference = `${referencePrefix}_${Date.now()}`;
      const apiUrl = import.meta.env.VITE_API_URL || '';

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
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      deleteInvoice(id);
      showToast("Invoice deleted successfully!");
    }
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

    // Log to communication
    const comm = {
      channel: "WhatsApp",
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

      const apiUrl = import.meta.env.VITE_API_URL || '';
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

      // Log to communication
      const comm = {
        channel: "Email",
        message: `Payment reminder: ${memberData.name} (${memberData.email}) - $${totalDue.toFixed(2)} due (${memberUnpaidInvoices.length} invoice${memberUnpaidInvoices.length > 1 ? "s" : ""})`,
        status: "Delivered",
      };
      addCommunication(comm);

      showToast(
        `✓ Reminder email sent to ${memberData.name} for $${totalDue.toFixed(2)} outstanding!`
      );
    } catch (error) {
      console.error("✗ Email send error:", error);

      // Log failed attempt
      const comm = {
        channel: "Email",
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
      const apiUrl = import.meta.env.VITE_API_URL || '';
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
            <p className="eyebrow light">Admin Portal</p>
            <h3>Finance Operations</h3>
            <nav>
              {sections.map((section) => (
                <button
                  key={section.id}
                  className={`admin-tab ${activeSection === section.id ? "active" : ""}`}
                  onClick={() => {
                    console.log('Clicking section:', section.id, section.label);
                    handleNavClick(section.id);
                    setIsMobileMenuOpen(false); // Close menu on section click
                  }}
                >
                  {section.label}
                </button>
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
                    <div className="card kpi">
                      <p><i className="fas fa-users" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Total Members</p>
                      <h4>{members.length}</h4>
                      <small>Active members</small>
                    </div>
                    <div className="card kpi">
                      <p><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#10b981" }}></i>Total Collected</p>
                      <h4>${dashboardMetrics.collectedMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                      <small>${dashboardMetrics.collectedYear.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} YTD</small>
                    </div>
                    <div className="card kpi">
                      <p><i className="fas fa-exclamation-triangle" style={{ marginRight: "8px", color: "#f59e0b" }}></i>Total Outstanding</p>
                      <h4>${dashboardMetrics.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                      <small>Expected ${dashboardMetrics.expectedAnnual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                    <div className="card kpi">
                      <p><i className="fas fa-exclamation-circle" style={{ marginRight: "8px", color: "#ef4444" }}></i>Overdue Members</p>
                      <h4>{dashboardMetrics.overdueMembers}</h4>
                      <small>Requires attention</small>
                    </div>
                  </div>

                  <div className="card chart-card">
                    <div className="card-header">
                      <div>
                        <h4><i className="fas fa-chart-bar" style={{ marginRight: "8px" }}></i>Monthly Collections · Last 12 Months</h4>
                        <p>Expected contribution is $800 per member per year</p>
                      </div>
                    </div>
                    <div 
                      className="chart" 
                      style={{ position: "relative" }}
                      onMouseMove={(e) => {
                        if (hoveredMonth) {
                          setMousePosition({ x: e.clientX, y: e.clientY });
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
                            setMousePosition({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseMove={(e) => {
                            if (hoveredMonth?.monthKey === item.monthKey) {
                              setMousePosition({ x: e.clientX, y: e.clientY });
                            }
                          }}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                        </div>
                      ))}
                      {hoveredMonth && (
                        <div style={{
                          position: "fixed",
                          left: `${mousePosition.x + 10}px`,
                          top: `${mousePosition.y - 40}px`,
                          padding: "8px 12px",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          whiteSpace: "nowrap",
                          zIndex: 1000,
                          pointerEvents: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                        }}>
                          {hoveredMonth.month} {new Date().getFullYear()}: ${hoveredMonth.value.toFixed(2)}
                          {hoveredMonth.count > 0 && ` (${hoveredMonth.count} payment${hoveredMonth.count > 1 ? 's' : ''})`}
                        </div>
                      )}
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
                          if (window.confirm("This will reset all data to initial values from data.js. Continue?")) {
                            resetAllData();
                            showToast("Data reset! Showing fresh data from data.js");
                            window.location.reload();
                          }
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
                          setMemberForm({
                            name: "",
                            email: "",
                            phone: "",
                            status: "Active",
                            balance: "$0",
                            nextDue: "",
                            lastPayment: "",
                            subscriptionType: "Monthly",
                          });
                        }}
                      >
                        + Add Member
                      </button>
                    </div>
                  </div>
                </header>

                {/* Member Form */}
                {showMemberForm && (
                  <div className="card" style={{ marginBottom: "20px", background: "#f9fafb" }}>
                    <h4>{editingMember ? "Edit Member" : "Add New Member"}</h4>
                    <form className="form-grid" onSubmit={editingMember ? handleUpdateMember : handleAddMember}>
                      <label>
                        Name *
                        <input
                          type="text"
                          required
                          value={memberForm.name}
                          onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                        />
                      </label>
                      <label>
                        Email *
                        <input
                          type="email"
                          required
                          value={memberForm.email}
                          onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                        />
                      </label>
                      <label>
                        Phone
                        <input
                          type="tel"
                          value={memberForm.phone}
                          onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                        />
                      </label>
                      <label>
                        Password {editingMember ? "(leave blank to keep current)" : "*"}
                        <div style={{ position: "relative" }}>
                          <input
                            type={showMemberPassword ? "text" : "password"}
                            required={!editingMember}
                            value={memberForm.password}
                            onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                            placeholder={editingMember ? "Enter new password or leave blank" : "Enter password for member"}
                            style={{ paddingRight: "40px" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowMemberPassword(!showMemberPassword)}
                            style={{
                              position: "absolute",
                              right: "8px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 8px",
                              color: "#666",
                              fontSize: "0.875rem"
                            }}
                            title={showMemberPassword ? "Hide password" : "Show password"}
                          >
                            {showMemberPassword ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </label>
                      <label>
                        Status
                        <select
                          value={memberForm.status}
                          onChange={(e) => setMemberForm({ ...memberForm, status: e.target.value })}
                        >
                          <option>Active</option>
                          <option>Inactive</option>
                        </select>
                      </label>
                      <label>
                        Subscription Type
                        <select
                          value={memberForm.subscriptionType || "Monthly"}
                          onChange={(e) => setMemberForm({ ...memberForm, subscriptionType: e.target.value })}
                        >
                          <option value="Monthly">Monthly - $50/month</option>
                          <option value="Yearly">Yearly - $500/year</option>
                        </select>
                      </label>
                      <label>
                        balance
                        <input
                          type="text"
                          value={memberForm.balance}
                          onChange={(e) => setMemberForm({ ...memberForm, balance: e.target.value })}
                        />
                      </label>
                      <label>
                        Next Due Date
                        <input
                          type="text"
                          value={memberForm.nextDue}
                          onChange={(e) => setMemberForm({ ...memberForm, nextDue: e.target.value })}
                        />
                      </label>
                      <label>
                        Last Payment Date
                        <input
                          type="text"
                          value={memberForm.lastPayment}
                          onChange={(e) => setMemberForm({ ...memberForm, lastPayment: e.target.value })}
                        />
                      </label>
                      <div className="form-actions">
                        < button type="button" className="ghost-btn" onClick={() => setShowMemberForm(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="primary-btn">
                          {editingMember ? "Update" : "Add"} Member
                        </button>
                      </div>
                    </form>
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
                                📅 Subscription: {member.subscriptionType || 'Monthly'}
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
                      // Filter members based on search term
                      const filteredMembers = members.filter(member => 
                        !memberSearchTerm || 
                        member.name?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                      );
                      
                      // Calculate pagination
                      const totalPages = Math.ceil(filteredMembers.length / membersPageSize) || 1;
                      const currentPage = Math.min(membersPage, totalPages);
                      const startIndex = (currentPage - 1) * membersPageSize;
                      const endIndex = startIndex + membersPageSize;
                      const paginatedMembers = filteredMembers.slice(startIndex, endIndex);
                      
                      return (
                        <>
                          <Table
                            columns={[
                              "ID",
                              "Name",
                              "Email",
                              "WhatsApp",
                              "Status",
                              "Balance",
                              "Actions",
                            ]}
                            rows={paginatedMembers.map((member) => ({
                              ID: member.id,
                              Name: member.name,
                              Email: member.email,
                              WhatsApp: member.phone,
                              Status: {
                                render: () => (
                                  <span className={statusClass[member.status]}>
                                    {member.status}
                                  </span>
                                ),
                              },
                              Balance: member.balance,
                              Actions: {
                                render: () => (
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {member.status === 'Pending' && (
                                      <button
                                        className="primary-btn"
                                        style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                                        onClick={() => handleApproveMember(member.id)}
                                      >
                                        ✓ Approve
                                      </button>
                                    )}
                                    <button
                                      className="ghost-btn"
                                      style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                                      onClick={() => handleViewMemberDetail(member)}
                                    >
                                      View
                                    </button>
                                    <button
                                      className="secondary-btn"
                                      style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                                      onClick={() => handleEditMember(member)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="ghost-btn"
                                      style={{ padding: "6px 12px", fontSize: "0.85rem", color: "#ef4444" }}
                                      onClick={() => handleDeleteMember(member.id)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ),
                              },
                            }))}
                          />
                          {totalPages > 0 && filteredMembers.length > 0 && (
                            <Pagination
                              currentPage={currentPage}
                              totalPages={totalPages}
                              onPageChange={setMembersPage}
                              pageSize={membersPageSize}
                              onPageSizeChange={setMembersPageSize}
                              totalItems={filteredMembers.length}
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
                  <h3>Member Detail</h3>
                  <p>360º view with invoices, payment history, communications.</p>
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
                        className="secondary-btn"
                        onClick={() => handleSendWhatsAppReminder(selectedMember)}
                        title="Send reminder via WhatsApp"
                      >
                        📱 WhatsApp
                      </button>
                      <button
                        className="primary-btn"
                        onClick={() => handleSendReminder(selectedMember)}
                        title="Send reminder via Email"
                      >
                        📧 Email
                      </button>
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
                        rows={getMemberInvoices(selectedMember.id).map((invoice) => ({
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
                                📷 View
                              </button>
                            )
                          } : "-",
                          Actions: {
                            render: () => (
                              <div style={{ display: "flex", gap: "8px" }}>
                                {invoice.status !== "Paid" && (
                                  <>
                                    <button
                                      className="secondary-btn"
                                      style={{ padding: "4px 10px", fontSize: "0.85rem" }}
                                      onClick={() => {
                                        if (window.confirm(`Mark invoice ${invoice.id} as paid (Cash)?`)) {
                                          handleMarkAsPaid(invoice.id, "Cash");
                                        }
                                      }}
                                    >
                                      Paid (Cash)
                                    </button>
                                    <button
                                      className="secondary-btn"
                                      style={{ padding: "4px 10px", fontSize: "0.85rem" }}
                                      onClick={() => {
                                        if (window.confirm(`Mark invoice ${invoice.id} as paid (Online)?`)) {
                                          handleMarkAsPaid(invoice.id, "Online");
                                        }
                                      }}
                                    >
                                      Paid (Online)
                                    </button>
                                  </>
                                )}
                                <button
                                  className="ghost-btn"
                                  style={{ padding: "4px 10px", fontSize: "0.85rem", color: "#ef4444" }}
                                  onClick={() => handleDeleteInvoice(invoice.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            ),
                          },
                        }))}
                      />
                    </div>
                  )}

                  {activeTab === "Payment History" && (
                    <div className="tab-panel">
                      {(() => {
                        // Filter payment history for selected member
                        const memberPayments = paymentHistory.filter((payment) => 
                          payment.memberId === selectedMember.id || 
                          payment.memberEmail === selectedMember.email || 
                          payment.member === selectedMember.name
                        ).sort((a, b) => {
                          // Sort by date, newest first
                          const dateA = new Date(a.date || 0);
                          const dateB = new Date(b.date || 0);
                          return dateB - dateA;
                        });

                        if (memberPayments.length === 0) {
                          return (
                            <div style={{ 
                              textAlign: "center", 
                              padding: "40px 20px",
                              color: "#666"
                            }}>
                              <p style={{ margin: 0, fontSize: "1rem" }}>No payment history available for this member.</p>
                            </div>
                          );
                        }

                        return (
                          <div style={{ 
                            display: "grid", 
                            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", 
                            gap: "20px" 
                          }}>
                            {memberPayments.map((item, idx) => (
                              <div 
                                key={idx}
                                style={{
                                  background: "#fff",
                                  border: "none",
                                  borderRadius: "12px",
                                  padding: "20px",
                                  transition: "all 0.3s ease",
                                  boxShadow: "0 2px 8px rgba(90, 49, 234, 0.08)"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(90, 49, 234, 0.15)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(90, 49, 234, 0.08)";
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                                  <div>
                                    <div style={{ 
                                      fontSize: "0.75rem", 
                                      color: "#666", 
                                      textTransform: "uppercase", 
                                      letterSpacing: "0.5px",
                                      marginBottom: "4px"
                                    }}>
                                      {item.date || "N/A"}
                                    </div>
                                    <div style={{ 
                                      fontSize: "1.5rem", 
                                      fontWeight: "700", 
                                      color: "#000",
                                      marginBottom: "4px"
                                    }}>
                                      {item.amount || "$0"}
                                    </div>
                                  </div>
                                  <span className={`badge ${item.status === "Paid" ? "badge-paid" : item.status === "Pending Verification" ? "badge-pending" : "badge-unpaid"}`} style={{ fontSize: "0.75rem", padding: "4px 10px" }}>
                                    {item.status || "Paid"}
                                  </span>
                                </div>
                                
                                <div style={{ 
                                  display: "flex", 
                                  flexDirection: "column", 
                                  gap: "8px",
                                  paddingTop: "16px",
                                  borderTop: "1px solid #f0f0f0"
                                }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.875rem", color: "#666" }}>Method:</span>
                                    <strong style={{ fontSize: "0.875rem" }}>{getPaymentMethodDisplay(item)}</strong>
                                  </div>
                                  {item.reference && item.reference !== "N/A" && item.reference !== "-" && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "0.875rem", color: "#666" }}>Reference:</span>
                                      <strong style={{ fontSize: "0.875rem", fontFamily: "monospace" }}>{item.reference}</strong>
                                    </div>
                                  )}
                                  {item.paidToAdminName && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "0.875rem", color: "#666" }}>Paid to:</span>
                                      <strong style={{ fontSize: "0.875rem" }}>{item.paidToAdminName}</strong>
                                    </div>
                                  )}
                                  {item.period && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "0.875rem", color: "#666" }}>Period:</span>
                                      <strong style={{ fontSize: "0.875rem" }}>{item.period}</strong>
                                    </div>
                                  )}
                                  {item.member && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "0.875rem", color: "#666" }}>Member:</span>
                                      <strong style={{ fontSize: "0.875rem" }}>{item.member}</strong>
                                    </div>
                                  )}
                                </div>
                                
                                {item.screenshot && (
                                  <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f0f0f0" }}>
                                    <button
                                      onClick={() => {
                                        const newWindow = window.open();
                                        if (newWindow) {
                                          newWindow.document.write(`
                                            <html>
                                              <head><title>Payment Screenshot</title></head>
                                              <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                                <img src="${item.screenshot}" alt="Payment Screenshot" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                                              </body>
                                            </html>
                                          `);
                                        }
                                      }}
                                      style={{
                                        width: "100%",
                                        padding: "10px 16px",
                                        background: "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontSize: "0.875rem",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        boxShadow: "0 2px 8px rgba(90, 49, 234, 0.3)"
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.background = "linear-gradient(135deg, #4a28d0 0%, #6b3fff 100%)";
                                        e.target.style.boxShadow = "0 4px 12px rgba(90, 49, 234, 0.4)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.background = "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)";
                                        e.target.style.boxShadow = "0 2px 8px rgba(90, 49, 234, 0.3)";
                                      }}
                                    >
                                      <span style={{ color: "#ffffff" }}>📷</span>
                                      <span style={{ color: "#ffffff" }}>View Screenshot</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {activeTab === "Communication" && (
                    <div className="tab-panel">
                      {(() => {
                        // Filter communication log for selected member
                        const memberCommunications = communicationLog.filter((comm) => 
                          comm.memberId === selectedMember.id || 
                          comm.memberEmail === selectedMember.email || 
                          comm.memberName === selectedMember.name ||
                          comm.member === selectedMember.name
                        ).sort((a, b) => {
                          // Sort by date, newest first
                          const dateA = new Date(a.date || 0);
                          const dateB = new Date(b.date || 0);
                          return dateB - dateA;
                        });

                        if (memberCommunications.length === 0) {
                          return (
                            <div style={{ 
                              textAlign: "center", 
                              padding: "40px 20px",
                              color: "#666"
                            }}>
                              <p style={{ margin: 0, fontSize: "1rem" }}>No communication history available for this member.</p>
                            </div>
                          );
                        }

                        return (
                          <ul className="timeline">
                            {memberCommunications.map((item, idx) => (
                              <li key={idx}>
                                <p>
                                  {item.channel || "N/A"} · {item.message || "N/A"} · {item.date || "N/A"}
                                </p>
                                <span className={statusClass[item.status] || "badge"}>{item.status || "N/A"}</span>
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </article>
            )}

            {/* INVOICE BUILDER */}
            {activeSection === "invoice-builder" && (
              <article className="screen-card" id="invoice-builder">
                <header className="screen-card__header">
                  <h3><i className="fas fa-file-invoice" style={{ marginRight: "10px" }}></i>Invoice Builder</h3>
                  <p>Create invoices for monthly or Eid contributions.</p>
                </header>
                <form className="card form-grid" onSubmit={handleAddInvoice} style={{ padding: "40px", background: "linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)", boxShadow: "0 4px 16px rgba(90, 49, 234, 0.1)" }}>
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
                        <i className={`fas ${showMemberDropdown ? "fa-chevron-up" : "fa-chevron-down"}`} style={{ fontSize: "0.75rem", color: "#5a31ea" }}></i>
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
                      <span style={{ fontSize: "0.75rem", color: "#d32f2f", marginTop: "4px", display: "block" }}>
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
                        const amount = type === "Monthly" ? "50" : "100";
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
                      <option value="Monthly">Monthly - $50</option>
                      <option value="Eid">Eid - $100</option>
                    </select>
                  </label>

                  <label style={{ marginBottom: "24px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-calendar" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Period *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nov 2025"
                      value={invoiceForm.period}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, period: e.target.value })}
                      className="mono-input"
                      style={{ color: "#1a1a1a" }}
                    />
                  </label>

                  <label style={{ marginBottom: "24px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1a1a", marginBottom: "12px", display: "block" }}><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount ($) *</span>
                    <input
                      type="number"
                      required
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
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
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, due: e.target.value })}
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

                        // Create the invoice object from form data
                        const newInvoice = {
                          memberId: invoiceForm.memberId,
                          memberName: member?.name || "",
                          period: invoiceForm.period,
                          amount: `$${invoiceForm.amount}`,
                          status: "Unpaid",
                          due: invoiceForm.due,
                          method: "-",
                          reference: "-",
                        };

                        // Add invoice to state
                        addInvoice(newInvoice);
                        
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

                          const apiUrl = import.meta.env.VITE_API_URL || '';
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
                            period: "",
                            amount: "50",
                            invoiceType: "Monthly",
                            due: "",
                            notes: "",
                          });
                          setShowInvoiceForm(false);

                          showToast(
                            `✓ Invoice created and reminder sent to ${member.name} for $${totalDue.toFixed(2)}!`
                          );
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
                            const apiUrl = import.meta.env.VITE_API_URL || '';
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
                        onClick={handleSendToAllOutstanding}
                        disabled={sendingToAll}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "8px",
                          fontWeight: "600",
                          opacity: sendingToAll ? 0.5 : 1,
                          cursor: sendingToAll ? "not-allowed" : "pointer"
                        }}
                      >
                        {sendingToAll ? "Sending..." : "📧 Send Email to All"}
                      </button>
                      <button
                        className="primary-btn"
                        onClick={handleSendWhatsAppToAllOutstanding}
                        disabled={sendingWhatsAppToAll}
                        style={{
                          padding: "12px 24px",
                        
                          borderRadius: "8px",
                          fontWeight: "600",
                          backgroundColor: "#25D366",
                          borderColor: "#25D366",
                          opacity: sendingWhatsAppToAll ? 0.5 : 1,
                          cursor: sendingWhatsAppToAll ? "not-allowed" : "pointer"
                        }}
                      >
                        {sendingWhatsAppToAll ? "Opening..." : "💬 Send WhatsApp to All"}
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
                                onClick={() => handleSendManualReminder(member.id)}
                                disabled={isSending}
                                style={{
                                  padding: "10px 20px",
                                  borderRadius: "8px",
                                  fontWeight: "600",
                                  fontSize: "0.875rem",
                                  opacity: isSending ? 0.5 : 1,
                                  cursor: isSending ? "not-allowed" : "pointer"
                                }}
                              >
                                {isSending ? "Sending..." : "📧 Email"}
                              </button>
                              {member.phone && (
                                <button
                                  className="secondary-btn"
                                  onClick={() => handleSendWhatsAppReminder(member)}
                                  disabled={sendingWhatsApp[member.id]}
                                  style={{
                                    padding: "10px 20px",
                                    borderRadius: "8px",
                                    fontWeight: "600",
                                    fontSize: "0.875rem",
                                    backgroundColor: "#25D366",
                                    borderColor: "#25D366",
                                    color: "#fff",
                                    opacity: sendingWhatsApp[member.id] ? 0.5 : 1,
                                    cursor: sendingWhatsApp[member.id] ? "not-allowed" : "pointer"
                                  }}
                                >
                                  {sendingWhatsApp[member.id] ? "Opening..." : "💬 WhatsApp"}
                                </button>
                              )}
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

                          const uploadResponse = await fetch(`${apiUrl}/api/upload-screenshot`, {
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
                              {method.name === "Alipay" ? "支" 
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
                      <select
                        value={paymentStatusFilter}
                        onChange={(e) => setPaymentStatusFilter(e.target.value)}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "8px",
                          border: "1px solid #e0e0e0",
                          fontSize: "0.875rem",
                          background: "#fff",
                          cursor: "pointer"
                        }}
                      >
                        <option value="All">All Payments</option>
                        <option value="Pending">Pending Approval</option>
                        <option value="Completed">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
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

                {/* Payment Form */}
                {showPaymentForm && (
                  <div className="card" style={{ marginBottom: "20px", background: "#f9fafb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <h4>{editingPayment ? "Edit Payment" : "Add New Payment"}</h4>
                      <button
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
                              year: "numeric"
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
                    <form className="form-grid" onSubmit={editingPayment ? handleUpdatePayment : handleAddPayment}>
                      <label>
                        Member *
                        <select
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
                        Screenshot URL
                        <input
                          type="text"
                          value={paymentForm.screenshot}
                          onChange={(e) => setPaymentForm({ ...paymentForm, screenshot: e.target.value })}
                          placeholder="https://..."
                        />
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
                                      style={{ color: "#000", textDecoration: "underline", fontWeight: "500" }}
                                    >
                                      📷 View
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
                                            className="primary-btn"
                                            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                                            onClick={() => {
                                              if (paymentIdString) handleApprovePayment(paymentIdString);
                                            }}
                                          >
                                            ✓ Approve
                                          </button>
                                          <button
                                            className="ghost-btn"
                                            style={{ padding: "6px 12px", fontSize: "0.85rem", color: "#ef4444" }}
                                            onClick={() => {
                                              if (paymentIdString) handleRejectPayment(paymentIdString);
                                            }}
                                          >
                                            ✗ Reject
                                          </button>
                                        </>
                                      )}
                                      {payment.status === "Rejected" && payment.rejectionReason && (
                                        <span style={{ fontSize: "0.75rem", color: "#666", fontStyle: "italic" }}>
                                          Reason: {payment.rejectionReason}
                                        </span>
                                      )}
                                      {payment.status === "Completed" && (
                                        <span style={{ fontSize: "0.75rem", color: "#4caf50" }}>
                                          ✓ Approved by {payment.approvedBy || "Admin"}
                                        </span>
                                      )}
                                      <button
                                        className="secondary-btn"
                                        style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                                        onClick={() => handleEditPayment(payment)}
                                        title="Edit Payment"
                                      >
                                        ✏️ Edit
                                      </button>
                                      <button
                                        className="ghost-btn"
                                        style={{ padding: "6px 12px", fontSize: "0.85rem", color: "#ef4444" }}
                                        onClick={() => {
                                          if (paymentIdString) handleDeletePayment(paymentIdString);
                                        }}
                                        title="Delete Payment"
                                      >
                                        🗑️ Delete
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

                {/* Add Donation Form */}
                {showDonationForm && (
                  <div className="card" style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <h4>Add Donation</h4>
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          setShowDonationForm(false);
                          setDonationForm({
                            donorName: "",
                            isMember: false,
                            memberId: "",
                            amount: "",
                            notes: "",
                          });
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          if (!donationForm.donorName || !donationForm.amount) {
                            showToast("Please fill all required fields", "error");
                            return;
                          }
                          await addDonation(donationForm);
                          showToast("Donation added successfully!");
                          setShowDonationForm(false);
                          setDonationForm({
                            donorName: "",
                            isMember: false,
                            memberId: "",
                            amount: "",
                            notes: "",
                          });
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
                            type="text"
                            value={donationForm.amount}
                            onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })}
                            placeholder="$100"
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
                            <span>👤</span>
                            <span>Member</span>
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
                            <span>🌐</span>
                            <span>Non-Member</span>
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
                                <span style={{ fontSize: "0.75rem" }}>{showDonationMemberDropdown ? "▲" : "▼"}</span>
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
                              <span style={{ fontSize: "0.75rem", color: "#d32f2f", marginTop: "4px", display: "block" }}>
                                Please select a member
                              </span>
                            )}
                          </label>
                        </div>
                      )}
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
                              notes: "",
                            });
                            setDonationMemberSearch("");
                            setShowDonationMemberDropdown(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
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
                            <Table
                              columns={["Date", "Donor Name", "Type", "Amount", "Notes", "Actions"]}
                              rows={paginatedDonations.map((donation) => {
                                if (!donation) return null;
                                const donationDate = donation.date || 
                                  (donation.createdAt ? new Date(donation.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : "N/A");
                                
                                return {
                                  Date: donationDate,
                                  "Donor Name": donation.donorName || "Unknown",
                                  Type: donation.isMember ? (
                                    <span className="badge badge-active">Member</span>
                                  ) : (
                                    <span className="badge badge-inactive">Non-Member</span>
                                  ),
                                  Amount: donation.amount || "$0",
                                  Notes: donation.notes || "-",
                                  Actions: {
                                    render: () => (
                                      <button
                                        className="ghost-btn"
                                        style={{ padding: "6px 12px", fontSize: "0.85rem", color: "#ef4444" }}
                                        onClick={async () => {
                                          if (window.confirm("Are you sure you want to delete this donation?")) {
                                            try {
                                              const donationId = donation._id || donation.id;
                                              await deleteDonation(donationId);
                                              showToast("Donation deleted successfully!");
                                              await fetchDonations();
                                            } catch (error) {
                                              showToast(error.message || "Failed to delete donation", "error");
                                            }
                                          }
                                        }}
                                      >
                                        Delete
                                      </button>
                                    )
                                  },
                                };
                              }).filter(row => row !== null)}
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
                  <h3>Reports</h3>
                  <p>Financial overview and payment analytics.</p>
                </header>
                <div className="card reports">
                  <div className="reports-header">
                    <label>
                      Date From
                      <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                      />
                    </label>
                    <label>
                      Date To
                      <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
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

                  <div className="chart-stack" style={{ marginTop: "24px" }}>
                    <div>
                      <h4>Collected vs Outstanding</h4>
                      <div className="stacked-bar">
                        <div
                          className="collected"
                          style={{
                            width: `${Math.min(100, Math.round((reportStats.collected / (reportStats.collected + dashboardMetrics.outstanding)) * 100) || 0)}%`,
                          }}
                        >
                          Collected
                        </div>
                        <div
                          className="outstanding"
                          style={{
                            width: `${Math.max(0, 100 - Math.round((reportStats.collected / (reportStats.collected + dashboardMetrics.outstanding)) * 100) || 0)}%`,
                          }}
                        >
                          Outstanding
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4>Payment Method Breakdown</h4>
                      <ul className="donut-legend">
                        {reportStats.methodMix.map((item) => (
                          <li key={item.label}>
                            <span
                              className={`legend-dot ${item.label
                                .toLowerCase()
                                .replace(/[^a-z]/g, "")}`}
                            ></span>
                            {item.label} · {item.value}
                          </li>
                        ))}
                      </ul>
                    </div>
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
                    <h4 style={{ marginBottom: "16px" }}>Transactions</h4>
                    <div className="card">
                      <div className="table-wrapper">
                        <Table
                          columns={["Date", "Type", "Source", "Amount", "Details"]}
                          rows={(() => {
                            // Combine payments and donations
                            const allTransactions = [
                              ...(reportStats.paymentsInRange || []).map(p => ({
                                ...p,
                                type: 'Payment',
                                source: p.member || 'Unknown',
                                amount: p.amount,
                                details: `${getPaymentMethodDisplay(p)} - ${p.period || 'N/A'}`,
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
                                details: d.isMember ? 'Member Donation' : 'Non-Member Donation',
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
                            return allTransactions.filter(t => {
                              if (reportFilter === "payments" && t.type !== "Payment") return false;
                              if (reportFilter === "donations" && t.type !== "Donation") return false;
                              if (t.type === "Donation") {
                                if (donorTypeFilter === "member" && !t.isMember) return false;
                                if (donorTypeFilter === "non-member" && t.isMember) return false;
                              }
                              return true;
                            });
                          })().map((transaction) => ({
                            Date: transaction.date,
                            Type: transaction.type === "Payment" ? (
                              <span className="badge badge-paid">Payment</span>
                            ) : (
                              <span className="badge badge-active">Donation</span>
                            ),
                            Source: transaction.source,
                            Amount: transaction.amount,
                            Details: transaction.details,
                          }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
                    <button
                      className="secondary-btn"
                      onClick={handleExportCSV}
                    >
                      📥 Export CSV
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={handleExportPDF}
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

            {/* SETTINGS */}
            {activeSection === "settings" && (
              <article className="screen-card" id="settings">
                <header className="screen-card__header">
                  <h3>Admin Settings</h3>
                  <p>Organization profile and admin accounts.</p>
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
                          Name
                          <input
                            type="text"
                            className="settings-form__input"
                            value={orgForm.name}
                            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                            placeholder="Organization name"
                          />
                        </label>
                      </div>
                      <div className="settings-form__group">
                        <label className="settings-form__label">
                          Contact Email
                          <input
                            type="email"
                            className="settings-form__input"
                            value={orgForm.email}
                            onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                            placeholder="contact@organization.com"
                          />
                        </label>
                      </div>
                      <div className="settings-form__group">
                        <label className="settings-form__label">
                          Contact Number
                          <input
                            type="tel"
                            className="settings-form__input"
                            value={orgForm.phone}
                            onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                            placeholder="+1 (555) 123-4567"
                          />
                        </label>
                      </div>
                      <div className="settings-form__group">
                        <label className="settings-form__label">
                          Address
                          <input
                            type="text"
                            className="settings-form__input"
                            value={orgForm.address}
                            onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                            placeholder="123 Main St, City, State ZIP"
                          />
                        </label>
                      </div>
                      <button className="settings-form__submit primary-btn" type="submit">
                        Save Changes
                      </button>
                    </form>
                  </div>

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
                            setShowAdminForm(true);
                            setAdminForm({ name: "", role: "Viewer", status: "Active" });
                          }}
                        >
                          + Add Admin
                        </button>
                      </div>
                    </div>

                    {showAdminForm && (
                      <div className="settings-admin-form">
                        <div className="settings-admin-form__header">
                          <h4 className="settings-admin-form__title">Add New Admin</h4>
                        </div>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!adminForm.name) {
                              showToast("Please enter admin name", "error");
                              return;
                            }
                            try {
                              await addAdminUser(adminForm);
                              setShowAdminForm(false);
                              setAdminForm({ name: "", role: "Viewer", status: "Active" });
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
                                placeholder="Enter Your Name"
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
                                placeholder="Enter your Email"
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
                                placeholder="Enter Your Password"
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
                                <option>Owner</option>
                                <option>Finance Admin</option>
                                <option>Viewer</option>
                              </select>
                            </label>
                          </div>
                          <div className="settings-form__actions">
                            <button type="button" className="ghost-btn settings-form__cancel" onClick={() => setShowAdminForm(false)}>
                              Cancel
                            </button>
                            <button type="submit" className="primary-btn settings-form__submit-btn">
                              Add Admin
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

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
                                {(user.role || 'Viewer') !== "Owner" && (
                                  <button
                                    className="ghost-btn settings-table__action-btn settings-table__action-btn--danger"
                                    onClick={async () => {
                                      if (window.confirm(`Remove ${user.name} from admin users?`)) {
                                        try {
                                          await deleteAdminUser(user.id);
                                          showToast(`${user.name} removed`);
                                        } catch (error) {
                                          showToast(error.message || "Failed to delete admin", "error");
                                        }
                                      }
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
              </article>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
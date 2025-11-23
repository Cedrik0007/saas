import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { useApp } from "../context/AppContext.jsx";
import emailjs from "@emailjs/browser";
import {
  reportStats,
} from "../data";
import { statusClass } from "../statusClasses";


export function AdminPage() {
  const {
    members,
    admins,
    invoices,
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
  } = useApp();

  const sections = [
    { id: "dashboard", label: "Dashboard" },
    { id: "members", label: "Members" },
    { id: "member-detail", label: "Member Detail" },
    { id: "invoice-builder", label: "Invoice Builder" },
    { id: "automation", label: "Reminders" },
    { id: "payment-methods", label: "Payments" },
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
    status: "Active",
    balance: "$0",
    nextDue: "",
    lastPayment: "",
  });

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

  const [orgForm, setOrgForm] = useState(organizationInfo);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: "", role: "Viewer", status: "Active" });
  const [templateForm, setTemplateForm] = useState(reminderTemplates);
  const [dateRange, setDateRange] = useState({
    from: "2025-01-01",
    to: "2025-12-31",
  });
  const [selectedPeriod, setSelectedPeriod] = useState("This Year");
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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
      
      // Filter payments for this month
      const monthPayments = paymentHistory.filter((payment) => {
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

  // Get recent payments from paymentHistory
  const getRecentPayments = () => {
    return paymentHistory
      .filter(payment => payment.status === "Paid" || payment.status === "Pending Verification")
      .sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      })
      .slice(0, 5)
      .map(payment => ({
        Member: payment.member || "Unknown",
        Period: payment.period || "N/A",
        Amount: payment.amount || "$0",
        Method: payment.method || "N/A",
        Status: payment.status || "Paid",
        Date: payment.date || "N/A",
      }));
  };

  const monthlyCollectionsData = calculateMonthlyCollections();
  const recentPaymentsData = getRecentPayments();

  // Initialize EmailJS
  useEffect(() => {
    const publicKey = "G8OQbtdWodMBUv53Y";
    
    // Only initialize if key is configured
    if (publicKey && publicKey !== "YOUR_PUBLIC_KEY") {
      try {
        emailjs.init(publicKey);
        console.log("✓ EmailJS initialized successfully");
      } catch (error) {
        console.error("EmailJS initialization error:", error);
      }
    } else {
      console.warn("⚠️ EmailJS not configured. Add your public key in AdminPage.jsx line ~35");
    }
  }, []);

  const handleNavClick = (id) => {
    setActiveSection(id);
    setShowMemberForm(false);
    setShowInvoiceForm(false);
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
      });
      setShowMemberForm(false);
      showToast("Member added successfully!");
    } catch (error) {
      showToast("Failed to add member. Please try again.", "error");
    }
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setMemberForm(member);
    setShowMemberForm(true);
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    try {
      await updateMember(editingMember.id, memberForm);
      setEditingMember(null);
      setMemberForm({
        name: "",
        email: "",
        phone: "",
        status: "Active",
        balance: "$0",
        nextDue: "",
        lastPayment: "",
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

  const handleMarkAsPaid = (invoiceId, method = "Manual") => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      const adminEmail = sessionStorage.getItem('adminEmail');
      const currentAdmin = admins.find(a => a.email === adminEmail);
      
      const paymentMethod = method === "Cash" ? "Cash" : "Manual";
      const reference = method === "Cash" ? `CASH_${Date.now()}` : `MAN${Date.now()}`;
      
      updateInvoice(invoiceId, {
        status: "Paid",
        method: paymentMethod,
        reference: reference,
        paidToAdmin: currentAdmin?.id,
        paidToAdminName: currentAdmin?.name,
      });
      
      // Add payment record
      addPayment({
        invoiceId: invoiceId,
        amount: invoice.amount,
        method: paymentMethod,
        reference: reference,
        member: invoice.memberName || "Member",
        memberId: invoice.memberId,
        period: invoice.period,
        status: "Paid",
        paidToAdmin: currentAdmin?.id,
        paidToAdminName: currentAdmin?.name,
      });
      
      showToast(`Invoice marked as paid (${paymentMethod})!`);
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

    // Get member's unpaid/overdue invoices
    const memberUnpaidInvoices = invoices.filter(
      (inv) =>
        inv.memberId === memberData.id &&
        (inv.status === "Unpaid" || inv.status === "Overdue")
    );

    if (memberData.balance === "$0") {
      showToast("This member has no outstanding payments", "error");
      return;
    }
    // if (memberData.balance.length === 0) {
    //     showToast("This member has no outstanding payments", "error");
    //     return;
    //   }

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
  };

  // Email Reminder (EmailJS)
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

    if (memberData.balance === "$0") {
      showToast("This member has no outstanding payments", "error");
      return;
    }

    // Calculate total due
    const totalDue = memberUnpaidInvoices.reduce((sum, inv) => {
      return sum + parseFloat(inv.amount.replace("$", ""));
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
            <strong>${inv.status}</strong>
          </li>`
      )
      .join("");

    // Prepare email parameters
    const emailParams = {
      to_email: memberData.email,
      to_name: memberData.name,
      member_id: memberData.id,
      member_phone: memberData.phone,
      total_due: memberData.balance,
      invoice_count: memberUnpaidInvoices.length,
      invoice_list_text: invoiceListText,
      invoice_list_html: invoiceListHTML,
      payment_methods:
        "FPS (ID: 1234567), PayMe, Bank Transfer (HSBC 123-456789-001), or Credit Card",
      portal_link: `${window.location.origin}/member`,
      current_date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    };

    // EmailJS configuration
    const serviceId = "service_yb0uo4k";
    const templateId = "template_5uhd93r";
    
    if (serviceId === "YOUR_SERVICE_ID" || templateId === "YOUR_TEMPLATE_ID") {
      // EmailJS not configured yet - simulate email for now
      console.log("📧 Email Preview (EmailJS not configured yet):");
      console.log("To:", memberData.email);
      console.log("Subject: Payment Reminder - Outstanding Balance $" + totalDue);
      console.log("Invoices:", memberUnpaidInvoices);
      console.log("\n⚠️ To send real emails, configure EmailJS:");
      console.log("1. Sign up at https://www.emailjs.com");
      console.log("2. Get Service ID, Template ID, and Public Key");
      console.log("3. Update AdminPage.jsx lines ~35 and ~271");
      
      // Log to communication (simulated)
      const comm = {
        channel: "Email",
        message: `Payment reminder: ${memberData.name} (${memberData.email}) - $${totalDue} due (${memberUnpaidInvoices.length} invoice${memberUnpaidInvoices.length > 1 ? "s" : ""}) [SIMULATED]`,
        status: "Delivered",
      };
      addCommunication(comm);

      showToast(
        `📧 Reminder logged (Configure EmailJS to send real emails). Check console for details.`
      );
      return;
    }

    try {
      showToast("Sending reminder email...");

      // Send email using EmailJS
      const result = await emailjs.send(
        serviceId,
        templateId,
        emailParams
      );

      console.log("✓ Email sent successfully:", result);

      // Log to communication with details
      const comm = {
        channel: "Email",
        message: `Payment reminder: ${memberData.name} (${memberData.email}) - $${totalDue} due (${memberUnpaidInvoices.length} invoice${memberUnpaidInvoices.length > 1 ? "s" : ""})`,
        status: "Delivered",
      };
      addCommunication(comm);

      showToast(
        `✓ Reminder email sent to ${memberData.name} for $${memberData.balance} outstanding!`
      );
    } catch (error) {
      console.error("✗ Email send error:", error);

      // Log failed attempt
      const comm = {
        channel: "Email",
        message: `Reminder attempt to ${memberData.name} - $${totalDue} due`,
        status: "Failed",
      };
      addCommunication(comm);

      showToast(
        "Failed to send email. Please check EmailJS configuration.",
        "error"
      );
    }
  };

  const handleViewMemberDetail = (member) => {
    setSelectedMember(member);
    setActiveSection("member-detail");
  };

  // Get member's invoices
  const getMemberInvoices = (memberId) => {
    return invoices.filter((inv) => inv.memberId === memberId);
  };

  return (
    <>
      <SiteHeader showCTA={false} showLogout={true} onLogout={handleLogout} />
      
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 1000,
            background: toast.type === "success" ? "#000000" : "#666666",
            color: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
            border: "1px solid " + (toast.type === "success" ? "#000000" : "#999999"),
            animation: "slideIn 0.3s ease",
          }}
        >
          {toast.message}
        </div>
      )}

      <main className="admin-main">
        {/* Mobile Horizontal Navigation */}
        <div className="mobile-nav-tabs">
          {sections.map((section) => (
            <button
              key={section.id}
              className={`mobile-nav-tab ${activeSection === section.id ? "active" : ""}`}
              onClick={() => handleNavClick(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="admin-layout">
          {/* Desktop Sidebar */}
          <aside className="admin-menu">
            <p className="eyebrow light">Admin Portal</p>
            <h3>Finance Operations</h3>
            <nav>
              {sections.map((section) => (
                <button
                  key={section.id}
                  className={`admin-tab ${activeSection === section.id ? "active" : ""}`}
                  onClick={() => handleNavClick(section.id)}
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
                  <h3>Dashboard</h3>
                  <p>Key KPIs, monthly collections, recent payments.</p>
                </header>
                <div className="card dashboard-card">
                  <div className="kpi-grid">
                    <div className="card kpi">
                      <p>Total Members</p>
                      <h4>{members.length}</h4>
                      <small>Active members</small>
                    </div>
                    <div className="card kpi">
                      <p>Total Collected</p>
                      <h4>${metrics.collectedMonth.toLocaleString()}</h4>
                      <small>${metrics.collectedYear.toLocaleString()} YTD</small>
                    </div>
                    <div className="card kpi">
                      <p>Total Outstanding</p>
                      <h4>${metrics.outstanding.toLocaleString()}</h4>
                      <small>Expected ${metrics.expectedAnnual.toLocaleString()}</small>
                    </div>
                    <div className="card kpi">
                      <p>Overdue Members</p>
                      <h4>{metrics.overdueMembers}</h4>
                      <small>Requires attention</small>
                    </div>
                  </div>

                  <div className="card chart-card">
                    <div className="card-header">
                      <div>
                        <h4>Monthly Collections · Last 12 Months</h4>
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
                      <h4>Recent Payments</h4>
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

                <div className="card">
                  <div className="table-wrapper">
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
                      rows={members.map((member) => ({
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
                            <div style={{ display: "flex", gap: "8px" }}>
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
                          const unpaidInvoices = memberInvoices.filter(inv => 
                            inv.status === "Unpaid" || inv.status === "Overdue"
                          );
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
                            const unpaidInvoices = memberInvoices.filter(inv => 
                              inv.status === "Unpaid" || inv.status === "Overdue"
                            );
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
                                Total Outstanding: <strong style={{ color: "#000" }}>${outstandingTotal.toFixed(2)}</strong>
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
                                      Mark Paid (Cash)
                                    </button>
                                    <button
                                      className="secondary-btn"
                                      style={{ padding: "4px 10px", fontSize: "0.85rem" }}
                                      onClick={() => handleMarkAsPaid(invoice.id)}
                                    >
                                      Mark Paid
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
                          <ul className="timeline">
                            {memberPayments.map((item, idx) => (
                              <li key={idx}>
                                <p>
                                  {item.date || "N/A"} · {item.amount || "$0"} · {item.method || "N/A"} · Ref {item.reference || "N/A"}
                                </p>
                                <span className={`badge ${item.status === "Paid" ? "badge-paid" : item.status === "Pending Verification" ? "badge-pending" : "badge-unpaid"}`}>
                                  {item.status || "Paid"}
                                </span>
                              </li>
                            ))}
                          </ul>
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
                  <h3>Invoice Creation</h3>
                  <p>Create invoices for monthly or Eid contributions.</p>
                </header>
                <form className="card form-grid" onSubmit={handleAddInvoice}>
                  <label>
                    Member *
                    <select
                      required
                      value={invoiceForm.memberId}
                      onChange={(e) =>
                        setInvoiceForm({ ...invoiceForm, memberId: e.target.value })
                      }
                      style={{ color: "#000" }}
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
                    Invoice Type *
                    <select
                      required
                      value={invoiceForm.invoiceType}
                      onChange={(e) => {
                        const type = e.target.value;
                        const amount = type === "Monthly" ? "50" : "100";
                        setInvoiceForm({ ...invoiceForm, invoiceType: type, amount: amount });
                      }}
                      style={{ color: "#000" }}
                    >
                      <option value="">Select Invoice Type</option>
                      <option value="Monthly">Monthly - $50</option>
                      <option value="Eid">Eid - $100</option>
                    </select>
                  </label>

                  <label>
                    Period *
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nov 2025"
                      value={invoiceForm.period}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, period: e.target.value })}
                      style={{ color: "#000" }}
                    />
                  </label>

                  <label>
                    Amount ($) *
                    <input
                      type="number"
                      required
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                      style={{ color: "#000" }}
                    />
                  </label>

                  <label>
                    Due Date *
                    <input
                      type="date"
                      required
                      value={invoiceForm.due}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, due: e.target.value })}
                      style={{ color: "#000" }}
                    />
                  </label>

                  <label className="notes">
                    Notes
                    <textarea
                      placeholder="Add context for this invoice"
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      style={{ color: "#000" }}
                    ></textarea>
                  </label>

                  <div className="form-actions">
                    <button type="submit" className="primary-btn">
                      Create Invoice
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

                        // Prepare email parameters with the newly created invoice
                        const emailParams = {
                          to_email: member.email,
                          to_name: member.name,
                          member_id: member.id,
                          member_phone: member.phone,
                          total_due: `$${totalDue.toFixed(2)}`,
                          invoice_count: allUnpaidInvoices.length,
                          invoice_list_text: invoiceListText,
                          invoice_list_html: invoiceListHTML,
                          payment_methods:
                            "FPS (ID: 1234567), PayMe, Bank Transfer (HSBC 123-456789-001), or Credit Card",
                          portal_link: `${window.location.origin}/member`,
                          current_date: new Date().toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          }),
                        };

                        // EmailJS configuration
                        const serviceId = "service_yb0uo4k";
                        const templateId = "template_5uhd93r";

                        if (serviceId === "YOUR_SERVICE_ID" || templateId === "YOUR_TEMPLATE_ID") {
                          // EmailJS not configured yet - simulate email for now
                          console.log("📧 Email Preview (EmailJS not configured yet):");
                          console.log("To:", member.email);
                          console.log("Subject: Payment Reminder - Outstanding Balance $" + totalDue.toFixed(2));
                          console.log("Invoices:", allUnpaidInvoices);
                          console.log("\n⚠️ To send real emails, configure EmailJS:");
                          console.log("1. Sign up at https://www.emailjs.com");
                          console.log("2. Get Service ID, Template ID, and Public Key");
                          console.log("3. Update AdminPage.jsx lines ~35 and ~271");
                          
                          // Log to communication (simulated)
                          const comm = {
                            channel: "Email",
                            message: `Payment reminder: ${member.name} (${member.email}) - $${totalDue.toFixed(2)} due (${allUnpaidInvoices.length} invoice${allUnpaidInvoices.length > 1 ? "s" : ""}) [SIMULATED]`,
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
                            `📧 Invoice created! Reminder logged (Configure EmailJS to send real emails). Check console for details.`
                          );
                          return;
                        }

                        try {
                          showToast("Sending reminder email...");

                          // Send email using EmailJS
                          const result = await emailjs.send(
                            serviceId,
                            templateId,
                            emailParams
                          );

                          console.log("✓ Email sent successfully:", result);

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
                            "Invoice created but failed to send email. Please check EmailJS configuration.",
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
                  <h3>Reminders &amp; Automation</h3>
                  <p>Configure automated payment reminders.</p>
                </header>
                <div className="card automation">
                  <div className="automation-row">
                    <div>
                      <p>Reminder Rules</p>
                      <span>Send smart nudges around each due date.</span>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={automationEnabled}
                        onChange={(e) => {
                          setAutomationEnabled(e.target.checked);
                          showToast(
                            e.target.checked
                              ? "Automation enabled!"
                              : "Automation disabled!"
                          );
                        }}
                      />
                      <span></span>
                    </label>
                  </div>

                  <div className="schedule-grid">
                    {reminderRules.map((rule) => (
                      <div className="schedule-card" key={rule.label}>
                        <p>{rule.label}</p>
                        <div className="checkbox-row">
                          {["Email", "WhatsApp"].map((channel) => (
                            <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={rule.channels.includes(channel)}
                                onChange={(e) => {
                                  const newChannels = e.target.checked
                                    ? [...rule.channels, channel]
                                    : rule.channels.filter((c) => c !== channel);
                                  updateReminderRule(rule.label, newChannels);
                                  showToast(`${channel} ${e.target.checked ? "enabled" : "disabled"} for ${rule.label}`);
                                }}
                              />
                              {channel === "Email" ? (
                                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                  <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                              ) : (
                                <svg width="38" height="38" viewBox="0 0 24 24" fill="#000000">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              )}
                              <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{channel}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="templates" style={{ marginTop: "24px" }}>
                    <div>
                      <h4>Upcoming Due Template</h4>
                      <textarea
                        value={templateForm.upcomingDue}
                        onChange={(e) =>
                          setTemplateForm({ ...templateForm, upcomingDue: e.target.value })
                        }
                        rows={4}
                      ></textarea>
                    </div>
                    <div>
                      <h4>Overdue Template</h4>
                      <textarea
                        value={templateForm.overdue}
                        onChange={(e) =>
                          setTemplateForm({ ...templateForm, overdue: e.target.value })
                        }
                        rows={4}
                      ></textarea>
                    </div>
                  </div>

                  <div className="preview" style={{ marginTop: "20px" }}>
                    <h4>Preview</h4>
                    <div className="preview-tabs">
                      <button className="chip active">Email</button>
                      <button className="chip">WhatsApp</button>
                    </div>
                    <div className="preview-body">
                      <p><strong>From:</strong> finance@subscriptionhk.org</p>
                      <p><strong>Subject:</strong> Upcoming contribution due 05 Nov</p>
                      <p style={{ marginTop: "12px" }}>
                        {templateForm.upcomingDue.replace("{{member_name}}", "Ahmed")
                          .replace("{{period}}", "Nov 2025")
                          .replace("{{amount}}", "50")
                          .replace("{{due_date}}", "05 Nov 2025")}
                      </p>
                    </div>
                  </div>

                  <div className="integration-grid" style={{ marginTop: "24px" }}>
                    <div className="integration-card">
                      <div>
                        <p><strong>WhatsApp API</strong></p>
                        <span className="badge badge-paid" style={{ marginTop: "8px" }}>Connected</span>
                      </div>
                      <button className="ghost-btn" onClick={() => showToast("WhatsApp settings opened")}>
                        Manage
                      </button>
                    </div>
                    <div className="integration-card">
                      <div>
                        <p><strong>Email SMTP</strong></p>
                        <span className="badge badge-unpaid" style={{ marginTop: "8px" }}>Not Connected</span>
                      </div>
                      <button className="secondary-btn" onClick={() => showToast("Email setup initiated")}>
                        Connect
                      </button>
                    </div>
                  </div>

                  <button
                    className="primary-btn"
                    style={{ marginTop: "24px" }}
                    onClick={() => {
                      updateReminderTemplate("upcomingDue", templateForm.upcomingDue);
                      updateReminderTemplate("overdue", templateForm.overdue);
                      showToast("All automation settings saved!");
                    }}
                  >
                    Save All Settings
                  </button>
                </div>
              </article>
            )}

            {/* PAYMENT METHODS */}
            {activeSection === "payment-methods" && (
              <article className="screen-card" id="payment-methods">
                <header className="screen-card__header">
                  <h3>Payments &amp; Methods</h3>
                  <p>Configure payment channels visible to members.</p>
                </header>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "20px"
                }}>
                  {paymentMethods.map((method) => (
                    <div 
                      key={method.name}
                      style={{
                        background: "#fff",
                        border: `2px solid ${method.visible ? "#000" : "#e0e0e0"}`,
                        borderRadius: "12px",
                        padding: "24px",
                        transition: "all 0.3s ease",
                        position: "relative",
                        boxShadow: method.visible ? "0 4px 12px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)"
                      }}
                      onMouseEnter={(e) => {
                        if (!method.visible) {
                          e.currentTarget.style.borderColor = "#ccc";
                          e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.08)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!method.visible) {
                          e.currentTarget.style.borderColor = "#e0e0e0";
                          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
                        }
                      }}
                    >
                      {/* Status Badge */}
                      <div style={{
                        position: "absolute",
                        top: "16px",
                        right: "16px",
                        padding: "4px 12px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        background: method.visible ? "#e8f5e9" : "#f5f5f5",
                        color: method.visible ? "#2e7d32" : "#666"
                      }}>
                        {method.visible ? "Active" : "Inactive"}
                      </div>

                      {/* Method Header */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "20px",
                        paddingRight: "80px"
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: "1.25rem",
                          fontWeight: "600",
                          color: "#000"
                        }}>
                          {method.name}
                        </h4>
                      </div>

                      {/* Toggle Switch */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "20px",
                        padding: "12px",
                        background: method.visible ? "#f8f8f8" : "#fafafa",
                        borderRadius: "8px"
                      }}>
                        <span style={{
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          color: "#666"
                        }}>
                          {method.visible ? "Enabled for members" : "Disabled for members"}
                        </span>
                        <label className="switch" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={method.visible}
                            onChange={(e) =>
                              updatePaymentMethod(method.name, { visible: e.target.checked })
                            }
                            tabIndex={-1}
                            onFocus={(e) => e.target.blur()}
                          />
                          <span></span>
                        </label>
                      </div>

                      {/* Method Details */}
                      <div style={{
                        borderTop: "1px solid #f0f0f0",
                        paddingTop: "16px"
                      }}>
                        <div style={{
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          color: "#666",
                          marginBottom: "12px"
                        }}>
                          Payment Details:
                        </div>
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}>
                          {method.details.map((detail, index) => (
                            <div 
                              key={`${method.name}-detail-${index}`}
                              style={{
                                padding: "10px 12px",
                                background: "#f8f8f8",
                                borderRadius: "6px",
                                fontSize: "0.875rem",
                                color: "#333",
                                borderLeft: "3px solid #000"
                              }}
                            >
                              {detail}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
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
                      <h4>{recentPayments.length}</h4>
                      <small>In selected period</small>
                    </div>
                    <div className="card kpi">
                      <p>Outstanding</p>
                      <h4>${metrics.outstanding.toLocaleString()}</h4>
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
                            width: `${Math.round((reportStats.collected / reportStats.expected) * 100)}%`,
                          }}
                        >
                          Collected
                        </div>
                        <div
                          className="outstanding"
                          style={{
                            width: `${100 - Math.round((reportStats.collected / reportStats.expected) * 100)}%`,
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

                  <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
                    <button
                      className="secondary-btn"
                      onClick={() => {
                        const csvData = `Period,${dateRange.from} to ${dateRange.to}\nCollected,$${reportStats.collected}\nExpected,$${reportStats.expected}\nOutstanding,$${metrics.outstanding}\nAverage per Member,$${reportStats.averagePerMember}`;
                        showToast("Report generated! Check console for CSV data");
                        console.log("CSV Export:", csvData);
                      }}
                    >
                      Export CSV
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        showToast("PDF report generation initiated");
                        console.log("PDF Export: Financial Report", {
                          period: `${dateRange.from} to ${dateRange.to}`,
                          collected: reportStats.collected,
                          expected: reportStats.expected,
                          methodMix: reportStats.methodMix,
                        });
                      }}
                    >
                      Export PDF
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        showToast("Report refreshed with latest data");
                      }}
                    >
                      Refresh Data
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
                <div className="card settings-grid">
                  <div>
                    <h4>Organization Info</h4>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        updateOrganizationInfo(orgForm);
                        showToast("Organization info updated!");
                      }}
                    >
                      <label>
                        Name
                        <input
                          value={orgForm.name}
                          onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                          style={{ color: "#000" }}
                        />
                      </label>
                      <label>
                        Contact Email
                        <input
                          type="email"
                          value={orgForm.email}
                          onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                          style={{ color: "#000" }}
                        />
                      </label>
                      <label>
                        Contact Number
                        <input
                          value={orgForm.phone}
                          onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                          style={{ color: "#000" }}
                        />
                      </label>
                      <label>
                        Address
                        <input
                          value={orgForm.address}
                          onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                          style={{ color: "#000" }}
                        />
                      </label>
                      <button className="primary-btn" type="submit" style={{ marginTop: "12px" }}>
                        Save Changes
                      </button>
                    </form>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h4>User Management</h4>
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setShowAdminForm(true);
                          setAdminForm({ name: "", role: "Viewer", status: "Active" });
                        }}
                      >
                        + Add Admin
                      </button>
                    </div>

                    {showAdminForm && (
                      <div className="card" style={{ marginBottom: "16px", background: "var(--gray-50)", padding: "16px" }}>
                        <h4 style={{ fontSize: "1rem", marginBottom: "12px" }}>Add New Admin</h4>
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
                          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                        >
                          
                          <label>
                            Name
                            <input
                              required
                              value={adminForm.name}
                              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                              placeholder="Enter Your Name"
                            />
                          </label>

                          <label>
                            Email
                            <input
                              required
                              value={adminForm.email}
                              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                              placeholder="Enter your Email"
                            />
                          </label>

                          <label>
                            Password
                            <input
                              required
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                              placeholder="Enter Your Password"
                            />
                          </label>
                           
                          <label>
                            Role
                            <select
                              value={adminForm.role}
                              onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                            >
                              <option>Owner</option>
                              <option>Finance Admin</option>
                              <option>Viewer</option>
                            </select>
                          </label>

                          <div style={{ display: "flex", gap: "8px" }}>
                            <button type="button" className="ghost-btn" onClick={() => setShowAdminForm(false)}>
                              Cancel
                            </button>
                            <button type="submit" className="primary-btn">
                              Add Admin
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

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
                            <div style={{ display: "flex", gap: "8px" }}>
                              {(user.status || 'Active') === "Active" ? (
                                <button
                                  className="ghost-btn"
                                  style={{ padding: "4px 10px", fontSize: "0.85rem" }}
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
                                  className="secondary-btn"
                                  style={{ padding: "4px 10px", fontSize: "0.85rem" }}
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
                                  className="ghost-btn"
                                  style={{ padding: "4px 10px", fontSize: "0.85rem", color: "#000" }}
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

                  {/* <div>
                    <h4>Notification Preferences</h4>
                    <label className="checkbox">
                      <input type="checkbox" defaultChecked />
                      Weekly finance summary
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" defaultChecked />
                      Payment failure alerts
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" />
                      Reminder escalation emails
                    </label>
                    <button
                      className="primary-btn"
                      onClick={() => showToast("Notification preferences saved!")}
                      style={{ marginTop: "12px" }}
                    >
                      Save Preferences
                    </button>
                  </div> */}
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
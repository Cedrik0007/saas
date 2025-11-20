import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { useApp } from "../context/AppContext.jsx";
import {
  monthlyCollections,
  reminderRules,
  reportStats,
} from "../data";
import { statusClass } from "../statusClasses";

export function AdminPage() {
  const {
    members,
    invoices,
    recentPayments,
    paymentHistory,
    communicationLog,
    paymentMethods,
    metrics,
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

  const [invoiceForm, setInvoiceForm] = useState({
    memberId: "",
    period: "",
    amount: "50",
    invoiceType: "Monthly",
    due: "",
    notes: "",
  });

  const navigate = useNavigate();

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
  const handleAddMember = (e) => {
    e.preventDefault();
    if (!memberForm.name || !memberForm.email) {
      showToast("Please fill all required fields", "error");
      return;
    }
    addMember(memberForm);
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
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setMemberForm(member);
    setShowMemberForm(true);
  };

  const handleUpdateMember = (e) => {
    e.preventDefault();
    updateMember(editingMember.id, memberForm);
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
  };

  const handleDeleteMember = (id) => {
    if (window.confirm("Are you sure you want to delete this member?")) {
      deleteMember(id);
      showToast("Member deleted successfully!");
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

  const handleMarkAsPaid = (invoiceId) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      updateInvoice(invoiceId, {
        status: "Paid",
        method: "Manual",
        reference: `MAN${Date.now()}`,
      });
      showToast("Invoice marked as paid!");
    }
  };

  const handleDeleteInvoice = (id) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      deleteInvoice(id);
      showToast("Invoice deleted successfully!");
    }
  };

  // Communication Operations
  const handleSendReminder = (memberData) => {
    const comm = {
      channel: "Email",
      message: `Payment reminder sent to ${memberData?.name || "member"}`,
      status: "Delivered",
    };
    addCommunication(comm);
    showToast(`Reminder sent to ${memberData?.name || "member"}!`);
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
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
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
                      <h4>{metrics.totalMembers}</h4>
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
                    <div className="chart">
                      {monthlyCollections.map((item) => (
                        <div
                          key={item.month}
                          style={{ height: `${item.value}%` }}
                          data-month={item.month}
                        ></div>
                      ))}
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
                      rows={recentPayments.slice(0, 5).map((payment) => ({
                        Member: payment.member,
                        Period: payment.period,
                        Amount: payment.amount,
                        Method: payment.method,
                        Status: payment.status,
                        Date: payment.date,
                      }))}
                    />
                  </div>
                </div>
              </article>
            )}

            {/* MEMBERS LIST */}
            {activeSection === "members" && (
              <article className="screen-card" id="members">
                <header className="screen-card__header">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div>
                      <h3>Members List</h3>
                      <p>Manage all members and their subscriptions.</p>
                    </div>
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
                      <div className="form-actions">
                        <button type="button" className="ghost-btn" onClick={() => setShowMemberForm(false)}>
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
                        className="primary-btn"
                        onClick={() => handleSendReminder(selectedMember)}
                      >
                        Send Reminder
                      </button>
                    </div>
                  </div>

                  <div className="summary-grid">
                    <div className="summary-card">
                      <p>Outstanding Balance</p>
                      <h4>{selectedMember.balance}</h4>
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
                        <h4>Invoices</h4>
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
                                  <button
                                    className="secondary-btn"
                                    style={{ padding: "4px 10px", fontSize: "0.85rem" }}
                                    onClick={() => handleMarkAsPaid(invoice.id)}
                                  >
                                    Mark Paid
                                  </button>
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
                      <ul className="timeline">
                        {paymentHistory.slice(0, 5).map((item, idx) => (
                          <li key={idx}>
                            <p>
                              {item.date} · {item.amount} · {item.method} · Ref {item.reference}
                            </p>
                            <span className="badge badge-paid">Paid</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeTab === "Communication" && (
                    <div className="tab-panel">
                      <ul className="timeline">
                        {communicationLog.slice(0, 5).map((item, idx) => (
                          <li key={idx}>
                            <p>
                              {item.channel} · {item.message} · {item.date}
                            </p>
                            <span className={statusClass[item.status]}>{item.status}</span>
                          </li>
                        ))}
                      </ul>
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
                    Invoice Type
                    <div className="segmented">
                      <button
                        type="button"
                        className={`chip ${invoiceForm.invoiceType === "Monthly" ? "active" : ""}`}
                        onClick={() =>
                          setInvoiceForm({ ...invoiceForm, invoiceType: "Monthly", amount: "50" })
                        }
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        className={`chip ${invoiceForm.invoiceType === "Eid" ? "active" : ""}`}
                        onClick={() =>
                          setInvoiceForm({ ...invoiceForm, invoiceType: "Eid", amount: "100" })
                        }
                      >
                        Eid
                      </button>
                    </div>
                  </label>

                  <label>
                    Period *
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nov 2025"
                      value={invoiceForm.period}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, period: e.target.value })}
                    />
                  </label>

                  <label>
                    Amount ($) *
                    <input
                      type="number"
                      required
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    />
                  </label>

                  <label>
                    Due Date *
                    <input
                      type="date"
                      required
                      value={invoiceForm.due}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, due: e.target.value })}
                    />
                  </label>

                  <label className="notes">
                    Notes
                    <textarea
                      placeholder="Add context for this invoice"
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                    ></textarea>
                  </label>

                  <div className="form-actions">
                    <button type="submit" className="primary-btn">
                      Create Invoice
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        const member = members.find((m) => m.id === invoiceForm.memberId);
                        if (member) {
                          handleAddInvoice({ preventDefault: () => {} });
                          handleSendReminder(member);
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
                      <input type="checkbox" defaultChecked />
                      <span></span>
                    </label>
                  </div>

                  <div className="schedule-grid">
                    {reminderRules.map((rule) => (
                      <div className="schedule-card" key={rule.label}>
                        <p>{rule.label}</p>
                        <div className="checkbox-row">
                          {["Email", "WhatsApp"].map((channel) => (
                            <label key={channel}>
                              <input
                                type="checkbox"
                                defaultChecked={rule.channels.includes(channel)}
                              />
                              {channel}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="primary-btn"
                    onClick={() => showToast("Reminder settings saved!")}
                  >
                    Save Settings
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
                <div className="card methods-grid">
                  {paymentMethods.map((method) => (
                    <div className="method-card" key={method.name}>
                      <div className="method-header">
                        <h4>{method.name}</h4>
                        <label className="switch">
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
                      {method.details.map((detail, index) => (
                        <p key={`${method.name}-detail-${index}`} className="method-detail">
                          {detail}
                        </p>
                      ))}
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
                  <div className="kpi-grid">
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
                  </div>

                  <div className="chart-stack">
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

                  <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                    <button
                      className="secondary-btn"
                      onClick={() => showToast("Report exported to CSV")}
                    >
                      Export CSV
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => showToast("Report exported to PDF")}
                    >
                      Export PDF
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
                    <label>
                      Name
                      <input defaultValue="Subscription Manager HK" />
                    </label>
                    <label>
                      Contact Email
                      <input defaultValue="support@subscriptionhk.org" />
                    </label>
                    <label>
                      Contact Number
                      <input defaultValue="+852 2800 1122" />
                    </label>
                    <button
                      className="primary-btn"
                      onClick={() => showToast("Settings saved!")}
                      style={{ marginTop: "12px" }}
                    >
                      Save Changes
                    </button>
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

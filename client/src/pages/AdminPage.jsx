import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import {
  metrics,
  monthlyCollections,
  recentPayments,
  members,
  invoices,
  paymentHistory,
  communicationLog,
  reminderRules,
  paymentMethods,
  reportStats,
} from "../data";
import { statusClass } from "../statusClasses";

export function AdminPage() {
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
  const navigate = useNavigate();

  const handleNavClick = (id) => {
    setActiveSection(id);
  };

  const handleLogout = () => {
    navigate("/login", { replace: true });
  };

  return (
    <>
      <SiteHeader showCTA={false} showLogout={true} onLogout={handleLogout} />
      <main className="admin-main">
        <div className="admin-layout">
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
                <small>+12 vs last month</small>
              </div>
              <div className="card kpi">
                <p>Total Collected</p>
                <div className="toggle-chip-group">
                  <button className="chip active">This Month</button>
                  <button className="chip">This Year</button>
                </div>
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
                <small>-5 vs last month</small>
              </div>
            </div>
            <div className="card chart-card">
              <div className="card-header">
                <div>
                  <h4>Monthly Collections · Last 12 Months</h4>
                  <p>Expected contribution is $800 per member per year</p>
                </div>
                <select>
                  <option>Oct 2024 - Sep 2025</option>
                </select>
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
                <button className="text-btn">View all</button>
              </div>
              <Table
                columns={["Member", "Period", "Amount", "Method", "Status", "Date"]}
                rows={recentPayments.map((payment) => ({
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

            {activeSection === "members" && (
              <article className="screen-card" id="members">
          <header className="screen-card__header">
            <h3>Members List</h3>
            <p>Filters, bulk actions, WhatsApp-ready contact info.</p>
          </header>
          <div className="card">
            <div className="filters">
              <label>
                Status
                <select>
                  <option>All</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
              <label>
                Payment Status
                <select>
                  <option>All</option>
                  <option>Paid</option>
                  <option>Unpaid</option>
                  <option>Overdue</option>
                </select>
              </label>
              <input type="search" placeholder="Search name, email, ID" />
              <div className="bulk-actions">
                <button className="secondary-btn">Send Reminder</button>
                <button className="ghost-btn">Export</button>
              </div>
            </div>
            <div className="table-wrapper">
              <Table
                columns={[
                  "ID",
                  "Name",
                  "Email",
                  "WhatsApp",
                  "Status",
                  "Balance",
                  "Next Due",
                  "Last Payment",
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
                  "Next Due": member.nextDue,
                  "Last Payment": member.lastPayment,
                }))}
              />
            </div>
          </div>
            </article>
            )}

            {activeSection === "member-detail" && (
              <article className="screen-card" id="member-detail">
          <header className="screen-card__header">
            <h3>Member Detail</h3>
            <p>360º view with invoices, payment history, communications.</p>
          </header>
          <div className="card member-detail">
            <div className="member-header">
              <div>
                <span className="avatar">SC</span>
                <div>
                  <h4>Samuel Chan</h4>
                  <p>
                    Member ID HK1021 · samuel.chan@hk.org · WhatsApp +852 9123
                    4567
                  </p>
                </div>
              </div>
              <div className="header-actions">
                <button className="secondary-btn">Create Invoice</button>
                <button className="primary-btn">Send Reminder</button>
              </div>
            </div>
            <div className="summary-grid">
              <div className="summary-card">
                <p>Total Paid This Year</p>
                <h4>$650</h4>
              </div>
              <div className="summary-card">
                <p>Outstanding Balance</p>
                <h4>$150</h4>
              </div>
              <div className="summary-card">
                <p>Next Due Date</p>
                <h4>05 Nov 2025</h4>
              </div>
              <div className="summary-card">
                <p>Subscription Plan</p>
                <h4>$50/mo + 2×$100 Eid</h4>
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
                    <button className="secondary-btn">Create Manual Invoice</button>
                    <button className="ghost-btn">Mark as Paid</button>
                  </div>
                </div>
                <Table
                  columns={[
                    "Invoice #",
                    "Period",
                    "Amount",
                    "Status",
                    "Due Date",
                    "Method",
                    "Reference",
                  ]}
                  rows={invoices.map((invoice) => ({
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
                    Method: invoice.method,
                    Reference: invoice.reference,
                  }))}
                />
              </div>
            )}
            {activeTab === "Payment History" && (
              <div className="tab-panel">
                <ul className="timeline">
                  {paymentHistory.map((item) => (
                    <li key={item.reference}>
                      <p>
                        {item.date} · {item.amount} · {item.method} · Ref{" "}
                        {item.reference}
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
                  {communicationLog.map((item) => (
                    <li key={item.message}>
                      <p>
                        {item.channel} · {item.message} · {item.date}
                      </p>
                      <span className={statusClass[item.status]}>
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
            </article>
            )}

            {activeSection === "invoice-builder" && (
              <article className="screen-card" id="invoice-builder">
          <header className="screen-card__header">
            <h3>Invoice Creation</h3>
            <p>Pre-filled logic for monthly vs Eid invoices with reminder option.</p>
          </header>
          <form className="card form-grid">
            <label>
              Member
              <select>
                {members.map((member) => (
                  <option key={member.id}>
                    {member.name} ({member.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Invoice Type
              <div className="segmented">
                <button type="button" className="chip active">
                  Monthly
                </button>
                <button type="button" className="chip">
                  Eid
                </button>
              </div>
            </label>
            <label>
              Period (Month/Year)
              <input type="month" defaultValue="2025-10" />
            </label>
            <label>
              Amount
              <input type="number" defaultValue="50" />
            </label>
            <label>
              Due Date
              <input type="date" defaultValue="2025-11-05" />
            </label>
            <label className="notes">
              Notes
              <textarea placeholder="Add context for this invoice"></textarea>
            </label>
            <div className="form-actions">
              <button type="button" className="secondary-btn">
                Save
              </button>
              <button type="button" className="primary-btn">
                Save &amp; Send Reminder
              </button>
            </div>
          </form>
            </article>
            )}

            {activeSection === "automation" && (
              <article className="screen-card" id="automation">
          <header className="screen-card__header">
            <h3>Reminders &amp; Automation</h3>
            <p>Enable automated nudges via email and WhatsApp.</p>
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
            <div className="templates">
              <div>
                <h4>Upcoming Due Template</h4>
                <textarea defaultValue="Hi {{member_name}}, friendly reminder your {{period}} subscription of ${{amount}} is due on {{due_date}}. You can pay via FPS, PayMe, or card. Thank you!"></textarea>
              </div>
              <div>
                <h4>Overdue Template</h4>
                <textarea defaultValue="Hi {{member_name}}, your {{period}} contribution of ${{amount}} is now overdue. Please settle via the member portal or reply once paid."></textarea>
              </div>
              <div className="preview">
                <h4>Preview</h4>
                <div className="preview-tabs">
                  <button className="chip active">Email</button>
                  <button className="chip">WhatsApp</button>
                </div>
                <div className="preview-body">
                  <p>From: finance@subscriptionhk.org</p>
                  <p>Subject: Upcoming contribution due 05 Nov</p>
                  <p>
                    Hi Samuel, friendly reminder your Nov 2025 subscription of
                    $50 is due on 05 Nov 2025. Pay via FPS (ID 1234567) or PayMe.
                    Thank you!
                  </p>
                </div>
              </div>
            </div>
            <div className="integration-grid">
              <div className="integration-card">
                <p>WhatsApp API</p>
                <span className="badge badge-paid">Connected</span>
                <button className="ghost-btn">Manage</button>
              </div>
              <div className="integration-card">
                <p>Email SMTP</p>
                <span className="badge badge-unpaid">Not Connected</span>
                <button className="ghost-btn">Connect</button>
              </div>
            </div>
          </div>
            </article>
            )}

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
                      defaultChecked={method.visible}
                      tabIndex={-1}
                      onFocus={(e) => {
                        e.target.blur();
                      }}
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

            {activeSection === "reports" && (
              <article className="screen-card" id="reports">
          <header className="screen-card__header">
            <h3>Reports</h3>
            <p>Compare collected vs expected and break down by method.</p>
          </header>
          <div className="card reports">
            <div className="reports-header">
              <label>
                Date From
                <input type="date" defaultValue="2025-01-01" />
              </label>
              <label>
                Date To
                <input type="date" defaultValue="2025-12-31" />
              </label>
              <div className="chip-group">
                <button className="chip active">This Year</button>
                <button className="chip">This Quarter</button>
                <button className="chip">This Month</button>
              </div>
              <div className="exports">
                <button className="ghost-btn">Export CSV</button>
                <button className="secondary-btn">Export PDF</button>
              </div>
            </div>
            <div className="kpi-grid">
              <div className="card kpi">
                <p>Collected vs Expected</p>
                <h4>
                  ${reportStats.collected.toLocaleString()} / $
                  {reportStats.expected.toLocaleString()}
                </h4>
                <small>
                  {Math.round(
                    (reportStats.collected / reportStats.expected) * 100,
                  )}
                  % of goal
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
                <h4>Collected vs Outstanding</h4>
                <div className="stacked-bar">
                  <div className="collected" style={{ width: "88%" }}>
                    Collected
                  </div>
                  <div className="outstanding" style={{ width: "12%" }}>
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
          </div>
            </article>
            )}

            {activeSection === "settings" && (
              <article className="screen-card" id="settings">
          <header className="screen-card__header">
            <h3>Admin Settings</h3>
            <p>Organization profile, admin accounts, notifications.</p>
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
              <label>
                Logo Upload
                <button className="ghost-btn">Upload Logo</button>
              </label>
            </div>
            <div>
              <h4>User Management</h4>
              <Table
                columns={["User", "Role", "Status", "Action"]}
                rows={[
                  {
                    User: "Elaine Wong",
                    Role: "Owner",
                    Status: {
                      render: () => (
                        <span className="badge badge-paid">Active</span>
                      ),
                    },
                    Action: {
                      render: () => <button className="ghost-btn">Remove</button>,
                    },
                  },
                  {
                    User: "Hassan Idris",
                    Role: "Finance Admin",
                    Status: {
                      render: () => (
                        <span className="badge badge-paid">Active</span>
                      ),
                    },
                    Action: {
                      render: () => <button className="ghost-btn">Remove</button>,
                    },
                  },
                  {
                    User: "Kelly Chan",
                    Role: "Viewer",
                    Status: {
                      render: () => (
                        <span className="badge badge-unpaid">Pending</span>
                      ),
                    },
                    Action: {
                      render: () => (
                        <button className="ghost-btn">Resend Invite</button>
                      ),
                    },
                  },
                ]}
              />
              <button className="secondary-btn">Add Admin</button>
            </div>
            <div>
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


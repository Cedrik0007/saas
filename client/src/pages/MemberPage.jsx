import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import {
  memberUpcomingPayments,
  memberInvoices,
  memberPaymentHistory,
} from "../data";
import { statusClass } from "../statusClasses";

export function MemberPage() {
  const sections = [
    { id: "dashboard", label: "Dashboard" },
    { id: "pay", label: "Pay Now" },
    { id: "invoices", label: "Invoices" },
    { id: "history", label: "Payment History" },
    { id: "profile", label: "Profile" },
  ];

  const [activeSection, setActiveSection] = useState(sections[0].id);
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
      <main className="member-main">
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

        <div className="member-layout">
          {/* Desktop Sidebar */}
          <aside className="member-menu">
            <p className="eyebrow light">Member Portal</p>
            <h3>Aisha Malik</h3>
            <p>Plan: $50/month + 2× $100 Eid</p>
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

          <div className="member-body">
            {activeSection === "dashboard" && (
              <article className="screen-card" id="dashboard">
          <header className="member-dashboard-header">
            <div>
              <h2>Welcome back, Aisha</h2>
              <p className="dashboard-subtitle">Here's an overview of your membership account</p>
            </div>
            <button className="primary-btn" onClick={() => handleNavClick("pay")}>Pay Now</button>
          </header>

          {/* Alert Banner */}
          <div className="alert-banner alert-warning">
            <div className="alert-content">
              <strong>Payment Due Soon</strong>
              <p>You have an outstanding balance of $150. Pay by Nov 5 to avoid late fees.</p>
            </div>
            <button className="alert-dismiss">×</button>
          </div>

          {/* Stats Cards */}
          <div className="member-stats-grid">
            <div className="stat-card stat-primary">
              <div className="stat-details">
                <span className="stat-label">Outstanding Balance</span>
                <h3 className="stat-value">$150</h3>
                <span className="stat-change negative">2 invoices pending</span>
              </div>
            </div>
            
            <div className="stat-card stat-success">
              <div className="stat-details">
                <span className="stat-label">Next Due Date</span>
                <h3 className="stat-value">Nov 5</h3>
                <span className="stat-change">Monthly $50</span>
              </div>
            </div>
            
            <div className="stat-card stat-info">
              <div className="stat-details">
                <span className="stat-label">Paid This Year</span>
                <h3 className="stat-value">$650</h3>
                <span className="stat-change positive">On track</span>
              </div>
            </div>
            
            <div className="stat-card stat-neutral">
              <div className="stat-details">
                <span className="stat-label">Membership Plan</span>
                <h3 className="stat-value">Active</h3>
                <span className="stat-change">$50/mo + 2×$100 Eid</span>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="member-dashboard-grid">
            {/* Upcoming Payments */}
            <div className="dashboard-card">
              <div className="card-header-flex">
                <h4>Upcoming Payments</h4>
                <span className="badge-count">3</span>
              </div>
              <div className="payment-list">
                {memberUpcomingPayments.map((item) => (
                  <div key={item.label} className="payment-item">
                    <div className="payment-info">
                      <strong className="payment-title">{item.label}</strong>
                      <span className="payment-date">Due {item.due}</span>
                    </div>
                    <div className="payment-right">
                      <span className="payment-amount">{item.amount}</span>
                      <span className={statusClass[item.status]}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-link" onClick={() => handleNavClick("invoices")}>
                View All Invoices →
              </button>
            </div>

            {/* Recent Activity */}
            <div className="dashboard-card">
              <div className="card-header-flex">
                <h4>Recent Activity</h4>
              </div>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-details">
                    <strong>Payment Received</strong>
                    <span>Oct 5, 2025 • $50 via FPS</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-details">
                    <strong>Payment Received</strong>
                    <span>Sep 2, 2025 • $50 via PayMe</span>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-details">
                    <strong>Reminder Sent</strong>
                    <span>Oct 2, 2025 • Next payment due</span>
                  </div>
                </div>
              </div>
              <button className="btn-link" onClick={() => handleNavClick("history")}>
                View Payment History →
              </button>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-card quick-actions-card">
              <h4>Quick Actions</h4>
              <div className="quick-actions-grid">
                <button className="quick-action-btn" onClick={() => handleNavClick("pay")}>
                  <span className="action-label">Pay Now</span>
                </button>
                <button className="quick-action-btn" onClick={() => handleNavClick("invoices")}>
                  <span className="action-label">View Invoices</span>
                </button>
                <button className="quick-action-btn" onClick={() => handleNavClick("history")}>
                  <span className="action-label">Payment History</span>
                </button>
                <button className="quick-action-btn" onClick={() => handleNavClick("profile")}>
                  <span className="action-label">Settings</span>
                </button>
              </div>
            </div>
          </div>
            </article>
            )}

            {activeSection === "pay" && (
              <article className="screen-card" id="pay">
          <header className="screen-card__header">
            <h3>Pay Now</h3>
            <p>Manual vs card flows with proof upload and confirmations.</p>
          </header>
          <div className="card pay-now">
            <div className="due-summary">
              <h4>Due Items</h4>
              <ul>
                <li>Nov Monthly · $50</li>
                <li>Sep Eid 2 · $100</li>
              </ul>
              <p className="total">Total: $150</p>
            </div>
            <div className="payment-methods">
              <div className="tabs">
                <button className="tab active">Bank Transfer</button>
                <button className="tab">FPS</button>
                <button className="tab">Alipay</button>
                <button className="tab">PayMe</button>
                <button className="tab">Card</button>
              </div>
              <div className="method-panel">
                <p>
                  Transfer to HSBC Hong Kong · Account 123-456789-001 · Name:
                  Subscription Manager HK.
                </p>
                <label>
                  Transaction Reference
                  <input placeholder="e.g. FP89231" />
                </label>
                <label>
                  Upload Payment Proof
                  <button className="ghost-btn">Upload</button>
                </label>
                <button className="primary-btn">Submit Payment Details</button>
              </div>
              <div className="method-panel">
                <form className="card-form">
                  <label>
                    Card Number
                    <input placeholder="4242 4242 4242 4242" />
                  </label>
                  <div className="inline">
                    <label>
                      Name on Card
                      <input placeholder="Aisha Malik" />
                    </label>
                    <label>
                      Expiry
                      <input placeholder="09/27" />
                    </label>
                    <label>
                      CVV
                      <input placeholder="123" />
                    </label>
                  </div>
                  <button className="primary-btn">Pay $150</button>
                </form>
              </div>
              <div className="confirmation card">
                <h4>Payment Submitted</h4>
                <p>
                  Thanks! We’ve received your details. You’ll receive an email
                  once the finance team confirms the payment.
                </p>
              </div>
            </div>
          </div>
            </article>
            )}

            {activeSection === "invoices" && (
              <article className="screen-card" id="invoices">
          <header className="screen-card__header">
            <h3>Member Invoices</h3>
            <p>Self-serve invoice list with detail panel.</p>
          </header>
          <div className="card">
            <Table
              columns={[
                "Invoice No",
                "Period",
                "Amount",
                "Status",
                "Due Date",
                "Action",
              ]}
              rows={memberInvoices.map((invoice) => ({
                "Invoice No": invoice.id,
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
                Action: {
                  render: () =>
                    invoice.status === "Paid" ? (
                      <button className="ghost-btn">View</button>
                    ) : (
                      <button className="secondary-btn">Pay Now</button>
                    ),
                },
              }))}
            />
            <div className="invoice-detail card">
              <h4>Invoice INV-2025-072</h4>
              <p>Period: Sep 2025 (Eid 2)</p>
              <p>Amount: $100</p>
              <p>
                Status: <span className="badge badge-overdue">Overdue</span>
              </p>
              <p>Due Date: 30 Sep 2025</p>
              <button className="primary-btn">Pay Now</button>
            </div>
          </div>
            </article>
            )}

            {activeSection === "history" && (
              <article className="screen-card" id="history">
          <header className="screen-card__header">
            <h3>Payment History</h3>
            <p>Chronological ledger for members.</p>
          </header>
          <ul className="timeline card">
            {memberPaymentHistory.map((item) => (
              <li key={item.reference}>
                <p>
                  {item.date} · {item.amount} · {item.method} · Ref{" "}
                  {item.reference}
                </p>
                <span className="badge badge-paid">Paid</span>
              </li>
            ))}
          </ul>
            </article>
            )}

            {activeSection === "profile" && (
              <article className="screen-card" id="profile">
          <header className="screen-card__header">
            <h3>Profile &amp; Notifications</h3>
            <p>Contact updates plus reminder preferences.</p>
          </header>
          <form className="card form-grid">
            <label>
              Name
              <input defaultValue="Aisha Malik" />
            </label>
            <label>
              Email
              <input defaultValue="aisha.malik@hk.org" />
            </label>
            <label>
              Mobile (WhatsApp)
              <input defaultValue="+852 9988 7766" />
            </label>
            <label className="checkbox full">
              <input type="checkbox" defaultChecked />
              Receive email reminders
            </label>
            <label className="checkbox full">
              <input type="checkbox" defaultChecked />
              Receive WhatsApp reminders
            </label>
            <div className="form-actions">
              <button className="secondary-btn">Cancel</button>
              <button className="primary-btn">Save Changes</button>
            </div>
          </form>
            </article>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}


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
        <div className="member-layout">
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
          <header className="screen-card__header">
            <h3>Member Dashboard</h3>
            <p>Greeting, current status, upcoming payments, quick links.</p>
          </header>
          <div className="card member-dashboard">
            <div className="member-nav">
              <div className="brand-mini">Subscription Manager HK</div>
              <nav>
                <a className="active" href="#dashboard">
                  Dashboard
                </a>
                <a href="#invoices">Invoices</a>
                <a href="#payments">Payments</a>
              </nav>
              <div className="avatar">AM</div>
            </div>
            <div className="member-content">
              <header>
                <h4>Hi Aisha 👋</h4>
                <p>Here’s a snapshot of your membership contributions.</p>
              </header>
              <div className="status-card">
                <div>
                  <p>Next Due Amount</p>
                  <h4>$50</h4>
                </div>
                <div>
                  <p>Next Due Date</p>
                  <h4>05 Nov 2025</h4>
                </div>
                <div>
                  <p>Outstanding Balance</p>
                  <h4>$150</h4>
                </div>
                <div>
                  <p>Status</p>
                  <span className="badge badge-unpaid">Unpaid</span>
                </div>
                <button className="primary-btn">Pay Now</button>
              </div>
              <div className="double-grid">
                <div>
                  <h4>Upcoming Payments</h4>
                  <ul className="list">
                    {memberUpcomingPayments.map((item) => (
                      <li key={item.label}>
                        <div>
                          <strong>{item.label}</strong>
                          <span>Due {item.due}</span>
                        </div>
                        <div>
                          <p>{item.amount}</p>
                          <span className={statusClass[item.status]}>
                            {item.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Shortcuts</h4>
                  <div className="shortcuts">
                    <button className="secondary-btn">View Invoices</button>
                    <button className="secondary-btn">Payment History</button>
                    <button className="secondary-btn">
                      Update Contact Details
                    </button>
                  </div>
                </div>
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


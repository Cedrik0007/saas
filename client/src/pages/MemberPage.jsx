import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { useApp } from "../context/AppContext.jsx";
import { statusClass } from "../statusClasses";

export function MemberPage() {
  const {
    invoices,
    paymentHistory,
    addPayment,
    updateInvoice,
  } = useApp();

  const sections = [
    { id: "dashboard", label: "Dashboard" },
    { id: "pay", label: "Pay Now" },
    { id: "invoices", label: "Invoices" },
    { id: "history", label: "Payment History" },
    { id: "profile", label: "Profile" },
  ];

  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Bank Transfer");
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Card payment form
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    nameOnCard: "",
    expiry: "",
    cvv: "",
  });

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: "Aisha Malik",
    email: "aisha.malik@hk.org",
    phone: "+852 9988 7766",
    emailReminders: true,
    whatsappReminders: true,
  });

  const navigate = useNavigate();

  const handleNavClick = (id) => {
    setActiveSection(id);
    setShowPaymentSuccess(false);
  };

  const handleLogout = () => {
    navigate("/login", { replace: true });
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Get unpaid invoices
  const getUnpaidInvoices = () => {
    return invoices.filter((inv) => inv.status === "Unpaid" || inv.status === "Overdue");
  };

  // Get upcoming payments
  const getUpcomingPayments = () => {
    const unpaid = getUnpaidInvoices();
    return unpaid.map((inv) => ({
      label: inv.period,
      due: inv.due,
      amount: inv.amount,
      status: inv.status,
      id: inv.id,
    }));
  };

  // Calculate total amount to pay
  const calculateTotal = () => {
    return selectedInvoices.reduce((total, invId) => {
      const invoice = invoices.find((inv) => inv.id === invId);
      if (invoice) {
        return total + parseFloat(invoice.amount.replace("$", ""));
      }
      return total;
    }, 0);
  };

  // Handle invoice selection for payment
  const handleSelectInvoice = (invoiceId) => {
    if (selectedInvoices.includes(invoiceId)) {
      setSelectedInvoices(selectedInvoices.filter((id) => id !== invoiceId));
    } else {
      setSelectedInvoices([...selectedInvoices, invoiceId]);
    }
  };

  // Handle manual payment submission (Bank Transfer, FPS, etc.)
  const handleManualPayment = (e) => {
    e.preventDefault();

    if (selectedInvoices.length === 0) {
      showToast("Please select at least one invoice to pay", "error");
      return;
    }

    if (!paymentReference) {
      showToast("Please enter a transaction reference", "error");
      return;
    }

    // Process each selected invoice
    selectedInvoices.forEach((invoiceId) => {
      const invoice = invoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        // Update invoice status to pending verification
        updateInvoice(invoiceId, {
          status: "Pending Verification",
          method: selectedPaymentMethod,
          reference: paymentReference,
        });

        // Add payment record
        addPayment({
          invoiceId: invoiceId,
          amount: invoice.amount,
          method: selectedPaymentMethod,
          reference: paymentReference,
          member: "Aisha Malik",
          period: invoice.period,
          status: "Pending Verification",
        });
      }
    });

    // Reset form and show success
    setPaymentReference("");
    setPaymentProof(null);
    setSelectedInvoices([]);
    setShowPaymentSuccess(true);
    showToast("Payment submitted successfully! Awaiting verification.");
  };

  // Handle card payment
  const handleCardPayment = (e) => {
    e.preventDefault();

    if (selectedInvoices.length === 0) {
      showToast("Please select at least one invoice to pay", "error");
      return;
    }

    if (!cardForm.cardNumber || !cardForm.nameOnCard || !cardForm.expiry || !cardForm.cvv) {
      showToast("Please fill in all card details", "error");
      return;
    }

    // Process each selected invoice
    selectedInvoices.forEach((invoiceId) => {
      const invoice = invoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        const reference = `CC${Date.now()}`;
        
        // Update invoice status to Paid
        updateInvoice(invoiceId, {
          status: "Paid",
          method: "Credit Card",
          reference: reference,
        });

        // Add payment record
        addPayment({
          invoiceId: invoiceId,
          amount: invoice.amount,
          method: "Credit Card",
          reference: reference,
          member: "Aisha Malik",
          period: invoice.period,
          status: "Paid",
        });
      }
    });

    // Reset form and show success
    setCardForm({
      cardNumber: "",
      nameOnCard: "",
      expiry: "",
      cvv: "",
    });
    setSelectedInvoices([]);
    setShowPaymentSuccess(true);
    showToast("Payment successful!");
  };

  // Handle profile update
  const handleUpdateProfile = (e) => {
    e.preventDefault();
    showToast("Profile updated successfully!");
  };

  // Calculate statistics for dashboard
  const calculateStats = () => {
    const unpaidInvoices = getUnpaidInvoices();
    const outstanding = unpaidInvoices.reduce((total, inv) => {
      return total + parseFloat(inv.amount.replace("$", ""));
    }, 0);

    const paidInvoices = invoices.filter((inv) => inv.status === "Paid");
    const paidThisYear = paidInvoices.reduce((total, inv) => {
      return total + parseFloat(inv.amount.replace("$", ""));
    }, 0);

    const nextDueInvoice = unpaidInvoices.sort((a, b) => 
      new Date(a.due) - new Date(b.due)
    )[0];

    return {
      outstanding,
      paidThisYear,
      nextDue: nextDueInvoice?.due || "N/A",
      nextDueAmount: nextDueInvoice?.amount || "$0",
    };
  };

  const stats = calculateStats();

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
            {/* DASHBOARD */}
            {activeSection === "dashboard" && (
              <article className="screen-card" id="dashboard">
                <header className="member-dashboard-header">
                  <div>
                    <h2>Welcome back, Aisha</h2>
                    <p className="dashboard-subtitle">Here's an overview of your membership account</p>
                  </div>
                  <button className="primary-btn" onClick={() => handleNavClick("pay")}>
                    Pay Now
                  </button>
                </header>

                {/* Alert Banner */}
                {stats.outstanding > 0 && (
                  <div className="alert-banner alert-warning">
                    <div className="alert-content">
                      <strong>Payment Due Soon</strong>
                      <p>
                        You have an outstanding balance of ${stats.outstanding}. Please pay to avoid late
                        fees.
                      </p>
                    </div>
                    <button className="alert-dismiss">×</button>
                  </div>
                )}

                {/* Stats Cards */}
                <div className="member-stats-grid">
                  <div className="stat-card stat-primary">
                    <div className="stat-details">
                      <span className="stat-label">Outstanding Balance</span>
                      <h3 className="stat-value">${stats.outstanding}</h3>
                      <span className="stat-change negative">
                        {getUnpaidInvoices().length} invoice(s) pending
                      </span>
                    </div>
                  </div>

                  <div className="stat-card stat-success">
                    <div className="stat-details">
                      <span className="stat-label">Next Due Date</span>
                      <h3 className="stat-value">{stats.nextDue}</h3>
                      <span className="stat-change">{stats.nextDueAmount}</span>
                    </div>
                  </div>

                  <div className="stat-card stat-info">
                    <div className="stat-details">
                      <span className="stat-label">Paid This Year</span>
                      <h3 className="stat-value">${stats.paidThisYear}</h3>
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
                      <span className="badge-count">{getUpcomingPayments().length}</span>
                    </div>
                    <div className="payment-list">
                      {getUpcomingPayments().slice(0, 3).map((item) => (
                        <div key={item.id} className="payment-item">
                          <div className="payment-info">
                            <strong className="payment-title">{item.label}</strong>
                            <span className="payment-date">Due {item.due}</span>
                          </div>
                          <div className="payment-right">
                            <span className="payment-amount">{item.amount}</span>
                            <span className={statusClass[item.status]}>{item.status}</span>
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
                      {paymentHistory.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="activity-item">
                          <div className="activity-details">
                            <strong>Payment Received</strong>
                            <span>
                              {item.date} • {item.amount} via {item.method}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="btn-link" onClick={() => handleNavClick("history")}>
                      View Payment History →
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div className="dashboard-card quick-actions-card">
                    <h4>Quick Actions</h4>
                    <div className="quick-actions-grid">
                      <button
                        className="quick-action-btn"
                        onClick={() => handleNavClick("pay")}
                      >
                        <span className="action-label">Pay Now</span>
                      </button>
                      <button
                        className="quick-action-btn"
                        onClick={() => handleNavClick("invoices")}
                      >
                        <span className="action-label">View Invoices</span>
                      </button>
                      <button
                        className="quick-action-btn"
                        onClick={() => handleNavClick("history")}
                      >
                        <span className="action-label">Payment History</span>
                      </button>
                      <button
                        className="quick-action-btn"
                        onClick={() => handleNavClick("profile")}
                      >
                        <span className="action-label">Settings</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* PAY NOW */}
            {activeSection === "pay" && (
              <article className="screen-card" id="pay">
                <header className="screen-card__header">
                  <h3>Pay Now</h3>
                  <p>Select invoices and choose your payment method.</p>
                </header>

                {showPaymentSuccess ? (
                  <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
                    <h2>Payment {selectedPaymentMethod === "Card" ? "Successful" : "Submitted"}</h2>
                    <p style={{ color: "#666", marginBottom: "24px" }}>
                      {selectedPaymentMethod === "Card"
                        ? "Your payment has been processed successfully."
                        : "Your payment details have been submitted and are awaiting verification."}
                    </p>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                      <button className="primary-btn" onClick={() => handleNavClick("dashboard")}>
                        Back to Dashboard
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setShowPaymentSuccess(false);
                          handleNavClick("invoices");
                        }}
                      >
                        View Invoices
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    {/* Invoice Selection */}
                    <div className="due-summary">
                      <h4>Select Invoices to Pay</h4>
                      <ul style={{ listStyle: "none", padding: 0 }}>
                        {getUnpaidInvoices().map((invoice) => (
                          <li key={invoice.id} style={{ marginBottom: "12px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <input
                                type="checkbox"
                                checked={selectedInvoices.includes(invoice.id)}
                                onChange={() => handleSelectInvoice(invoice.id)}
                              />
                              <span>
                                {invoice.period} · {invoice.amount}
                                <span className={statusClass[invoice.status]} style={{ marginLeft: "8px" }}>
                                  {invoice.status}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      {selectedInvoices.length > 0 && (
                        <p className="total" style={{ marginTop: "16px", fontSize: "1.2rem" }}>
                          Total: ${calculateTotal()}
                        </p>
                      )}
                    </div>

                    {/* Payment Methods */}
                    <div className="payment-methods">
                      <div className="tabs">
                        <button
                          className={`tab ${selectedPaymentMethod === "Bank Transfer" ? "active" : ""}`}
                          onClick={() => setSelectedPaymentMethod("Bank Transfer")}
                        >
                          Bank Transfer
                        </button>
                        <button
                          className={`tab ${selectedPaymentMethod === "FPS" ? "active" : ""}`}
                          onClick={() => setSelectedPaymentMethod("FPS")}
                        >
                          FPS
                        </button>
                        <button
                          className={`tab ${selectedPaymentMethod === "PayMe" ? "active" : ""}`}
                          onClick={() => setSelectedPaymentMethod("PayMe")}
                        >
                          PayMe
                        </button>
                        <button
                          className={`tab ${selectedPaymentMethod === "Alipay" ? "active" : ""}`}
                          onClick={() => setSelectedPaymentMethod("Alipay")}
                        >
                          Alipay
                        </button>
                        <button
                          className={`tab ${selectedPaymentMethod === "Card" ? "active" : ""}`}
                          onClick={() => setSelectedPaymentMethod("Card")}
                        >
                          Card
                        </button>
                      </div>

                      {/* Manual Payment Methods */}
                      {selectedPaymentMethod !== "Card" && (
                        <form className="method-panel" onSubmit={handleManualPayment}>
                          <p style={{ marginBottom: "16px", color: "#666" }}>
                            {selectedPaymentMethod === "Bank Transfer" &&
                              "Transfer to HSBC Hong Kong · Account 123-456789-001 · Name: Subscription Manager HK"}
                            {selectedPaymentMethod === "FPS" && "FPS ID: 1234567"}
                            {selectedPaymentMethod === "PayMe" &&
                              "Scan the PayMe QR code and complete the payment"}
                            {selectedPaymentMethod === "Alipay" &&
                              "Scan the Alipay QR code and complete the payment"}
                          </p>

                          <label>
                            Transaction Reference *
                            <input
                              required
                              placeholder="e.g. FP89231"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                            />
                          </label>

                          <label>
                            Upload Payment Proof (Optional)
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setPaymentProof(e.target.files[0])}
                            />
                          </label>

                          <button type="submit" className="primary-btn" style={{ marginTop: "16px" }}>
                            Submit Payment Details
                          </button>
                        </form>
                      )}

                      {/* Card Payment */}
                      {selectedPaymentMethod === "Card" && (
                        <form className="method-panel" onSubmit={handleCardPayment}>
                          <div className="card-form">
                            <label>
                              Card Number *
                              <input
                                required
                                placeholder="4242 4242 4242 4242"
                                value={cardForm.cardNumber}
                                onChange={(e) =>
                                  setCardForm({ ...cardForm, cardNumber: e.target.value })
                                }
                              />
                            </label>

                            <div className="inline">
                              <label>
                                Name on Card *
                                <input
                                  required
                                  placeholder="Aisha Malik"
                                  value={cardForm.nameOnCard}
                                  onChange={(e) =>
                                    setCardForm({ ...cardForm, nameOnCard: e.target.value })
                                  }
                                />
                              </label>

                              <label>
                                Expiry *
                                <input
                                  required
                                  placeholder="MM/YY"
                                  value={cardForm.expiry}
                                  onChange={(e) =>
                                    setCardForm({ ...cardForm, expiry: e.target.value })
                                  }
                                />
                              </label>

                              <label>
                                CVV *
                                <input
                                  required
                                  placeholder="123"
                                  type="password"
                                  maxLength="3"
                                  value={cardForm.cvv}
                                  onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value })}
                                />
                              </label>
                            </div>

                            <button type="submit" className="primary-btn" style={{ marginTop: "16px" }}>
                              Pay ${calculateTotal()}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </article>
            )}

            {/* INVOICES */}
            {activeSection === "invoices" && (
              <article className="screen-card" id="invoices">
                <header className="screen-card__header">
                  <h3>My Invoices</h3>
                  <p>View all your invoices and payment status.</p>
                </header>
                <div className="card">
                  <Table
                    columns={["Invoice No", "Period", "Amount", "Status", "Due Date", "Action"]}
                    rows={invoices.map((invoice) => ({
                      "Invoice No": invoice.id,
                      Period: invoice.period,
                      Amount: invoice.amount,
                      Status: {
                        render: () => (
                          <span className={statusClass[invoice.status]}>{invoice.status}</span>
                        ),
                      },
                      "Due Date": invoice.due,
                      Action: {
                        render: () =>
                          invoice.status === "Paid" || invoice.status === "Pending Verification" ? (
                            <button className="ghost-btn" style={{ padding: "6px 12px" }}>
                              View
                            </button>
                          ) : (
                            <button
                              className="primary-btn"
                              style={{ padding: "6px 12px" }}
                              onClick={() => {
                                setSelectedInvoices([invoice.id]);
                                handleNavClick("pay");
                              }}
                            >
                              Pay Now
                            </button>
                          ),
                      },
                    }))}
                  />
                </div>
              </article>
            )}

            {/* PAYMENT HISTORY */}
            {activeSection === "history" && (
              <article className="screen-card" id="history">
                <header className="screen-card__header">
                  <h3>Payment History</h3>
                  <p>Complete record of all your payments.</p>
                </header>
                <ul className="timeline card">
                  {paymentHistory.map((item, idx) => (
                    <li key={idx}>
                      <p>
                        {item.date} · {item.amount} · {item.method} · Ref {item.reference}
                      </p>
                      <span className="badge badge-paid">Paid</span>
                    </li>
                  ))}
                </ul>
              </article>
            )}

            {/* PROFILE */}
            {activeSection === "profile" && (
              <article className="screen-card" id="profile">
                <header className="screen-card__header">
                  <h3>Profile &amp; Notifications</h3>
                  <p>Update your contact information and preferences.</p>
                </header>
                <form className="card form-grid" onSubmit={handleUpdateProfile}>
                  <label>
                    Name
                    <input
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </label>

                  <label>
                    Mobile (WhatsApp)
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </label>

                  <label className="checkbox full">
                    <input
                      type="checkbox"
                      checked={profileForm.emailReminders}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, emailReminders: e.target.checked })
                      }
                    />
                    Receive email reminders
                  </label>

                  <label className="checkbox full">
                    <input
                      type="checkbox"
                      checked={profileForm.whatsappReminders}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, whatsappReminders: e.target.checked })
                      }
                    />
                    Receive WhatsApp reminders
                  </label>

                  <div className="form-actions">
                    <button type="button" className="secondary-btn">
                      Cancel
                    </button>
                    <button type="submit" className="primary-btn">
                      Save Changes
                    </button>
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

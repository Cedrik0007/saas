import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { useApp } from "../context/AppContext.jsx";
import { statusClass } from "../statusClasses";

export function MemberPage() {
  const {
    members,  // Get members from MongoDB
    invoices,
    paymentHistory,
    addPayment,
    updateInvoice,
    updateMember,
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  
  // Card payment form
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    nameOnCard: "",
    expiry: "",
    cvv: "",
  });

  // Get current member from MongoDB based on email in sessionStorage (case-insensitive)
  const memberEmail = sessionStorage.getItem('memberEmail');
  const currentMember = memberEmail 
    ? members.find(m => m.email && m.email.toLowerCase() === memberEmail.toLowerCase())
    : null;

  // Profile form - use MongoDB data
  const [profileForm, setProfileForm] = useState(() => {
    if (currentMember) {
      return {
        name: currentMember.name || "",
        email: currentMember.email || "",
        phone: currentMember.phone || "",
        emailReminders: true,
        whatsappReminders: true,
      };
    }
    return {
      name: "",
      email: "",
      phone: "",
      emailReminders: true,
      whatsappReminders: true,
    };
  });

  // Update profile when member data changes
  useEffect(() => {
    if (currentMember) {
      setProfileForm({
        name: currentMember.name || "",
        email: currentMember.email || "",
        phone: currentMember.phone || "",
        emailReminders: true,
        whatsappReminders: true,
      });
    }
  }, [currentMember, members]);

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

  // Get unpaid invoices for current member only
  const getUnpaidInvoices = () => {
    if (!currentMember) return [];
    return invoices.filter((inv) => 
      (inv.status === "Unpaid" || inv.status === "Overdue") &&
      (inv.memberId === currentMember.id || inv.memberEmail === currentMember.email || inv.memberName === currentMember.name)
    );
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
          member: currentMember?.name || "Member",
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
          member: currentMember?.name || "Member",
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
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    if (!currentMember) {
      showToast("Member not found", "error");
      return;
    }

    try {
      // Update member in MongoDB
      await updateMember(currentMember.id, {
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
      });
      
      showToast("Profile updated successfully!");
      setIsEditingProfile(false);
      
      // Refresh members to get updated data
      // The useEffect will update profileForm when currentMember changes
    } catch (error) {
      console.error("Error updating profile:", error);
      showToast("Failed to update profile. Please try again.", "error");
    }
  };

  // Calculate statistics for dashboard
  const calculateStats = () => {
    const unpaidInvoices = getUnpaidInvoices();
    const outstanding = unpaidInvoices.reduce((total, inv) => {
      return total + parseFloat(inv.amount.replace("$", ""));
    }, 0);

    // Filter paid invoices for current member only
    const paidInvoices = invoices.filter((inv) => 
      inv.status === "Paid" &&
      (inv.memberId === currentMember?.id || inv.memberEmail === currentMember?.email || inv.memberName === currentMember?.name)
    );
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
            <h3>{currentMember?.name || "Member"}</h3>
            {/* <p>Balance: {currentMember?.balance || "$0"} | Next Due: {currentMember?.nextDue || "N/A"}</p> */}
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
                    <h2>Welcome back, {currentMember?.name?.split(' ')[0] || "Member"}</h2>
                    <p className="dashboard-subtitle">Here's an overview of your membership account</p>
                  </div>
                  <button className="primary-btn" onClick={() => handleNavClick("pay")}>
                    Pay Now
                  </button>
                </header>

                {/* Alert Banner */}
                {stats.outstanding > 0 && !isAlertDismissed && (
                  <div className="alert-banner alert-warning">
                    <div className="alert-content">
                      <strong>Payment Due Soon</strong>
                      <p>
                        You have an outstanding balance of ${stats.outstanding.toFixed(2)}. Please pay to avoid late
                        fees.
                      </p>
                    </div>
                    <button 
                      className="alert-dismiss" 
                      onClick={() => setIsAlertDismissed(true)}
                      style={{ cursor: "pointer" }}
                    >
                      ×
                    </button>
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
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "20px",
                  marginTop: "24px"
                }}>
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
                      {(() => {
                        const memberPayments = currentMember 
                          ? paymentHistory.filter((item) => 
                              item.memberId === currentMember.id || 
                              item.memberEmail === currentMember.email || 
                              item.member === currentMember.name
                            )
                          : paymentHistory;
                        
                        const recentPayments = memberPayments.slice(0, 3);
                        
                        if (recentPayments.length === 0) {
                          return (
                            <div style={{ 
                              textAlign: "center", 
                              padding: "20px",
                              color: "#666",
                              fontSize: "0.9rem"
                            }}>
                              No recent payments
                            </div>
                          );
                        }
                        
                        return recentPayments.map((item, idx) => (
                          <div key={idx} className="activity-item">
                            <div className="activity-details">
                              <strong>Payment Made</strong>
                              <span>
                                {item.date} • {item.amount} via {item.method}
                                {item.reference && ` • Ref: ${item.reference}`}
                              </span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    {(() => {
                      const memberPayments = currentMember 
                        ? paymentHistory.filter((item) => 
                            item.memberId === currentMember.id || 
                            item.memberEmail === currentMember.email || 
                            item.member === currentMember.name
                          )
                        : paymentHistory;
                      
                      return memberPayments.length > 0 && (
                        <button className="btn-link" onClick={() => handleNavClick("history")}>
                          View Payment History →
                        </button>
                      );
                    })()}
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
                    <div className="invoice-selection-section" style={{ marginBottom: "32px" }}>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        marginBottom: "20px",
                        flexWrap: "wrap",
                        gap: "12px"
                      }}>
                        <h4 style={{ margin: 0 }}>Select Invoices to Pay</h4>
                        {getUnpaidInvoices().length > 0 && (
                          <button
                            type="button"
                            className="ghost-btn"
                            style={{ 
                              fontSize: "0.875rem",
                              padding: "6px 12px"
                            }}
                            onClick={() => {
                              if (selectedInvoices.length === getUnpaidInvoices().length) {
                                setSelectedInvoices([]);
                              } else {
                                setSelectedInvoices(getUnpaidInvoices().map(inv => inv.id));
                              }
                            }}
                          >
                            {selectedInvoices.length === getUnpaidInvoices().length ? "Deselect All" : "Select All"}
                          </button>
                        )}
                      </div>
                      
                      {getUnpaidInvoices().length === 0 ? (
                        <div style={{ 
                          textAlign: "center", 
                          padding: "40px 20px",
                          color: "#666"
                        }}>
                          <p style={{ margin: 0, fontSize: "1rem" }}>No unpaid invoices available.</p>
                        </div>
                      ) : (
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                          gap: "16px",
                          marginBottom: "24px"
                        }}>
                          {getUnpaidInvoices().map((invoice) => {
                            const isSelected = selectedInvoices.includes(invoice.id);
                            return (
                              <label
                                key={invoice.id}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  padding: "16px",
                                  border: `2px solid ${isSelected ? "var(--primary, #000)" : "#e0e0e0"}`,
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  backgroundColor: isSelected ? "rgba(0, 0, 0, 0.02)" : "#fff",
                                  position: "relative"
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.borderColor = "#ccc";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.borderColor = "#e0e0e0";
                                  }
                                }}
                              >
                                <div style={{ 
                                  display: "flex", 
                                  alignItems: "flex-start", 
                                  gap: "12px",
                                  marginBottom: "12px"
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleSelectInvoice(invoice.id)}
                                    style={{
                                      marginTop: "2px",
                                      width: "18px",
                                      height: "18px",
                                      cursor: "pointer",
                                      flexShrink: 0
                                    }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ 
                                      fontWeight: "600", 
                                      fontSize: "0.95rem",
                                      marginBottom: "4px",
                                      color: "#000"
                                    }}>
                                      {invoice.period}
                                    </div>
                                    <div style={{ 
                                      fontSize: "0.875rem", 
                                      color: "#666",
                                      marginBottom: "8px"
                                    }}>
                                      Due: {invoice.due}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ 
                                  display: "flex", 
                                  justifyContent: "space-between", 
                                  alignItems: "center",
                                  marginTop: "auto",
                                  paddingTop: "12px",
                                  borderTop: "1px solid #f0f0f0"
                                }}>
                                  <span style={{ 
                                    fontSize: "1.1rem", 
                                    fontWeight: "600",
                                    color: "#000"
                                  }}>
                                    {invoice.amount}
                                  </span>
                                  <span className={statusClass[invoice.status]} style={{ 
                                    fontSize: "0.75rem",
                                    padding: "4px 8px"
                                  }}>
                                    {invoice.status}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      
                      {selectedInvoices.length > 0 && (
                        <div style={{
                          padding: "20px",
                          backgroundColor: "#f8f8f8",
                          borderRadius: "8px",
                          border: "1px solid #e0e0e0"
                        }}>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "12px"
                          }}>
                            <div>
                              <div style={{ 
                                fontSize: "0.875rem", 
                                color: "#666",
                                marginBottom: "4px"
                              }}>
                                {selectedInvoices.length} invoice{selectedInvoices.length > 1 ? 's' : ''} selected
                              </div>
                              <div style={{ 
                                fontSize: "1.5rem", 
                                fontWeight: "600",
                                color: "#000"
                              }}>
                                Total: ${calculateTotal().toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
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
                                  placeholder={currentMember?.name || "Enter name"}
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
                    rows={(currentMember ? invoices.filter((inv) => 
                      inv.memberId === currentMember.id || 
                      inv.memberEmail === currentMember.email || 
                      inv.memberName === currentMember.name
                    ) : invoices).map((invoice) => ({
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
                  {(currentMember ? paymentHistory.filter((item) => 
                    item.memberId === currentMember.id || 
                    item.memberEmail === currentMember.email || 
                    item.member === currentMember.name
                  ) : paymentHistory).map((item, idx) => (
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
                <header className="screen-card__header" style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "16px"
                }}>
                  <div>
                    <h3>Profile Settings</h3>
                    <p>Manage your account information and preferences.</p>
                  </div>
                  {!isEditingProfile && (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => setIsEditingProfile(true)}
                      style={{
                        padding: "10px 20px",
                        fontSize: "0.9rem"
                      }}
                    >
                      Edit Profile
                    </button>
                  )}
                </header>

                <form onSubmit={handleUpdateProfile}>
                  {/* Profile Header Card */}
                  <div className="card" style={{
                    padding: "24px",
                    marginBottom: "24px",
                    background: "linear-gradient(135deg, #f8f8f8 0%, #ffffff 100%)",
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px"
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      flexWrap: "wrap"
                    }}>
                      <div style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #000 0%, #333 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "2rem",
                        fontWeight: "600",
                        flexShrink: 0
                      }}>
                        {currentMember?.name?.charAt(0)?.toUpperCase() || "M"}
                      </div>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <h4 style={{ margin: "0 0 8px 0", fontSize: "1.5rem", fontWeight: "600" }}>
                          {currentMember?.name || "Member"}
                        </h4>
                        <p style={{ margin: "0 0 4px 0", color: "#666", fontSize: "0.9rem" }}>
                          {currentMember?.email || "No email"}
                        </p>
                        <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                          {currentMember?.phone || "No phone"}
                        </p>
                      </div>
                      <div style={{
                        padding: "8px 16px",
                        background: currentMember?.status === "Active" ? "#e8f5e9" : "#fff3e0",
                        color: currentMember?.status === "Active" ? "#2e7d32" : "#e65100",
                        borderRadius: "20px",
                        fontSize: "0.875rem",
                        fontWeight: "500"
                      }}>
                        {currentMember?.status || "Active"}
                      </div>
                    </div>
                  </div>

                  {/* Member Details Section */}
                  <div className="card" style={{
                    padding: "24px",
                    marginBottom: "24px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px"
                  }}>
                    <h4 style={{
                      margin: "0 0 20px 0",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      paddingBottom: "12px",
                      borderBottom: "2px solid #f0f0f0"
                    }}>
                      Personal Information
                    </h4>
                    
                    {isEditingProfile ? (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "20px"
                      }}>
                        <label style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}>
                          <span style={{
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            color: "#333"
                          }}>
                            Full Name *
                          </span>
                          <input
                            required
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            style={{
                              padding: "12px 16px",
                              border: "1px solid #ddd",
                              borderRadius: "8px",
                              fontSize: "1rem",
                              transition: "border-color 0.2s",
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#000"}
                            onBlur={(e) => e.target.style.borderColor = "#ddd"}
                          />
                        </label>

                        <label style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}>
                          <span style={{
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            color: "#333"
                          }}>
                            Email Address *
                          </span>
                          <input
                            required
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            style={{
                              padding: "12px 16px",
                              border: "1px solid #ddd",
                              borderRadius: "8px",
                              fontSize: "1rem",
                              transition: "border-color 0.2s",
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#000"}
                            onBlur={(e) => e.target.style.borderColor = "#ddd"}
                          />
                        </label>

                        <label style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}>
                          <span style={{
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            color: "#333"
                          }}>
                            Phone Number (WhatsApp) *
                          </span>
                          <input
                            required
                            type="tel"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            placeholder="+852 1234 5678"
                            style={{
                              padding: "12px 16px",
                              border: "1px solid #ddd",
                              borderRadius: "8px",
                              fontSize: "1rem",
                              transition: "border-color 0.2s",
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#000"}
                            onBlur={(e) => e.target.style.borderColor = "#ddd"}
                          />
                        </label>
                      </div>
                    ) : (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "24px"
                      }}>
                        <div>
                          <div style={{
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            color: "#666",
                            marginBottom: "8px"
                          }}>
                            Full Name
                          </div>
                          <div style={{
                            fontSize: "1rem",
                            fontWeight: "500",
                            color: "#000"
                          }}>
                            {currentMember?.name || "N/A"}
                          </div>
                        </div>

                        <div>
                          <div style={{
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            color: "#666",
                            marginBottom: "8px"
                          }}>
                            Email Address
                          </div>
                          <div style={{
                            fontSize: "1rem",
                            fontWeight: "500",
                            color: "#000"
                          }}>
                            {currentMember?.email || "N/A"}
                          </div>
                        </div>

                        <div>
                          <div style={{
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            color: "#666",
                            marginBottom: "8px"
                          }}>
                            Phone Number
                          </div>
                          <div style={{
                            fontSize: "1rem",
                            fontWeight: "500",
                            color: "#000"
                          }}>
                            {currentMember?.phone || "N/A"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notification Preferences Section */}
                  <div className="card" style={{
                    padding: "24px",
                    marginBottom: "24px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px"
                  }}>
                    <h4 style={{
                      margin: "0 0 20px 0",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      paddingBottom: "12px",
                      borderBottom: "2px solid #f0f0f0"
                    }}>
                      Notification Preferences
                    </h4>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px"
                    }}>
                      <label style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        background: profileForm.emailReminders ? "#f8f8f8" : "#fff"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "#ccc"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                      >
                        <div>
                          <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                            Email Reminders
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#666" }}>
                            Receive payment reminders and updates via email
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={profileForm.emailReminders}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, emailReminders: e.target.checked })
                          }
                          style={{
                            width: "20px",
                            height: "20px",
                            cursor: "pointer"
                          }}
                        />
                      </label>

                      <label style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        background: profileForm.whatsappReminders ? "#f8f8f8" : "#fff"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "#ccc"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                      >
                        <div>
                          <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                            WhatsApp Reminders
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#666" }}>
                            Receive payment reminders via WhatsApp
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={profileForm.whatsappReminders}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, whatsappReminders: e.target.checked })
                          }
                          style={{
                            width: "20px",
                            height: "20px",
                            cursor: "pointer"
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Form Actions */}
                  {isEditingProfile && (
                    <div style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "12px",
                      paddingTop: "24px",
                      borderTop: "1px solid #f0f0f0"
                    }}>
                      <button 
                        type="button" 
                        className="secondary-btn"
                        onClick={() => {
                          setIsEditingProfile(false);
                          if (currentMember) {
                            setProfileForm({
                              name: currentMember.name || "",
                              email: currentMember.email || "",
                              phone: currentMember.phone || "",
                              emailReminders: true,
                              whatsappReminders: true,
                            });
                          }
                        }}
                        style={{
                          padding: "12px 24px",
                          minWidth: "120px"
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="primary-btn"
                        style={{
                          padding: "12px 24px",
                          minWidth: "120px"
                        }}
                      >
                        Save Changes
                      </button>
                    </div>
                  )}
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

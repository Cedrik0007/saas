import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { useApp } from "../context/AppContext.jsx";
import { statusClass } from "../statusClasses";

export function MemberPage() {
  const {
    members,  // Get members from MongoDB
    admins,  // Get admins for payment selection
    invoices,
    payments,
    paymentHistory,
    addPayment,
    updateInvoice,
    updateMember,
    fetchInvoices,
    fetchPayments,
  } = useApp();

  const sections = [
    { id: "dashboard", label: "Dashboard" },
    { id: "pay", label: "Pay Now" },
    { id: "invoices", label: "Invoices" },
    { id: "history", label: "Payment History" },
    { id: "profile", label: "Profile" },
  ];

  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Online Payment");
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

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

  // Refresh invoices and payments when viewing invoices section to ensure status is up to date
  useEffect(() => {
    if (activeSection === "invoices" || activeSection === "history") {
      fetchInvoices();
      fetchPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]); // Only depend on activeSection to prevent unnecessary re-fetches

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

  // Get effective invoice status based on payment status
  const getEffectiveInvoiceStatus = (invoice) => {
    // Check if there's a payment for this invoice
    const relatedPayment = (payments || paymentHistory || []).find(
      (p) => p.invoiceId === invoice.id
    );

    if (relatedPayment) {
      // If payment is pending, invoice should show "Pending Verification"
      if (relatedPayment.status === "Pending") {
        return "Pending Verification";
      }
      // If payment is completed (approved), invoice should show "Paid"
      if (relatedPayment.status === "Completed") {
        return "Paid";
      }
      // If payment is rejected, invoice should show "Unpaid"
      if (relatedPayment.status === "Rejected") {
        return "Unpaid";
      }
    }

    // If no payment or payment status doesn't match, return invoice's current status
    return invoice.status;
  };

  // Get unpaid invoices for current member only
  const getUnpaidInvoices = () => {
    if (!currentMember) return [];
    return invoices.filter((inv) => {
      const effectiveStatus = getEffectiveInvoiceStatus(inv);
      return (
        (effectiveStatus === "Unpaid" || effectiveStatus === "Overdue") &&
        (inv.memberId === currentMember.id || inv.memberEmail === currentMember.email || inv.memberName === currentMember.name)
      );
    });
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


  // Handle screenshot payment submission
  const handleScreenshotPayment = async (e) => {
    e.preventDefault();

    if (selectedInvoices.length === 0) {
      showToast("Please select at least one invoice", "error");
      return;
    }

    if (!paymentProof) {
      showToast("Please upload a payment screenshot", "error");
      return;
    }

    setUploading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
      // Upload screenshot to Cloudinary
      const formData = new FormData();
      formData.append("screenshot", paymentProof);

      const uploadResponse = await fetch(`${apiUrl}/api/upload-screenshot`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        // Try to get error message from response
        let errorMessage = "Failed to upload screenshot";
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
      
      const screenshotUrl = uploadData.url;

      // Process each selected invoice
      for (const invoiceId of selectedInvoices) {
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (invoice) {
          // Update invoice status to Pending Verification (NOT Paid)
          await updateInvoice(invoiceId, {
            status: "Pending Verification",
            method: "Screenshot",
            reference: `PENDING_${Date.now()}`,
            screenshot: screenshotUrl,
          });

          // Add payment record with Pending status
          await addPayment({
            invoiceId: invoiceId,
            amount: invoice.amount,
            method: "Screenshot",
            reference: `PENDING_${Date.now()}`,
            member: currentMember?.name || "Member",
            memberId: currentMember?.id,
            memberEmail: currentMember?.email,
            period: invoice.period,
            status: "Pending",
            screenshot: screenshotUrl,
          });
        }
      }

      // Reset form and show success
      setPaymentProof(null);
      setSelectedInvoices([]);
      setShowPaymentSuccess(true);
      showToast(`Payment proof submitted successfully! ${selectedInvoices.length} invoice(s) pending admin approval.`);
    } catch (error) {
      console.error("Error submitting payment:", error);
      // Show the actual error message
      showToast(error.message || "Failed to submit payment. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Handle admin payment submission
  const handleAdminPayment = async (e) => {
    e.preventDefault();

    if (selectedInvoices.length === 0) {
      showToast("Please select at least one invoice", "error");
      return;
    }

    if (!selectedAdminId) {
      showToast("Please select the admin you paid to", "error");
      return;
    }

    setUploading(true);
    try {
      const admin = admins.find((a) => a.id === selectedAdminId);
      
      if (!admin) {
        showToast("Admin not found", "error");
        return;
      }

      let screenshotUrl = null;
      
      // Upload screenshot if provided
      if (paymentProof) {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        
        const formData = new FormData();
        formData.append("screenshot", paymentProof);

        const uploadResponse = await fetch(`${apiUrl}/api/upload-screenshot`, {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          // Try to get error message from response
          let errorMessage = "Failed to upload screenshot";
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
        
        screenshotUrl = uploadData.url;
      }

      // Process each selected invoice
      for (const invoiceId of selectedInvoices) {
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (invoice) {
          // Update invoice status to Pending Verification (requires admin approval)
          await updateInvoice(invoiceId, {
            status: "Pending Verification",
            method: "Cash to Admin",
            reference: `CASH_PENDING_${Date.now()}`,
            paidToAdmin: admin.id,
            paidToAdminName: admin.name,
            screenshot: screenshotUrl,
          });

          // Add payment record with Pending status (requires admin approval)
          await addPayment({
            invoiceId: invoiceId,
            amount: invoice.amount,
            method: "Cash to Admin",
            reference: `CASH_PENDING_${Date.now()}`,
            member: currentMember?.name || "Member",
            memberId: currentMember?.id,
            memberEmail: currentMember?.email,
            period: invoice.period,
            status: "Pending",
            paidToAdmin: admin.id,
            paidToAdminName: admin.name,
            screenshot: screenshotUrl,
          });
        }
      }

      // Reset form and show success
      setSelectedInvoices([]);
      setSelectedAdminId("");
      setPaymentProof(null);
      setShowPaymentSuccess(true);
      showToast(`Payment submitted successfully! ${selectedInvoices.length} invoice(s) pending admin approval.`);
    } catch (error) {
      console.error("Error submitting payment:", error);
      // Show the actual error message
      showToast(error.message || "Failed to submit payment. Please try again.", "error");
    } finally {
      setUploading(false);
    }
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

    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Calculate paid this year from payment history (more accurate)
    // Include both "Paid" and "Completed" statuses (Completed = approved by admin)
    const memberPayments = currentMember 
      ? paymentHistory.filter((item) => 
          (item.memberId === currentMember.id || 
           item.memberEmail === currentMember.email || 
           item.member === currentMember.name) &&
          (item.status === "Paid" || item.status === "Completed")
        )
      : paymentHistory.filter(item => item.status === "Paid" || item.status === "Completed");
    
    // Filter payments from current year
    const paymentsThisYear = memberPayments.filter((payment) => {
      if (!payment.date) return false;
      // Parse date (format: "DD MMM YYYY" or similar)
      const paymentDate = new Date(payment.date);
      return paymentDate.getFullYear() === currentYear;
    });
    
    // Sum all paid amounts from current year
    let paidThisYear = paymentsThisYear.reduce((total, payment) => {
      const amount = parseFloat(payment.amount?.replace(/[^0-9.]/g, '') || 0);
      return total + amount;
    }, 0);
    
    // Fallback: if no payment history, use paid invoices from current year
    if (paidThisYear === 0) {
      const paidInvoices = invoices.filter((inv) => 
        inv.status === "Paid" &&
        (inv.memberId === currentMember?.id || 
         inv.memberEmail === currentMember?.email || 
         inv.memberName === currentMember?.name)
      );
      
      // Filter by year based on due date or current year
      const paidInvoicesThisYear = paidInvoices.filter((inv) => {
        if (inv.due) {
          const dueDate = new Date(inv.due);
          return dueDate.getFullYear() === currentYear;
        }
        return true; // Include if no due date
      });
      
      paidThisYear = paidInvoicesThisYear.reduce((total, inv) => {
        return total + parseFloat(inv.amount.replace("$", ""));
      }, 0);
    }

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
                      <h3 className="stat-value">${parseFloat(stats.paidThisYear).toFixed(2)}</h3>
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
                                {item.date} • {item.amount} via {(() => {
                                  // Show "Cash" for cash payments, "Online Payment" for online payments
                                  if (item.paidToAdmin || item.paidToAdminName || item.method === "Cash to Admin") {
                                    return "Cash";
                                  }
                                  const onlineMethods = ["Screenshot", "Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card", "Online Payment"];
                                  return onlineMethods.includes(item.method) ? "Online Payment" : (item.method || "N/A");
                                })()}
                                {item.paidToAdminName && ` • Paid to ${item.paidToAdminName}`}
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
                    <h2>Payment Submitted</h2>
                    <p style={{ color: "#666", marginBottom: "24px" }}>
                      Your payment has been submitted successfully.
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
                    {/* Invoice Selection Cards */}
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
                                  <span className={statusClass[getEffectiveInvoiceStatus(invoice)]} style={{ 
                                    fontSize: "0.75rem",
                                    padding: "4px 8px"
                                  }}>
                                    {getEffectiveInvoiceStatus(invoice)}
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

                    {/* Payment Methods - Two Options */}
                    {selectedInvoices.length > 0 && (
                      <div className="payment-methods">
                        <div className="tabs">
                          <button
                            className={`tab ${selectedPaymentMethod === "Online Payment" ? "active" : ""}`}
                            onClick={() => setSelectedPaymentMethod("Online Payment")}
                          >
                            Online Payment
                          </button>
                          <button
                            className={`tab ${selectedPaymentMethod === "Cash Payment" ? "active" : ""}`}
                            onClick={() => setSelectedPaymentMethod("Cash Payment")}
                          >
                            Cash Payment
                          </button>
                        </div>

                        {/* Online Payment Option */}
                        {selectedPaymentMethod === "Online Payment" && (
                          <form className="method-panel" onSubmit={handleScreenshotPayment}>
                            <p style={{ marginBottom: "16px", color: "#666" }}>
                              Upload a screenshot of your payment confirmation for the selected invoice(s). All selected invoices will be marked as paid once the screenshot is uploaded.
                            </p>

                            <label>
                              Upload Payment Screenshot *
                              <input
                                type="file"
                                accept="image/*"
                                required
                                onChange={(e) => setPaymentProof(e.target.files[0])}
                              />
                              {paymentProof && (
                                <div style={{ marginTop: "8px", fontSize: "0.875rem", color: "#666" }}>
                                  Selected: {paymentProof.name}
                                </div>
                              )}
                            </label>

                            <button 
                              type="submit" 
                              className="primary-btn" 
                              style={{ marginTop: "16px" }}
                              disabled={uploading}
                            >
                              {uploading ? "Uploading..." : `Pay $${calculateTotal().toFixed(2)}`}
                            </button>
                          </form>
                        )}

                        {/* Cash Payment Option */}
                        {selectedPaymentMethod === "Cash Payment" && (
                          <form className="method-panel" onSubmit={handleAdminPayment}>
                            <p style={{ marginBottom: "16px", color: "#666" }}>
                              Select the admin you paid to. You can optionally upload a payment screenshot as proof. All selected invoices will be pending admin approval.
                            </p>

                            <label>
                              Select Admin You Paid To *
                              <select
                                required
                                value={selectedAdminId || ""}
                                onChange={(e) => setSelectedAdminId(e.target.value)}
                                style={{ color: "#000" }}
                              >
                                <option value="">Choose an admin</option>
                                {admins.filter(admin => admin.status === 'Active').map((admin) => (
                                  <option key={admin.id} value={admin.id}>
                                    {admin.name} ({admin.email})
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              Upload Payment Screenshot (Optional)
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setPaymentProof(e.target.files[0])}
                              />
                              {paymentProof && (
                                <div style={{ marginTop: "8px", fontSize: "0.875rem", color: "#666" }}>
                                  Selected: {paymentProof.name}
                                </div>
                              )}
                            </label>

                            <button 
                              type="submit" 
                              className="primary-btn" 
                              style={{ marginTop: "16px" }}
                              disabled={uploading}
                            >
                              {uploading ? "Uploading..." : `Pay $${calculateTotal().toFixed(2)}`}
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    {selectedInvoices.length === 0 && (
                      <div style={{ 
                        textAlign: "center", 
                        padding: "40px 20px",
                        color: "#666",
                        border: "2px dashed #e0e0e0",
                        borderRadius: "8px"
                      }}>
                        <p style={{ margin: 0, fontSize: "1rem" }}>Please select at least one invoice above to proceed with payment.</p>
                      </div>
                    )}
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
                  {(() => {
                    if (!invoices || !Array.isArray(invoices)) {
                      return <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>Loading invoices...</div>;
                    }
                    
                    const memberInvoices = currentMember 
                      ? invoices.filter((inv) => 
                          inv && (
                            inv.memberId === currentMember.id || 
                            inv.memberEmail === currentMember.email || 
                            inv.memberName === currentMember.name
                          )
                        )
                      : invoices;
                    
                    if (memberInvoices.length === 0) {
                      return (
                        <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
                          <p>No invoices found.</p>
                        </div>
                      );
                    }
                    
                    return (
                      <Table
                        columns={["Invoice No", "Period", "Amount", "Status", "Due Date", "Action"]}
                        rows={memberInvoices.map((invoice) => {
                          if (!invoice) return null;
                          const effectiveStatus = getEffectiveInvoiceStatus(invoice);
                          return {
                            "Invoice No": invoice.id || "N/A",
                            Period: invoice.period || "N/A",
                            Amount: invoice.amount || "$0",
                            Status: {
                              render: () => (
                                <span className={statusClass[effectiveStatus] || "badge badge-unpaid"}>{effectiveStatus}</span>
                              ),
                            },
                            "Due Date": invoice.due || "N/A",
                            Action: {
                              render: () =>
                                effectiveStatus === "Paid" || effectiveStatus === "Pending Verification" ? (
                                  <button 
                                    className="ghost-btn" 
                                    style={{ padding: "6px 12px" }}
                                    onClick={() => setViewingInvoice(invoice)}
                                  >
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
                          };
                        }).filter(row => row !== null)}
                      />
                    );
                  })()}
                </div>
              </article>
            )}

            {/* INVOICE DETAIL MODAL */}
            {viewingInvoice && (
              <div 
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 1000,
                  padding: "20px"
                }}
                onClick={() => setViewingInvoice(null)}
              >
                <div 
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    padding: "32px",
                    maxWidth: "600px",
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700" }}>Invoice Details</h3>
                    <button
                      onClick={() => setViewingInvoice(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        fontSize: "24px",
                        cursor: "pointer",
                        color: "#666",
                        padding: "0",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "4px",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = "#f0f0f0";
                        e.target.style.color = "#000";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = "transparent";
                        e.target.style.color = "#666";
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ padding: "16px", background: "#f8f9fa", borderRadius: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ color: "#666", fontSize: "0.875rem" }}>Invoice ID:</span>
                        <strong>{viewingInvoice.id}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ color: "#666", fontSize: "0.875rem" }}>Period:</span>
                        <strong>{viewingInvoice.period}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ color: "#666", fontSize: "0.875rem" }}>Amount:</span>
                        <strong style={{ fontSize: "1.25rem", color: "#000" }}>{viewingInvoice.amount}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ color: "#666", fontSize: "0.875rem" }}>Due Date:</span>
                        <strong>{viewingInvoice.due}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ color: "#666", fontSize: "0.875rem" }}>Status:</span>
                        <span className={statusClass[getEffectiveInvoiceStatus(viewingInvoice)]}>{getEffectiveInvoiceStatus(viewingInvoice)}</span>
                      </div>
                    </div>

                    {getEffectiveInvoiceStatus(viewingInvoice) === "Pending Verification" && (
                      <div style={{ padding: "16px", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107", marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "1.25rem" }}>⏳</span>
                          <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: "600", color: "#856404" }}>Payment Pending Approval</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#856404" }}>
                          Your payment has been submitted and is awaiting admin approval. You will be notified once it's reviewed.
                        </p>
                        {viewingInvoice.method && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #ffc107" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#856404", fontSize: "0.875rem" }}>Payment Method:</span>
                              <strong style={{ color: "#856404" }}>{viewingInvoice.method}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {getEffectiveInvoiceStatus(viewingInvoice) === "Paid" && (
                      <div style={{ padding: "16px", background: "#f0f8ff", borderRadius: "8px", border: "1px solid #1677FF" }}>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: "600" }}>Payment Information</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#666", fontSize: "0.875rem" }}>Payment Method:</span>
                            <strong>{(() => {
                              // Show "Cash" for cash payments, "Online Payment" for online payments
                              if (viewingInvoice.paidToAdmin || viewingInvoice.paidToAdminName || viewingInvoice.method === "Cash to Admin") {
                                return "Cash";
                              }
                              const onlineMethods = ["Screenshot", "Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card", "Online Payment"];
                              return onlineMethods.includes(viewingInvoice.method) ? "Online Payment" : (viewingInvoice.method || "N/A");
                            })()}</strong>
                          </div>
                          {viewingInvoice.reference && viewingInvoice.reference !== "-" && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#666", fontSize: "0.875rem" }}>Reference:</span>
                              <strong>{viewingInvoice.reference}</strong>
                            </div>
                          )}
                          {viewingInvoice.paidToAdminName && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#666", fontSize: "0.875rem" }}>Paid to:</span>
                              <strong>{viewingInvoice.paidToAdminName}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {viewingInvoice.screenshot && (
                      <div style={{ padding: "16px", background: "#f8f9fa", borderRadius: "8px" }}>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: "600" }}>Payment Screenshot</h4>
                        <button
                          onClick={() => {
                            const newWindow = window.open();
                            if (newWindow) {
                              newWindow.document.write(`
                                <html>
                                  <head><title>Payment Screenshot - ${viewingInvoice.id}</title></head>
                                  <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                    <img src="${viewingInvoice.screenshot}" alt="Payment Screenshot" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                                  </body>
                                </html>
                              `);
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "12px",
                            background: "#000",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "0.9375rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => e.target.style.background = "#333"}
                          onMouseLeave={(e) => e.target.style.background = "#000"}
                        >
                          📷 View Full Screenshot
                        </button>
                        <img 
                          src={viewingInvoice.screenshot} 
                          alt="Payment Screenshot Preview"
                          style={{
                            width: "100%",
                            maxHeight: "300px",
                            objectFit: "contain",
                            borderRadius: "8px",
                            marginTop: "12px",
                            border: "1px solid #e0e0e0"
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setViewingInvoice(null)}
                      style={{
                        padding: "10px 20px",
                        background: "#000",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "0.9375rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => e.target.style.background = "#333"}
                      onMouseLeave={(e) => e.target.style.background = "#000"}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENT HISTORY */}
            {activeSection === "history" && (
              <article className="screen-card" id="history">
                <header className="screen-card__header">
                  <h3>Payment History</h3>
                  <p>Complete record of all your payments.</p>
                </header>
                <div style={{ marginTop: "24px" }}>
                  {(() => {
                    const filteredPayments = currentMember ? paymentHistory.filter((item) => 
                      item.memberId === currentMember.id || 
                      item.memberEmail === currentMember.email || 
                      item.member === currentMember.name
                    ) : paymentHistory;
                    
                    if (filteredPayments.length === 0) {
                      return (
                        <div style={{ 
                          textAlign: "center", 
                          padding: "60px 20px",
                          color: "#666"
                        }}>
                          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                          <p style={{ margin: 0, fontSize: "1.125rem", fontWeight: "500" }}>No payment history yet</p>
                          <p style={{ margin: "8px 0 0 0", fontSize: "0.9375rem", color: "#999" }}>Your payment records will appear here</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", 
                        gap: "20px" 
                      }}>
                        {filteredPayments.map((item, idx) => (
                          <div 
                            key={idx}
                            style={{
                              background: "#fff",
                              border: "1px solid #e0e0e0",
                              borderRadius: "12px",
                              padding: "20px",
                              transition: "all 0.3s ease",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                              e.currentTarget.style.borderColor = "#000";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                              e.currentTarget.style.borderColor = "#e0e0e0";
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
                              <span className={statusClass[item.status] || "badge badge-unpaid"} style={{ fontSize: "0.75rem", padding: "4px 10px" }}>
                                {item.status || "Pending"}
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
                                <strong style={{ fontSize: "0.875rem" }}>{(() => {
                                  // Show "Cash" for cash payments, "Online Payment" for online payments
                                  if (item.paidToAdmin || item.paidToAdminName || item.method === "Cash to Admin") {
                                    return "Cash";
                                  }
                                  const onlineMethods = ["Screenshot", "Bank Transfer", "FPS", "PayMe", "Alipay", "Credit Card", "Online Payment"];
                                  return onlineMethods.includes(item.method) ? "Online Payment" : (item.method || "N/A");
                                })()}</strong>
                              </div>
                              {item.reference && item.reference !== "-" && (
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
                            </div>
                            
                            {item.status === "Pending" && (
                              <div style={{ 
                                marginTop: "12px", 
                                padding: "12px", 
                                background: "#fff3cd", 
                                borderRadius: "8px",
                                border: "1px solid #ffc107",
                                fontSize: "0.875rem",
                                color: "#856404"
                              }}>
                                ⏳ Your payment is pending admin approval. You will be notified once it's reviewed.
                              </div>
                            )}
                            
                            {item.status === "Rejected" && item.rejectionReason && (
                              <div style={{ 
                                marginTop: "12px", 
                                padding: "12px", 
                                background: "#f8d7da", 
                                borderRadius: "8px",
                                border: "1px solid #f5c6cb",
                                fontSize: "0.875rem",
                                color: "#721c24"
                              }}>
                                ❌ Payment rejected: {item.rejectionReason}
                              </div>
                            )}
                            
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
                                    background: "#000",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontSize: "0.875rem",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px"
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = "#333"}
                                  onMouseLeave={(e) => e.target.style.background = "#000"}
                                >
                                  <span>📷</span>
                                  <span>View Screenshot</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
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
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        transition: "all 0.2s",
                        background: "#f8f8f8",
                        opacity: "0.8"
                      }}>
                        <div>
                          <div style={{ fontWeight: "500", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                            Email Reminders
                            <span style={{ 
                              fontSize: "0.75rem", 
                              color: "#666", 
                              fontWeight: "normal",
                              fontStyle: "italic"
                            }}>
                              (Required)
                            </span>
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#666" }}>
                            Receive payment reminders and updates via email
                          </div>
                        </div>
                        <div
                          style={{
                            position: "relative",
                            width: "50px",
                            height: "28px",
                            borderRadius: "14px",
                            backgroundColor: "#000",
                            cursor: "not-allowed",
                            transition: "background-color 0.3s ease",
                            flexShrink: 0,
                            opacity: "1"
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: "2px",
                              left: "24px",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              backgroundColor: "#fff",
                              transition: "left 0.3s ease",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                            }}
                          />
                        </div>
                      </div>

                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        transition: "all 0.2s",
                        background: "#f8f8f8",
                        opacity: "0.8"
                      }}>
                        <div>
                          <div style={{ fontWeight: "500", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                            WhatsApp Reminders
                            <span style={{ 
                              fontSize: "0.75rem", 
                              color: "#666", 
                              fontWeight: "normal",
                              fontStyle: "italic"
                            }}>
                              (Required)
                            </span>
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#666" }}>
                            Receive payment reminders via WhatsApp
                          </div>
                        </div>
                        <div
                          style={{
                            position: "relative",
                            width: "50px",
                            height: "28px",
                            borderRadius: "14px",
                            backgroundColor: "#000",
                            cursor: "not-allowed",
                            transition: "background-color 0.3s ease",
                            flexShrink: 0,
                            opacity: "1"
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: "2px",
                              left: "24px",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              backgroundColor: "#fff",
                              transition: "left 0.3s ease",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                            }}
                          />
                        </div>
                      </div>
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

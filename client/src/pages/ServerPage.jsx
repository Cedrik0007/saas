import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { Table } from "../components/Table.jsx";
import { Notie } from "../components/Notie.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import { useApp } from "../context/AppContext.jsx";

export function ServerPage() {
  const {
    members,
    admins,
    invoices,
    payments,
    paymentHistory,
    donations,
    paymentMethods,
    communicationLog,
    fetchMembers,
    fetchAdmins,
    fetchInvoices,
    fetchPayments,
    fetchDonations,
    fetchPaymentMethods,
    addMember,
    updateMember,
    deleteMember,
    addAdminUser,
    updateAdminUser,
    deleteAdminUser,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addDonation,
    deleteDonation,
    updatePaymentMethod,
    loading,
  } = useApp();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("members");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
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
    subscriptionType: "Lifetime",
  });

  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Viewer",
    status: "Active",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    memberId: "",
    memberName: "",
    period: "",
    amount: "",
    invoiceType: "Lifetime",
    due: "",
    status: "Unpaid",
    notes: "",
  });

  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [donationForm, setDonationForm] = useState({
    donorName: "",
    isMember: false,
    memberId: "",
    amount: "",
    notes: "",
  });

  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: "",
    visible: true,
    qrImageUrl: "",
    details: [],
  });

  useEffect(() => {
    fetchMembers();
    fetchAdmins();
    fetchInvoices();
    fetchPayments();
    fetchDonations();
    fetchPaymentMethods();
  }, []);

  const showToast = (message, type = "success") => {
    setNotieMessage(message);
    setNotieType(type);
    setTimeout(() => setNotieMessage(null), 3000);
  };

  const handleLogout = () => {
    showToast("You have been logged out", "success");
    setTimeout(() => {
      sessionStorage.clear();
      navigate("/login", { replace: true });
    }, 500);
  };

  // Member CRUD Operations
  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await addMember(memberForm);
      showToast("Member added successfully!");
      setShowForm(false);
      resetMemberForm();
      fetchMembers();
    } catch (error) {
      showToast(error.message || "Failed to add member", "error");
    }
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    try {
      await updateMember(editingItem.id, memberForm);
      showToast("Member updated successfully!");
      setShowForm(false);
      setEditingItem(null);
      resetMemberForm();
      fetchMembers();
    } catch (error) {
      showToast(error.message || "Failed to update member", "error");
    }
  };

  const handleDeleteMember = async (id) => {
    if (window.confirm("Are you sure you want to delete this member?")) {
      try {
        await deleteMember(id);
        showToast("Member deleted successfully!");
        fetchMembers();
      } catch (error) {
        showToast(error.message || "Failed to delete member", "error");
      }
    }
  };

  const handleEditMember = (member) => {
    setEditingItem(member);
    setMemberForm({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      password: "",
      status: member.status || "Active",
      balance: member.balance || "$0",
      nextDue: member.nextDue || "",
      lastPayment: member.lastPayment || "",
      subscriptionType: member.subscriptionType || "Lifetime",
    });
    setShowForm(true);
  };

  const resetMemberForm = () => {
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
  };

  // Admin CRUD Operations
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      await addAdminUser(adminForm);
      showToast("Admin added successfully!");
      setShowForm(false);
      resetAdminForm();
      fetchAdmins();
    } catch (error) {
      showToast(error.message || "Failed to add admin", "error");
    }
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    try {
      await updateAdminUser(editingItem.id, adminForm);
      showToast("Admin updated successfully!");
      setShowForm(false);
      setEditingItem(null);
      resetAdminForm();
      fetchAdmins();
    } catch (error) {
      showToast(error.message || "Failed to update admin", "error");
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (window.confirm("Are you sure you want to delete this admin?")) {
      try {
        await deleteAdminUser(id);
        showToast("Admin deleted successfully!");
        fetchAdmins();
      } catch (error) {
        showToast(error.message || "Failed to delete admin", "error");
      }
    }
  };

  const handleEditAdmin = (admin) => {
    setEditingItem(admin);
    setAdminForm({
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      role: admin.role || "Viewer",
      status: admin.status || "Active",
    });
    setShowForm(true);
  };

  const resetAdminForm = () => {
    setAdminForm({
      name: "",
      email: "",
      password: "",
      role: "Viewer",
      status: "Active",
    });
  };

  // Invoice CRUD Operations
  const handleAddInvoice = async (e) => {
    e.preventDefault();
    try {
      const invoiceData = {
        ...invoiceForm,
        amount: invoiceForm.amount.startsWith("$") ? invoiceForm.amount : `$${invoiceForm.amount}`,
      };
      await addInvoice(invoiceData);
      showToast("Invoice added successfully!");
      setShowForm(false);
      resetInvoiceForm();
      fetchInvoices();
    } catch (error) {
      showToast(error.message || "Failed to add invoice", "error");
    }
  };

  const handleUpdateInvoice = async (e) => {
    e.preventDefault();
    try {
      const invoiceData = {
        ...invoiceForm,
        amount: invoiceForm.amount.startsWith("$") ? invoiceForm.amount : `$${invoiceForm.amount}`,
      };
      await updateInvoice(editingItem.id, invoiceData);
      showToast("Invoice updated successfully!");
      setShowForm(false);
      setEditingItem(null);
      resetInvoiceForm();
      fetchInvoices();
    } catch (error) {
      showToast(error.message || "Failed to update invoice", "error");
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      try {
        await deleteInvoice(id);
        showToast("Invoice deleted successfully!");
        fetchInvoices();
      } catch (error) {
        showToast(error.message || "Failed to delete invoice", "error");
      }
    }
  };

  const handleEditInvoice = (invoice) => {
    setEditingItem(invoice);
    setInvoiceForm({
      memberId: invoice.memberId || "",
      memberName: invoice.memberName || "",
      period: invoice.period || "",
      amount: invoice.amount?.replace("$", "") || "",
      invoiceType: invoice.invoiceType || "Lifetime",
      due: invoice.due || "",
      status: invoice.status || "Unpaid",
      notes: invoice.notes || "",
    });
    setShowForm(true);
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      memberId: "",
      memberName: "",
      period: "",
      amount: "",
      invoiceType: "Lifetime",
      due: "",
      status: "Unpaid",
      notes: "",
    });
  };

  // Donation CRUD Operations
  const handleAddDonation = async (e) => {
    e.preventDefault();
    try {
      await addDonation(donationForm);
      showToast("Donation added successfully!");
      setShowForm(false);
      resetDonationForm();
      fetchDonations();
    } catch (error) {
      showToast(error.message || "Failed to add donation", "error");
    }
  };

  const handleUpdateDonation = async (e) => {
    e.preventDefault();
    try {
      // Note: Update donation might not be available, so we'll just show a message
      showToast("Donation update functionality not available", "error");
      setShowForm(false);
      setEditingItem(null);
      resetDonationForm();
    } catch (error) {
      showToast(error.message || "Failed to update donation", "error");
    }
  };

  const handleDeleteDonation = async (id) => {
    if (window.confirm("Are you sure you want to delete this donation?")) {
      try {
        await deleteDonation(id);
        showToast("Donation deleted successfully!");
        fetchDonations();
      } catch (error) {
        showToast(error.message || "Failed to delete donation", "error");
      }
    }
  };

  const handleEditDonation = (donation) => {
    setEditingItem(donation);
    setDonationForm({
      donorName: donation.donorName || "",
      isMember: donation.isMember || false,
      memberId: donation.memberId || "",
      amount: donation.amount?.toString().replace("$", "") || "",
      notes: donation.notes || "",
    });
    setShowForm(true);
  };

  const resetDonationForm = () => {
    setDonationForm({
      donorName: "",
      isMember: false,
      memberId: "",
      amount: "",
      notes: "",
    });
  };

  // Payment Method CRUD Operations
  const handleAddPaymentMethod = async (e) => {
    e.preventDefault();
    try {
      // Payment methods use updatePaymentMethod for both add and update
      // If name doesn't exist, it creates; if it exists, it updates
      // In development, use empty string to use Vite proxy (localhost:4000)
      // In production, use VITE_API_URL if set
      const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
      const response = await fetch(`${apiUrl}/api/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentMethodForm),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add payment method');
      }

      showToast("Payment method added successfully!");
      setShowForm(false);
      resetPaymentMethodForm();
      fetchPaymentMethods();
    } catch (error) {
      showToast(error.message || "Failed to add payment method", "error");
    }
  };

  const handleUpdatePaymentMethod = async (e) => {
    e.preventDefault();
    try {
      await updatePaymentMethod(editingItem.name, paymentMethodForm);
      showToast("Payment method updated successfully!");
      setShowForm(false);
      setEditingItem(null);
      resetPaymentMethodForm();
      fetchPaymentMethods();
    } catch (error) {
      showToast(error.message || "Failed to update payment method", "error");
    }
  };

  const handleEditPaymentMethod = (method) => {
    setEditingItem(method);
    setPaymentMethodForm({
      name: method.name || "",
      visible: method.visible !== undefined ? method.visible : true,
      qrImageUrl: method.qrImageUrl || "",
      details: Array.isArray(method.details) ? method.details : [],
    });
    setShowForm(true);
  };

  const resetPaymentMethodForm = () => {
    setPaymentMethodForm({
      name: "",
      visible: true,
      qrImageUrl: "",
      details: [],
    });
  };

  const handleNewItem = () => {
    setEditingItem(null);
    if (activeTab === "members") {
      resetMemberForm();
    } else if (activeTab === "admins") {
      resetAdminForm();
    } else if (activeTab === "invoices") {
      resetInvoiceForm();
    } else if (activeTab === "donations") {
      resetDonationForm();
    } else if (activeTab === "payment-methods") {
      resetPaymentMethodForm();
    }
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingItem(null);
    if (activeTab === "members") {
      resetMemberForm();
    } else if (activeTab === "admins") {
      resetAdminForm();
    } else if (activeTab === "invoices") {
      resetInvoiceForm();
    } else if (activeTab === "donations") {
      resetDonationForm();
    } else if (activeTab === "payment-methods") {
      resetPaymentMethodForm();
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="server-loading">
        <div className="server-loading-spinner"></div>
        <p className="server-loading-text">Loading data from server...</p>
      </div>
    );
  }

  return (
    <>
      <SiteHeader 
        showCTA={false} 
        showLogout={true} 
        onLogout={handleLogout}
        isSticky={true}
      />

      {/* Toast Notification */}
      <Notie
        message={notieMessage}
        type={notieType}
        onClose={() => setNotieMessage(null)}
        duration={3000}
      />

      <main className="server-main server-main--sticky-header">
        <div className="server-layout">
          <article className="server-card">
            <header className="server-header">
              <h3><i className="fas fa-server"></i>Server Management</h3>
              <p>Manage all data entities: Members, Admins, Invoices, Payments, Donations, and Payment Methods</p>
            </header>

            {/* Top Navigation Tabs */}
            <div className="server-nav">
              <button
                className={`server-nav-btn ${activeTab === "members" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("members");
                  setShowForm(false);
                  setEditingItem(null);
                }}
              >
                <i className="fas fa-users"></i>Members ({members.length})
              </button>
              <button
                className={`server-nav-btn ${activeTab === "admins" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("admins");
                  setShowForm(false);
                  setEditingItem(null);
                }}
              >
                <i className="fas fa-user-shield"></i>Admins ({admins.length})
              </button>
              <button
                className={`server-nav-btn ${activeTab === "invoices" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("invoices");
                  setShowForm(false);
                  setEditingItem(null);
                }}
              >
                <i className="fas fa-file-invoice"></i>Invoices ({invoices.length})
              </button>
              <button
                className={`server-nav-btn ${activeTab === "payments" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("payments");
                  setShowForm(false);
                  setEditingItem(null);
                }}
              >
                <i className="fas fa-credit-card"></i>Payments ({paymentHistory?.length || 0})
              </button>
              <button
                className={`server-nav-btn ${activeTab === "donations" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("donations");
                  setShowForm(false);
                  setEditingItem(null);
                }}
              >
                <i className="fas fa-hand-holding-heart"></i>Donations ({donations?.length || 0})
              </button>
              <button
                className={`server-nav-btn ${activeTab === "payment-methods" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("payment-methods");
                  setShowForm(false);
                  setEditingItem(null);
                }}
              >
                <i className="fas fa-wallet"></i>Payment Methods ({paymentMethods?.length || 0})
              </button>
            </div>

            {/* Content Area */}
            <div className="server-content">
              {/* Members Tab */}
              {activeTab === "members" && (
                <>
                  <div className="server-section-header">
                    <h4>Members Management</h4>
                    <button className="server-add-btn" onClick={handleNewItem}>
                      <i className="fas fa-plus"></i>Add Member
                    </button>
                  </div>

                  {showForm && (
                    <div className="server-form-card">
                      <h4>
                        {editingItem ? "Edit Member" : "Add New Member"}
                      </h4>
                      <form className="server-form-grid" onSubmit={editingItem ? handleUpdateMember : handleAddMember} noValidate>
                        <label>
                          <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Name <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            required
                            value={memberForm.name}
                            onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Email <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="email"
                            required
                            value={memberForm.email}
                            onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <div>
                          <PhoneInput
                            label={<span><i className="fas fa-phone" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Phone</span>}
                            value={memberForm.phone}
                            onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                            onError={(error) => {
                              showToast(error, "error");
                            }}
                            placeholder="Enter phone number"
                            className="mono-input"
                          />
                        </div>
                        <label>
                          <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Password {editingItem ? "(leave blank to keep current)" : <span style={{ color: "#ef4444" }}>*</span>}</span>
                          <div style={{ position: "relative" }}>
                            <input
                              type={showMemberPassword ? "text" : "password"}
                              required={!editingItem}
                              value={memberForm.password}
                              onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                              className="mono-input"
                            />
                            <button
                              type="button"
                              onClick={() => setShowMemberPassword(!showMemberPassword)}
                              style={{
                                position: "absolute",
                                right: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#666"
                              }}
                            >
                              <i className={`fas ${showMemberPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                            </button>
                          </div>
                        </label>
                        <label>
                          <span><i className="fas fa-toggle-on" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Status</span>
                          <select
                            value={memberForm.status}
                            onChange={(e) => setMemberForm({ ...memberForm, status: e.target.value })}
                            className="mono-input"
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </label>
                        <label>
                          <span><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Balance</span>
                          <input
                            type="text"
                            value={memberForm.balance}
                            onChange={(e) => setMemberForm({ ...memberForm, balance: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-calendar" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Next Due</span>
                          <input
                            type="text"
                            value={memberForm.nextDue}
                            onChange={(e) => setMemberForm({ ...memberForm, nextDue: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-calendar-check" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Last Payment</span>
                          <input
                            type="text"
                            value={memberForm.lastPayment}
                            onChange={(e) => setMemberForm({ ...memberForm, lastPayment: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-id-card" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Subscription Type</span>
                          <select
                            value={memberForm.subscriptionType}
                            onChange={(e) => setMemberForm({ ...memberForm, subscriptionType: e.target.value })}
                            className="mono-input"
                          >
                            <option value="Lifetime">Lifetime</option>
                            <option value="Yearly + Janaza Fund">Yearly + Janaza Fund</option>
                          </select>
                        </label>
                        <div className="server-form-actions">
                          <button type="button" className="secondary-btn" onClick={handleCancelForm}>
                            Cancel
                          </button>
                          <button type="submit" className="primary-btn">
                            {editingItem ? "Update" : "Add"} Member
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="server-table-container">
                    <Table
                    columns={["ID", "Name", "Email", "Phone", "Status", "Balance", "Actions"]}
                    rows={members.map((member) => ({
                      ID: member.id,
                      Name: member.name,
                      Email: member.email,
                      Phone: member.phone || "-",
                      Status: {
                        render: () => (
                          <span className={
                            member.status === "Active" ? "server-badge server-badge--active" : 
                            member.status === "Pending" ? "server-badge server-badge--pending" : 
                            "server-badge server-badge--inactive"
                          }>
                            {member.status}
                          </span>
                        ),
                      },
                      Balance: member.balance || "$0",
                      Actions: {
                        render: () => (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="server-action-btn server-action-btn--edit"
                              onClick={() => handleEditMember(member)}
                            >
                              <i className="fas fa-edit"></i>Edit
                            </button>
                            <button
                              className="server-action-btn server-action-btn--delete"
                              onClick={() => handleDeleteMember(member.id)}
                              title="Delete Member"
                              aria-label="Delete Member"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        ),
                      },
                    }))}
                    />
                  </div>
                </>
              )}

              {/* Admins Tab */}
              {activeTab === "admins" && (
                <>
                  <div className="server-section-header">
                    <h4>Admins Management</h4>
                    <button className="server-add-btn" onClick={handleNewItem}>
                      <i className="fas fa-plus"></i>Add Admin
                    </button>
                  </div>

                  {showForm && (
                    <div className="server-form-card">
                      <h4>
                        {editingItem ? "Edit Admin" : "Add New Admin"}
                      </h4>
                      <form className="server-form-grid" onSubmit={editingItem ? handleUpdateAdmin : handleAddAdmin} noValidate>
                        <label>
                          <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Name <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            required
                            value={adminForm.name}
                            onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Email <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="email"
                            required
                            value={adminForm.email}
                            onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Password {editingItem ? "(leave blank to keep current)" : <span style={{ color: "#ef4444" }}>*</span>}</span>
                          <div style={{ position: "relative" }}>
                            <input
                              type={showAdminPassword ? "text" : "password"}
                              required={!editingItem}
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                              className="mono-input"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              style={{
                                position: "absolute",
                                right: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#666"
                              }}
                            >
                              <i className={`fas ${showAdminPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                            </button>
                          </div>
                        </label>
                        <label>
                          <span><i className="fas fa-user-tag" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Role</span>
                          <select
                            value={adminForm.role}
                            onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                            className="mono-input"
                          >
                            <option value="Viewer">Viewer</option>
                            <option value="Editor">Editor</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </label>
                        <label>
                          <span><i className="fas fa-toggle-on" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Status</span>
                          <select
                            value={adminForm.status}
                            onChange={(e) => setAdminForm({ ...adminForm, status: e.target.value })}
                            className="mono-input"
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </label>
                        <div className="server-form-actions">
                          <button type="button" className="secondary-btn" onClick={handleCancelForm}>
                            Cancel
                          </button>
                          <button type="submit" className="primary-btn">
                            {editingItem ? "Update" : "Add"} Admin
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="server-table-container">
                    <Table
                    columns={["ID", "Name", "Email", "Role", "Status", "Actions"]}
                    rows={admins.map((admin) => ({
                      ID: admin.id,
                      Name: admin.name,
                      Email: admin.email,
                      Role: admin.role || "Viewer",
                      Status: {
                        render: () => (
                          <span className={admin.status === "Active" ? "server-badge server-badge--active" : "server-badge server-badge--inactive"}>
                            {admin.status}
                          </span>
                        ),
                      },
                      Actions: {
                        render: () => (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="server-action-btn server-action-btn--edit"
                              onClick={() => handleEditAdmin(admin)}
                            >
                              <i className="fas fa-edit"></i>Edit
                            </button>
                            <button
                              className="server-action-btn server-action-btn--delete"
                              onClick={() => handleDeleteAdmin(admin.id)}
                              title="Delete Admin"
                              aria-label="Delete Admin"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        ),
                      },
                    }))}
                    />
                  </div>
                </>
              )}

              {/* Invoices Tab */}
              {activeTab === "invoices" && (
                <>
                  <div className="server-section-header">
                    <h4>Invoices Management</h4>
                    <button className="server-add-btn" onClick={handleNewItem}>
                      <i className="fas fa-plus"></i>Add Invoice
                    </button>
                  </div>

                  {showForm && (
                    <div className="server-form-card">
                      <h4>
                        {editingItem ? "Edit Invoice" : "Add New Invoice"}
                      </h4>
                      <form className="server-form-grid" onSubmit={editingItem ? handleUpdateInvoice : handleAddInvoice} noValidate>
                        <label>
                          <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Member ID <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            required
                            value={invoiceForm.memberId}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, memberId: e.target.value })}
                            className="mono-input"
                            placeholder="e.g. HK1001"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Member Name <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            required
                            value={invoiceForm.memberName}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, memberName: e.target.value })}
                            className="mono-input"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-calendar" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Period <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            required
                            value={invoiceForm.period}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, period: e.target.value })}
                            className="mono-input"
                            placeholder="e.g. Nov 2025"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-id-card" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Invoice Type</span>
                          <select
                            value={invoiceForm.invoiceType}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceType: e.target.value })}
                            className="mono-input"
                          >
                            <option value="Lifetime">Lifetime</option>
                            <option value="Yearly + Janaza Fund">Yearly + Janaza Fund</option>
                          </select>
                        </label>
                        <label>
                          <span><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="number"
                            required
                            value={invoiceForm.amount}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                            className="mono-input"
                            placeholder="e.g. 50"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-calendar-check" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Due Date <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="date"
                            required
                            value={invoiceForm.due}
                            onChange={(e) => {
                              const selectedDate = e.target.value;
                              setInvoiceForm({ ...invoiceForm, due: selectedDate });
                            }}
                            onBlur={(e) => {
                              const dateValue = e.target.value;
                              if (dateValue) {
                                const date = new Date(dateValue);
                                if (isNaN(date.getTime())) {
                                  showToast("Invalid date format. Please enter a valid date (YYYY-MM-DD)", "error");
                                  return;
                                }
                                // Validate date components
                                const [year, month, day] = dateValue.split('-').map(Number);
                                if (month < 1 || month > 12) {
                                  showToast("Invalid month. Please enter a month between 01 and 12", "error");
                                  return;
                                }
                                if (day < 1 || day > 31) {
                                  showToast("Invalid day. Please enter a valid day for the selected month", "error");
                                  return;
                                }
                                // Check if day is valid for the month
                                const daysInMonth = new Date(year, month, 0).getDate();
                                if (day > daysInMonth) {
                                  showToast(`Invalid date. ${month}/${year} only has ${daysInMonth} days`, "error");
                                  return;
                                }
                              }
                            }}
                            className="mono-input"
                            style={{ borderRadius: "4px", width: "100%" }}
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-info-circle" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Status</span>
                          <select
                            value={invoiceForm.status}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}
                            className="mono-input"
                          >
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Pending Verification">Pending Verification</option>
                          </select>
                        </label>
                        <label className="notes" style={{ gridColumn: "1 / -1" }}>
                          <span><i className="fas fa-sticky-note"></i>Notes</span>
                          <textarea
                            value={invoiceForm.notes}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                            className="mono-input"
                            style={{ minHeight: "100px" }}
                          ></textarea>
                        </label>
                        <div className="server-form-actions">
                          <button type="button" className="secondary-btn" onClick={handleCancelForm}>
                            Cancel
                          </button>
                          <button type="submit" className="primary-btn">
                            {editingItem ? "Update" : "Add"} Invoice
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="server-table-container">
                    <Table
                    columns={["Invoice #", "Member", "Period", "Amount", "Status", "Due Date", "Actions"]}
                    rows={invoices.map((invoice) => ({
                      "Invoice #": invoice.id,
                      Member: invoice.memberName || invoice.memberId || "-",
                      Period: invoice.period,
                      Amount: invoice.amount,
                      Status: {
                        render: () => (
                          <span className={
                            invoice.status === "Paid" ? "server-badge server-badge--success" :
                            invoice.status === "Overdue" ? "server-badge server-badge--danger" :
                            invoice.status === "Pending Verification" ? "server-badge server-badge--pending" :
                            "server-badge server-badge--warning"
                          }>
                            {invoice.status}
                          </span>
                        ),
                      },
                      "Due Date": invoice.due,
                      Actions: {
                        render: () => (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="server-action-btn server-action-btn--edit"
                              onClick={() => handleEditInvoice(invoice)}
                            >
                              <i className="fas fa-edit"></i>Edit
                            </button>
                            <button
                              className="server-action-btn server-action-btn--delete"
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              title="Delete Invoice"
                              aria-label="Delete Invoice"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        ),
                      },
                    }))}
                    />
                  </div>
                </>
              )}

              {/* Payments Tab */}
              {activeTab === "payments" && (
                <>
                  <div className="server-section-header">
                    <h4>Payments Management</h4>
                  </div>

                  <div className="server-table-container">
                    <Table
                      columns={["Date", "Member", "Amount", "Method", "Status", "Reference", "Period"]}
                      rows={(paymentHistory || []).map((payment) => ({
                        Date: payment.date || "-",
                        Member: payment.member || payment.memberName || payment.memberId || "-",
                        Amount: payment.amount || "$0",
                        Method: payment.method || "-",
                        Status: {
                          render: () => (
                            <span className={
                              payment.status === "Paid" || payment.status === "Completed" ? "server-badge server-badge--success" :
                              payment.status === "Pending" || payment.status === "Pending Verification" ? "server-badge server-badge--pending" :
                              payment.status === "Rejected" ? "server-badge server-badge--danger" :
                              "server-badge server-badge--warning"
                            }>
                              {payment.status}
                            </span>
                          ),
                        },
                        Reference: payment.reference || "-",
                        Period: payment.period || "-",
                      }))}
                    />
                  </div>
                </>
              )}

              {/* Donations Tab */}
              {activeTab === "donations" && (
                <>
                  <div className="server-section-header">
                    <h4>Donations Management</h4>
                    <button className="server-add-btn" onClick={handleNewItem}>
                      <i className="fas fa-plus"></i>Add Donation
                    </button>
                  </div>

                  {showForm && (
                    <div className="server-form-card">
                      <h4>
                        {editingItem ? "Edit Donation" : "Add New Donation"}
                      </h4>
                      <form className="server-form-grid" onSubmit={editingItem ? handleUpdateDonation : handleAddDonation} noValidate>
                        <label>
                          <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Donor Name <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            required
                            value={donationForm.donorName}
                            onChange={(e) => setDonationForm({ ...donationForm, donorName: e.target.value })}
                            className="mono-input"
                            placeholder="Enter donor name"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-dollar-sign" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Amount <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="number"
                            required
                            value={donationForm.amount}
                            onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })}
                            className="mono-input"
                            placeholder="Enter amount"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-check-circle" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Is Member</span>
                          <select
                            value={donationForm.isMember ? "true" : "false"}
                            onChange={(e) => setDonationForm({ ...donationForm, isMember: e.target.value === "true" })}
                            className="mono-input"
                          >
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                          </select>
                        </label>
                        {donationForm.isMember && (
                          <label>
                            <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Member ID</span>
                            <input
                              type="text"
                              value={donationForm.memberId}
                              onChange={(e) => setDonationForm({ ...donationForm, memberId: e.target.value })}
                              className="mono-input"
                              placeholder="Enter member ID"
                            />
                          </label>
                        )}
                        <label className="notes" style={{ gridColumn: "1 / -1" }}>
                          <span><i className="fas fa-sticky-note"></i>Notes</span>
                          <textarea
                            value={donationForm.notes}
                            onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })}
                            className="mono-input"
                            style={{ minHeight: "100px" }}
                          ></textarea>
                        </label>
                        <div className="server-form-actions">
                          <button type="button" className="secondary-btn" onClick={handleCancelForm}>
                            Cancel
                          </button>
                          <button type="submit" className="primary-btn">
                            {editingItem ? "Update" : "Add"} Donation
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="server-table-container">
                    <Table
                      columns={["Donor", "Amount", "Is Member", "Member ID", "Date", "Actions"]}
                      rows={(donations || []).map((donation) => ({
                        Donor: donation.donorName || "-",
                        Amount: donation.amount ? `$${donation.amount}` : "$0",
                        "Is Member": donation.isMember ? "Yes" : "No",
                        "Member ID": donation.memberId || "-",
                        Date: donation.date || "-",
                        Actions: {
                          render: () => (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                className="server-action-btn server-action-btn--delete"
                                onClick={() => handleDeleteDonation(donation._id || donation.id)}
                                title="Delete Donation"
                                aria-label="Delete Donation"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          ),
                        },
                      }))}
                    />
                  </div>
                </>
              )}

              {/* Payment Methods Tab */}
              {activeTab === "payment-methods" && (
                <>
                  <div className="server-section-header">
                    <h4>Payment Methods Management</h4>
                    <button className="server-add-btn" onClick={handleNewItem}>
                      <i className="fas fa-plus"></i>Add Payment Method
                    </button>
                  </div>

                  {showForm && (
                    <div className="server-form-card">
                      <h4>
                        {editingItem ? "Edit Payment Method" : "Add New Payment Method"}
                      </h4>
                      <form className="server-form-grid" onSubmit={editingItem ? handleUpdatePaymentMethod : handleAddPaymentMethod} noValidate>
                        <label>
                          <span><i className="fas fa-wallet" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Name <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            required
                            value={paymentMethodForm.name}
                            onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                            className="mono-input"
                            placeholder="e.g. FPS, PayMe, Bank Transfer"
                          />
                        </label>
                        <label>
                          <span><i className="fas fa-eye" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Visible</span>
                          <select
                            value={paymentMethodForm.visible ? "true" : "false"}
                            onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, visible: e.target.value === "true" })}
                            className="mono-input"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </label>
                        <label>
                          <span><i className="fas fa-image" style={{ marginRight: "8px", color: "#5a31ea" }}></i>QR Image URL</span>
                          <input
                            type="url"
                            value={paymentMethodForm.qrImageUrl}
                            onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, qrImageUrl: e.target.value })}
                            className="mono-input"
                            placeholder="Enter QR code image URL"
                          />
                        </label>
                        <label className="notes" style={{ gridColumn: "1 / -1" }}>
                          <span><i className="fas fa-list" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Details (one per line)</span>
                          <textarea
                            value={Array.isArray(paymentMethodForm.details) ? paymentMethodForm.details.join("\n") : ""}
                            onChange={(e) => setPaymentMethodForm({ 
                              ...paymentMethodForm, 
                              details: e.target.value.split("\n").filter(d => d.trim()) 
                            })}
                            className="mono-input"
                            style={{ minHeight: "100px" }}
                            placeholder="Enter details, one per line"
                          ></textarea>
                        </label>
                        <div className="server-form-actions">
                          <button type="button" className="secondary-btn" onClick={handleCancelForm}>
                            Cancel
                          </button>
                          <button type="submit" className="primary-btn">
                            {editingItem ? "Update" : "Add"} Payment Method
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="server-table-container">
                    <Table
                      columns={["Name", "Visible", "QR Image", "Details", "Actions"]}
                      rows={(paymentMethods || []).map((method) => ({
                        Name: method.name || "-",
                        Visible: {
                          render: () => (
                            <span className={method.visible ? "server-badge server-badge--success" : "server-badge server-badge--inactive"}>
                              {method.visible ? "Yes" : "No"}
                            </span>
                          ),
                        },
                        "QR Image": method.qrImageUrl ? (
                          <a href={method.qrImageUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#5a31ea" }}>
                            View Image
                          </a>
                        ) : "-",
                        Details: Array.isArray(method.details) ? method.details.join(", ") : "-",
                        Actions: {
                          render: () => (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                className="server-action-btn server-action-btn--edit"
                                onClick={() => handleEditPaymentMethod(method)}
                              >
                                <i className="fas fa-edit"></i>Edit
                              </button>
                            </div>
                          ),
                        },
                      }))}
                    />
                  </div>
                </>
              )}
            </div>
          </article>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}


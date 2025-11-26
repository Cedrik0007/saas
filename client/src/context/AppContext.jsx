import { createContext, useContext, useState, useEffect } from "react";
import {
  members as initialMembers,
  admins as initialAdmins,
  invoices as initialInvoices,
  recentPayments as initialRecentPayments,
  paymentHistory as initialPaymentHistory,
  communicationLog as initialCommunicationLog,
  memberUpcomingPayments as initialMemberUpcomingPayments,
  memberInvoices as initialMemberInvoices,
  memberPaymentHistory as initialMemberPaymentHistory,
  paymentMethods as initialPaymentMethods,
  metrics as initialMetrics,
  reminderRules as initialReminderRules,
} from "../data";



const AppContext = createContext();

export function AppProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [admins,setAdmins] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [recentPayments, setRecentPayments] = useState(() => {
    const saved = localStorage.getItem("recentPayments");
    return saved ? JSON.parse(saved) : initialRecentPayments;
  });

  const [paymentHistory, setPaymentHistory] = useState(() => {
    const saved = localStorage.getItem("paymentHistory");
    return saved ? JSON.parse(saved) : initialPaymentHistory;
  });

  const [communicationLog, setCommunicationLog] = useState(() => {
    const saved = localStorage.getItem("communicationLog");
    return saved ? JSON.parse(saved) : initialCommunicationLog;
  });

  const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods); // Will be loaded from database

  const [metrics, setMetrics] = useState(() => {
    const saved = localStorage.getItem("metrics");
    return saved ? JSON.parse(saved) : initialMetrics;
  });

  const [reminderRules, setReminderRules] = useState(() => {
    const saved = localStorage.getItem("reminderRules");
    return saved ? JSON.parse(saved) : initialReminderRules;
  });

  const [automationEnabled, setAutomationEnabled] = useState(true);

  const [reminderTemplates, setReminderTemplates] = useState(() => {
    const saved = localStorage.getItem("reminderTemplates");
    return saved ? JSON.parse(saved) : {
      upcomingDue: "Hi {{member_name}}, friendly reminder your {{period}} subscription of ${{amount}} is due on {{due_date}}. You can pay via FPS, PayMe, or card. Thank you!",
      overdue: "Hi {{member_name}}, your {{period}} contribution of ${{amount}} is now overdue. Please settle via the member portal or reply once paid.",
    };
  });

  const [organizationInfo, setOrganizationInfo] = useState(() => {
    const saved = localStorage.getItem("organizationInfo");
    return saved ? JSON.parse(saved) : {
      name: "Subscription Manager HK",
      email: "support@subscriptionhk.org",
      phone: "+852 2800 1122",
      address: "123 Central Street, Hong Kong",
    };
  });

  // adminUsers removed - now using admins from MongoDB API

  const [selectedMember, setSelectedMember] = useState(null);

  // Fetch data from server on mount
  useEffect(() => {
    fetchMembers();
    fetchAdmins();
    fetchInvoices();
    fetchPayments();
    fetchPaymentMethods();
  }, []);

  // Fetch members from server
  const fetchMembers = async () => {
    try {
      setLoading(true);
      // const response = await fetch('/api/members');
      // const response = await fetch(`${import.meta.env.VITE_API_URL}/api/members`);
      // const response = await fetch(`/api/members`);
      const apiUrl = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${apiUrl}/api/members`);

      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data);
      console.log('✓ Loaded', data.length, 'members from server');
    } catch (error) {
      console.error('Error fetching members:', error);
      console.warn('⚠️ Using fallback data from data.js');
      setMembers(initialMembers);
    } finally {
      setLoading(false);
    }
  };

   // Fetch Admins from server
   const fetchAdmins = async () => {
    try {
      setLoading(true);
      const apiUr = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${apiUr}/api/admins`);

      if (!response.ok) throw new Error('Failed to fetch admins');
      const data = await response.json();
      setAdmins(data);
      console.log('✓ Loaded', data.length, 'Admins from server');
    } catch (error) {
      console.error('Error fetching Admins:', error);
      console.warn('⚠️ Using fallback data from data.js');
      setAdmins(initialAdmins);
    } finally {
      setLoading(false);
    }
  };

  // Fetch invoices from server
  const fetchInvoices = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/invoices`);
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      setInvoices(data);
      console.log('✓ Loaded', data.length, 'invoices from MongoDB');
    } catch (error) {
      console.error('Error fetching invoices:', error);
      console.warn('⚠️ Using fallback data from data.js');
      setInvoices(initialInvoices);
    }
  };

  // Fetch payments from server
  const fetchPayments = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/payments`);
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data);
      // Sync paymentHistory with MongoDB payments
      setPaymentHistory(data);
      setRecentPayments(data.slice(0, 10)); // Keep recent payments for dashboard
      console.log('✓ Loaded', data.length, 'payments from MongoDB');
    } catch (error) {
      console.error('Error fetching payments:', error);
      console.warn('⚠️ Using fallback data from data.js');
      setPayments(initialPaymentHistory);
    }
  };

  // Fetch payment methods from server
  const fetchPaymentMethods = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/payment-methods`);
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const data = await response.json();
      
      // If database is empty, initialize with default payment methods
      if (data.length === 0) {
        console.log('⚠️ No payment methods in database, initializing defaults...');
        const defaultMethods = [
          { name: "Alipay", visible: false, qrImageUrl: "", details: [] },
          { name: "PayMe", visible: false, qrImageUrl: "", details: [] },
          { name: "FPS", visible: true, details: ["FPS ID 1234567"] },
          { name: "Direct Bank Transfer", visible: true, details: ["HSBC Hong Kong", "123-456789-001", "Subscription Manager HK"] },
          { name: "Credit/Debit Cards", visible: true, details: ["Gateway: Stripe"] },
        ];
        
        // Save defaults to database
        for (const method of defaultMethods) {
          try {
            await fetch(`${apiUrl}/api/payment-methods`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(method),
            });
          } catch (err) {
            console.error(`Error initializing payment method ${method.name}:`, err);
          }
        }
        
        setPaymentMethods(defaultMethods);
        console.log('✓ Initialized default payment methods in database');
      } else {
        setPaymentMethods(data);
        console.log('✓ Loaded', data.length, 'payment methods from MongoDB');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      console.warn('⚠️ Using fallback data from data.js');
      setPaymentMethods(initialPaymentMethods);
    }
  };

  // Persist other data to localStorage
  useEffect(() => {
    localStorage.setItem("recentPayments", JSON.stringify(recentPayments));
  }, [recentPayments]);

  useEffect(() => {
    localStorage.setItem("recentPayments", JSON.stringify(recentPayments));
  }, [recentPayments]);

  useEffect(() => {
    localStorage.setItem("paymentHistory", JSON.stringify(paymentHistory));
  }, [paymentHistory]);

  useEffect(() => {
    localStorage.setItem("communicationLog", JSON.stringify(communicationLog));
  }, [communicationLog]);

  // Payment methods are now stored in MongoDB, not localStorage
  // useEffect removed - payment methods persist in database

  useEffect(() => {
    localStorage.setItem("metrics", JSON.stringify(metrics));
  }, [metrics]);

  useEffect(() => {
    localStorage.setItem("reminderRules", JSON.stringify(reminderRules));
  }, [reminderRules]);


  useEffect(() => {
    localStorage.setItem("reminderTemplates", JSON.stringify(reminderTemplates));
  }, [reminderTemplates]);

  useEffect(() => {
    localStorage.setItem("organizationInfo", JSON.stringify(organizationInfo));
  }, [organizationInfo]);

  useEffect(() => {
    // adminUsers localStorage removed - now using MongoDB API
  }, []);

  // CRUD Operations for Members (Server-based)
  const addMember = async (member) => {
    try {
      // const response = await fetch('/api/members', {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      if (!response.ok) throw new Error('Failed to add member');
      const newMember = await response.json();
      setMembers([...members, newMember]);
      updateMetrics({ totalMembers: metrics.totalMembers + 1 });
      console.log('✓ Member added to server:', newMember);
      return newMember;
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  };

  const updateMember = async (id, updatedData) => {
    try {
      // const response = await fetch(`/api/members/${id}`, {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) throw new Error('Failed to update member');
      const updated = await response.json();
      setMembers(members.map((m) => (m.id === id ? updated : m)));
      console.log('✓ Member updated on server:', updated);
    } catch (error) {
      console.error('Error updating member:', error);
      throw error;
    }
  };

  const deleteMember = async (id) => {
    try {
      // const response = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/members/${id}`, { method: 'DELETE' });

      if (!response.ok) throw new Error('Failed to delete member');
      setMembers(members.filter((m) => m.id !== id));
      setInvoices(invoices.filter((inv) => inv.memberId !== id));
      updateMetrics({ totalMembers: metrics.totalMembers - 1 });
      console.log('✓ Member deleted from server:', id);
    } catch (error) {
      console.error('Error deleting member:', error);
      throw error;
    }
  };

  // CRUD Operations for Invoices (Server-based)
  const addInvoice = async (invoice) => {
    try {
      // const response = await fetch('/api/invoices', {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
      if (!response.ok) throw new Error('Failed to add invoice');
      const newInvoice = await response.json();
      setInvoices([newInvoice, ...invoices]);
      console.log('✓ Invoice added to server:', newInvoice);
      return newInvoice;
    } catch (error) {
      console.error('Error adding invoice:', error);
      throw error;
    }
  };

  const updateInvoice = async (id, updatedData) => {
    try {
      // const response = await fetch(`/api/invoices/${id}`, {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) throw new Error('Failed to update invoice');
      const updated = await response.json();
      setInvoices(invoices.map((inv) => (inv.id === id ? updated : inv)));
      
      // If status changed to Paid, update metrics
      if (updatedData.status === "Paid") {
        const invoice = invoices.find((inv) => inv.id === id);
        if (invoice && invoice.status !== "Paid") {
          const amount = parseFloat(invoice.amount.replace("$", ""));
          updateMetrics({
            collectedMonth: metrics.collectedMonth + amount,
            collectedYear: metrics.collectedYear + amount,
            outstanding: metrics.outstanding - amount,
          });
        }
      }
      console.log('✓ Invoice updated on server:', updated);
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  };

  const deleteInvoice = async (id) => {
    try {
      // const response = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete invoice');
      setInvoices(invoices.filter((inv) => inv.id !== id));
      console.log('✓ Invoice deleted from server:', id);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  };

  // Payment Operations
  const addPayment = async (payment) => {
    try {
      const paymentData = {
        ...payment,
        date: payment.date || new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
      
      // Save payment to MongoDB
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save payment');
      }
      
      const newPayment = await response.json();
      
      // Update local state
      setPayments([newPayment, ...payments]);
      setRecentPayments([newPayment, ...recentPayments]);
      setPaymentHistory([newPayment, ...paymentHistory]);
      
      // Update related invoice
      if (payment.invoiceId) {
        await updateInvoice(payment.invoiceId, { 
          status: "Paid", 
          method: payment.method, 
          reference: payment.reference,
          screenshot: payment.screenshot || payment.screenshotUrl,
          paidToAdmin: payment.paidToAdmin,
          paidToAdminName: payment.paidToAdminName,
        });
      }
      
      // Update metrics
      const amount = parseFloat(payment.amount.replace("$", ""));
      updateMetrics({
        collectedMonth: metrics.collectedMonth + amount,
        collectedYear: metrics.collectedYear + amount,
        outstanding: Math.max(0, metrics.outstanding - amount),
      });

      console.log('✓ Payment saved to MongoDB:', newPayment);
      return newPayment;
    } catch (error) {
      console.error('Error adding payment:', error);
      // Still update local state for UI feedback, but log the error
      const fallbackPayment = {
        ...payment,
        date: payment.date || new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
      setRecentPayments([fallbackPayment, ...recentPayments]);
      setPaymentHistory([fallbackPayment, ...paymentHistory]);
      throw error;
    }
  };

  // Communication Operations
  const addCommunication = (comm) => {
    const newComm = {
      ...comm,
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      status: "Delivered",
    };
    setCommunicationLog([newComm, ...communicationLog]);
    return newComm;
  };

  // Payment Methods Operations
  const updatePaymentMethod = async (name, updatedData) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/payment-methods/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment method');
      }

      const updatedMethod = await response.json();
      
      // Update local state
      setPaymentMethods(
        paymentMethods.map((pm) => (pm.name === name ? updatedMethod : pm))
      );
      
      console.log('✓ Payment method updated in database:', updatedMethod);
      return updatedMethod;
    } catch (error) {
      console.error('Error updating payment method:', error);
      // Still update local state for immediate UI feedback
      setPaymentMethods(
        paymentMethods.map((pm) => (pm.name === name ? { ...pm, ...updatedData } : pm))
      );
      throw error;
    }
  };

  // Metrics Operations
  const updateMetrics = (updates) => {
    setMetrics({ ...metrics, ...updates });
  };

  // Reset all data to initial values from data.js
  const resetAllData = () => {
    localStorage.clear();
    setMembers(initialMembers);
    serAdmins(initialAdmins);
    setInvoices(initialInvoices);
    setRecentPayments(initialRecentPayments);
    setPaymentHistory(initialPaymentHistory);
    setCommunicationLog(initialCommunicationLog);
    setPaymentMethods(initialPaymentMethods);
    setMetrics(initialMetrics);
    setReminderRules(initialReminderRules);
    setAutomationEnabled(true);
    localStorage.setItem("dataVersion", "v2.0");
  };

  // Automation Operations
  const updateReminderRule = (label, channels) => {
    setReminderRules(
      reminderRules.map((rule) =>
        rule.label === label ? { ...rule, channels } : rule
      )
    );
  };

  const updateReminderTemplate = (type, content) => {
    setReminderTemplates({ ...reminderTemplates, [type]: content });
  };

  // Organization & Admin Operations
  const updateOrganizationInfo = (updates) => {
    setOrganizationInfo({ ...organizationInfo, ...updates });
  };

  // Admin CRUD Operations - Using MongoDB API
  const addAdminUser = async (user) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          email: user.email || '',
          role: user.role || 'Viewer',
          status: user.status || 'Active',
          password: user.password || ''
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create admin');
      }
      const newAdmin = await response.json();
      setAdmins([...admins, newAdmin]);
      await fetchAdmins(); // Refresh to get latest data
      return newAdmin;
    } catch (error) {
      console.error('Error adding admin:', error);
      throw error;
    }
  };

  const updateAdminUser = async (id, updates) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/admins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update admin');
      }
      const updatedAdmin = await response.json();
      setAdmins(admins.map((admin) => (admin.id === id ? updatedAdmin : admin)));
      await fetchAdmins(); // Refresh to get latest data
      return updatedAdmin;
    } catch (error) {
      console.error('Error updating admin:', error);
      throw error;
    }
  };

  const deleteAdminUser = async (id) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/admins/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete admin');
      }
      setAdmins(admins.filter((admin) => admin.id !== id));
      await fetchAdmins(); // Refresh to get latest data
    } catch (error) {
      console.error('Error deleting admin:', error);
      throw error;
    }
  };

  const value = {
    members,
    invoices,
    payments,
    loading,
    fetchMembers,
    fetchAdmins,
    fetchInvoices,
    fetchPayments,
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
    admins,
    selectedMember,
    setSelectedMember,
    addMember,
    updateMember,
    deleteMember,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addPayment,
    addCommunication,
    updatePaymentMethod,
    updateMetrics,
    updateReminderRule,
    updateReminderTemplate,
    updateOrganizationInfo,
    addAdminUser,
    updateAdminUser,
    deleteAdminUser,
    resetAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}


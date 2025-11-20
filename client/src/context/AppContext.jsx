import { createContext, useContext, useState, useEffect } from "react";
import {
  members as initialMembers,
  invoices as initialInvoices,
  recentPayments as initialRecentPayments,
  paymentHistory as initialPaymentHistory,
  communicationLog as initialCommunicationLog,
  memberUpcomingPayments as initialMemberUpcomingPayments,
  memberInvoices as initialMemberInvoices,
  memberPaymentHistory as initialMemberPaymentHistory,
  paymentMethods as initialPaymentMethods,
  metrics as initialMetrics,
} from "../data";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [members, setMembers] = useState(() => {
    const saved = localStorage.getItem("members");
    return saved ? JSON.parse(saved) : initialMembers;
  });

  const [invoices, setInvoices] = useState(() => {
    const saved = localStorage.getItem("invoices");
    return saved ? JSON.parse(saved) : initialInvoices;
  });

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

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem("paymentMethods");
    return saved ? JSON.parse(saved) : initialPaymentMethods;
  });

  const [metrics, setMetrics] = useState(() => {
    const saved = localStorage.getItem("metrics");
    return saved ? JSON.parse(saved) : initialMetrics;
  });

  const [selectedMember, setSelectedMember] = useState(null);

  // Persist to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem("members", JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem("invoices", JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem("recentPayments", JSON.stringify(recentPayments));
  }, [recentPayments]);

  useEffect(() => {
    localStorage.setItem("paymentHistory", JSON.stringify(paymentHistory));
  }, [paymentHistory]);

  useEffect(() => {
    localStorage.setItem("communicationLog", JSON.stringify(communicationLog));
  }, [communicationLog]);

  useEffect(() => {
    localStorage.setItem("paymentMethods", JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  useEffect(() => {
    localStorage.setItem("metrics", JSON.stringify(metrics));
  }, [metrics]);

  // CRUD Operations for Members
  const addMember = (member) => {
    const newMember = {
      ...member,
      id: `HK${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setMembers([...members, newMember]);
    updateMetrics({ totalMembers: metrics.totalMembers + 1 });
    return newMember;
  };

  const updateMember = (id, updatedData) => {
    setMembers(members.map((m) => (m.id === id ? { ...m, ...updatedData } : m)));
  };

  const deleteMember = (id) => {
    setMembers(members.filter((m) => m.id !== id));
    setInvoices(invoices.filter((inv) => inv.memberId !== id));
    updateMetrics({ totalMembers: metrics.totalMembers - 1 });
  };

  // CRUD Operations for Invoices
  const addInvoice = (invoice) => {
    const newInvoice = {
      ...invoice,
      id: `INV-2025-${Math.floor(100 + Math.random() * 900)}`,
    };
    setInvoices([newInvoice, ...invoices]);
    return newInvoice;
  };

  const updateInvoice = (id, updatedData) => {
    setInvoices(invoices.map((inv) => (inv.id === id ? { ...inv, ...updatedData } : inv)));
    
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
  };

  const deleteInvoice = (id) => {
    setInvoices(invoices.filter((inv) => inv.id !== id));
  };

  // Payment Operations
  const addPayment = (payment) => {
    const newPayment = {
      ...payment,
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
    setRecentPayments([newPayment, ...recentPayments]);
    setPaymentHistory([newPayment, ...paymentHistory]);
    
    // Update related invoice
    if (payment.invoiceId) {
      updateInvoice(payment.invoiceId, { status: "Paid", method: payment.method, reference: payment.reference });
    }
    
    // Update metrics
    const amount = parseFloat(payment.amount.replace("$", ""));
    updateMetrics({
      collectedMonth: metrics.collectedMonth + amount,
      collectedYear: metrics.collectedYear + amount,
      outstanding: Math.max(0, metrics.outstanding - amount),
    });

    return newPayment;
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
  const updatePaymentMethod = (name, updatedData) => {
    setPaymentMethods(
      paymentMethods.map((pm) => (pm.name === name ? { ...pm, ...updatedData } : pm))
    );
  };

  // Metrics Operations
  const updateMetrics = (updates) => {
    setMetrics({ ...metrics, ...updates });
  };

  const value = {
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
    addPayment,
    addCommunication,
    updatePaymentMethod,
    updateMetrics,
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


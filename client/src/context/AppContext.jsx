import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
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
import { normalizeSubscriptionType } from "../constants/subscriptionTypes.js";



const AppContext = createContext();

const normalizeMemberRecord = (member) => {
  if (!member || typeof member !== "object") {
    return member;
  }
  return {
    ...member,
    subscriptionType: normalizeSubscriptionType(member.subscriptionType),
  };
};

export function AppProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [admins,setAdmins] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [donations, setDonations] = useState([]);
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

  // Reminder logs from backend (automatic + manual email reminders)
  const [reminderLogs, setReminderLogs] = useState([]);

  // Password reset requests
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);

  const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods); // Will be loaded from database

  const [metrics, setMetrics] = useState(() => {
    const saved = localStorage.getItem("metrics");
    return saved ? JSON.parse(saved) : initialMetrics;
  });

  const [reminderRules, setReminderRules] = useState(() => {
    try {
      const saved = localStorage.getItem("reminderRules");
      return saved ? JSON.parse(saved) : initialReminderRules;
    } catch {
      return initialReminderRules;
    }
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
      name: "IMA Subscription Manager",
      email: "support@subscriptionhk.org",
      phone: "+852 2800 1122",
      address: "123 Central Street, Hong Kong",
    };
  });

  // User locale preference for number formatting
  const [userLocale, setUserLocale] = useState(() => {
    try {
      const saved = localStorage.getItem("userLocale");
      if (saved) {
        return saved;
      }
      // Try to detect browser locale
      const browserLocale = navigator.language || navigator.userLanguage;
      return browserLocale || "en-US";
    } catch (error) {
      console.error("Error getting user locale:", error);
      return "en-US";
    }
  });

  const updateUserLocale = (locale) => {
    try {
      localStorage.setItem("userLocale", locale);
      setUserLocale(locale);
      // Dispatch custom event to notify components of locale change
      window.dispatchEvent(new CustomEvent("localeChanged", { detail: { locale } }));
    } catch (error) {
      console.error("Error setting user locale:", error);
    }
  };

  // adminUsers removed - now using admins from MongoDB API

  const [selectedMember, setSelectedMember] = useState(null);
  // In development, use empty string to use Vite proxy (localhost:4000)
  // In production, use VITE_API_URL if set
  const apiBaseUrl = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL || "");

  
  // Socket.io connection and request deduplication
  const socketRef = useRef(null);
  const pendingRequestsRef = useRef(new Set()); // Track pending requests to prevent duplicates
  
  // Initialize Socket.io connection
  useEffect(() => {
    // const socketUrl = import.meta.env.DEV 
    //   ? 'http://localhost:4000' 
    //   : (import.meta.env.VITE_API_URL || window.location.origin);
    const socketUrl = import.meta.env.VITE_API_URL;

    
    if (socketUrl) {
      // Try polling first if WebSocket fails (better for production environments)
      socketRef.current = io(socketUrl, {
        transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        timeout: 20000,
        forceNew: false,
        upgrade: true,
        rememberUpgrade: true
      });

      socketRef.current.on('connect', () => {
        console.log('✓ Socket.io connected:', socketRef.current.id, 'Transport:', socketRef.current.io.engine.transport.name);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('✗ Socket.io disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected, reconnect manually
          socketRef.current.connect();
        }
      });

      socketRef.current.on('connect_error', (error) => {
        console.warn('⚠ Socket.io connection error:', error.message);
        // Don't show error to user - it will retry automatically
      });

      socketRef.current.on('reconnect', (attemptNumber) => {
        console.log('✓ Socket.io reconnected after', attemptNumber, 'attempts');
      });

      socketRef.current.on('reconnect_attempt', () => {
        console.log('🔄 Attempting to reconnect Socket.io...');
      });

      socketRef.current.on('reconnect_error', (error) => {
        console.warn('⚠ Socket.io reconnection error:', error.message);
      });

      socketRef.current.on('reconnect_failed', () => {
        console.error('❌ Socket.io reconnection failed - will continue trying');
      });

      // Listen for member updates
      socketRef.current.on('member:created', (member) => {
        setMembers(prev => {
          // Check if member already exists (by ID)
          const exists = prev.find(m => m.id === member.id);
          if (exists) {
            // Update existing member, removing any optimistic flags
            return prev.map(m => m.id === member.id ? { ...member, _isOptimistic: false } : m);
          }
          // Remove any optimistic members that might match (by email or name) to prevent duplicates
          // Also add the new real member
          const filtered = prev.filter(m => !(m._isOptimistic && (m.email === member.email || (m.name === member.name && m.email === member.email))));
          return [member, ...filtered];
        });
      });

      socketRef.current.on('member:updated', (member) => {
        setMembers(prev => prev.map(m => m.id === member.id ? member : m));
      });

      socketRef.current.on('member:deleted', (data) => {
        setMembers(prev => prev.filter(m => m.id !== data.id));
      });

      // Listen for invoice updates
      socketRef.current.on('invoice:created', (invoice) => {
        setInvoices(prev => {
          const exists = prev.find(inv => inv._id === invoice._id);
          if (exists) {
            return prev.map(inv => inv._id === invoice._id ? invoice : inv);
          }
          return [invoice, ...prev];
        });
      });

      socketRef.current.on('invoice:updated', (invoice) => {
        setInvoices(prev => prev.map(inv => inv._id === invoice._id ? invoice : inv));
      });

      socketRef.current.on('invoice:deleted', (data) => {
        setInvoices(prev => prev.filter(inv => inv._id !== data.id && inv.id !== data.businessId));
      });

      // Listen for payment updates
      socketRef.current.on('payment:created', (payment) => {
        setPayments(prev => {
          const exists = prev.find(p => p._id === payment._id || p.id === payment.id);
          if (exists) {
            return prev.map(p => (p._id === payment._id || p.id === payment.id) ? payment : p);
          }
          return [payment, ...prev];
        });
      });

      socketRef.current.on('payment:updated', (payment) => {
        setPayments(prev => prev.map(p => (p._id === payment._id || p.id === payment.id) ? payment : p));
      });

      // Listen for donation updates
      socketRef.current.on('donation:created', (donation) => {
        setDonations(prev => {
          const exists = prev.find(d => d._id === donation._id);
          if (exists) {
            return prev.map(d => d._id === donation._id ? donation : d);
          }
          return [donation, ...prev];
        });
      });

      socketRef.current.on('donation:deleted', (data) => {
        setDonations(prev => prev.filter(d => d._id !== data.id));
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!window.__invoiceIdFetchGuardInstalled) {
      const originalFetch = window.fetch.bind(window);
      const guardedFetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input?.url || "";

        if (/\/api\/invoices\/INV-/i.test(url)) {
          console.error("❌ Blocked API call using business invoice number in URL:", url);
          throw new Error("BUG: Business invoice number used as API identifier");
        }

        const body = init?.body;
        if (typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            const invoiceId = parsed?.invoiceId;
            if (typeof invoiceId === "string" && invoiceId.startsWith("INV-")) {
              console.error("❌ Blocked API call using business invoice number in payload:", invoiceId);
              throw new Error("BUG: Business invoice number used as API identifier");
            }
          } catch (error) {
            // Ignore non-JSON payloads
          }
        }

        return originalFetch(input, init);
      };
      guardedFetch.__originalFetch = originalFetch;
      window.fetch = guardedFetch;
      window.__invoiceIdFetchGuardInstalled = true;
    }

    return () => {
      if (window.__invoiceIdFetchGuardInstalled && window.fetch?.__originalFetch) {
        window.fetch = window.fetch.__originalFetch;
        window.__invoiceIdFetchGuardInstalled = false;
      }
    };
  }, []);

  // Fetch data from server on mount
  // Helper function to create fetch with timeout
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  };

  // Retry helper function with exponential backoff
  const retryFetch = async (fetchFn, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fetchFn();
        return; // Success, exit
      } catch (error) {
        if (i === maxRetries - 1) {
          console.error(`Failed after ${maxRetries} attempts:`, error);
          throw error;
        }
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  // Fetch members from server
  const fetchMembers = async () => {
    try {
      const response = await fetchWithTimeout(`${apiBaseUrl}/api/members`, {}, 15000);

      if (!response.ok) throw new Error(`Failed to fetch members: ${response.status} ${response.statusText}`);
      const data = await response.json();
      const normalizedMembers = Array.isArray(data)
        ? data.map(normalizeMemberRecord)
        : [];
      setMembers(normalizedMembers);
      console.log('✓ Loaded', normalizedMembers.length, 'members from server');
    } catch (error) {
      console.error('Error fetching members:', error);
      // Only set empty array if we don't have data yet (first load)
      setMembers(prev => prev.length === 0 ? [] : prev);
      throw error; // Re-throw to allow retry mechanism
    }
  };

   // Fetch Admins from server
   const fetchAdmins = async () => {
    try {
      const response = await fetchWithTimeout(`${apiBaseUrl}/api/admins`, {}, 15000);

      if (!response.ok) throw new Error(`Failed to fetch admins: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setAdmins(data);
      console.log('✓ Loaded', data.length, 'Admins from server');
    } catch (error) {
      console.error('Error fetching Admins:', error);
      // Only set empty array if we don't have data yet (first load)
      setAdmins(prev => prev.length === 0 ? [] : prev);
      throw error; // Re-throw to allow retry mechanism
    }
  };

  // Fetch invoices from server
  const fetchInvoices = async () => {
    try {
      const response = await fetchWithTimeout(`${apiBaseUrl}/api/invoices`, {}, 15000);
      if (!response.ok) throw new Error(`Failed to fetch invoices: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setInvoices(data);
      console.log('✓ Loaded', data.length, 'invoices from MongoDB');
    } catch (error) {
      console.error('Error fetching invoices:', error);
      // Only set empty array if we don't have data yet (first load)
      setInvoices(prev => prev.length === 0 ? [] : prev);
      throw error; // Re-throw to allow retry mechanism
    }
  };

  // Fetch payments from server
  const fetchPayments = async () => {
    try {
      const response = await fetchWithTimeout(`${apiBaseUrl}/api/payments`, {}, 15000);
      if (!response.ok) throw new Error(`Failed to fetch payments: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setPayments(data);
      // Sync paymentHistory with MongoDB payments
      setPaymentHistory(data);
      setRecentPayments(data.slice(0, 10)); // Keep recent payments for dashboard
      console.log('✓ Loaded', data.length, 'payments from MongoDB');
    } catch (error) {
      console.error('Error fetching payments:', error);
      // Only set empty array if we don't have data yet (first load)
      setPayments(prev => prev.length === 0 ? [] : prev);
      setPaymentHistory(prev => prev.length === 0 ? [] : prev);
      setRecentPayments(prev => prev.length === 0 ? [] : prev);
      throw error; // Re-throw to allow retry mechanism
    }
  };

  // Fetch donations from server
  const fetchDonations = async () => {
    try {
      const response = await fetchWithTimeout(`${apiBaseUrl}/api/donations`, {}, 15000);
      if (!response.ok) throw new Error(`Failed to fetch donations: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setDonations(data);
      console.log('✓ Loaded', data.length, 'donations from MongoDB');
    } catch (error) {
      console.error('Error fetching donations:', error);
      // Only set empty array if we don't have data yet (first load)
      setDonations(prev => prev.length === 0 ? [] : prev);
    }
  };

  // Fetch payment methods from server
  const fetchPaymentMethods = async () => {
    try {
      const response = await fetchWithTimeout(`${apiBaseUrl}/api/payment-methods`, {}, 15000);
      if (!response.ok) throw new Error(`Failed to fetch payment methods: ${response.status} ${response.statusText}`);
      const data = await response.json();
      
      // If database is empty, initialize with default payment methods
      if (data.length === 0) {
        console.log('⚠️ No payment methods in database, initializing defaults...');
        const defaultMethods = [
          { name: "Alipay", visible: false, qrImageUrl: "", details: [] },
          { name: "PayMe", visible: false, qrImageUrl: "", details: [] },
          { name: "FPS", visible: true, details: ["FPS ID 1234567"] },
          { name: "Direct Bank Transfer", visible: true, details: ["HSBC Hong Kong", "123-456789-001", "IMA Subscription Manager"] },
          { name: "Credit/Debit Cards", visible: true, details: ["Gateway: Stripe"] },
        ];
        
        // Save defaults to database
        for (const method of defaultMethods) {
          try {
            await fetch(`${apiBaseUrl}/api/payment-methods`, {
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
      // Set empty array instead of dummy data - will retry automatically
      setPaymentMethods([]);
      throw error; // Re-throw to allow retry mechanism
    }
  };

  // Fetch reminder logs (automatic + manual email reminders) from server
  const fetchReminderLogs = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/reminders/logs`);
      if (!response.ok) throw new Error('Failed to fetch reminder logs');
      const data = await response.json();
      setReminderLogs(data);
      console.log('✓ Loaded', data.length, 'reminder logs from MongoDB');
    } catch (error) {
      console.error('Error fetching reminder logs:', error);
      setReminderLogs([]);
    }
  };

  // Fetch password reset requests from server
  const fetchPasswordResetRequests = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/password-reset-requests`);
      if (!response.ok) throw new Error('Failed to fetch password reset requests');
      const data = await response.json();
      setPasswordResetRequests(data);
      console.log('✓ Loaded', data.length, 'password reset requests from MongoDB');
    } catch (error) {
      console.error('Error fetching password reset requests:', error);
      setPasswordResetRequests([]);
    }
  };

  // Fetch data on mount - moved after function definitions
  useEffect(() => {
    // Fetch data in background without blocking page render
    // This improves perceived performance - page shows immediately
    const fetchAllData = async () => {
      try {
        // Fetch critical data first with retry mechanism (members, admins, invoices)
        await Promise.allSettled([
          retryFetch(() => fetchMembers(), 3, 1000).catch(err => console.error('Failed to fetch members after retries:', err)),
          retryFetch(() => fetchAdmins(), 3, 1000).catch(err => console.error('Failed to fetch admins after retries:', err)),
          retryFetch(() => fetchInvoices(), 3, 1000).catch(err => console.error('Failed to fetch invoices after retries:', err)),
        ]);
        
        // Then fetch remaining data with retry
        await Promise.allSettled([
          retryFetch(() => fetchPayments(), 3, 1000).catch(err => console.error('Failed to fetch payments after retries:', err)),
          retryFetch(() => fetchDonations(), 2, 1000).catch(err => console.error('Failed to fetch donations after retries:', err)),
          retryFetch(() => fetchPaymentMethods(), 2, 1000).catch(err => console.error('Failed to fetch payment methods after retries:', err)),
          fetchReminderLogs().catch(err => console.error('Failed to fetch reminder logs:', err)),
        ]);
        
        // Set loading to false after data fetching completes (even if some failed)
        setLoading(false);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        // Set loading to false even on error so page can render
        setLoading(false);
      }
    };
    
    // Start fetching immediately but don't block
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Persist other data to localStorage
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

  // Request deduplication helper
  const makeRequest = useCallback(async (requestKey, requestFn) => {
    if (pendingRequestsRef.current.has(requestKey)) {
      console.log('⚠ Duplicate request prevented:', requestKey);
      throw new Error('Request already in progress');
    }
    
    pendingRequestsRef.current.add(requestKey);
    try {
      const result = await requestFn();
      return result;
    } finally {
      pendingRequestsRef.current.delete(requestKey);
    }
  }, []);

  // CRUD Operations for Members (Server-based) with Optimistic Updates
  const addMember = async (member) => {
    const normalizedMemberInput = normalizeMemberRecord(member);
    const payload = { ...normalizedMemberInput };
    delete payload.id;
    delete payload.memberNo;
    delete payload._id;
    delete payload.allowManualId;
    const requestKey = `add-member-${Date.now()}`;
    
    // Optimistic update - update UI immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMember = { ...normalizedMemberInput, id: tempId, _isOptimistic: true };
    const previousMembers = members;
    setMembers(prev => [...prev, optimisticMember]);
    updateMetrics({ totalMembers: metrics.totalMembers + 1 });
    
    try {
      const newMember = await makeRequest(requestKey, async () => {
      const response = await fetch(`${apiBaseUrl}/api/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Extract detailed error message - prioritize errors array over message
        let errorMessage = 'Failed to add member';
        
        // Always prefer errors array if it exists (contains detailed validation errors)
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          errorMessage = errorData.errors.join(', ');
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        throw new Error(errorMessage);
      }
        return await response.json();
      });
      const normalizedResponse = normalizeMemberRecord(newMember);

      if (!normalizedResponse?.id) {
        throw new Error("Member ID missing in server response. Please try again.");
      }
      
      // Replace optimistic member with real one
      // Also remove any duplicate members that might have been added via Socket.io
      setMembers(prev => {
        // Remove the optimistic member and any duplicate members with the same ID
        const filtered = prev.filter(m => !(m._isOptimistic && m.id === tempId) && m.id !== normalizedResponse.id);
        // Check if newMember already exists (shouldn't, but check to be safe)
        const alreadyExists = prev.find(m => m.id === normalizedResponse.id && !m._isOptimistic);
        if (alreadyExists) {
          // If exists, update it instead of adding
          return prev.map(m => m.id === normalizedResponse.id ? normalizedResponse : m);
        }
        // Add the new member at the beginning
        return [normalizedResponse, ...filtered];
      });
      console.log('✓ Member added to server:', normalizedResponse);
      return normalizedResponse;
    } catch (error) {
      console.error('Error adding member:', error);
      // Rollback optimistic update
      setMembers(previousMembers);
      updateMetrics({ totalMembers: metrics.totalMembers - 1 });
      throw error;
    }
  };

  const updateMember = async (id, updatedData) => {
    if (!id) {
      console.error("Missing member _id for update.");
      throw new Error("Member data not available. Please refresh the page.");
    }
    const requestKey = `update-member-${id}-${Date.now()}`;
    const normalizedUpdate = updatedData && typeof updatedData === "object"
      ? (
          updatedData.subscriptionType
            ? { ...updatedData, subscriptionType: normalizeSubscriptionType(updatedData.subscriptionType) }
            : { ...updatedData }
        )
      : updatedData;
    
    // Optimistic update
    const previousMembers = members;
    setMembers(prev => prev.map(m => {
      const matches = m._id ? m._id === id : m.id === id;
      return matches ? { ...m, ...normalizedUpdate, _isOptimistic: true } : m;
    }));
    
    try {
      const updated = await makeRequest(requestKey, async () => {
        const response = await fetch(`${apiBaseUrl}/api/members/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedUpdate),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.message || errorData.error || 'Failed to update member';
          throw new Error(message);
        }
        return await response.json();
      });
      const normalizedResult = normalizeMemberRecord(updated);
      
      // Replace optimistic update with real one
      setMembers(prev => prev.map(m => {
        const matches = m._id ? m._id === id : m.id === id;
        return matches ? normalizedResult : m;
      }));
      console.log('✓ Member updated on server:', normalizedResult);
      return normalizedResult;
    } catch (error) {
      console.error('Error updating member:', error);
      // Rollback optimistic update
      setMembers(previousMembers);
      throw error;
    }
  };

  const upgradeMemberSubscription = async (id, toSubscriptionType) => {
    if (!id) {
      throw new Error("Missing member id for upgrade.");
    }
    if (!toSubscriptionType || typeof toSubscriptionType !== "string") {
      throw new Error("toSubscriptionType is required.");
    }

    const requestKey = `upgrade-member-subscription-${id}-${Date.now()}`;

    const upgraded = await makeRequest(requestKey, async () => {
      const response = await fetch(`${apiBaseUrl}/api/members/${encodeURIComponent(id)}/upgrade-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toSubscriptionType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || errorData.error || "Failed to upgrade subscription";
        throw new Error(message);
      }

      return await response.json();
    });

    // Refresh member data after upgrade (ensures UI gets the new displayId immediately)
    const refreshResponse = await fetch(`${apiBaseUrl}/api/members/${encodeURIComponent(upgraded?._id || id)}`);
    const refreshed = refreshResponse.ok ? await refreshResponse.json() : upgraded;
    const normalizedResult = normalizeMemberRecord(refreshed);

    setMembers(prev => prev.map(m => {
      const matches = m._id ? String(m._id) === String(normalizedResult._id) : m.id === normalizedResult.id;
      return matches ? normalizedResult : m;
    }));

    return normalizedResult;
  };

  const deleteMember = async (id) => {
    if (!id) {
      console.error("Missing member _id for delete.");
      throw new Error("Member data not available. Please refresh the page.");
    }
    const requestKey = `delete-member-${id}-${Date.now()}`;
    
    // Optimistic update
    const previousMembers = members;
    const previousInvoices = invoices;
    const deletedMember = members.find(m => (m._id ? m._id === id : m.id === id));
    const deletedBusinessId = deletedMember?.id;
    setMembers(prev => prev.filter((m) => (m._id ? m._id !== id : m.id !== id)));
    setInvoices(prev => {
      if (!deletedBusinessId) return prev;
      return prev.filter((inv) => inv.memberId !== deletedBusinessId);
    });
    updateMetrics({ totalMembers: metrics.totalMembers - 1 });
    
    try {
      await makeRequest(requestKey, async () => {
      const response = await fetch(`${apiBaseUrl}/api/members/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete member');
        return response;
      });
      
      console.log('✓ Member deleted from server:', id);
    } catch (error) {
      console.error('Error deleting member:', error);
      // Rollback optimistic update
      setMembers(previousMembers);
      setInvoices(previousInvoices);
      if (deletedMember) {
        updateMetrics({ totalMembers: metrics.totalMembers + 1 });
      }
      throw error;
    }
  };

  // CRUD Operations for Invoices (Server-based)
  const addInvoice = async (invoice) => {
    const { memberName, memberEmail, member, ...rest } = invoice || {};
    const sanitizedInvoice = { ...rest };
    delete sanitizedInvoice.amount;
    delete sanitizedInvoice.membershipFee;
    delete sanitizedInvoice.janazaFee;
    if (sanitizedInvoice.subscriptionType) {
      sanitizedInvoice.subscriptionType = normalizeSubscriptionType(sanitizedInvoice.subscriptionType);
    }
    try {
        const response = await fetch(`${apiBaseUrl}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedInvoice),
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

  const isBusinessInvoiceNumber = (value) => /^INV-/i.test(String(value || "").trim());

  const assertInvoiceMongoId = (value, contextLabel = "invoiceId") => {
    const normalized = String(value || "").trim();
    if (!normalized) {
      throw new Error(`${contextLabel} is required`);
    }
    if (isBusinessInvoiceNumber(normalized)) {
      console.error(`❌ Blocked API call using business invoice number: ${normalized}`);
      throw new Error("Invoice API calls must use Mongo _id, not business invoice number.");
    }
    return normalized;
  };

  const updateInvoice = async (id, updatedData) => {
    const resolvedId = assertInvoiceMongoId(id, "updateInvoice id");
    const requestKey = `update-invoice-${resolvedId}-${Date.now()}`;
    
    // Optimistic update
    const previousInvoices = invoices;
    const previousMetrics = { ...metrics };
    const oldInvoice = invoices.find((inv) => String(inv._id || "") === resolvedId);
    
    // Log for debugging
    console.log(`📝 updateInvoice called for ${resolvedId}:`, { 
      oldStatus: oldInvoice?.status, 
      newStatus: updatedData.status,
      hasOldInvoice: !!oldInvoice 
    });
    
    setInvoices(prev => prev.map(inv => String(inv._id || "") === resolvedId ? { ...inv, ...updatedData, _isOptimistic: true } : inv));
    
    // Optimistic metrics update
    if (updatedData.status === "Paid" && oldInvoice && oldInvoice.status !== "Paid") {
      const amount = parseFloat(oldInvoice.amount?.replace(/[^0-9.]/g, "") || "0");
      updateMetrics({
        collectedMonth: metrics.collectedMonth + amount,
        collectedYear: metrics.collectedYear + amount,
        outstanding: Math.max(0, metrics.outstanding - amount),
      });
    }
    
    try {
      const updated = await makeRequest(requestKey, async () => {
        const response = await fetch(`${apiBaseUrl}/api/invoices/${resolvedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ Invoice update failed for ${resolvedId}:`, errorData);
          throw new Error(errorData.message || errorData.error || 'Failed to update invoice');
        }
        
        const result = await response.json();
        console.log(`✓ Invoice ${resolvedId} API response:`, { 
          status: result.status, 
          receiptNumber: result.receiptNumber 
        });
        return result;
      });
      
      // Replace optimistic update with real one
      setInvoices(prev => prev.map(inv => String(inv._id || "") === resolvedId ? updated : inv));
      console.log('✓ Invoice updated on server:', updated.id, updated.status);
      return updated;
    } catch (error) {
      console.error('Error updating invoice:', error);
      // Rollback optimistic update
      setInvoices(previousInvoices);
      setMetrics(previousMetrics);
      throw error;
    }
  };

  const deleteInvoice = async (id) => {
    const resolvedId = assertInvoiceMongoId(id, "deleteInvoice id");
    const requestKey = `delete-invoice-${resolvedId}-${Date.now()}`;
    
    try {
      await makeRequest(requestKey, async () => {
        const response = await fetch(`${apiBaseUrl}/api/invoices/${resolvedId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete invoice');
        return response;
      });
      
      setInvoices(prev => prev.filter((inv) => String(inv._id || "") !== resolvedId));
      console.log('✓ Invoice deleted from server:', resolvedId);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  };

  // Payment Operations with Optimistic Updates
  const addPayment = async (payment) => {
    const requestKey = `add-payment-${Date.now()}`;
    
      const paymentData = {
        ...payment,
        date: payment.date || new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
      
    if (payment.invoiceId && isBusinessInvoiceNumber(payment.invoiceId)) {
      console.error(`❌ Blocked payment payload with business invoice number: ${payment.invoiceId}`);
      throw new Error("Payment payload must not include business invoice numbers.");
    }

    // Optimistic update
    const tempId = `temp-payment-${Date.now()}`;
    const optimisticPayment = { ...paymentData, _id: tempId, id: tempId, _isOptimistic: true };
    const previousPayments = payments;
    const previousRecentPayments = recentPayments;
    const previousPaymentHistory = paymentHistory;
    const previousMetrics = { ...metrics };
    
    setPayments(prev => [optimisticPayment, ...prev]);
    setRecentPayments(prev => [optimisticPayment, ...prev]);
    setPaymentHistory(prev => [optimisticPayment, ...prev]);
    
    // Optimistic metrics update
    const amount = parseFloat(payment.amount.replace(/[^0-9.]/g, ""));
    updateMetrics({
      collectedMonth: metrics.collectedMonth + amount,
      collectedYear: metrics.collectedYear + amount,
      outstanding: Math.max(0, metrics.outstanding - amount),
    });
    
    try {
      const newPayment = await makeRequest(requestKey, async () => {
      const response = await fetch(`${apiBaseUrl}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save payment');
      }
      
        return await response.json();
      });
      
      // Replace optimistic payment with real one
      setPayments(prev => prev.map(p => (p._isOptimistic && (p._id === tempId || p.id === tempId)) ? newPayment : p));
      setRecentPayments(prev => prev.map(p => (p._isOptimistic && (p._id === tempId || p.id === tempId)) ? newPayment : p));
      setPaymentHistory(prev => prev.map(p => (p._isOptimistic && (p._id === tempId || p.id === tempId)) ? newPayment : p));
      
      console.log('✓ Payment saved to MongoDB:', newPayment);
      return newPayment;
    } catch (error) {
      console.error('Error adding payment:', error);
      // Rollback optimistic updates
      setPayments(previousPayments);
      setRecentPayments(previousRecentPayments);
      setPaymentHistory(previousPaymentHistory);
      setMetrics(previousMetrics);
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
      const response = await fetch(`${apiBaseUrl}/api/payment-methods/${name}`, {
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
    setAdmins(initialAdmins);
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
      const response = await fetch(`${apiBaseUrl}/api/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          email: user.email || '',
          phone: user.phone || '',
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
      const response = await fetch(`${apiBaseUrl}/api/admins/${id}`, {
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
      // No need to refetch - Socket.io will update in real-time if implemented
      return updatedAdmin;
    } catch (error) {
      console.error('Error updating admin:', error);
      throw error;
    }
  };

  const deleteAdminUser = async (id) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admins/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete admin');
      }
      setAdmins(admins.filter((admin) => admin.id !== id));
      // No need to refetch - Socket.io will update in real-time if implemented
    } catch (error) {
      console.error('Error deleting admin:', error);
      throw error;
    }
  };

  // Donation Operations
  const addDonation = async (donation) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donation),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add donation');
      }
      
      const newDonation = await response.json();
      setDonations([newDonation, ...donations]);
      console.log('✓ Donation added to server:', newDonation);
      return newDonation;
    } catch (error) {
      console.error('Error adding donation:', error);
      throw error;
    }
  };

  const deleteDonation = async (id) => {
    const requestKey = `delete-donation-${id}-${Date.now()}`;
    
    // Optimistic update
    const previousDonations = donations;
    setDonations(prev => prev.filter(d => d._id !== id));
    
    try {
      await makeRequest(requestKey, async () => {
      const response = await fetch(`${apiBaseUrl}/api/donations/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete donation');
      }
      
        return response;
      });
      
      console.log('✓ Donation deleted from server:', id);
    } catch (error) {
      console.error('Error deleting donation:', error);
      // Rollback optimistic update
      setDonations(previousDonations);
      throw error;
    }
  };

  const value = {
    members,
    invoices,
    payments,
    donations,
    loading,
    fetchMembers,
    fetchAdmins,
    fetchInvoices,
    fetchPayments,
    fetchDonations,
    fetchPaymentMethods,
    fetchReminderLogs,
    fetchPasswordResetRequests,
    recentPayments,
    paymentHistory,
    communicationLog,
    reminderLogs,
    passwordResetRequests,
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
    upgradeMemberSubscription,
    deleteMember,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addPayment,
    addDonation,
    deleteDonation,
    addCommunication,
    updatePaymentMethod,
    updateMetrics,
    updateReminderRule,
    updateReminderTemplate,
    updateOrganizationInfo,
    userLocale,
    updateUserLocale,
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


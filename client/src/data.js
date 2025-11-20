export const loginPresets = {
  admin: { email: "admin@subscriptionhk.org", password: "Admin#2025" },
  member: { email: "member@subscriptionhk.org", password: "Member#2025" },
};

export const metrics = {
  totalMembers: 312,
  collectedMonth: 12450,
  collectedYear: 220800,
  outstanding: 18400,
  overdueMembers: 27,
  expectedAnnual: 249600,
};

export const monthlyCollections = [
  { month: "Oct", value: 65 },
  { month: "Nov", value: 72 },
  { month: "Dec", value: 58 },
  { month: "Jan", value: 80 },
  { month: "Feb", value: 76 },
  { month: "Mar", value: 90 },
  { month: "Apr", value: 84 },
  { month: "May", value: 88 },
  { month: "Jun", value: 77 },
  { month: "Jul", value: 85 },
  { month: "Aug", value: 92 },
  { month: "Sep", value: 79 },
];

export const recentPayments = [
  {
    member: "Janice Leung",
    period: "Oct 2025",
    amount: "$50",
    method: "PayMe",
    status: "Paid",
    date: "02 Oct · 09:11",
  },
  {
    member: "Samuel Chan",
    period: "Oct 2025",
    amount: "$50",
    method: "FPS",
    status: "Paid",
    date: "05 Oct · 10:22",
  },
  {
    member: "Aisha Malik",
    period: "Sep 2025",
    amount: "$100",
    method: "Card",
    status: "Unpaid",
    date: "30 Sep · 12:44",
  },
  {
    member: "Omar Rahman",
    period: "Sep 2025",
    amount: "$100",
    method: "PayMe",
    status: "Overdue",
    date: "20 Sep · 14:10",
  },
];

export const members = [
  {
    id: "HK1021",
    name: "Samuel Chan",
    email: "samuel.chan@hk.org",
    phone: "+852 9123 4567",
    status: "Active",
    balance: "$150 Outstanding",
    nextDue: "05 Nov 2025",
    lastPayment: "05 Oct 2025",
  },
  {
    id: "HK1088",
    name: "Janice Leung",
    email: "janice.leung@hk.org",
    phone: "+852 6789 1234",
    status: "Active",
    balance: "$0",
    nextDue: "05 Nov 2025",
    lastPayment: "02 Oct 2025",
  },
  {
    id: "HK1104",
    name: "Omar Rahman",
    email: "omar.rahman@hk.org",
    phone: "+852 9555 2011",
    status: "Inactive",
    balance: "$250 Overdue",
    nextDue: "20 Sep 2025",
    lastPayment: "15 Jul 2025",
  },
  {
    id: "HK1112",
    name: "Aisha Malik",
    email: "aisha.malik@hk.org",
    phone: "+852 9988 7766",
    status: "Active",
    balance: "$100 Unpaid",
    nextDue: "30 Sep 2025",
    lastPayment: "05 Aug 2025",
  },
];

export const invoices = [
  {
    id: "INV-2025-091",
    period: "Oct 2025",
    amount: "$50",
    status: "Paid",
    due: "05 Oct 2025",
    method: "FPS",
    reference: "FP89231",
  },
  {
    id: "INV-2025-072",
    period: "Sep 2025 (Eid)",
    amount: "$100",
    status: "Unpaid",
    due: "30 Sep 2025",
    method: "PayMe",
    reference: "PM22011",
  },
  {
    id: "INV-2025-051",
    period: "Aug 2025",
    amount: "$50",
    status: "Paid",
    due: "05 Aug 2025",
    method: "Bank Transfer",
    reference: "BT99127",
  },
];

export const paymentHistory = [
  { date: "05 Oct 2025", amount: "$50", method: "FPS", reference: "FP89231" },
  { date: "05 Sep 2025", amount: "$50", method: "PayMe", reference: "PM22110" },
  { date: "02 Apr 2025", amount: "$100", method: "Bank Transfer", reference: "BT44881" },
];

export const communicationLog = [
  { channel: "Email", message: "Upcoming due reminder", status: "Delivered", date: "02 Oct 2025" },
  { channel: "WhatsApp", message: "Overdue alert", status: "Pending", date: "01 Oct 2025" },
];

export const reminderRules = [
  { label: "3 days before due date", channels: ["Email", "WhatsApp"] },
  { label: "On due date", channels: ["Email", "WhatsApp"] },
  { label: "5 days after due date", channels: ["Email"] },
];

export const paymentMethods = [
  {
    name: "Direct Bank Transfer",
    visible: true,
    details: ["HSBC Hong Kong", "123-456789-001", "Subscription Manager HK"],
  },
  { name: "FPS", visible: true, details: ["FPS ID 1234567"] },
  { name: "Alipay", visible: true, details: ["Upload QR placeholder"] },
  { name: "PayMe", visible: true, details: ["Upload QR placeholder"] },
  { name: "Credit/Debit Cards", visible: true, details: ["Gateway: Stripe"] },
];

export const reportStats = {
  collected: 220800,
  expected: 249600,
  averagePerMember: 708,
  methodMix: [
    { label: "FPS", value: "34%" },
    { label: "PayMe", value: "26%" },
    { label: "Bank Transfer", value: "18%" },
    { label: "Credit/Debit", value: "15%" },
    { label: "Alipay", value: "7%" },
  ],
};

export const memberUpcomingPayments = [
  { label: "Nov 2025 Monthly", due: "05 Nov 2025", amount: "$50", status: "Due Soon" },
  { label: "Sep 2025 Eid 2", due: "30 Sep 2025", amount: "$100", status: "Overdue" },
  { label: "Apr 2025 Eid 1", due: "02 Apr 2025", amount: "$100", status: "Paid" },
];

export const memberInvoices = invoices;

export const memberPaymentHistory = [
  { date: "05 Oct 2025", amount: "$50", method: "FPS", reference: "FP89231" },
  { date: "02 Sep 2025", amount: "$50", method: "PayMe", reference: "PM22110" },
  { date: "30 Apr 2025", amount: "$100", method: "Card", reference: "CC90211" },
];

export const userFlows = [
  {
    title: "Admin Billing",
    steps: [
      "Login as Admin",
      "Dashboard → Members",
      "Open Samuel Chan",
      "Create manual invoice",
      "Save & send reminder",
    ],
    cta: "Trigger Reminder",
    tone: "primary",
  },
  {
    title: "Automation Setup",
    steps: [
      "Login as Admin",
      "Reminders & Automation",
      "Enable automatic reminders",
      "Configure before/on/after rules",
      "Select Email + WhatsApp",
    ],
    cta: "Update Rules",
    tone: "secondary",
  },
  {
    title: "Member Payment",
    steps: [
      "Login as Member",
      "Dashboard → Pay Now",
      "Choose PayMe or Card",
      "Submit proof or pay online",
      "View confirmation",
    ],
    cta: "Simulate Payment",
    tone: "primary",
  },
  {
    title: "Invoice Review",
    steps: [
      "Login as Member",
      "Dashboard → View Invoices",
      "Open INV-2025-072",
      "Select Pay Now",
      "Complete payment",
    ],
    cta: "Open Invoice",
    tone: "secondary",
  },
];









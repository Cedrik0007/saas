import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

// app.use(cors());
app.use(cors({
  origin: "https://subs-manager.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// const members = [
//   { id: "HK1021", name: "Samuel Chan", status: "Active", outstanding: 150 },
//   { id: "HK1088", name: "Janice Leung", status: "Active", outstanding: 0 },
//   { id: "HK1104", name: "Omar Rahman", status: "Inactive", outstanding: 250 },
//   { id: "HK1112", name: "Aisha Malik", status: "Active", outstanding: 100 },
// ];

const members = [
  {
    id: "HK1001",
    name: "Shan Yeager",
    email: "0741sanjai@gmail.com",
    phone: "+91 7806830491",
    status: "Active",
    balance: "$250 Outstanding",
    nextDue: "20 Nov 2025",
    lastPayment: "15 Oct 2025",
  },
  {
    id: "HK1021",
    name: "Ahmed Al-Rashid",
    email: "ahmed.rashid@hk.org",
    phone: "+852 9123 4567",
    status: "Active",
    balance: "$150 Outstanding",
    nextDue: "05 Nov 2025",
    lastPayment: "05 Oct 2025",
  },
  {
    id: "HK1088",
    name: "Fatima Hussain",
    email: "fatima.hussain@hk.org",
    phone: "+852 6789 1234",
    status: "Active",
    balance: "$0",
    nextDue: "05 Nov 2025",
    lastPayment: "02 Oct 2025",
  },
 
];

const metrics = {
  totalMembers: 312,
  collectedMonth: 12450,
  collectedYear: 220800,
  outstanding: 18400,
  overdueMembers: 27,
};

const invoices = [
  {
    id: "INV-2025-095",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Nov 2025 Monthly",
    amount: "$50",
    status: "Unpaid",
    due: "20 Nov 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-094",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Oct 2025 Monthly",
    amount: "$50",
    status: "Overdue",
    due: "20 Oct 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-093",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Sep 2025 Eid 2",
    amount: "$100",
    status: "Overdue",
    due: "30 Sep 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-092",
    memberId: "HK1001",
    memberName: "Shan Yeager",
    period: "Sep 2025 Monthly",
    amount: "$50",
    status: "Overdue",
    due: "20 Sep 2025",
    method: "-",
    reference: "-",
  },
  {
    id: "INV-2025-091",
    memberId: "HK1021",
    memberName: "Ahmed Al-Rashid",
    period: "Oct 2025",
    amount: "$50",
    status: "Paid",
    due: "05 Oct 2025",
    method: "FPS",
    reference: "FP89231",
  },
  {
    id: "INV-2025-072",
    memberId: "HK1112",
    memberName: "Aisha Malik",
    period: "Sep 2025 (Eid)",
    amount: "$100",
    status: "Unpaid",
    due: "30 Sep 2025",
    method: "-",
    reference: "-",
  },
];

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const role = email.includes("admin") ? "Admin" : "Member";
  res.json({
    role,
    token: `demo-token-${Math.random().toString(36).slice(2, 10)}`,
    email,
  });
});

app.get("/api/metrics", (_req, res) => {
  res.json(metrics);
});

// ========== MEMBERS CRUD ENDPOINTS ==========

// GET all members
app.get("/api/members", (_req, res) => {
  res.json(members);
});

// GET single member
app.get("/api/members/:id", (req, res) => {
  const member = members.find(m => m.id === req.params.id);
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }
  res.json(member);
});

// POST create new member
app.post("/api/members", (req, res) => {
  const newMember = {
    id: `HK${Math.floor(1000 + Math.random() * 9000)}`,
    ...req.body,
  };
  members.push(newMember);
  res.status(201).json(newMember);
});

// PUT update member
app.put("/api/members/:id", (req, res) => {
  const index = members.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "Member not found" });
  }
  members[index] = { ...members[index], ...req.body };
  res.json(members[index]);
});

// DELETE member
app.delete("/api/members/:id", (req, res) => {
  const index = members.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "Member not found" });
  }
  members.splice(index, 1);
  res.status(204).send();
});

// ========== INVOICES CRUD ENDPOINTS ==========

// GET all invoices
app.get("/api/invoices", (_req, res) => {
  res.json(invoices);
});

// GET invoices for specific member
app.get("/api/invoices/member/:memberId", (req, res) => {
  const memberInvoices = invoices.filter(inv => inv.memberId === req.params.memberId);
  res.json(memberInvoices);
});

// POST create new invoice
app.post("/api/invoices", (req, res) => {
  const invoice = {
    id: `INV-2025-${Math.floor(100 + Math.random() * 900)}`,
    ...req.body,
    status: req.body.status || "Unpaid",
  };
  invoices.push(invoice);
  res.status(201).json(invoice);
});

// PUT update invoice
app.put("/api/invoices/:id", (req, res) => {
  const index = invoices.findIndex(inv => inv.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  invoices[index] = { ...invoices[index], ...req.body };
  res.json(invoices[index]);
});

// DELETE invoice
app.delete("/api/invoices/:id", (req, res) => {
  const index = invoices.findIndex(inv => inv.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  invoices.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Subscription Manager HK API running on port ${PORT}`);
  console.log(`✓ API endpoints available:`);
  console.log(`  - GET    /api/members`);
  console.log(`  - POST   /api/members`);
  console.log(`  - PUT    /api/members/:id`);
  console.log(`  - DELETE /api/members/:id`);
  console.log(`  - GET    /api/invoices`);
  console.log(`  - POST   /api/invoices`);
  console.log(`  - PUT    /api/invoices/:id`);
  console.log(`  - DELETE /api/invoices/:id`);
});












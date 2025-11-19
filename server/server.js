import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const members = [
  { id: "HK1021", name: "Samuel Chan", status: "Active", outstanding: 150 },
  { id: "HK1088", name: "Janice Leung", status: "Active", outstanding: 0 },
  { id: "HK1104", name: "Omar Rahman", status: "Inactive", outstanding: 250 },
  { id: "HK1112", name: "Aisha Malik", status: "Active", outstanding: 100 },
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
    id: "INV-2025-091",
    memberId: "HK1021",
    period: "Oct 2025",
    amount: 50,
    status: "Paid",
    due: "2025-10-05",
  },
  {
    id: "INV-2025-072",
    memberId: "HK1021",
    period: "Sep 2025 (Eid)",
    amount: 100,
    status: "Unpaid",
    due: "2025-09-30",
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

app.get("/api/members", (_req, res) => {
  res.json(members);
});

app.get("/api/invoices", (_req, res) => {
  res.json(invoices);
});

app.post("/api/invoices", (req, res) => {
  const invoice = {
    id: `INV-${Date.now()}`,
    ...req.body,
    status: "Unpaid",
  };
  invoices.push(invoice);
  res.status(201).json(invoice);
});

app.listen(PORT, () => {
  console.log(`Subscription Manager HK API running on port ${PORT}`);
});






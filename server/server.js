import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ CORS: allow only your Vercel frontend
app.use(cors({
  origin: "https://subscription-frontend.vercel.app" // replace with your Vercel frontend URL
}));

app.use(express.json());

// Health route
app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: Date.now() }));

// Mock data
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
  { id: "INV-2025-091", memberId: "HK1021", period: "Oct 2025", amount: 50, status: "Paid", due: "2025-10-05" },
  { id: "INV-2025-072", memberId: "HK1021", period: "Sep 2025 (Eid)", amount: 100, status: "Unpaid", due: "2025-09-30" },
];

// ✅ Login endpoint
app.post("/api/login", (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // Simple demo: admin if email contains "admin"
  const role = email.toLowerCase().includes("admin") ? "Admin" : "Member";
  const token = `demo-token-${Math.random().toString(36).slice(2, 10)}`;

  res.json({ role, token, email });
});

// Other endpoints
app.get("/api/metrics", (_req, res) => res.json(metrics));
app.get("/api/members", (_req, res) => res.json(members));
app.get("/api/invoices", (_req, res) => res.json(invoices));
app.post("/api/invoices", (req, res) => {
  const invoice = { id: `INV-${Date.now()}`, ...req.body, status: "Unpaid" };
  invoices.push(invoice);
  res.status(201).json(invoice);
});

// Start server
app.listen(PORT, () => console.log(`Subscription Manager API running on port ${PORT}`));

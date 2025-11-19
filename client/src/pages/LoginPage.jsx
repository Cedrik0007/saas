import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";

export function LoginPage() {
  const [authMessage, setAuthMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  // ✅ Backend API URL via Vercel env variable
  const API_BASE = import.meta.env.VITE_API_URL; // e.g., https://subscription-backend.onrender.com/api

  const handleLogin = async () => {
    setAuthMessage(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      if (!response.ok) throw new Error("Login failed");

      const payload = await response.json();

      setAuthMessage({
        type: "success",
        text: `${payload.role} login accepted · token ${payload.token.slice(0, 6)}***`,
      });

      // Redirect based on backend role
      navigate(payload.role === "Admin" ? "/admin" : "/member", { replace: true, state: payload });

    } catch (err) {
      setAuthMessage({ type: "error", text: "Login failed. Ensure backend is live." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader showCTA={false} />
      <main className="login-main">
        <div className="login-shell">
          <aside className="login-menu">
            <p className="eyebrow light">Welcome</p>
            <h2>Subscription Manager HK</h2>
            <p>Streamlined portal for Hong Kong membership dues. Track payments and automations from one place.</p>
          </aside>

          <div className="login-form-card">
            <h1>Sign in</h1>

            <label className="mono-label">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter Your Email"
                className="mono-input"
              />
            </label>

            <label className="mono-label">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter Your Password"
                className="mono-input"
              />
            </label>

            <div className="login-buttons">
              <button type="button" className="btn-login" onClick={handleLogin} disabled={loading}>
                {loading ? "Authorising…" : "Login"}
              </button>
            </div>

            {authMessage && (
              <div className={`alert ${authMessage.type === "success" ? "alert-success" : "alert-error"}`}>
                {authMessage.text}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

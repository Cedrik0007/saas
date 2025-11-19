import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { loginPresets } from "../data";

export function LoginPage() {
  const [authMessage, setAuthMessage] = useState(null);
  const [loadingRole, setLoadingRole] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  // Your Render backend URL
  const API_BASE = "https://sm-bk.onrender.com";

  const handleLogin = async (role) => {
    const preset = loginPresets[role];

    const emailMatch =
      form.email.trim().toLowerCase() === preset.email.toLowerCase();
    const passwordMatch = form.password === preset.password;

    // Validate using preset but SEND real form input
    if (!emailMatch || !passwordMatch) {
      setAuthMessage({
        type: "error",
        text: `Use the ${role} demo credentials shown below.`,
      });
      return;
    }

    setLoadingRole(role);
    setAuthMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      if (!response.ok) throw new Error("Login failed");

      const payload = await response.json();

      setAuthMessage({
        type: "success",
        text: `${payload.role} login accepted · token ${payload.token.slice(
          0,
          6
        )}***`,
      });

      navigate(payload.role === "Admin" ? "/admin" : "/member", {
        replace: true,
        state: payload,
      });
    } catch (err) {
      setAuthMessage({
        type: "error",
        text: "Demo API is offline. Please try again later.",
      });
    } finally {
      setLoadingRole(null);
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
            <p>
              Streamlined portal for Hong Kong membership dues. Track monthly
              payments and automation from one place.
            </p>
            <ul>
              <li>✓ Supports FPS, PayMe, bank transfers, cards</li>
              <li>✓ Automated reminders via email + WhatsApp</li>
              <li>✓ Clear dashboards for admins and members</li>
            </ul>
          </aside>

          <div className="login-form-card">
            <h1>Sign in</h1>

            <label className="mono-label">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                placeholder="Enter Your Email"
                className="mono-input"
              />
            </label>

            <label className="mono-label">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                placeholder="Enter Your Password"
                className="mono-input"
              />
            </label>

            <div className="login-hints">
              <p>
                <strong>Admin:</strong> {loginPresets.admin.email} /{" "}
                {loginPresets.admin.password}
              </p>
              <p>
                <strong>Member:</strong> {loginPresets.member.email} /{" "}
                {loginPresets.member.password}
              </p>
            </div>

            <div className="login-buttons">
              <button
                type="button"
                className="btn-admin"
                onClick={() => handleLogin("admin")}
                disabled={loadingRole === "member"}
              >
                {loadingRole === "admin" ? "Authorising…" : "Login as Admin"}
              </button>

              <button
                type="button"
                className="btn-member"
                onClick={() => handleLogin("member")}
                disabled={loadingRole === "admin"}
              >
                {loadingRole === "member" ? "Authorising…" : "Login as Member"}
              </button>
            </div>

            {authMessage && (
              <div
                className={`alert ${
                  authMessage.type === "success"
                    ? "alert-success"
                    : "alert-error"
                }`}
              >
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

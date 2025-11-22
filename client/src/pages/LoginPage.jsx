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

  const handleLogin = async (role) => {
    const preset = loginPresets[role];

    // Validate using preset
    const emailMatch = form.email.trim().toLowerCase() === preset.email.toLowerCase();
    const passwordMatch = form.password === preset.password;

    if (!emailMatch || !passwordMatch) {
      setAuthMessage({
        type: "error",
        text: `Use the ${role} demo credentials shown below.`,
      });
      return;
    }

    setLoadingRole(role);
    setAuthMessage(null);

    // Generate token locally (no server call needed)
    const token = `${role.toLowerCase()}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    
    const payload = {
      role: role.charAt(0).toUpperCase() + role.slice(1),
      token: token,
      email: form.email
    };

    // Store in sessionStorage for ProtectedRoute
    sessionStorage.setItem('authToken', payload.token);

    setAuthMessage({
      type: "success",
      text: `${payload.role} login accepted · token ${payload.token.slice(0, 6)}***`,
    });

    setTimeout(() => {
      navigate(payload.role === "Admin" ? "/admin" : "/member", {
        replace: true,
        state: payload,
      });
    }, 500);

    setLoadingRole(null);
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
              payments and automations from one place.
            </p>
            <ul>
              <li>Supports FPS, PayMe, bank transfers, cards</li>
              <li>Automated reminders via email and WhatsApp</li>
              <li>Clear dashboards for admins and members</li>
            </ul>
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
                // value="fakepsw"
                // id="myInput"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter Your Password"
                className="mono-input"
              />
              {/* <input type="checkbox" onClick="myFunction()" />show pass */}
            </label>

            <div className="login-hints">
              <p>
                <strong>Admin:</strong> {loginPresets.admin.email} / {loginPresets.admin.password}
              </p>
              <p>
                <strong>Member:</strong> {loginPresets.member.email} / {loginPresets.member.password}
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

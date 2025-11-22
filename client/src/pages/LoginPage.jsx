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
    // Handle admin login via MongoDB API
    if (role === "admin") {
      if (!form.email || !form.password) {
        setAuthMessage({
          type: "error",
          text: "Please enter both email and password",
        });
        return;
      }

      setLoadingRole("admin");
      setAuthMessage(null);

      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setAuthMessage({
            type: "error",
            text: data.message || "Invalid email or password",
          });
          setLoadingRole(null);
          return;
        }

        // Store auth token
        sessionStorage.setItem('authToken', data.token);
        sessionStorage.setItem('adminEmail', data.email);
        sessionStorage.setItem('adminName', data.name);

        setAuthMessage({
          type: "success",
          text: `Welcome ${data.name}! Redirecting to admin panel...`,
        });

        setTimeout(() => {
          navigate("/admin", {
            replace: true,
            state: {
              role: "Admin",
              token: data.token,
              email: data.email,
              name: data.name,
              adminId: data.adminId,
              adminRole: data.adminRole
            },
          });
        }, 500);
      } catch (error) {
        console.error("Login error:", error);
        setAuthMessage({
          type: "error",
          text: "Network error. Please check your connection and try again.",
        });
        setLoadingRole(null);
      }
    } else {
      // Keep member login as is (using presets)
      const preset = loginPresets[role];
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

      const token = `${role.toLowerCase()}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      
      const payload = {
        role: role.charAt(0).toUpperCase() + role.slice(1),
        token: token,
        email: form.email
      };

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
                <strong>Admin:</strong> Use your registered email and password from MongoDB
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

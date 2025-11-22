import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { loginPresets } from "../data";

export function LoginPage() {
  const [authMessage, setAuthMessage] = useState(null);
  const [loadingRole, setLoadingRole] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleLogin = async (role) => {
    // Handle both admin and member login via MongoDB API
    if (role === "admin" || role === "member") {
      if (!form.email || !form.password) {
        setAuthMessage({
          type: "error",
          text: "Please enter both email and password",
        });
        return;
      }

      setLoadingRole(role);
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
            role: role,  // Send role to check specific database
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

        // Store auth token and user info
        sessionStorage.setItem('authToken', data.token);
        
        if (data.role === "Admin") {
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
        } else {
          // Member login
          sessionStorage.setItem('memberEmail', data.email);
          sessionStorage.setItem('memberName', data.name);
          sessionStorage.setItem('memberId', data.memberId);
          
          setAuthMessage({
            type: "success",
            text: `Welcome ${data.name}! Redirecting to member portal...`,
          });

          setTimeout(() => {
            navigate("/member", {
              replace: true,
              state: {
                role: "Member",
                token: data.token,
                email: data.email,
                name: data.name,
                memberId: data.memberId,
                phone: data.phone
              },
            });
          }, 500);
        }
      } catch (error) {
        console.error("Login error:", error);
        setAuthMessage({
          type: "error",
          text: "Network error. Please check your connection and try again.",
        });
        setLoadingRole(null);
      }
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
            <p style={{ marginBottom: "24px", color: "var(--gray-600)" }}>
              New user? <Link to="/signup" style={{ color: "var(--primary)", textDecoration: "underline" }}>Sign up here</Link>
            </p>

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
                <strong>Member:</strong> Use your registered email and password from MongoDB
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

            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <p style={{ color: "var(--gray-600)", fontSize: "0.9rem" }}>
                New user? <Link to="/signup" style={{ color: "var(--primary)", textDecoration: "underline", fontWeight: "500" }}>Create an account</Link>
              </p>
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

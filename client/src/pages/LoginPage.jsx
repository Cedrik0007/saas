import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { loginPresets } from "../data";
import { GoogleLogin } from "@react-oauth/google";

export function LoginPage() {
  const [authMessage, setAuthMessage] = useState(null);
  const [loadingRole, setLoadingRole] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Feature flag to show/hide member login (set to true to show, false to hide)
  const SHOW_MEMBER_LOGIN = false;

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
        // In development, use empty string to use Vite proxy (localhost:4000)
        // In production, use VITE_API_URL if set
        const apiBaseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
        const response = await fetch(`${apiBaseUrl}/api/login`, {
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
            <div className="login-form-card__header">
              <h1><i className="fas fa-sign-in-alt" style={{ marginRight: "12px", color: "#5a31ea" }}></i>Sign in</h1>
              <p>
                New user? <Link to="/signup" style={{ color: "#5a31ea", textDecoration: "none", fontWeight: "500" }}>Sign up here</Link>
              </p>
            </div>

            <label className="mono-label">
              <span><i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter your email address"
                className="mono-input"
              />
            </label>

            <label className="mono-label">
              <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  className="mono-input"
                  style={{ paddingRight: "45px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <div className="login-hints">
              <p style={{ marginTop: 0, fontWeight: "600", color: "#1a1a1a", marginBottom: "12px" }}>
                <i className="fas fa-info-circle" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Demo Credentials
              </p>
              <p>
                <strong>Admin:</strong> admin2002@gmail.com / #Admin2204
              </p>
              {SHOW_MEMBER_LOGIN && (
                <p>
                  <strong>Member:</strong> member1234@gmail.com / member1234
                </p>
              )}
            </div>

            <div className="login-buttons">
              {/* Admin login (email/password) */}
              <button
                type="button"
                className="btn-admin"
                onClick={() => handleLogin("admin")}
                disabled={loadingRole === "member"}
              >
                {loadingRole === "admin" ? "Authorising…" : "Login as Admin"}
              </button>

              {/* Member login (email/password) - Hidden when SHOW_MEMBER_LOGIN is false */}
              {SHOW_MEMBER_LOGIN && (
                <button
                  type="button"
                  className="btn-member"
                  onClick={() => handleLogin("member")}
                  disabled={loadingRole === "admin"}
                >
                  {loadingRole === "member" ? "Authorising…" : "Login as Member"}
                </button>
              )}
            </div>

            {/* Google sign-in option for members - Hidden when SHOW_MEMBER_LOGIN is false */}
            {SHOW_MEMBER_LOGIN && (
              <div style={{ marginTop: "16px", textAlign: "center", width: "100%" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                marginBottom: "12px",
                gap: "8px"
              }}>
                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }}></div>
                <p style={{ fontSize: "0.85rem", color: "#666", margin: 0, padding: "0 12px" }}>
                  Or
                </p>
                <div style={{ flex: 1, height: "1px", background: "#e0e0e0" }}></div>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "8px" }}>
                Sign in as <strong>Member</strong> with Google
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    try {
                      // In development, use empty string to use Vite proxy (localhost:4000)
                      // In production, use VITE_API_URL if set
                      const apiBaseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
                      const res = await fetch(`${apiBaseUrl}/api/login/google-member`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ credential: credentialResponse.credential }),
                      });

                      const data = await res.json();
                      if (!res.ok || !data.success) {
                        setAuthMessage({
                          type: "error",
                          text: data.message || "Google member login failed",
                        });
                        return;
                      }

                      // Store auth token and member info (same as existing member login)
                      sessionStorage.setItem("authToken", data.token);
                      sessionStorage.setItem("memberEmail", data.email);
                      sessionStorage.setItem("memberName", data.name);
                      sessionStorage.setItem("memberId", data.memberId);

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
                            phone: data.phone,
                          },
                        });
                      }, 500);
                    } catch (error) {
                      console.error("Google member login error:", error);
                      setAuthMessage({
                        type: "error",
                        text: "Network error during Google login",
                      });
                    }
                  }}
                  onError={() => {
                    setAuthMessage({
                      type: "error",
                      text: "Google member login failed",
                    });
                  }}
                />
              </div>
            </div>
            )}


            {authMessage && (
              <div className={`alert ${authMessage.type === "success" ? "alert-success" : "alert-error"}`}>
                <i className={`fas ${authMessage.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`} style={{ marginRight: "8px" }}></i>
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

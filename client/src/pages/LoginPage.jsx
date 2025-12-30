import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AlertModal } from "../components/AlertModal.jsx";
import { Notie } from "../components/Notie.jsx";
import { loginPresets } from "../data";
import { GoogleLogin } from "@react-oauth/google";

export function LoginPage() {
  const [authMessage, setAuthMessage] = useState(null);
  const [loadingRole, setLoadingRole] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [notieMessage, setNotieMessage] = useState(null);
  const [notieType, setNotieType] = useState("error");
  const navigate = useNavigate();

  // Check for logout reason (inactivity) and show message
  useEffect(() => {
    const logoutReason = sessionStorage.getItem('logoutReason');
    if (logoutReason === 'inactivity') {
      sessionStorage.removeItem('logoutReason');
      setAuthMessage({
        type: "error",
        text: "Session expired due to inactivity. Please login again.",
      });
    }
  }, []);

  // Disable body scroll on login page (100vh, overflow hidden)
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate form fields - email first, password only after email is valid
  const validateForm = () => {
    // Clear all errors first
    const newErrors = { email: "", password: "" };
    
    // Validate email first
    if (!form.email.trim()) {
      newErrors.email = "Email is required";
      setErrors(newErrors);
      setNotieMessage("Email is required");
      setNotieType("error");
      return false;
    }
    
    if (!validateEmail(form.email.trim())) {
      newErrors.email = "Please enter a valid email address";
      setErrors(newErrors);
      setNotieMessage("Please enter a valid email address");
      setNotieType("error");
      return false;
    }

    // Only validate password if email is valid
    if (!form.password) {
      newErrors.password = "Password is required";
      setErrors(newErrors);
      setNotieMessage("Password is required");
      setNotieType("error");
      return false;
    }

    // All valid - clear all errors
    setErrors(newErrors);
    return true;
  };

  // Feature flag to show/hide member login (set to true to show, false to hide)
  const SHOW_MEMBER_LOGIN = false;

  const handleLogin = async (role) => {
    // Handle both admin and member login via MongoDB API
    if (role === "admin" || role === "member") {
      // Prevent multiple clicks - return early if already loading
      if (loadingRole !== null) {
        return;
      }

      // Validate form before submitting
      if (!validateForm()) {
        return;
      }

      setLoadingRole(role);
      setAuthMessage(null);
      setErrors({ email: "", password: "" });
      setNotieMessage(null);

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

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error("JSON parse error:", jsonError);
          setNotieMessage("Invalid response from server. Please try again.");
          setNotieType("error");
          setLoadingRole(null);
          return;
        }

        if (!response.ok || !data.success) {
          // Check if account is locked
          if (data.locked) {
            setNotieMessage(data.message || "Account temporarily locked due to multiple failed login attempts. Please try again later.");
          } else {
            // Show generic error message for security (no specific details)
            setNotieMessage(data.message || "Invalid email or password. Please check your credentials and try again.");
          }
          setNotieType("error");
          setLoadingRole(null);
          return;
        }

        // Store auth token and user info
        sessionStorage.setItem('authToken', data.token);
        
        if (data.role === "Admin") {
          sessionStorage.setItem('adminEmail', data.email);
          sessionStorage.setItem('adminName', data.name);
          if (data.adminId) {
            sessionStorage.setItem('adminId', data.adminId);
          }
          if (data.adminRole) {
            sessionStorage.setItem('adminRole', data.adminRole);
          }
          
          // Clear loading state before navigation
          setLoadingRole(null);
          
          // Instant redirect - no delay
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
        } else {
          // Member login
          sessionStorage.setItem('memberEmail', data.email);
          sessionStorage.setItem('memberName', data.name);
          sessionStorage.setItem('memberId', data.memberId);
          
          // Clear loading state before navigation
          setLoadingRole(null);
          
          // Instant redirect - no delay
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
        }
      } catch (error) {
        console.error("Login error:", error);
        // Show generic error message for security
        setNotieMessage("Unable to connect. Please check your connection and try again.");
        setNotieType("error");
        setLoadingRole(null);
      }
    }
  };

  return (
    <>
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
            </div>

            <label className="mono-label">
              <span><i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Email <span style={{ color: "#ef4444" }}>*</span></span>
              <input
                type="text"
                inputMode="email"
                value={form.email}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                title=""
                onInvalid={(e) => e.preventDefault()}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  // Clear email error when user starts typing
                  if (errors.email) {
                    setErrors({ ...errors, email: "" });
                  }
                }}
                placeholder="Enter your email address"
                className={`mono-input ${errors.email ? "input-error" : ""}`}
                disabled={loadingRole !== null}
              />
            </label>

            <label className="mono-label">
              <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Password <span style={{ color: "#ef4444" }}>*</span></span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  title=""
                  onInvalid={(e) => e.preventDefault()}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    // Clear error when user starts typing
                    if (errors.password) {
                      setErrors({ ...errors, password: "" });
                    }
                  }}
                  placeholder="Enter your password"
                  className={`mono-input ${errors.password ? "input-error" : ""}`}
                  style={{ paddingRight: "45px" }}
                  disabled={loadingRole !== null}
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
                  disabled={loadingRole !== null}
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
              <div style={{ marginTop: "8px", textAlign: "right" }}>
                <Link 
                  to="/forgot-password" 
                  style={{ 
                    color: "#5a31ea", 
                    textDecoration: "none", 
                    fontSize: "0.875rem",
                    fontWeight: "500"
                  }}
                  onClick={(e) => {
                    // Prevent navigation if button is disabled (during loading)
                    if (loadingRole !== null) {
                      e.preventDefault();
                    }
                  }}
                >
                  Forgot Password?
                </Link>
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
                disabled={loadingRole !== null}
                style={{ 
                  position: "relative",
                  opacity: loadingRole !== null ? 0.7 : 1,
                  cursor: loadingRole !== null ? "not-allowed" : "pointer"
                }}
              >
                {loadingRole === "admin" ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <svg 
                      style={{ 
                        animation: "spin 1s linear infinite",
                        width: "16px",
                        height: "16px"
                      }} 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                    </svg>
                    Authorising…
                  </span>
                ) : (
                  "Login"
                )}
              </button>

              {/* Member login (email/password) - Hidden when SHOW_MEMBER_LOGIN is false */}
              {SHOW_MEMBER_LOGIN && (
                <button
                  type="button"
                  className="btn-member"
                  onClick={() => handleLogin("member")}
                  disabled={loadingRole !== null}
                  style={{ 
                    position: "relative",
                    opacity: loadingRole !== null ? 0.7 : 1,
                    cursor: loadingRole !== null ? "not-allowed" : "pointer"
                  }}
                >
                  {loadingRole === "member" ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <svg 
                        style={{ 
                          animation: "spin 1s linear infinite",
                          width: "16px",
                          height: "16px"
                        }} 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                      </svg>
                      Authorising…
                    </span>
                  ) : (
                    "Login as Member"
                  )}
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

                      // Instant redirect - no delay
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


            <AlertModal
              isOpen={!!authMessage}
              message={authMessage?.text}
              type={authMessage?.type || "error"}
              onClose={() => setAuthMessage(null)}
            />
            <Notie
              message={notieMessage}
              type={notieType}
              onClose={() => setNotieMessage(null)}
              duration={3000}
            />
          </div>
        </div>
      </main>
    </>
  );
}

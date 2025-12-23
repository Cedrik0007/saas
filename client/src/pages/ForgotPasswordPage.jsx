import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin"); // admin or member
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate email
    if (!email.trim()) {
      setMessage({
        type: "error",
        text: "Email is required",
      });
      return;
    }

    if (!validateEmail(email.trim())) {
      setMessage({
        type: "error",
        text: "Please enter a valid email address",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const apiBaseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
      const response = await fetch(`${apiBaseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          role: role,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "Failed to send reset email. Please try again.",
        });
        setLoading(false);
        return;
      }

      // Success
      setEmailSent(true);
      setMessage({
        type: "success",
        text: data.message || "Password reset link has been sent to your email.",
      });
      setLoading(false);
    } catch (error) {
      console.error("Forgot password error:", error);
      setMessage({
        type: "error",
        text: "Unable to connect. Please check your connection and try again.",
      });
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader showCTA={false} />
      <main className="login-main">
        <div className="login-shell">
          <aside className="login-menu">
            <p className="eyebrow light">Password Recovery</p>
            <h2>Reset Your Password</h2>
            <p>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <ul>
              <li>Check your email inbox</li>
              <li>Click the reset link</li>
              <li>Create a new password</li>
            </ul>
          </aside>

          <div className="login-form-card">
            <div className="login-form-card__header">
              <h1><i className="fas fa-key" style={{ marginRight: "12px", color: "#5a31ea" }}></i>Forgot Password</h1>
            </div>

            {!emailSent ? (
              <form onSubmit={handleSubmit}>
                <label className="mono-label">
                  <span><i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Email <span style={{ color: "#ef4444" }}>*</span></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="mono-input"
                    disabled={loading}
                    required
                  />
                </label>

                <div className="login-buttons">
                  <button
                    type="submit"
                    className="btn-admin"
                    disabled={loading}
                    style={{ 
                      position: "relative",
                      opacity: loading ? 0.7 : 1,
                      cursor: loading ? "not-allowed" : "pointer",
                      width: "100%"
                    }}
                  >
                    {loading ? (
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
                        Sending...
                      </span>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </div>

                <div style={{ textAlign: "center", marginTop: "16px" }}>
                  <Link 
                    to="/login" 
                    style={{ 
                      color: "#5a31ea", 
                      textDecoration: "none", 
                      fontSize: "0.875rem",
                      fontWeight: "500"
                    }}
                  >
                    <i className="fas fa-arrow-left" style={{ marginRight: "6px" }}></i>Back to Login
                  </Link>
                </div>
              </form>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ 
                  width: "80px", 
                  height: "80px", 
                  margin: "0 auto 20px",
                  background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "40px",
                  color: "#ffffff"
                }}>
                  <i className="fas fa-check"></i>
                </div>
                <h3 style={{ marginBottom: "12px", color: "#1a1a1a" }}>Check Your Email</h3>
                <p style={{ color: "#666", marginBottom: "24px" }}>
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "24px" }}>
                  Please check your inbox and click the link to reset your password. The link will expire in 1 hour.
                </p>
                <div className="login-buttons">
                  <button
                    type="button"
                    className="btn-admin"
                    onClick={() => navigate("/login")}
                    style={{ width: "100%" }}
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginTop: "20px" }}>
                <i className={`fas ${message.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`} style={{ marginRight: "8px" }}></i>
                {message.text}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}


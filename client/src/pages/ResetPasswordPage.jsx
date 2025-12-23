import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const [errors, setErrors] = useState({ password: "", confirmPassword: "" });
  const navigate = useNavigate();

  const token = searchParams.get("token");
  const role = searchParams.get("role") || "admin";

  useEffect(() => {
    if (!token) {
      setMessage({
        type: "error",
        text: "Invalid reset link. Please request a new password reset.",
      });
    }
  }, [token]);

  const validatePassword = (pwd) => {
    if (!pwd) {
      return "Password is required";
    }
    if (pwd.length < 6) {
      return "Password must be at least 6 characters long";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords
    const passwordError = validatePassword(password);
    const confirmPasswordError = password !== confirmPassword 
      ? "Passwords do not match" 
      : validatePassword(confirmPassword);

    setErrors({
      password: passwordError,
      confirmPassword: confirmPasswordError,
    });

    if (passwordError || confirmPasswordError) {
      return;
    }

    if (!token) {
      setMessage({
        type: "error",
        text: "Invalid reset token. Please request a new password reset.",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const apiBaseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
      const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          newPassword: password,
          role: role,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "Failed to reset password. Please try again.",
        });
        setLoading(false);
        return;
      }

      // Success
      setPasswordReset(true);
      setMessage({
        type: "success",
        text: data.message || "Password has been reset successfully!",
      });
      setLoading(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      console.error("Reset password error:", error);
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
            <p className="eyebrow light">Password Reset</p>
            <h2>Create New Password</h2>
            <p>
              Enter your new password below. Make sure it's strong and secure.
            </p>
            <ul>
              <li>At least 6 characters long</li>
              <li>Use a combination of letters and numbers</li>
              <li>Don't reuse your old password</li>
            </ul>
          </aside>

          <div className="login-form-card">
            <div className="login-form-card__header">
              <h1><i className="fas fa-lock" style={{ marginRight: "12px", color: "#5a31ea" }}></i>Reset Password</h1>
            </div>

            {!passwordReset ? (
              <form onSubmit={handleSubmit}>
                <label className="mono-label">
                  <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>New Password <span style={{ color: "#ef4444" }}>*</span></span>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) {
                          setErrors({ ...errors, password: "" });
                        }
                      }}
                      onBlur={() => {
                        setErrors({ ...errors, password: validatePassword(password) });
                      }}
                      placeholder="Enter new password"
                      className={`mono-input ${errors.password ? "input-error" : ""}`}
                      style={{ paddingRight: "45px" }}
                      disabled={loading || !token}
                      required
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
                      disabled={loading}
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
                  {errors.password && (
                    <div className="field-error" style={{ 
                      marginTop: "4px", 
                      fontSize: "0.875rem", 
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ fontSize: "0.75rem" }}></i>
                      {errors.password}
                    </div>
                  )}
                </label>

                <label className="mono-label">
                  <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Confirm Password <span style={{ color: "#ef4444" }}>*</span></span>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors({ ...errors, confirmPassword: "" });
                        }
                      }}
                      onBlur={() => {
                        const error = password !== confirmPassword 
                          ? "Passwords do not match" 
                          : validatePassword(confirmPassword);
                        setErrors({ ...errors, confirmPassword: error });
                      }}
                      placeholder="Confirm new password"
                      className={`mono-input ${errors.confirmPassword ? "input-error" : ""}`}
                      style={{ paddingRight: "45px" }}
                      disabled={loading || !token}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
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
                  {errors.confirmPassword && (
                    <div className="field-error" style={{ 
                      marginTop: "4px", 
                      fontSize: "0.875rem", 
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ fontSize: "0.75rem" }}></i>
                      {errors.confirmPassword}
                    </div>
                  )}
                </label>

                <div className="login-buttons">
                  <button
                    type="submit"
                    className="btn-admin"
                    disabled={loading || !token}
                    style={{ 
                      position: "relative",
                      opacity: (loading || !token) ? 0.7 : 1,
                      cursor: (loading || !token) ? "not-allowed" : "pointer",
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
                        Resetting...
                      </span>
                    ) : (
                      "Reset Password"
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
                <h3 style={{ marginBottom: "12px", color: "#1a1a1a" }}>Password Reset Successful!</h3>
                <p style={{ color: "#666", marginBottom: "24px" }}>
                  Your password has been reset successfully. You can now login with your new password.
                </p>
                <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "24px" }}>
                  Redirecting to login page in a few seconds...
                </p>
                <div className="login-buttons">
                  <button
                    type="button"
                    className="btn-admin"
                    onClick={() => navigate("/login")}
                    style={{ width: "100%" }}
                  >
                    Go to Login
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


import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { AlertModal } from "../components/AlertModal.jsx";
import { Notie } from "../components/Notie.jsx";

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
  const [notieMessage, setNotieMessage] = useState(null);
  const [notieType, setNotieType] = useState("error");
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
      // Show first error in Notie
      const errorToShow = passwordError || confirmPasswordError;
      setNotieMessage(errorToShow);
      setNotieType("error");
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
              <h1><i className="fas fa-lock login-title-icon"></i>Reset Password</h1>
            </div>

            {!passwordReset ? (
              <form onSubmit={handleSubmit} noValidate>
                <label className="mono-label">
                  <span><i className="fas fa-lock login-icon"></i>New Password <span className="login-required">*</span></span>
                  <div className="login-input-wrapper">
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
                        const error = validatePassword(password);
                        setErrors({ ...errors, password: error });
                        if (error) {
                          setNotieMessage(error);
                          setNotieType("error");
                        }
                      }}
                      onInvalid={(e) => e.preventDefault()}
                      placeholder="Enter new password"
                      className={`mono-input login-input--with-icon ${errors.password ? "input-error" : ""}`}
                      disabled={loading || !token}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="login-password-toggle"
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
                </label>

                <label className="mono-label">
                  <span><i className="fas fa-lock login-icon"></i>Confirm Password <span className="login-required">*</span></span>
                  <div className="login-input-wrapper">
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
                        if (error) {
                          setNotieMessage(error);
                          setNotieType("error");
                        }
                      }}
                      onInvalid={(e) => e.preventDefault()}
                      placeholder="Confirm new password"
                      className={`mono-input login-input--with-icon ${errors.confirmPassword ? "input-error" : ""}`}
                      disabled={loading || !token}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="login-password-toggle"
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
                </label>

                <div className="login-buttons">
                  <button
                    type="submit"
                    className={`btn-admin login-btn-wrapper login-btn-full-width ${(loading || !token) ? "login-btn--loading" : ""}`}
                    disabled={loading || !token}
                  >
                    {loading ? (
                      <span className="login-btn-spinner">
                        <svg 
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

                <div className="forgot-password-back-link">
                  <Link to="/login">
                    <i className="fas fa-arrow-left forgot-password-back-link-icon"></i>Back to Login
                  </Link>
                </div>
              </form>
            ) : (
              <div className="forgot-password-success">
                <div className="forgot-password-success-icon">
                  <i className="fas fa-check"></i>
                </div>
                <h3 className="forgot-password-success-title">Password Reset Successful!</h3>
                <p className="forgot-password-success-message">
                  Your password has been reset successfully. You can now login with your new password.
                </p>
                <p className="forgot-password-success-message forgot-password-success-message--small">
                  Redirecting to login page in a few seconds...
                </p>
                <div className="login-buttons">
                  <button
                    type="button"
                    className="btn-admin login-btn-full-width"
                    onClick={() => navigate("/login")}
                  >
                    Go to Login
                  </button>
                </div>
              </div>
            )}

            <AlertModal
              isOpen={!!message}
              message={message?.text}
              type={message?.type || "error"}
              onClose={() => setMessage(null)}
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
      <SiteFooter />
    </>
  );
}



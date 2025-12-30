import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Notie } from "../components/Notie.jsx";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [notieMessage, setNotieMessage] = useState(null);
  const [notieType, setNotieType] = useState("error");
  const navigate = useNavigate();

  // Disable body scroll on forgot password page (100vh, overflow hidden)
  useEffect(() => {
    document.body.classList.add('login-page-body');
    
    return () => {
      document.body.classList.remove('login-page-body');
    };
  }, []);

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (loading) {
      return;
    }

    // Validate email - only show errors on submit
    setEmailError("");
    setNotieMessage(null);
    
    if (!email.trim()) {
      setEmailError("Email is required");
      setNotieMessage("Email is required");
      setNotieType("error");
      return;
    }

    if (!validateEmail(email.trim())) {
      setEmailError("Please enter a valid email address");
      setNotieMessage("Please enter a valid email address");
      setNotieType("error");
      return;
    }

    setLoading(true);
    setNotieMessage(null);

    try {
      const apiBaseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
      const response = await fetch(`${apiBaseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse response:", jsonError);
        setNotieMessage("Server returned an invalid response. Please try again.");
        setNotieType("error");
        setLoading(false);
        return;
      }

      if (!response.ok || !data.success) {
        const errorMsg = data.message || "Failed to send reset request. Please try again.";
        setNotieMessage(errorMsg);
        setNotieType("error");
        setLoading(false);
        return;
      }

      // Success - always show success message (security: don't reveal if email exists)
      setRequestSent(true);
      setLoading(false);
    } catch (error) {
      console.error("Forgot password error:", error);
      setNotieMessage("Unable to connect. Please check your connection and try again.");
      setNotieType("error");
      setLoading(false);
    }
  };

  return (
    <>
      <main className="login-main">
        <div className="login-shell">
          <aside className="login-menu">
            <p className="eyebrow light">Password Recovery</p>
            <h2>Request Password Reset</h2>
            <p>
              Enter your email address to request a password reset. Your request will be sent to the administrator for manual approval.
            </p>
            <ul>
              <li>Submit your email address</li>
              <li>Administrator will review your request</li>
              <li>You'll receive your new password after verification</li>
            </ul>
          </aside>

          <div className="login-form-card">
            <div className="login-form-card__header">
              <h1><i className="fas fa-key login-title-icon"></i>Forgot Password</h1>
            </div>

            {!requestSent ? (
              <form onSubmit={handleSubmit} noValidate>
                <label className="mono-label">
                  <span><i className="fas fa-envelope login-icon"></i>Email <span className="login-required">*</span></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // Clear error when user starts typing
                      if (emailError) {
                        setEmailError("");
                      }
                    }}
                    onInvalid={(e) => e.preventDefault()}
                    placeholder="Enter your email address"
                    className={`mono-input ${emailError ? "input-error" : ""}`}
                    disabled={loading}
                  />
                </label>

                <div className="login-buttons">
                  <button
                    type="submit"
                    className={`btn-admin login-btn-wrapper login-btn-full-width ${loading ? "login-btn--loading" : ""}`}
                    disabled={loading}
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
                        Sending...
                      </span>
                    ) : (
                      "Request Password Reset"
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
                <h3 className="forgot-password-success-title">Request Sent</h3>
                <p className="forgot-password-success-message">
                  Your request has been sent to the administrator. You will receive your new password after verification.
                </p>
                <div className="login-buttons">
                  <button
                    type="button"
                    className="btn-admin login-btn-full-width"
                    onClick={() => navigate("/login")}
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            )}

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


import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { useApp } from "../context/AppContext.jsx";

export function SignupPage() {
  const { members, fetchMembers } = useApp();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    subscriptionType: "Monthly",
  });
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // Fetch members on component mount to check for existing emails
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Check if email already exists
  const checkEmailExists = (email) => {
    if (!email) {
      setEmailError(null);
      return false;
    }

    const emailLower = email.trim().toLowerCase();
    const emailExists = members.some(
      (member) => member.email && member.email.toLowerCase() === emailLower
    );

    if (emailExists) {
      setEmailError("This email has already been registered. Please use a different email or try logging in.");
      return true;
    } else {
      setEmailError(null);
      return false;
    }
  };

  // Handle email input change
  const handleEmailChange = (e) => {
    const emailValue = e.target.value;
    setForm({ ...form, email: emailValue });
    
    // Clear email error when user starts typing
    if (emailError) {
      setEmailError(null);
    }
  };

  // Handle email blur - check when user leaves the field
  const handleEmailBlur = (e) => {
    const emailValue = e.target.value.trim();
    if (emailValue) {
      checkEmailExists(emailValue);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setEmailError(null);

    // Validation
    if (!form.name || !form.email || !form.phone || !form.password || !form.subscriptionType) {
      setError("Please fill in all required fields");
      return;
    }

    // Check if email already exists before submitting
    const emailExists = checkEmailExists(form.email);
    if (emailExists) {
      setError("This email has already been registered. Please use a different email or try logging in.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
          status: "Pending",
          balance: "$0",
          nextDue: "",
          lastPayment: "",
          subscriptionType: form.subscriptionType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if error is related to duplicate email
        const errorMessage = data.message || data.error || 'Failed to create account';
        if (errorMessage.toLowerCase().includes('email') || 
            errorMessage.toLowerCase().includes('already exists') ||
            errorMessage.toLowerCase().includes('duplicate')) {
          setEmailError("This email has already been registered. Please use a different email or try logging in.");
          throw new Error("This email has already been registered. Please use a different email or try logging in.");
        }
        throw new Error(errorMessage);
      }

      setSuccess("Account created successfully! Your account is pending approval. You will be able to login once an admin approves your account.");
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login", { 
          replace: true,
          state: { 
            message: "Account created successfully! Your account is pending approval. Please wait for admin approval before logging in.",
            email: form.email 
          }
        });
      }, 3000);
    } catch (error) {
      console.error("Signup error:", error);
      setError(error.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
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
              Create your member account to access the subscription portal.
            </p>
            <ul>
              <li>Track your subscription payments</li>
              <li>View invoices and payment history</li>
              <li>Manage your profile and preferences</li>
            </ul>
          </aside>

          <div className="login-form-card">
            <div className="login-form-card__header">
              <h1><i className="fas fa-user-plus" style={{ marginRight: "12px", color: "#5a31ea" }}></i>Create Account</h1>
              <p>
                Already have an account? <Link to="/login" style={{ color: "#5a31ea", textDecoration: "none", fontWeight: "500" }}>Sign in</Link>
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="mono-label">
                <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Full Name *</span>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="mono-input"
                />
              </label>

              <label className="mono-label">
                <span><i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Email *</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  placeholder="Enter your email address"
                  className="mono-input"
                  style={{
                    border: emailError ? "2px solid #ef4444" : "none",
                    boxShadow: emailError ? "0 0 0 3px rgba(239, 68, 68, 0.1), 0 4px 12px rgba(239, 68, 68, 0.12)" : undefined
                  }}
                />
                {emailError && (
                  <div style={{
                    fontSize: "0.875rem",
                    color: "#ef4444",
                    marginTop: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <i className="fas fa-exclamation-circle"></i>
                    {emailError}
                  </div>
                )}
              </label>

              <label className="mono-label">
                <span><i className="fas fa-phone" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Phone Number *</span>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Enter your phone number"
                  className="mono-input"
                />
              </label>

              <label className="mono-label">
                <span><i className="fas fa-calendar-alt" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Subscription Type *</span>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr 1fr", 
                  gap: "12px",
                  marginTop: "8px"
                }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, subscriptionType: "Monthly" })}
                    style={{
                      padding: "16px",
                      border: "none",
                      borderRadius: "10px",
                      background: form.subscriptionType === "Monthly" 
                        ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" 
                        : "#f8f9ff",
                      color: form.subscriptionType === "Monthly" ? "white" : "#1a1a1a",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: "600",
                      boxShadow: form.subscriptionType === "Monthly" 
                        ? "0 4px 12px rgba(90, 49, 234, 0.3)" 
                        : "0 2px 4px rgba(90, 49, 234, 0.08)",
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>Monthly</div>
                    <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>$50/month</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, subscriptionType: "Yearly" })}
                    style={{
                      padding: "16px",
                      border: "none",
                      borderRadius: "10px",
                      background: form.subscriptionType === "Yearly" 
                        ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" 
                        : "#f8f9ff",
                      color: form.subscriptionType === "Yearly" ? "white" : "#1a1a1a",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: "600",
                      boxShadow: form.subscriptionType === "Yearly" 
                        ? "0 4px 12px rgba(90, 49, 234, 0.3)" 
                        : "0 2px 4px rgba(90, 49, 234, 0.08)",
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>Yearly</div>
                    <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>$500/year</div>
                  </button>
                </div>
              </label>

              <label className="mono-label">
                <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Password *</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Create a password (min. 6 characters)"
                    className="mono-input"
                    minLength={6}
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

              <label className="mono-label">
                <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Confirm Password *</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Confirm your password"
                    className="mono-input"
                    minLength={6}
                    style={{ paddingRight: "45px" }}
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

              {error && (
                <div className="alert alert-error" style={{ marginTop: "16px" }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: "8px" }}></i>
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success" style={{ marginTop: "16px" }}>
                  <i className="fas fa-check-circle" style={{ marginRight: "8px" }}></i>
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="primary-btn"
                style={{ width: "100%", marginTop: "24px" }}
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}


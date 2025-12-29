import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { AlertModal } from "../components/AlertModal.jsx";
import { Notie } from "../components/Notie.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import { useApp } from "../context/AppContext.jsx";

export function SignupPage() {
  const { members, fetchMembers } = useApp();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    subscriptionType: "Lifetime",
  });
  // All errors now use Notie
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notieMessage, setNotieMessage] = useState(null);
  const [notieType, setNotieType] = useState("error");
  const [fieldErrors, setFieldErrors] = useState({
    name: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
  });
  const navigate = useNavigate();

  // Fetch members on component mount to check for existing emails
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Check if email already exists
  const checkEmailExists = (email) => {
    if (!email) {
      return false;
    }

    const emailLower = email.trim().toLowerCase();
    const emailExists = members.some(
      (member) => member.email && member.email.toLowerCase() === emailLower
    );

    if (emailExists) {
      setNotieMessage("This email has already been registered. Please use a different email or try logging in.");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      return true;
    }
    return false;
  };

  // Handle email input change
  const handleEmailChange = (e) => {
    const emailValue = e.target.value;
    setForm({ ...form, email: emailValue });
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

    // Reset errors
    const newErrors = {
      name: false,
      email: false,
      phone: false,
      password: false,
      confirmPassword: false,
    };

    // Validation
    if (!form.name || !form.name.trim()) {
      newErrors.name = true;
      setNotieMessage("Name is required");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    if (!form.email || !form.email.trim()) {
      newErrors.email = true;
      setNotieMessage("Email is required");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = true;
      setNotieMessage("Please enter a valid email address");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    // Check if email already exists before submitting
    const emailExists = checkEmailExists(form.email);
    if (emailExists) {
      newErrors.email = true;
      setNotieMessage("This email has already been registered. Please use a different email or try logging in.");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    if (!form.phone || !form.phone.trim()) {
      newErrors.phone = true;
      setNotieMessage("Phone number is required");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    if (!form.password) {
      newErrors.password = true;
      setNotieMessage("Password is required");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    if (form.password.length < 6) {
      newErrors.password = true;
      setNotieMessage("Password must be at least 6 characters long");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = true;
      setNotieMessage("Passwords do not match");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
      setFieldErrors(newErrors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({
      name: false,
      email: false,
      phone: false,
      password: false,
      confirmPassword: false,
    });

    setLoading(true);

    try {
      // In development, use empty string to use Vite proxy (localhost:4000)
      // In production, use VITE_API_URL if set
      const apiUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
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
          throw new Error("This email has already been registered. Please use a different email or try logging in.");
        }
        throw new Error(errorMessage);
      }

      setNotieMessage("Account created successfully! Your account is pending approval. You will be able to login once an admin approves your account.");
      setNotieType("success");
      setTimeout(() => setNotieMessage(null), 3000);
      
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
      setNotieMessage(error.message || "Failed to create account. Please try again.");
      setNotieType("error");
      setTimeout(() => setNotieMessage(null), 3000);
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

            <form onSubmit={handleSubmit} noValidate>
              <label className="mono-label">
                <span><i className="fas fa-user" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Full Name <span style={{ color: "#ef4444" }}>*</span></span>
                <input
                  type="text"
                  required
                  onInvalid={(e) => e.preventDefault()}
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (fieldErrors.name) {
                      setFieldErrors(prev => ({ ...prev, name: false }));
                    }
                  }}
                  style={{
                    borderColor: fieldErrors.name ? "#ef4444" : undefined,
                    borderWidth: fieldErrors.name ? "2px" : undefined,
                  }}
                  placeholder="Enter your full name"
                  className="mono-input"
                />
              </label>

              <label className="mono-label">
                <span><i className="fas fa-envelope" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Email <span style={{ color: "#ef4444" }}>*</span></span>
                <input
                  type="email"
                  required
                  onInvalid={(e) => e.preventDefault()}
                  value={form.email}
                  onChange={(e) => {
                    handleEmailChange(e);
                    if (fieldErrors.email) {
                      setFieldErrors(prev => ({ ...prev, email: false }));
                    }
                  }}
                  onBlur={handleEmailBlur}
                  style={{
                    borderColor: fieldErrors.email ? "#ef4444" : undefined,
                    borderWidth: fieldErrors.email ? "2px" : undefined,
                  }}
                  placeholder="Enter your email address"
                  className="mono-input"
                />
              </label>

              <div className="mono-label">
                <PhoneInput
                  label={<span><i className="fas fa-phone" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Phone Number <span style={{ color: "#ef4444" }}>*</span></span>}
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    if (fieldErrors.phone) {
                      setFieldErrors(prev => ({ ...prev, phone: false }));
                    }
                  }}
                  onError={(error) => {
                    setNotieMessage(error);
                    setNotieType("error");
                    setTimeout(() => setNotieMessage(null), 3000);
                    setFieldErrors(prev => ({ ...prev, phone: true }));
                  }}
                  style={{
                    border: fieldErrors.phone ? "2px solid #ef4444" : undefined,
                  }}
                  placeholder="Enter your phone number"
                  required
                  className="mono-input"
                />
              </div>

              <label className="mono-label">
                <span><i className="fas fa-id-card" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Subscription Type <span style={{ color: "#ef4444" }}>*</span></span>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr 1fr", 
                  gap: "12px",
                  marginTop: "8px"
                }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, subscriptionType: "Lifetime" })}
                    style={{
                      padding: "16px",
                      border: "none",
                      borderRadius: "10px",
                      background: form.subscriptionType === "Lifetime" 
                        ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" 
                        : "#f8f9ff",
                      color: form.subscriptionType === "Lifetime" ? "white" : "#1a1a1a",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: "600",
                      boxShadow: form.subscriptionType === "Lifetime" 
                        ? "0 4px 12px rgba(90, 49, 234, 0.3)" 
                        : "0 2px 4px rgba(90, 49, 234, 0.08)",
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>Lifetime</div>
                    <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>$250/year</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, subscriptionType: "Yearly + Janaza Fund" })}
                    style={{
                      padding: "16px",
                      border: "none",
                      borderRadius: "10px",
                      background: form.subscriptionType === "Yearly + Janaza Fund" 
                        ? "linear-gradient(135deg, #5a31ea 0%, #7c4eff 100%)" 
                        : "#f8f9ff",
                      color: form.subscriptionType === "Yearly + Janaza Fund" ? "white" : "#1a1a1a",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: "600",
                      boxShadow: form.subscriptionType === "Yearly + Janaza Fund" 
                        ? "0 4px 12px rgba(90, 49, 234, 0.3)" 
                        : "0 2px 4px rgba(90, 49, 234, 0.08)",
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>Yearly + Janaza Fund</div>
                    <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>$500/year</div>
                  </button>
                </div>
              </label>

              <label className="mono-label">
                <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Password <span style={{ color: "#ef4444" }}>*</span></span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    onInvalid={(e) => e.preventDefault()}
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
                <span><i className="fas fa-lock" style={{ marginRight: "8px", color: "#5a31ea" }}></i>Confirm Password <span style={{ color: "#ef4444" }}>*</span></span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    onInvalid={(e) => e.preventDefault()}
                    value={form.confirmPassword}
                    onChange={(e) => {
                      setForm({ ...form, confirmPassword: e.target.value });
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: false }));
                      }
                    }}
                    style={{
                      paddingRight: "45px",
                      borderColor: fieldErrors.confirmPassword ? "#ef4444" : undefined,
                      borderWidth: fieldErrors.confirmPassword ? "2px" : undefined,
                    }}
                    placeholder="Confirm your password"
                    className="mono-input"
                    minLength={6}
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

              {/* Alerts are now handled by AlertModal */}

              <button
                type="submit"
                className="primary-btn"
                style={{ width: "100%", marginTop: "24px" }}
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <AlertModal
              isOpen={!!error}
              message={error}
              type="error"
              onClose={() => setError(null)}
            />

            <AlertModal
              isOpen={!!success}
              message={success}
              type="success"
              onClose={() => setSuccess(null)}
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


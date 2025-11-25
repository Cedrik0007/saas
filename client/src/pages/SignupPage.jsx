import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";

export function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    subscriptionType: "Monthly",
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!form.name || !form.email || !form.phone || !form.password || !form.subscriptionType) {
      setError("Please fill in all required fields");
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
          status: "Active",
          balance: "$0",
          nextDue: "",
          lastPayment: "",
          subscriptionType: form.subscriptionType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create account');
      }

      setSuccess("Account created successfully! Redirecting to login...");
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login", { 
          replace: true,
          state: { 
            message: "Account created successfully! Please login with your credentials.",
            email: form.email 
          }
        });
      }, 2000);
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
            <h1>Create Account</h1>
            <p style={{ marginBottom: "24px", color: "var(--gray-600)" }}>
              Already have an account? <Link to="/login" style={{ color: "var(--primary)", textDecoration: "underline" }}>Sign in</Link>
            </p>

            <form onSubmit={handleSubmit}>
              <label className="mono-label">
                Full Name *
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter Your Full Name"
                  className="mono-input"
                />
              </label>

              <label className="mono-label">
                Email *
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter Your Email"
                  className="mono-input"
                />
              </label>

              <label className="mono-label">
                Phone Number *
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Enter Your Phone Number"
                  className="mono-input"
                />
              </label>

              <label className="mono-label">
                Subscription Type *
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
                      border: form.subscriptionType === "Monthly" 
                        ? "2px solid var(--primary)" 
                        : "2px solid #e0e0e0",
                      borderRadius: "8px",
                      background: form.subscriptionType === "Monthly" 
                        ? "var(--primary)" 
                        : "white",
                      color: form.subscriptionType === "Monthly" ? "white" : "var(--gray-700)",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: form.subscriptionType === "Monthly" ? "600" : "400",
                      transition: "all 0.2s",
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
                      border: form.subscriptionType === "Yearly" 
                        ? "2px solid var(--primary)" 
                        : "2px solid #e0e0e0",
                      borderRadius: "8px",
                      background: form.subscriptionType === "Yearly" 
                        ? "var(--primary)" 
                        : "white",
                      color: form.subscriptionType === "Yearly" ? "white" : "var(--gray-700)",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: form.subscriptionType === "Yearly" ? "600" : "400",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>Yearly</div>
                    <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>$500/year</div>
                  </button>
                </div>
              </label>

              <label className="mono-label">
                Password *
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Create a Password (min. 6 characters)"
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
                Confirm Password *
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Confirm Your Password"
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
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success" style={{ marginTop: "16px" }}>
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


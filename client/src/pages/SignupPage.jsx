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
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!form.name || !form.email || !form.phone || !form.password) {
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
                Password *
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Create a Password (min. 6 characters)"
                  className="mono-input"
                  minLength={6}
                />
              </label>

              <label className="mono-label">
                Confirm Password *
                <input
                  type="password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Confirm Your Password"
                  className="mono-input"
                  minLength={6}
                />
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


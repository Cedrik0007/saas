import { Link } from "react-router-dom";

export function SiteHeader({ 
  showCTA = true, 
  showLogout = false, 
  onLogout,
  showMobileMenu = false,
  isMobileMenuOpen = false,
  onMobileMenuToggle,
  isSticky = false
}) {
  return (
    <header className={`site-header ${isSticky ? 'site-header--sticky' : ''}`}>
      {showMobileMenu && (
        <button
          className="mobile-menu-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onMobileMenuToggle && onMobileMenuToggle();
          }}
          aria-label="Toggle menu"
          type="button"
        >
          <span className={`hamburger ${isMobileMenuOpen ? "active" : ""}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      )}
      <div className="brand">
        <span className="logo-mark">SM</span>
        <div>
          <p className="logo-title">Subscription Manager HK</p>
          <p className="logo-subtitle">
            Recurring payments for Hong Kong memberships
          </p>
        </div>
      </div>
      {showCTA && (
        <Link className="primary-btn" to="/login">
          Launch Demo
        </Link>
      )}
      {showLogout && (
        <button onClick={onLogout} className="ghost-btn">
          Logout
        </button>
      )}
    </header>
  );
}


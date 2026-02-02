/**
 * UX-friendly loading placeholder for lazy-loaded routes.
 * Shows a clear message and simple skeleton-style placeholder (no full-screen spinner, no white screen).
 */
export function PageLoader({ message = "Loading…" }) {
  return (
    <div
      className="page-loader"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="page-loader__content">
        <div className="page-loader__message">{message}</div>
        <div className="page-loader__skeleton">
          <div className="page-loader__skeleton-line" style={{ width: "80%", marginBottom: 12 }} />
          <div className="page-loader__skeleton-line" style={{ width: "60%", marginBottom: 12 }} />
          <div className="page-loader__skeleton-line" style={{ width: "70%" }} />
        </div>
      </div>
    </div>
  );
}

export default PageLoader;

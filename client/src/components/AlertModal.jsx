import "./AlertModal.css";

/**
 * AlertModal - Popup-based alert/modal component
 * Supports only: success (green) for positive, error (red) for negative
 * Warning and info types are mapped to error (negative)
 * Follows site design system
 */
export function AlertModal({ isOpen, message, type = "success", onClose, title }) {
  if (!isOpen || !message) return null;

  // Map all types to only success (green) or error (red)
  // success = positive notification (green)
  // error, warning, info = negative notification (red)
  const normalizedType = type === "success" ? "success" : "error";

  const getIcon = () => {
    switch (normalizedType) {
      case "success":
        return "fa-check-circle";
      case "error":
        return "fa-exclamation-circle";
      default:
        return "fa-exclamation-circle";
    }
  };

  return (
    <div 
      className="alert-modal-overlay"
      onClick={(e) => {
        // Prevent closing on background click
        e.stopPropagation();
      }}
    >
      <div 
        className={`alert-modal alert-modal--${normalizedType}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="alert-modal-content">
          <div className="alert-modal-header">
            <div className="alert-modal-icon">
              <i className={`fas ${getIcon()}`}></i>
            </div>
            {title && <h3 className="alert-modal-title">{title}</h3>}
          </div>
          <div className="alert-modal-message">
            {message}
          </div>
        </div>
        <div className="alert-modal-divider"></div>
        <div className="alert-modal-actions">
          <button
            className="primary-btn"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}




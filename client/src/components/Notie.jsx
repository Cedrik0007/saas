import { useEffect } from "react";
import "./Notie.css";

/**
 * Notie-style notification component
 * Supports only: success (green) for positive, error (red) for negative
 * Warning and info types are mapped to error (negative)
 */
export function Notie({ message, type = "success", onClose, duration = 3000 }) {
  useEffect(() => {
    if (message && duration > 0) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  // Map all types to only success (green) or error (red)
  // success = positive notification (green)
  // error, warning, info = negative notification (red)
  const normalizedType = type === "success" ? "success" : "error";

  return (
    <div className={`notie notie--${normalizedType}`}>
      <div className="notie-content">
        {message}
      </div>
    </div>
  );
}





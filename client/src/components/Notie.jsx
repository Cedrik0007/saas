import { useEffect } from "react";
import "./Notie.css";

/**
 * Notie-style notification component
 * Supports: success, warning, error, info types
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

  return (
    <div className={`notie notie--${type}`}>
      <div className="notie-content">
        {message}
      </div>
    </div>
  );
}


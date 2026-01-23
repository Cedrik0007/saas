import { useEffect, useState, useRef } from "react";
import "./Notie.css";

/**
 * Notie-style notification component
 * Supports only: success (green) for positive, error (red) for negative
 * Warning and info types are mapped to error (negative)
 */
export function Notie({ message, type = "success", onClose, duration = 3000 }) {
  const [isExiting, setIsExiting] = useState(false);
  const [displayedMessage, setDisplayedMessage] = useState(message);
  const [displayedType, setDisplayedType] = useState(type);
  const timerRef = useRef(null);
  const exitTimerRef = useRef(null);

  // Update displayed message when new message arrives
  useEffect(() => {
    if (message) {
      // Clear any pending timers
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      
      // New message arrived - update and reset exit state
      setDisplayedMessage(message);
      setDisplayedType(type);
      setIsExiting(false);
    }
  }, [message, type]);

  // Handle auto-dismiss timer
  useEffect(() => {
    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    if (displayedMessage && !isExiting && duration > 0) {
      // Start exit animation after duration
      timerRef.current = setTimeout(() => {
        setIsExiting(true);
        // Wait for animation to finish before calling onClose and clearing message
        exitTimerRef.current = setTimeout(() => {
          if (onClose) onClose();
          setDisplayedMessage(null);
          setIsExiting(false);
        }, 350); // Match CSS transition duration
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [displayedMessage, duration, onClose, isExiting]);

  // Don't render if no message to display
  if (!displayedMessage) return null;

  // Map all types to only success (green) or error (red)
  // success = positive notification (green)
  // error, warning, info = negative notification (red)
  const normalizedType = displayedType === "success" ? "success" : "error";

  return (
    <div className={`notie notie--${normalizedType} ${isExiting ? "notie--exiting" : ""}`}>
      <div className="notie-content">
        {displayedMessage}
      </div>
    </div>
  );
}





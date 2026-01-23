import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Custom hook to handle auto-logout on inactivity
 * @param {number} timeoutMinutes - Minutes of inactivity before logout (default: 15)
 */
export function useAutoLogout(timeoutMinutes = 15) {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimeout = () => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    const timeoutMs = timeoutMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(() => {
      // Clear session storage
      sessionStorage.clear();
      
      // Show message in sessionStorage so login page can display it
      sessionStorage.setItem('logoutReason', 'inactivity');
      
      // Redirect to login
      navigate("/login", { replace: true });
    }, timeoutMs);
  };

  useEffect(() => {
    // Track user activity events
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown'
    ];

    const handleActivity = () => {
      resetTimeout();
    };

    // Set initial timeout
    resetTimeout();

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [navigate, timeoutMinutes]);
}


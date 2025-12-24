import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Custom hook to handle session timeout after inactivity
 * @param {number} timeoutMinutes - Minutes of inactivity before logout (default: 30)
 * @param {function} onTimeout - Optional callback when timeout occurs
 */
export function useSessionTimeout(timeoutMinutes = 30, onTimeout = null) {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Clear session storage and redirect to login
  const handleLogout = useCallback(() => {
    // Clear all session storage
    sessionStorage.clear();
    
    // Call optional callback
    if (onTimeout && typeof onTimeout === 'function') {
      onTimeout();
    }
    
    // Redirect to login
    navigate('/login', { replace: true });
  }, [navigate, onTimeout]);

  // Reset the timeout timer
  const resetTimeout = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout
    const timeoutMs = timeoutMinutes * 60 * 1000; // Convert minutes to milliseconds
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);
  }, [timeoutMinutes, handleLogout]);

  // Track user activity
  useEffect(() => {
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    const handleActivity = () => {
      // Only reset if user is authenticated
      const token = sessionStorage.getItem('authToken');
      if (token) {
        resetTimeout();
      }
    };

    // Add event listeners for user activity
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize timeout on mount
    const token = sessionStorage.getItem('authToken');
    if (token) {
      resetTimeout();
    }

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetTimeout]);

  // Check for existing session on mount and set timeout if authenticated
  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (token) {
      resetTimeout();
    }
  }, [resetTimeout]);

  return {
    resetTimeout,
    handleLogout
  };
}



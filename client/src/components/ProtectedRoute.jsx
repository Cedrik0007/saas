// components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useSessionTimeout } from "../hooks/useSessionTimeout";

export function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem("authToken"); // set on login

  // Enable session timeout (30 minutes of inactivity)
  useSessionTimeout(30, () => {
    // Optional: Show a message before logout
    console.log("Session expired due to inactivity");
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

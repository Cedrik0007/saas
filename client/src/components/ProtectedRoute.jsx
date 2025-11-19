// components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";

export function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem("authToken"); // set on login

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

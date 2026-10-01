import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_HOME } from "../constants/roles.js";

export default function ProtectedRoute({ children, role }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (role && auth.user.role !== role) {
    return <Navigate to={ROLE_HOME[auth.user.role] ?? "/"} replace />;
  }
  return children;
}
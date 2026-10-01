import { Routes, Route, Navigate } from "react-router-dom";
import RoleSelect from "./pages/auth/RoleSelect.jsx";
import Login from "./pages/auth/Login.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import SuperAdminApp from "./pages/superadmin/SuperAdminApp.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ManagerApp from "./ManagerApp.jsx";
import SalespersonApp from "./pages/salesperson/SalespersonApp.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/manager/*" element={
        <ProtectedRoute role="manager"><ManagerApp /></ProtectedRoute>
      } />
      <Route path="/superadmin/*" element={
        <ProtectedRoute role="superadmin"><SuperAdminApp /></ProtectedRoute>
      } />
      <Route path="/salesperson/*" element={
        <ProtectedRoute role="salesperson"><SalespersonApp /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
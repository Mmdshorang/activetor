import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Customers from "./pages/Customers";
import Versions from "./pages/Versions";
import Messages from "./pages/Messages";
import Licenses from "./pages/Licenses"; // ایمپورت کامپوننت لایسنس
import Contracts from "./pages/Contracts";
import RenewalRequests from "./pages/RenewalRequests";
import DashboardLayout from "./layout/DashboardLayout";
import { getAuthUser } from "./utils/auth";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const user = getAuthUser();
  if (!token || !user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RoleRoute({ allowedRoles, fallback = "/messages", children }) {
  const user = getAuthUser();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* مسیر ورود */}
        <Route path="/" element={<Login />} />
        
        {/* مسیرهای پنل مدیریت */}
        <Route
          path="/"
          element={(
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          )}
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<RoleRoute allowedRoles={["admin", "user"]}><Users /></RoleRoute>} />
          <Route path="customers" element={<RoleRoute allowedRoles={["admin", "user"]}><Customers /></RoleRoute>} />
          <Route path="versions" element={<RoleRoute allowedRoles={["admin", "user"]}><Versions /></RoleRoute>} />
          <Route path="messages" element={<Messages />} />
          <Route path="licenses" element={<RoleRoute allowedRoles={["admin", "user", "customer"]}><Licenses /></RoleRoute>} />
          <Route path="contracts" element={<RoleRoute allowedRoles={["admin", "user", "agent", "customer"]}><Contracts /></RoleRoute>} />
          <Route path="renewal-requests" element={<RoleRoute allowedRoles={["admin", "user", "agent", "customer"]}><RenewalRequests /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

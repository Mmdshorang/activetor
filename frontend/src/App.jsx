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
import { canAccessPage, getAuthUser } from "./utils/auth";
import { PAGE_DEFINITIONS } from "./constants/pagePermissions";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const user = getAuthUser();
  if (!token || !user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RoleRoute({ allowedRoles, pageKey, fallback = "/messages", children }) {
  const user = getAuthUser();
  const firstAllowedPath =
    PAGE_DEFINITIONS.find((item) => canAccessPage(user, item.key))?.path || "/";
  const redirectPath = fallback === "/messages" && !canAccessPage(user, "messages")
    ? firstAllowedPath
    : fallback;

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={redirectPath} replace />;
  }

  if (pageKey && !canAccessPage(user, pageKey)) {
    return <Navigate to={redirectPath} replace />;
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
          <Route path="dashboard" element={<RoleRoute allowedRoles={["admin", "user", "agent", "customer"]} pageKey="dashboard"><Dashboard /></RoleRoute>} />
          <Route path="users" element={<RoleRoute allowedRoles={["admin", "user"]} pageKey="users"><Users /></RoleRoute>} />
          <Route path="customers" element={<RoleRoute allowedRoles={["admin", "user", "agent"]} pageKey="customers"><Customers /></RoleRoute>} />
          <Route path="versions" element={<RoleRoute allowedRoles={["admin", "user"]} pageKey="versions"><Versions /></RoleRoute>} />
          <Route path="messages" element={<RoleRoute allowedRoles={["admin", "user", "agent", "customer"]} pageKey="messages"><Messages /></RoleRoute>} />
          <Route path="licenses" element={<RoleRoute allowedRoles={["admin", "user", "customer"]} pageKey="licenses"><Licenses /></RoleRoute>} />
          <Route path="contracts" element={<RoleRoute allowedRoles={["admin", "user", "agent", "customer"]} pageKey="contracts"><Contracts /></RoleRoute>} />
          <Route path="renewal-requests" element={<RoleRoute allowedRoles={["admin", "user", "agent", "customer"]} pageKey="renewalRequests"><RenewalRequests /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

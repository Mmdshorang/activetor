import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Customers from "./pages/Customers";
import Versions from "./pages/Versions";
import Messages from "./pages/Messages";
import Licenses from "./pages/Licenses";
import Contracts from "./pages/Contracts";
import RenewalRequests from "./pages/RenewalRequests";
import Trash from "./pages/Trash";
import DashboardLayout from "./layout/DashboardLayout";
import { canAccessPage, getAuthUser, isAuthenticated } from "./utils/auth";
import { PAGE_DEFINITIONS } from "./constants/pagePermissions";

function LoginRoute({ children }) {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RoleRoute({
  allowedRoles = [],
  pageKey,
  fallback = "/messages",
  children,
}) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const user = getAuthUser();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const role = String(user.role || "").toLowerCase();

  const firstAllowedPath =
    PAGE_DEFINITIONS.find((item) => canAccessPage(user, item.key))?.path ||
    "/dashboard";

  const redirectPath =
    fallback === "/messages" && !canAccessPage(user, "messages")
      ? firstAllowedPath
      : fallback;

  if (!allowedRoles.includes(role)) {
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
        <Route
          path="/"
          element={
            <LoginRoute>
              <Login />
            </LoginRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route
            path="dashboard"
            element={
              <RoleRoute
                allowedRoles={["admin", "user", "agent", "customer"]}
                pageKey="dashboard"
              >
                <Dashboard />
              </RoleRoute>
            }
          />

          <Route
            path="users"
            element={
              <RoleRoute allowedRoles={["admin", "user"]} pageKey="users">
                <Users />
              </RoleRoute>
            }
          />

          <Route
            path="customers"
            element={
              <RoleRoute
                allowedRoles={["admin", "user", "agent"]}
                pageKey="customers"
              >
                <Customers />
              </RoleRoute>
            }
          />

          <Route
            path="versions"
            element={
              <RoleRoute allowedRoles={["admin", "user"]} pageKey="versions">
                <Versions />
              </RoleRoute>
            }
          />

          <Route
            path="messages"
            element={
              <RoleRoute
                allowedRoles={["admin", "user", "agent", "customer"]}
                pageKey="messages"
              >
                <Messages />
              </RoleRoute>
            }
          />

          <Route
            path="licenses"
            element={
              <RoleRoute
                allowedRoles={["admin", "user", "customer"]}
                pageKey="licenses"
              >
                <Licenses />
              </RoleRoute>
            }
          />

          <Route
            path="contracts"
            element={
              <RoleRoute
                allowedRoles={["admin", "user", "agent", "customer"]}
                pageKey="contracts"
              >
                <Contracts />
              </RoleRoute>
            }
          />

          <Route
            path="renewal-requests"
            element={
              <RoleRoute
                allowedRoles={["admin", "user", "agent", "customer"]}
                pageKey="renewalRequests"
              >
                <RenewalRequests />
              </RoleRoute>
            }
          />

          <Route
            path="trash"
            element={
              <RoleRoute allowedRoles={["admin"]} pageKey="trash">
                <Trash />
              </RoleRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
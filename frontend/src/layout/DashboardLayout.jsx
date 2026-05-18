import React, { useEffect, useMemo, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Box,
  LogOut,
  Menu,
  X,
  Shield,
  Key,
  FileText,
  ChevronLeft,
  Repeat,
  Trash2,
} from "lucide-react";
import { canAccessPage, clearAuth, getAuthUser } from "../utils/auth";

const adminMenuItems = [
  { key: "dashboard", path: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "users", path: "/users", label: "کاربران", icon: Users },
  { key: "customers", path: "/customers", label: "مشتریان", icon: Users },
  { key: "versions", path: "/versions", label: "نسخه ها", icon: Box },
  { key: "licenses", path: "/licenses", label: "لایسنس ها", icon: Key },
  { key: "contracts", path: "/contracts", label: "قراردادها", icon: FileText },
  { key: "messages", path: "/messages", label: "پیام ها", icon: MessageSquare },
  { key: "renewalRequests", path: "/renewal-requests", label: "درخواست تمدید", icon: Repeat },
  { key: "trash", path: "/trash", label: "سطل زباله", icon: Trash2 },
];

const customerMenuItems = [
  { key: "dashboard", path: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "licenses", path: "/licenses", label: "لایسنس ها", icon: Key },
  { key: "contracts", path: "/contracts", label: "قراردادها", icon: FileText },
  { key: "renewalRequests", path: "/renewal-requests", label: "درخواست تمدید", icon: Repeat },
  { key: "messages", path: "/messages", label: "پیام ها", icon: MessageSquare },
];

const agentMenuItems = [
  { key: "dashboard", path: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "customers", path: "/customers", label: "مشتریان", icon: Users },
  { key: "contracts", path: "/contracts", label: "قراردادهای من", icon: FileText },
  { key: "renewalRequests", path: "/renewal-requests", label: "درخواست تمدید", icon: Repeat },
  { key: "messages", path: "/messages", label: "پیام ها", icon: MessageSquare },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      navigate("/");
      return;
    }
    setAuthUser(user);
  }, [navigate]);

  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);

      if (!desktop) {
        setSidebarOpen(true);
      } else {
        setMobileMenuOpen(false);
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const menuItems = useMemo(() => {
    let baseMenu = adminMenuItems;
    if (authUser?.role === "customer") baseMenu = customerMenuItems;
    else if (authUser?.role === "agent") baseMenu = agentMenuItems;

    return baseMenu.filter((item) => canAccessPage(authUser, item.key));
  }, [authUser]);

  const currentPage =
    menuItems.find((item) => item.path === location.pathname)?.label ||
    "داشبورد";

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-transparent" dir="rtl">
      <div className="flex h-full">
        {mobileMenuOpen && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-20 bg-slate-900/45 lg:hidden"
            aria-label="بستن منو"
          />
        )}

        <aside
          className={[
            "fixed lg:sticky right-0 top-0 z-30 h-screen transition-all duration-300",
            "bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100 border-l border-slate-700/60",
            sidebarOpen ? "w-72" : "w-24",
            mobileMenuOpen
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0",
          ].join(" ")}
        >
          <div className="h-20 px-4 border-b border-slate-700/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center">
                <Shield size={22} />
              </div>
              {sidebarOpen && (
                <span className="font-bold text-lg whitespace-nowrap">
                  {" "}
                  حساب بان
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                isDesktop ? setSidebarOpen((s) => !s) : setMobileMenuOpen(false)
              }
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700/60"
            >
              {isDesktop ? (
                <ChevronLeft
                  size={18}
                  className={!sidebarOpen ? "rotate-180" : ""}
                />
              ) : (
                <X size={18} />
              )}
            </button>
          </div>

          <nav className="px-3 py-4 space-y-1">
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={[
                    "group flex items-center gap-3 rounded-xl px-3 py-3 transition",
                    active
                      ? "bg-teal-600 text-white shadow-md shadow-teal-900/35"
                      : "text-slate-300 hover:bg-slate-700/70 hover:text-white",
                    !sidebarOpen ? "justify-center" : "",
                  ].join(" ")}
                >
                  <item.icon size={20} className="shrink-0" />
                  {sidebarOpen && (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 right-0 left-0 border-t border-slate-700/70 p-3">
            <button
              onClick={handleLogout}
              className={[
                "w-full rounded-xl px-3 py-2.5 text-red-200 hover:text-red-100 hover:bg-red-500/15",
                "transition flex items-center gap-2",
                !sidebarOpen ? "justify-center" : "",
              ].join(" ")}
            >
              <LogOut size={18} />
              {sidebarOpen && (
                <span className="text-sm font-medium">خروج از حساب</span>
              )}
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 lg:pr-0 h-full flex flex-col">
          <header className="z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
            <div className="h-20 px-4 md:px-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden rounded-xl p-2 border border-slate-200 text-slate-600"
                >
                  <Menu size={20} />
                </button>
                <div>
                  <h1 className="text-lg md:text-2xl font-extrabold text-slate-900 font-display">
                    {currentPage}
                  </h1>
                  <p className="text-xs md:text-sm text-slate-500">
                    مدیریت و پایش اطلاعات سامانه
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  {(authUser?.fullName || authUser?.username || "U").charAt(0)}
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-800 leading-4">
                    {authUser?.fullName || "کاربر"}
                  </p>
                  <p className="text-xs text-slate-500 leading-4">
                    @{authUser?.username || "user"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="app-page flex-1 overflow-y-auto">
            <div className="app-shell">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

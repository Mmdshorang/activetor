import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  Users,
  UserCheck,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  UserPlus,
  FileText,
  Clock3,
  CheckCircle2,
  KeyRound,
  RefreshCcw,
} from "lucide-react";
import { getAuthUser } from "../utils/auth";

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="panel-card p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl text-white flex items-center justify-center ${color}`}>
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const formatContractRemaining = (days) => {
  if (typeof days !== "number") return "نامشخص";
  if (days < 0) return "منقضی شده";
  return `${days} روز`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: 0,
    customers: 0,
    messages: 0,
    contracts: 0,
    activeUsers: 0,
  });
  const [authUser, setAuthUser] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getAuthUser();
    setAuthUser(user);

    const fetchData = async () => {
      try {
        const statsReq = api.get("/stats/dashboard-stats");
        const activityReq = user?.role === "customer" ? Promise.resolve({ data: [] }) : api.get("/stats/recent-activity");

        const [statsRes, activityRes] = await Promise.all([statsReq, activityReq]);
        setStats(statsRes.data);
        setActivity(activityRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const summary = useMemo(
    () => {
      if (authUser?.role === "customer") {
        return [
          { title: "لایسنس های من", value: stats.licenses || 0, icon: KeyRound, color: "bg-cyan-700" },
          { title: "قراردادهای من", value: stats.contracts || 0, icon: FileText, color: "bg-emerald-600" },
          { title: "باقی مانده قرارداد", value: formatContractRemaining(stats.contractRemainingDays), icon: Clock3, color: "bg-sky-700" },
          { title: "پیام ها", value: stats.messages || 0, icon: AlertCircle, color: "bg-amber-600" },
          { title: "تمدیدهای در انتظار", value: stats.pendingRenewals || 0, icon: RefreshCcw, color: "bg-violet-600" },
        ];
      }
      if (authUser?.role === "agent") {
        return [
          { title: "قراردادهای من", value: stats.contracts || 0, icon: FileText, color: "bg-emerald-600" },
          { title: "درخواست های تمدید", value: stats.renewalRequests || 0, icon: RefreshCcw, color: "bg-violet-600" },
          { title: "پیام ها", value: stats.messages || 0, icon: AlertCircle, color: "bg-amber-600" },
        ];
      }
      return [
        {
          title: "کل کاربران",
          value: stats.users,
          icon: Users,
          color: "bg-teal-600",
        },
        {
          title: "مشتریان فعال",
          value: stats.customers,
          icon: UserCheck,
          color: "bg-emerald-600",
        },
        {
          title: "پیام های جدید",
          value: stats.messages,
          icon: AlertCircle,
          color: "bg-amber-600",
        },
        {
          title: "کل قراردادها",
          value: stats.contracts,
          icon: FileText,
          color: "bg-cyan-700",
        },
      ];
    },
    [stats, authUser?.role],
  );

  if (loading) {
    return (
      <div className="panel-card h-56 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="panel-card-soft p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="panel-title text-2xl">خوش آمدید، {authUser?.fullName || authUser?.username || "کاربر"}</h2>
          <p className="panel-subtitle">
            {authUser?.role === "customer" ? "نمای کلی از وضعیت حساب و قرارداد شما" : "نمای کلی از وضعیت سیستم و فعالیت های اخیر"}
          </p>
        </div>
        {(authUser?.role === "customer" || authUser?.role === "agent") ? (
          <button className="panel-btn-primary" onClick={() => navigate("/renewal-requests")}>
            <RefreshCcw size={16} />
            درخواست تمدید
          </button>
        ) : (
          <button className="panel-btn-primary">
            <TrendingUp size={16} />
            مشاهده گزارش ها
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${summary.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3"} gap-4`}>
        {summary.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {authUser?.role !== "customer" && (
        <div className="panel-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 text-slate-800 font-bold">
            <Clock3 size={18} className="text-teal-700" />
            آخرین فعالیت ها
          </div>
          <div className="panel-table-wrap max-h-[430px]">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>کاربر / فرستنده</th>
                  <th>فعالیت</th>
                  <th>تاریخ</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {activity.length > 0 ? (
                  activity.map((item, index) => (
                    <tr key={index}>
                      <td className="font-medium text-slate-900">
                        {item.type === "message" ? <MessageSquare size={15} className="inline ml-2 text-slate-400" /> : <UserPlus size={15} className="inline ml-2 text-slate-400" />}
                        {item.user}
                      </td>
                      <td className="text-slate-600 max-w-[240px] truncate">{item.action}</td>
                      <td className="text-slate-500">{item.date}</td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700">
                          <CheckCircle2 size={12} />
                          موفق
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-500">
                      هنوز فعالیتی ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

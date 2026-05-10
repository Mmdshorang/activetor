import React, { useState } from "react";
import { User, Lock, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import api from "../services/api";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const login = async () => {
    if (!form.username || !form.password) {
      setError("لطفا نام کاربری و رمز عبور را وارد کنید.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.post("/auth/login", form);

      if (res.data.success && res.data.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("authUser", JSON.stringify(res.data.user || null));
        window.location.href = "/dashboard";
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "خطایی رخ داده است. لطفا دوباره تلاش کنید.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") login();
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950" dir="rtl">
      <section className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-teal-900 via-slate-900 to-amber-900 p-12">
        <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-teal-400/20 blur-3xl animate-floaty" />
        <div className="absolute bottom-10 left-10 w-52 h-52 rounded-full bg-amber-400/20 blur-3xl animate-floaty" />
        <div className="relative z-10 self-end text-white max-w-md">
          <h1 className="font-display text-5xl leading-tight">مدیریت مشتریان حساب بان</h1>
          <p className="mt-4 text-slate-200 leading-8">
            پنل مدیریتی یکپارچه برای کاربران، مشتریان، قراردادها و ارتباط با پشتیبانی.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-teal-600/20 text-teal-300 mb-3">
              <ShieldCheck size={30} />
            </div>
            <h2 className="text-3xl font-extrabold text-white">ورود به پنل</h2>
            <p className="text-slate-400 text-sm mt-1">نام کاربری و رمز عبور خود را وارد کنید</p>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            <div>
              <label className="panel-label text-slate-200">نام کاربری</label>
              <div className="relative">
                <User size={17} className="absolute right-3 top-3.5 text-slate-500" />
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 text-white pr-10 pl-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="مثال: admin"
                />
              </div>
            </div>

            <div>
              <label className="panel-label text-slate-200">رمز عبور</label>
              <div className="relative">
                <Lock size={17} className="absolute right-3 top-3.5 text-slate-500" />
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 text-white pr-10 pl-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <div className="panel-alert-error">{error}</div>}

            <button
              type="button"
              onClick={login}
              disabled={loading}
              className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 text-white py-3 font-bold transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  در حال بررسی...
                </>
              ) : (
                <>
                  ورود به پنل
                  <ArrowLeft size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

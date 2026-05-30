import React, { useEffect, useMemo, useState } from "react";
import { Phone, User, Lock, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import api from "../services/api";

const logoSrc = `${process.env.PUBLIC_URL || ""}/logo.jpg`;

export default function Login() {
  const [mode, setMode] = useState("otp"); // otp | password
  const [passwordForm, setPasswordForm] = useState({ username: "", password: "" });
  const [otpForm, setOtpForm] = useState({ phone: "", otp: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resendIn) return;
    const timer = setInterval(() => {
      setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const subtitle = useMemo(() => {
    if (mode === "password") return "نام کاربری و رمز عبور خود را وارد کنید";
    return otpSent ? "کد ارسال‌شده را وارد کنید" : "شماره موبایل خود را وارد کنید";
  }, [mode, otpSent]);

  const extractErrorMessage = (err, fallback) => {
    const data = err?.response?.data;

    if (!data) return fallback;

    if (typeof data === "string") {
      const trimmed = data.trim();
      if (!trimmed) return fallback;
      // If backend returned stringified JSON, try to parse and extract message.
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed?.message) return String(parsed.message);
        } catch (_) {
          // ignore
        }
      }
      return trimmed;
    }

    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message.trim();
    }

    if (Array.isArray(data?.errors) && data.errors.length) {
      const first = data.errors[0];
      if (typeof first === "string") return first;
      if (first?.message) return String(first.message);
    }

    return fallback;
  };

  const extractWaitSeconds = (message) => {
    const match = String(message || "").match(/(\d+)\s*ثانیه/);
    if (!match) return null;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setLoading(false);
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleOtpChange = (e) => {
    const { name, value } = e.target;
    const next = { ...otpForm, [name]: value };
    // If phone changes after requesting OTP, reset to request step.
    if (name === "phone" && value !== otpForm.phone) {
      next.otp = "";
      setOtpSent(false);
      setResendIn(0);
    }
    setOtpForm(next);
    if (error) setError("");
  };

  const persistAuthAndRedirect = (res) => {
    if (res?.data?.success && res?.data?.token) {
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("authUser", JSON.stringify(res.data.user || null));
      window.location.href = "/dashboard";
      return true;
    }
    return false;
  };

  const loginWithPassword = async () => {
    if (!passwordForm.username || !passwordForm.password) {
      setError("لطفا نام کاربری و رمز عبور را وارد کنید.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await api.post("/auth/login", passwordForm);
      if (!persistAuthAndRedirect(res)) {
        setError("ورود ناموفق بود.");
      }
    } catch (err) {
      setError(extractErrorMessage(err, "خطایی رخ داده است. لطفا دوباره تلاش کنید."));
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    if (!otpForm.phone) {
      setError("لطفا شماره موبایل را وارد کنید.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.post("/auth/request-otp", { phone: otpForm.phone });
      setOtpSent(true);
      // Backend defaults to 60s; client-side countdown is best-effort.
      setResendIn(60);
    } catch (err) {
      const msg = extractErrorMessage(err, "خطا در ارسال کد تایید.");
      setError(msg);

      // If backend rate-limits resend, keep user on OTP step for existing code.
      const waitSeconds = extractWaitSeconds(msg);
      if (err?.response?.status === 429 && waitSeconds) {
        setOtpSent(true);
        setResendIn(waitSeconds);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpForm.phone || !otpForm.otp) {
      setError("شماره موبایل و کد تایید را وارد کنید.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.post("/auth/verify-otp", { phone: otpForm.phone, otp: otpForm.otp });
      if (!persistAuthAndRedirect(res)) {
        setError("ورود ناموفق بود.");
      }
    } catch (err) {
      setError(extractErrorMessage(err, "خطا در تایید کد."));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;

    if (mode === "password") {
      loginWithPassword();
      return;
    }

    if (otpSent) verifyOtp();
    else requestOtp();
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950" dir="rtl">
      <section className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-teal-900 via-slate-900 to-amber-900 p-12">
        <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-teal-400/20 blur-3xl animate-floaty" />
        <div className="absolute bottom-10 left-10 w-52 h-52 rounded-full bg-amber-400/20 blur-3xl animate-floaty" />
        <div className="absolute top-10 right-10 z-10 flex items-center gap-3 text-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/95 shadow-lg">
            <img src={logoSrc} alt="حساب بان" className="h-10 w-10 object-contain" />
          </span>
          <span className="text-lg font-extrabold">حساب بان</span>
        </div>
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
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-700 bg-white shadow-lg">
              <img src={logoSrc} alt="حساب بان" className="h-14 w-14 object-contain" />
            </div>
            <h2 className="text-3xl font-extrabold text-white">ورود به پنل</h2>
            <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className={`rounded-xl py-2.5 font-bold border transition ${
                mode === "otp"
                  ? "bg-teal-600 text-white border-teal-500"
                  : "bg-slate-800/60 text-slate-200 border-slate-700 hover:bg-slate-800"
              }`}
              disabled={loading}
            >
              ورود با کد تایید
            </button>
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`rounded-xl py-2.5 font-bold border transition ${
                mode === "password"
                  ? "bg-teal-600 text-white border-teal-500"
                  : "bg-slate-800/60 text-slate-200 border-slate-700 hover:bg-slate-800"
              }`}
              disabled={loading}
            >
              ورود با رمز
            </button>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            {mode === "password" ? (
              <>
                <div>
                  <label className="panel-label text-slate-200">نام کاربری</label>
                  <div className="relative">
                    <User size={17} className="absolute right-3 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      name="username"
                      value={passwordForm.username}
                      onChange={handlePasswordChange}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/80 text-white pr-10 pl-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      placeholder="مثال: admin"
                      autoComplete="username"
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
                      value={passwordForm.password}
                      onChange={handlePasswordChange}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/80 text-white pr-10 pl-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="panel-label text-slate-200">شماره موبایل</label>
                  <div className="relative">
                    <Phone size={17} className="absolute right-3 top-3.5 text-slate-500" />
                    <input
                      type="tel"
                      name="phone"
                      value={otpForm.phone}
                      onChange={handleOtpChange}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/80 text-white pr-10 pl-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      placeholder="مثال: 09123456789"
                      dir="ltr"
                    />
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="panel-label text-slate-200">کد تایید</label>
                    <div className="relative">
                      <KeyRound size={17} className="absolute right-3 top-3.5 text-slate-500" />
                      <input
                        type="text"
                        name="otp"
                        value={otpForm.otp}
                        onChange={handleOtpChange}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/80 text-white pr-10 pl-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        placeholder="کد ۶ رقمی"
                        inputMode="numeric"
                        dir="ltr"
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={requestOtp}
                        disabled={loading || resendIn > 0}
                        className="text-teal-300 hover:text-teal-200 disabled:opacity-50"
                      >
                        {resendIn > 0 ? `ارسال مجدد تا ${resendIn}s` : "ارسال مجدد کد"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpForm({ ...otpForm, otp: "" });
                          setResendIn(0);
                          setError("");
                        }}
                        disabled={loading}
                        className="text-slate-300 hover:text-white disabled:opacity-50"
                      >
                        تغییر شماره
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && <div className="panel-alert-error">{error}</div>}

            <button
              type="button"
              onClick={
                mode === "password" ? loginWithPassword : otpSent ? verifyOtp : requestOtp
              }
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
                  {mode === "password" ? "ورود به پنل" : otpSent ? "تایید و ورود" : "ارسال کد تایید"}
                  {mode === "password" ? <ArrowLeft size={18} /> : <KeyRound size={18} />}
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

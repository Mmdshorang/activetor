import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  KeyRound,
  BadgeDollarSign,
  Save,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../services/api";
import SearchableSelect from "../components/SearchableSelect";
import OverflowTooltip from "../components/OverflowTooltip";
import axios from "axios";
import qs from "qs";
import { getAuthUser } from "../utils/auth";
import {
  ACTIVECODE_SERVERS,
  buildActivecodeUrl,
  getActivecodeServerKey,
  resolveActivecodeServer,
  setActivecodeServerKey,
} from "../config/externalServices";

export default function Licenses() {
  const authUser = getAuthUser();
  const canManageAll = authUser?.role === "admin" || authUser?.role === "user";
  const isAdmin = authUser?.role === "admin";
  const [activecodeServerKey, setActivecodeServerKeyState] = useState(() =>
    getActivecodeServerKey(),
  );
  const activecodeServer = useMemo(
    () => resolveActivecodeServer(activecodeServerKey),
    [activecodeServerKey],
  );
  const activecodeUrl = useMemo(
    () => buildActivecodeUrl(activecodeServer.baseUrl),
    [activecodeServer.baseUrl],
  );
  const [licenses, setLicenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [versions, setVersions] = useState([]);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    systemName: "",
    version: "",
    code1: "",
    code2: "",
    code3: "",
    customerId: "",
    licenseId: "",
  });

  const [searchParams] = useSearchParams();

  const selectedCustomerItem = useMemo(() => {
    const id = String(form.customerId || selectedCustomer || "");
    if (!id) return null;
    return customers.find((c) => String(c.id) === id) || null;
  }, [customers, form.customerId, selectedCustomer]);

  const loadCustomers = async () => {
    const res = await api.get("/customers");
    setCustomers(res.data || []);
  };

  const loadVersions = async () => {
    const res = await api.get("/versions");
    setVersions(res.data || []);
  };

  const loadLicenses = async (customerId = "") => {
    setLoading(true);
    try {
      const res = await api.get(
        `/licenses${customerId ? `?customerId=${customerId}` : ""}`,
      );
      setLicenses(res.data || []);
    } catch {
      setError("خطا در دریافت لایسنس ها");
    } finally {
      setLoading(false);
    }
  };

  const loadLicenseInfo = async (customerId) => {
    if (!customerId) {
      setLicenseInfo(null);
      return;
    }
    const res = await api.get(`/customers/${customerId}/license-info`);
    setLicenseInfo(res.data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await Promise.all([loadCustomers(), loadVersions()]);

        const customerIdFromQuery = searchParams.get("customerId") || "";
        if (customerIdFromQuery) {
          setSelectedCustomer(customerIdFromQuery);
          setForm((prev) => ({ ...prev, customerId: customerIdFromQuery }));
          await Promise.all([
            loadLicenses(customerIdFromQuery),
            loadLicenseInfo(customerIdFromQuery),
          ]);
        } else {
          await loadLicenses();
        }
      } catch {
        setError("خطا در بارگذاری اطلاعات اولیه");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleCustomerChange = async (customerId) => {
    setSelectedCustomer(customerId);
    setForm((prev) => ({ ...prev, customerId }));
    await Promise.all([loadLicenses(customerId), loadLicenseInfo(customerId)]);
  };

  const resetForm = () => {
    setForm({
      systemName: "",
      version: "",
      code1: "",
      code2: "",
      code3: "",
      customerId: selectedCustomer,
    });
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const saveLicense = async (e) => {
    e.preventDefault();
    
    // 1. اعتبارسنجی‌های اولیه
    if (!form.customerId) {
      setError("مشتری را انتخاب کنید");
      return;
    }
    
    // ظرفیت را چک کن
    if (licenseInfo && licenseInfo.count >= licenseInfo.limit) {
      setError("ظرفیت لایسنس این مشتری پر شده");
      return;
    }

    try {
      setLoading(true);
      setError(""); // پاک کردن خطاهای قبلی
      
      // آماده‌سازی داده‌ها
      const payload = {
        ...form,
      };

      // --- حالت ثبت جدید ---

      // مرحله اول: دریافت لایسنس از API خارجی
      const activatorUser =
        authUser?.fullName || authUser?.username || authUser?.user || "";

      const customerName = selectedCustomerItem?.fullName || "";
      const customerShop = selectedCustomerItem?.company || "";
      const customerMobile = selectedCustomerItem?.phone || "";
      const customerAddress = selectedCustomerItem?.address || "";

      const externalFormData = qs.stringify({
        user: activatorUser,
        name: customerName,
        shop: customerShop,
        mobile: customerMobile,
        key1: form.code1,
        key2: form.code2,
        key3: form.code3,
        code: customerAddress,
      });

      // استفاده از await برای صبر کردن پاسخ
      if (!activecodeUrl) {
        throw new Error("آدرس سرور لایسنس تنظیم نشده است");
      }

      const res = await axios.post(activecodeUrl, externalFormData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!res.data || !res.data.Message) {
        throw new Error("پاسخ نامعتبر از سرور لایسنس");
      }

      const licenseIdFromServer = res.data.Message;

      // مرحله دوم: ذخیره در دیتابیس خودمان
      const finalPayload = {
        ...payload,
        licenseId: licenseIdFromServer,
      };

      await api.post("/licenses", finalPayload);

      setSuccess("لایسنس با موفقیت ثبت شد");

      // ریست کردن فرم و لود مجدد لیست‌ها
      resetForm();
      await Promise.all([
        loadLicenses(selectedCustomer),
        loadLicenseInfo(selectedCustomer),
      ]);

    } catch (error) {
      console.error("Error saving license:", error);

      if (error?.response) {
        setError(
          error.response?.data?.message ||
            "خطا در ذخیره لایسنس. لطفاً اتصال اینترنت یا صحت کدها را بررسی کنید.",
        );
      } else if (error?.message) {
        setError(error.message);
      } else {
        setError(
          "خطا در ذخیره لایسنس. لطفاً اتصال اینترنت یا صحت کدها را بررسی کنید.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredLicenses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return licenses;
    return licenses.filter((l) => {
      const systemName = l.systemName?.toLowerCase() || "";
      const code1 = l.code1?.toLowerCase() || "";
      const customer = l.customer?.fullName?.toLowerCase() || "";
      return (
        systemName.includes(term) ||
        code1.includes(term) ||
        customer.includes(term)
      );
    });
  }, [licenses, searchTerm]);

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.fullName || customer.username || `#${customer.id}`,
      })),
    [customers],
  );

  const versionOptions = useMemo(
    () =>
      versions.map((version) => ({
        value: version.name,
        label: version.name,
      })),
    [versions],
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="panel-card-soft p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="panel-title flex items-center gap-3">
            <KeyRound className="text-teal-700" size={30} />
            مدیریت لایسنس ها
          </h1>
          <p className="panel-subtitle">
            ثبت، ویرایش و مدیریت وضعیت مصرف لایسنس مشتریان
          </p>
        </div>

        <div className="w-full md:w-72">
          <label className="panel-label">مشتری</label>
          <SearchableSelect
            value={selectedCustomer}
            onChange={handleCustomerChange}
            options={customerOptions}
            placeholder="همه مشتریان"
          />
        </div>
      </div>

      {isAdmin && (
        <div className="panel-card p-4">
          <label className="panel-label">سرور لایسنس (ActiveCode)</label>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex gap-2">
              {ACTIVECODE_SERVERS.map((s) => {
                const selected = s.key === activecodeServerKey;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setActivecodeServerKeyState(s.key);
                      setActivecodeServerKey(s.key);
                    }}
                    className={selected ? "panel-btn-primary" : "panel-btn-secondary"}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-slate-500">
              آدرس انتخاب‌شده:{" "}
              <span dir="ltr" className="font-mono text-slate-700 break-all">
                {activecodeUrl || "-"}
              </span>
            </div>
          </div>
        </div>
      )}

      {licenseInfo && (
        <div className="panel-card p-4">
          <p className="text-sm text-slate-700 flex items-center gap-2">
            <BadgeDollarSign size={16} className="text-amber-600" />
            مصرف لایسنس: <span className="font-bold">
              {licenseInfo.count}
            </span>{" "}
            از <span className="font-bold">{licenseInfo.limit}</span>
          </p>
        </div>
      )}

      {success && (
        <div className="panel-alert-success flex items-center gap-2">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}
      {error && (
        <div className="panel-alert-error flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {canManageAll && (
        <div className="panel-card p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-2">
              <Save size={18} className="text-teal-700 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">ثبت لایسنس جدید</h2>
                <p className="text-sm text-slate-500 mt-1">
                  برای نمایش بهتر جدول، فرم در بالای صفحه باز/بسته می‌شود.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (formOpen) {
                      closeForm();
                      return;
                    }
                    openCreateForm();
                  }}
                  className="panel-btn-primary"
                  disabled={loading}
                >
                  {formOpen ? <X size={18} /> : <Plus size={18} />}
                  {formOpen ? "بستن فرم" : "ثبت لایسنس"}
                </button>
              </div>
            </div>

          {formOpen && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <form onSubmit={saveLicense} className="space-y-3">
                <div>
                  <label className="panel-label">نام سیستم</label>
                  <input
                    name="systemName"
                    value={form.systemName}
                    onChange={handleChange}
                    className="panel-input"
                    placeholder="مثال: سامانه مدیریت"
                  />
                </div>

                <div>
                  <label className="panel-label">نسخه</label>
                  <SearchableSelect
                    value={form.version}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, version: value }))
                    }
                    options={versionOptions}
                    placeholder="انتخاب نسخه"
                  />
                </div>

                <div>
                  <label className="panel-label">کد اصلی</label>
                  <input
                    name="code1"
                    value={form.code1}
                    onChange={handleChange}
                    className="panel-input"
                    placeholder="Code 1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="panel-label">کد دوم</label>
                    <input
                      name="code2"
                      value={form.code2}
                      onChange={handleChange}
                      className="panel-input"
                      placeholder="Code 2"
                    />
                  </div>
                  <div>
                    <label className="panel-label">کد سوم</label>
                    <input
                      name="code3"
                      value={form.code3}
                      onChange={handleChange}
                      className="panel-input"
                      placeholder="Code 3"
                    />
                  </div>
                </div>

                <div>
                  <label className="panel-label">مشتری</label>
                  <SearchableSelect
                    value={form.customerId}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, customerId: value }))
                    }
                    options={customerOptions}
                    placeholder="انتخاب مشتری"
                  />
                </div>

                <button
                  type="submit"
                  className="panel-btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  ثبت لایسنس
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      <div className="panel-card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-3 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو بر اساس سیستم، مشتری یا کد"
              className="panel-input pr-9"
            />
          </div>
        </div>

        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>سیستم</th>
                <th>نسخه</th>
                <th>مشتری</th>
                <th>کد اصلی</th>
                <th>شناسه لایسنس</th>
              </tr>
            </thead>
            <tbody>
              {loading && licenses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      در حال بارگذاری...
                    </span>
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    نتیجه ای یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((license) => (
                  <tr key={license.id}>
                    <td className="font-semibold text-slate-900 min-w-[170px]">
                      <OverflowTooltip
                        text={license.systemName || "-"}
                        className="max-w-[160px]"
                      />
                    </td>
                    <td className="min-w-[140px]">
                      <OverflowTooltip
                        text={license.version || "-"}
                        className="max-w-[130px]"
                      />
                    </td>
                    <td className="min-w-[170px]">
                      <OverflowTooltip
                        text={license.customer?.fullName || "-"}
                        className="max-w-[160px]"
                      />
                    </td>
                    <td className="font-mono whitespace-nowrap" dir="ltr">
                      <OverflowTooltip
                        text={license.code1 || "-"}
                        className="max-w-[130px]"
                        dir="ltr"
                      />
                    </td>
                    <td className="font-mono whitespace-nowrap" dir="ltr">
                      <OverflowTooltip
                        text={license.licenseId || "-"}
                        className="max-w-[130px]"
                        dir="ltr"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

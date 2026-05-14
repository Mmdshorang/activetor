import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import JalaliDatePicker from "../components/DatePicker";
import moment from "jalali-moment";
import {
  Search,
  KeyRound,
  Calendar,
  BadgeDollarSign,
  Save,
  Edit2,
  Trash2,
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

export default function Licenses() {
  const authUser = getAuthUser();
  const canManageAll = authUser?.role === "admin" || authUser?.role === "user";
  const toGregorianDate = (jalaliOrDate) => {
    if (!jalaliOrDate) return null;
    const jalaliParsed = moment(jalaliOrDate, "jYYYY/jMM/jDD", true);
    if (jalaliParsed.isValid())
      return jalaliParsed.locale("en").format("YYYY-MM-DD");
    const normalParsed = moment(jalaliOrDate);
    return normalParsed.isValid() ? normalParsed.format("YYYY-MM-DD") : null;
  };

  const toJalaliDate = (dateValue) => {
    if (!dateValue) return null;
    const parsed = moment(dateValue);
    return parsed.isValid()
      ? parsed.locale("fa").format("jYYYY/jMM/jDD")
      : null;
  };

  const [licenses, setLicenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [versions, setVersions] = useState([]);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [editingId, setEditingId] = useState(null);
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
    expireDate: null,
    customerId: "",
    licenseId: "",
  });

  const [searchParams] = useSearchParams();

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
    setEditingId(null);
    setForm({
      systemName: "",
      version: "",
      code1: "",
      code2: "",
      code3: "",
      expireDate: null,
      customerId: selectedCustomer,
    });
  };

  const saveLicense = async (e) => {
    e.preventDefault();
    
    // 1. اعتبارسنجی‌های اولیه
    if (!form.customerId) {
      setError("مشتری را انتخاب کنید");
      return;
    }
    
    // اگر در حالت ویرایش نیستیم، ظرفیت را چک کن
    if (!editingId && licenseInfo && licenseInfo.count >= licenseInfo.limit) {
      setError("ظرفیت لایسنس این مشتری پر شده");
      return;
    }

    try {
      setLoading(true);
      setError(""); // پاک کردن خطاهای قبلی
      
      // آماده‌سازی داده‌ها
      const payload = {
        ...form,
        expireDate: toGregorianDate(form.expireDate),
      };

      if (editingId) {
        // --- حالت ویرایش ---
        await api.put(`/licenses/${editingId}`, payload);
        setSuccess("لایسنس با موفقیت ویرایش شد");
      } else {
        // --- حالت ثبت جدید ---
        
        // مرحله اول: دریافت لایسنس از API خارجی
        const externalFormData = qs.stringify({
          key1: form.code1,
          key2: form.code2,
          key3: form.code3,
        });

        // استفاده از await برای صبر کردن پاسخ
        const res = await axios.post(
          "http://192.168.1.16:4000/activecode",
          externalFormData
        );

        // بررسی وضعیت پاسخ (axios معمولاً اگر کد خطا نباشد ریزولت می‌شود، اما چک کردن ok خوب است)
        if (!res.data || !res.data.Message) {
            throw new Error("پاسخ نامعتبر از سرور لایسنس");
        }

        const licenseIdFromServer = res.data.Message; // یا res.data.message بسته به ساختار API شما

        // مرحله دوم: ذخیره در دیتابیس خودمان
        const finalPayload = {
          ...payload,
          licenseId: licenseIdFromServer
        };

        await api.post("/licenses", finalPayload);
        
        setSuccess("لایسنس با موفقیت ثبت شد");
      }

      // ریست کردن فرم و لود مجدد لیست‌ها
      resetForm();
      await Promise.all([
        loadLicenses(selectedCustomer),
        loadLicenseInfo(selectedCustomer),
      ]);

    } catch (error) {
      console.error("Error saving license:", error);
      
      // اگر خطا از سمت API خارجی بوده باشد، پیام مناسب نمایش دهیم
      if (error.response && error.response.status === 400) {
          setError("کد لایسنس نامعتبر است یا منقضی شده");
      } else {
          setError("خطا در ذخیره لایسنس. لطفاً اتصال اینترنت یا صحت کدها را بررسی کنید.");
      }
    } finally {
      setLoading(false);
    }
  };
  const editLicense = (license) => {
    if (!canManageAll) {
      setError("فقط ادمین یا کاربر می‌تواند لایسنس را ویرایش کند");
      return;
    }
    setEditingId(license.id);
    setForm({
      systemName: license.systemName,
      version: license.version,
      code1: license.code1,
      code2: license.code2 || "",
      code3: license.code3 || "",
      expireDate: toJalaliDate(license.expireDate),
      customerId: String(license.customerId || selectedCustomer || ""),
    });
  };

  const deleteLicense = async (id) => {
    if (!canManageAll) {
      setError("فقط ادمین یا کاربر می‌تواند لایسنس را حذف کند");
      return;
    }
    if (!window.confirm("آیا این لایسنس حذف شود؟")) return;

    try {
      setLoading(true);
      await api.delete(`/licenses/${id}`);
      setSuccess("لایسنس حذف شد");
      await Promise.all([
        loadLicenses(selectedCustomer),
        loadLicenseInfo(selectedCustomer),
      ]);
    } catch {
      setError("خطا در حذف لایسنس");
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-1">
          <div className="panel-card p-5 xl:sticky xl:top-24">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              {editingId ? (
                <Edit2 size={18} className="text-amber-600" />
              ) : (
                <Save size={18} className="text-teal-700" />
              )}
              {editingId ? "ویرایش لایسنس" : "ثبت لایسنس جدید"}
            </h2>

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

              <div className="grid grid-cols-2 gap-2">
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
                <label className="panel-label">تاریخ انقضا</label>
                <div className="relative">
                  <JalaliDatePicker
                    value={form.expireDate}
                    onChange={(d) => setForm({ ...form, expireDate: d })}
                    inputClassName="panel-input"
                    className="w-full"
                  />
                  <Calendar
                    size={16}
                    className="absolute left-3 top-3 text-slate-400 pointer-events-none"
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
                ) : editingId ? (
                  <Edit2 size={16} />
                ) : (
                  <Save size={16} />
                )}
                {editingId ? "ذخیره تغییرات" : "ثبت لایسنس"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="panel-btn-secondary w-full"
                >
                  انصراف از ویرایش
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="xl:col-span-2 panel-card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="relative w-full md:w-80">
              <Search
                className="absolute right-3 top-3 text-slate-400"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجو بر اساس سیستم، مشتری یا کد"
                className="panel-input pr-9"
              />
            </div>
          </div>

          <div className="panel-table-wrap max-h-[65vh]">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>سیستم</th>
                  <th>نسخه</th>
                  <th>مشتری</th>
                  <th>کد اصلی</th>
                      <th>انقضا</th>
                      <th>عملیات</th>
                  <th>شناسه لایسنس</th>
                </tr>
              </thead>
              <tbody>
                {loading && licenses.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} />
                        در حال بارگذاری...
                      </span>
                    </td>
                  </tr>
                ) : filteredLicenses.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
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
                      <td className="whitespace-nowrap">
                        {license.expireDate
                          ? new Date(license.expireDate).toLocaleDateString(
                              "fa-IR",
                            )
                          : "-"}
                      </td>
                      <td className="whitespace-nowrap">
                        {canManageAll ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => editLicense(license)}
                              className="panel-btn-secondary py-1.5 px-3"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLicense(license.id)}
                              className="panel-btn-danger py-1.5 px-3"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">فقط ادمین/کاربر</span>
                        )}
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
    </div>
  );
}

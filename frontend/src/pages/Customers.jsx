import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Users,
  Calendar,
  Phone,
  Building,
  MapPin,
  Loader2,
  AlertCircle,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  Search,
  Edit2,
  KeyRound,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import moment from "jalali-moment";
import JalaliDatePicker from "../components/DatePicker"; // مسیر کامپوننت تقویم
import OverflowTooltip from "../components/OverflowTooltip";
import api from "../services/api";
import ExcelUploader from "../components/ExcelUploader";
import { getAuthUser } from "../utils/auth";

export default function Customers() {
  const navigate = useNavigate();
  const toGregorianDate = (jalaliOrDate) => {
    if (!jalaliOrDate) return null;
    const jalaliParsed = moment(jalaliOrDate, "jYYYY/jMM/jDD", true);
    if (jalaliParsed.isValid()) {
      return jalaliParsed.locale("en").format("YYYY-MM-DD");
    }
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
  const user = getAuthUser();
  const isAdmin = user?.role === "admin";
  const isAgent = user?.role === "agent";
  const canApproveRequests = user?.role === "admin" || user?.role === "user";
  const [customers, setCustomers] = useState([]);
  const [customerRequests, setCustomerRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // State برای جستجو
  const [editingCustomerId, setEditingCustomerId] = useState(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    company: "",
    address: "",
    supportStatus: "",
    note: "",
    licenseLimit: 1,
    contractStartDate: null,
    contractEndDate: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // بارگذاری لیست مشتریان
  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/customers");
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
      setError("خطا در دریافت لیست مشتریان.");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerRequests = async () => {
    if (!user) return;
    try {
      const res = await api.get("/customer-requests?status=pending");
      setCustomerRequests(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadCustomerRequests();
  }, []);

  // هندل کردن تغییرات فرم
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (success) setSuccess("");
  };

  // هندل کردن تغییر تاریخ
  const handleDateChange = (dateString) => {
    setForm({ ...form, contractEndDate: dateString });
  };

  const handleContractStartChange = (dateString) => {
    setForm({ ...form, contractStartDate: dateString });
  };

  const resetForm = () => {
    setEditingCustomerId(null);
    setForm({
      fullName: "",
      phone: "",
      company: "",
      address: "",
      supportStatus: "",
      note: "",
      licenseLimit: 1,
      contractStartDate: null,
      contractEndDate: null,
    });
  };

  const editCustomer = (customer) => {
    setEditingCustomerId(customer.id);
    setForm({
      fullName: customer.fullName || "",
      phone: customer.phone || "",
      company: customer.company || "",
      address: customer.address || "",
      supportStatus: customer.supportStatus || "",
      note: "",
      licenseLimit: customer.licenseLimit || 1,
      contractStartDate: toJalaliDate(customer.contractStartDate),
      contractEndDate: toJalaliDate(
        customer.contractEndDate || customer.expireDate,
      ),
    });
    if (error) setError("");
    if (success) setSuccess("");
  };

  // ذخیره/ویرایش مشتری
  const saveCustomer = async (e) => {
    e.preventDefault();
    if (isAgent) {
      if (!form.fullName || !form.phone) {
        setError("نام و شماره موبایل الزامی است.");
        return;
      }
    } else {
      if (!form.fullName || !form.phone) {
        setError("نام و شماره موبایل الزامی است.");
        return;
      }
      if (Number(form.licenseLimit) < 1) {
        setError("سقف لایسنس باید حداقل ۱ باشد.");
        return;
      }
    }

    try {
      setLoading(true);

      if (isAgent) {
        const payload = {
          fullName: form.fullName,
          phone: form.phone,
          company: form.company,
          address: form.address,
          note: form.note,
        };
        await api.post("/customer-requests", payload);
        setSuccess("درخواست مشتری ثبت شد و منتظر تایید ادمین/کاربر است.");
        resetForm();
        loadCustomerRequests();
        return;
      }

      const payload = {
        ...form,
        licenseLimit: Number(form.licenseLimit),
        contractStartDate: toGregorianDate(form.contractStartDate),
        contractEndDate: toGregorianDate(form.contractEndDate),
        expireDate: toGregorianDate(form.contractEndDate),
      };
      delete payload.note;

      if (!isAdmin) delete payload.supportStatus;

      if (editingCustomerId) {
        await api.put(`/customers/${editingCustomerId}`, payload);
        setSuccess("اطلاعات مشتری با موفقیت ویرایش شد.");
      } else {
        await api.post("/customers", payload);
        setSuccess("مشتری با موفقیت اضافه شد.");
      }

      resetForm();
      loadCustomers();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "خطا در ذخیره مشتری.");
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId) => {
    try {
      setLoading(true);
      setError("");
      await api.put(`/customer-requests/${requestId}/approve`);
      setSuccess("درخواست تایید شد و مشتری ساخته شد.");
      await Promise.all([loadCustomers(), loadCustomerRequests()]);
    } catch (err) {
      setError(err?.response?.data?.message || "خطا در تایید درخواست.");
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      setLoading(true);
      setError("");
      await api.put(`/customer-requests/${requestId}/reject`);
      setSuccess("درخواست رد شد.");
      await loadCustomerRequests();
    } catch (err) {
      setError(err?.response?.data?.message || "خطا در رد کردن درخواست.");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (customer) => {
    try {
      await api.put(`/customers/${customer.id}`, {
        isActive: !customer.isActive,
      });
      setSuccess("وضعیت مشتری تغییر کرد.");
      loadCustomers();
    } catch (err) {
      setError("خطا در تغییر وضعیت.");
    }
  };

  const deleteCustomer = async (id) => {
    if (!isAdmin) {
      setError("فقط ادمین می تونه کاربر رو حذف کنه");
      return;
    }
    if (!window.confirm("آیا از حذف این مشتری اطمینان دارید؟")) return;
    try {
      setLoading(true);
      await api.delete(`/customers/${id}`);
      setSuccess("مشتری حذف شد.");
      loadCustomers();
    } catch (err) {
      setError("خطا در حذف مشتری.");
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (expireDate, directDaysRemaining = null) => {
    if (typeof directDaysRemaining === "number") {
      if (directDaysRemaining < 0)
        return {
          text: "منقضی شده",
          color: "text-red-600 bg-red-100 border-red-200",
        };
      if (directDaysRemaining === 0)
        return {
          text: "امروز",
          color: "text-orange-600 bg-orange-100 border-orange-200",
        };
      return {
        text: `${directDaysRemaining} روز`,
        color: "text-green-700 bg-green-100 border-green-200",
      };
    }
    if (!expireDate) return { text: "-", color: "text-gray-500 bg-gray-100" };
    // Avoid Date parsing of "YYYY-MM-DD" (UTC) which can shift a day in some timezones.
    const parsed = moment(expireDate, "YYYY-MM-DD", true);
    const end = parsed.isValid() ? parsed : moment(expireDate);
    if (!end.isValid()) return { text: "-", color: "text-gray-500 bg-gray-100" };
    const diffDays = end.startOf("day").diff(moment().startOf("day"), "days");

    if (diffDays < 0)
      return {
        text: "منقضی شده",
        color: "text-red-600 bg-red-100 border-red-200",
      };
    if (diffDays === 0)
      return {
        text: "امروز",
        color: "text-orange-600 bg-orange-100 border-orange-200",
      };
    return {
      text: `${diffDays} روز`,
      color: "text-green-700 bg-green-100 border-green-200",
    };
  };

  // فیلتر کردن مشتریان بر اساس جستجو
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const lowerTerm = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(lowerTerm) ||
        c.phone?.toLowerCase().includes(lowerTerm) ||
        c.company?.toLowerCase().includes(lowerTerm) ||
        c.username?.toLowerCase().includes(lowerTerm),
    );
  }, [customers, searchTerm]);
  const databaseFields = [
    "phone",
    "fullName",
    "company",
    "supportStatus",
    "address",
    "licenseLimit",
  ];

  const [uploadSuccessMessage, setUploadSuccessMessage] = useState("");

  // این تابع مسئول ارسال داده‌های پردازش شده به بک‌اند شماست.
  const handleDataToBackend = async (processedData) => {
    console.log("Data to send to backend:", processedData);
    const response = await api.post("/customers/upload-customers", processedData);
    setUploadSuccessMessage("داده‌ها با موفقیت به پایگاه داده ارسال شدند.");
    return response.data;
  };
  const [showModal, setShowModal] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (editingCustomerId) setFormOpen(true);
  }, [editingCustomerId]);

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEditForm = (customer) => {
    editCustomer(customer);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };
  return (
    <div className="space-y-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* هدر صفحه */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Users className="text-teal-700" size={32} />
              مدیریت مشتریان
            </h1>
            <p className="text-gray-500 mt-1">
              مشاهده و افزودن اطلاعات مشتریان
            </p>
          </div>

          {/* پیام‌های وضعیت */}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 shadow-sm">
              <CheckCircle size={20} />
              <span className="font-bold">عملیات موفق:</span> {success}
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 shadow-sm">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
        </div>

        {showModal && isAdmin && (
          <ExcelUploader
            dbFields={databaseFields}
            onDataUpload={handleDataToBackend}
            onClose={() => setShowModal(false)}
          />
        )}

        {uploadSuccessMessage && (
          <div className="panel-alert-success mb-6">{uploadSuccessMessage}</div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Plus size={18} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {isAgent ? "ثبت درخواست مشتری" : editingCustomerId ? "ویرایش مشتری" : "افزودن مشتری"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isAgent
                    ? "درخواست را ثبت کنید تا پس از تایید، مشتری ساخته شود."
                    : "نام کاربری و رمز عبور مشتری از روی شماره موبایل ساخته می‌شود."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (editingCustomerId) {
                    closeForm();
                    return;
                  }

                  if (formOpen) {
                    closeForm();
                    return;
                  }

                  openCreateForm();
                }}
                className="panel-btn-primary"
                disabled={loading}
              >
                <Plus size={18} />
                {editingCustomerId
                  ? "بستن ویرایش"
                  : formOpen
                    ? "بستن فرم"
                    : isAgent
                      ? "ثبت درخواست جدید"
                      : "افزودن مشتری"}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="panel-btn-secondary"
                  disabled={loading}
                >
                  <FileSpreadsheet size={18} />
                  بارگذاری از اکسل
                </button>
              )}
            </div>
          </div>

          {formOpen && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <form onSubmit={saveCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نام و نام خانوادگی *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      placeholder="مثال: علی احمدی"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                      <Users size={18} />
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    شماره موبایل *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      placeholder="مثال: 09123456789"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                      <Phone size={18} />
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نام شرکت / سازمان
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="company"
                      value={form.company}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      placeholder="مثال: شرکت تکنولوژی"
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                      <Building size={18} />
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    آدرس
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      placeholder="آدرس دفتر"
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                      <MapPin size={18} />
                    </span>
                  </div>
                </div>

                {isAgent && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      توضیحات (اختیاری)
                    </label>
                    <textarea
                      name="note"
                      value={form.note}
                      onChange={handleChange}
                      className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      placeholder="توضیحات تکمیلی برای ادمین/کاربر"
                      rows={3}
                    />
                  </div>
                )}


                {!isAgent && (
                  <>
                    <div className="md:col-span-2">
                      <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                        نام کاربری و رمز عبور مشتری به صورت خودکار از روی شماره موبایل ساخته می‌شود.
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        سقف لایسنس
                      </label>
                      <input
                        type="number"
                        min="1"
                        name="licenseLimit"
                        value={form.licenseLimit}
                        onChange={handleChange}
                        className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        تاریخ شروع قرارداد
                      </label>
                      <div className="relative">
                        <JalaliDatePicker
                          value={form.contractStartDate}
                          onChange={handleContractStartChange}
                          placeholder="انتخاب تاریخ"
                          className="w-full"
                          inputClassName="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-right"
                          format="jYYYY/jMM/jDD"
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                          <Calendar size={18} />
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        تاریخ پایان قرارداد
                      </label>
                      <div className="relative">
                        <JalaliDatePicker
                          value={form.contractEndDate}
                          onChange={handleDateChange}
                          placeholder="انتخاب تاریخ"
                          className="w-full"
                          inputClassName="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-right"
                          format="jYYYY/jMM/jDD"
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                          <Calendar size={18} />
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <div className="md:col-span-2 pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        در حال پردازش...
                      </>
                    ) : (
                      <>
                        {editingCustomerId ? <Edit2 size={20} /> : <Plus size={20} />}
                        {isAgent ? "ثبت درخواست" : editingCustomerId ? "ذخیره تغییرات" : "افزودن مشتری"}
                      </>
                    )}
                  </button>

                  {editingCustomerId && (
                    <button
                      type="button"
                      onClick={closeForm}
                      className="w-full border border-gray-300 text-gray-700 font-bold py-2.5 px-4 rounded-lg transition-colors duration-200 hover:bg-gray-50"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        {canApproveRequests && customerRequests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              درخواست های در انتظار تایید
            </h2>
            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead className="!static">
                  <tr>
                    <th>نام</th>
                    <th>موبایل</th>
                    <th>شرکت</th>
                    <th>آدرس</th>
                    <th>ثبت کننده</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRequests.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold text-slate-900">{r.fullName}</td>
                      <td dir="ltr" className="font-mono">{r.phone}</td>
                      <td>{r.company || "-"}</td>
                      <td>
                        <OverflowTooltip text={r.address || "-"} className="max-w-[180px]" />
                      </td>
                      <td>{r.requesterUser?.fullName || r.requesterUser?.username || "-"}</td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => approveRequest(r.id)}
                            className="panel-btn-primary py-1.5 px-3"
                            disabled={loading}
                          >
                            تایید
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectRequest(r.id)}
                            className="panel-btn-danger py-1.5 px-3"
                            disabled={loading}
                          >
                            رد
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* جدول لیست مشتریان */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Users className="text-teal-700" size={20} />
                  لیست مشتریان
                </h2>

                {/* بخش جستجو */}
                <div className="relative w-full md:w-64">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    placeholder="جستجو (نام، موبایل، شرکت)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {loading && customers.length === 0 ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="animate-spin text-teal-700" size={40} />
                </div>
              ) : (
                <div className="panel-table-wrap">
                  <table className="panel-table">
                    <thead>
                      <tr>
                        <th className="px-6 py-4 font-semibold">نام مشتری</th>
                        <th className="px-6 py-4 font-semibold">شرکت</th>
                        <th className="px-6 py-4 font-semibold">موبایل</th>
                        <th className="px-6 py-4 font-semibold">سقف لایسنس</th>
                        <th className="px-6 py-4 font-semibold">
                          شروع قرارداد
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          مبلغ قرارداد
                        </th>
                        <th className="px-6 py-4 font-semibold">وضعیت انقضا</th>
                        <th className="px-6 py-4 font-semibold">وضعیت</th>
                        <th className="px-6 py-4 font-semibold text-center sticky left-0 z-20 bg-slate-100/95">
                          عملیات
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td
                            colSpan="9"
                            className="text-center py-8 text-gray-500"
                          >
                            {customers.length === 0
                              ? "مشتری یافت نشد. برای افزودن از بخش بالای صفحه استفاده کنید."
                              : "نتیجه‌ای برای جستجوی شما یافت نشد."}
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((customer) => {
                          const daysInfo = getDaysRemaining(
                            customer.latestContractEndDate ||
                              customer.contractEndDate ||
                              customer.expireDate,
                            customer.latestContractDaysRemaining,
                          );
                          return (
                            <tr key={customer.id}>
                              <td className="min-w-[220px]">
                                <div className="font-medium text-slate-800">
                                  <OverflowTooltip
                                    text={customer.fullName}
                                    className="max-w-[180px]"
                                  />
                                </div>
                                <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                  <OverflowTooltip
                                    text={customer.address || "بدون آدرس"}
                                    className="max-w-[140px]"
                                  />
                                  <span className="whitespace-nowrap">
                                    قراردادها: {customer.contractsCount || 0}
                                  </span>
                                </div>
                              </td>
                              <td className="min-w-[150px] text-slate-700">
                                <OverflowTooltip
                                  text={customer.company || "-"}
                                  className="max-w-[130px]"
                                />
                              </td>
                              <td
                                className="whitespace-nowrap text-slate-700 font-mono"
                                dir="ltr"
                              >
                                {customer.phone}
                              </td>
                              <td className="whitespace-nowrap text-slate-700">
                                {customer.licenseLimit || 0}
                              </td>
                              <td className="whitespace-nowrap text-slate-700">
                                {customer.latestContractStartDate
                                  ? new Date(
                                      customer.latestContractStartDate,
                                    ).toLocaleDateString("fa-IR")
                                  : customer.contractStartDate
                                    ? new Date(
                                        customer.contractStartDate,
                                      ).toLocaleDateString("fa-IR")
                                    : "-"}
                              </td>
                              <td className="whitespace-nowrap text-slate-700">
                                {customer.latestContractAmount
                                  ? `${Number(customer.latestContractAmount).toLocaleString("fa-IR")} تومان`
                                  : "-"}
                              </td>
                              <td className="whitespace-nowrap">
                                <span
                                  className={`inline-flex whitespace-nowrap px-2 py-1 rounded-full text-xs font-medium border ${daysInfo.color}`}
                                >
                                  {daysInfo.text}
                                </span>
                              </td>
                              <td className="whitespace-nowrap">
                                {isAdmin ? (
                                  <button
                                    onClick={() => toggleStatus(customer)}
                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium ${
                                      customer.isActive
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {customer.isActive ? (
                                      <>
                                        <ToggleRight size={18} /> فعال
                                      </>
                                    ) : (
                                      <>
                                        <ToggleLeft size={18} /> غیرفعال
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium ${
                                      customer.isActive
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {customer.isActive ? "فعال" : "غیرفعال"}
                                  </span>
                                )}
                              </td>
                              <td className="whitespace-nowrap text-center sticky left-0 z-10 bg-white shadow-[-10px_0_18px_-18px_rgba(15,23,42,0.35)]">
                                <div className="inline-flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      navigate(`/licenses?customerId=${customer.id}`)
                                    }
                                    className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-2 rounded-lg transition-colors"
                                    title="مشاهده لایسنس‌های مشتری"
                                  >
                                    <KeyRound size={18} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      navigate(`/contracts?customerId=${customer.id}`)
                                    }
                                    className="text-violet-600 hover:text-violet-800 hover:bg-violet-50 p-2 rounded-lg transition-colors"
                                    title="مشاهده قراردادهای مشتری"
                                  >
                                    <FileText size={18} />
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => openEditForm(customer)}
                                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                      title="ویرایش مشتری"
                                    >
                                      <Edit2 size={18} />
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() => deleteCustomer(customer.id)}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                      title="حذف مشتری"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        }) 
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
      </div>
    </div>
  );
}

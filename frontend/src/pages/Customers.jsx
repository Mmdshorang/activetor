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
  Lock,
  User,
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
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // State برای جستجو
  const [editingCustomerId, setEditingCustomerId] = useState(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    company: "",
    address: "",
    username: "",
    password: "",
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

  useEffect(() => {
    loadCustomers();
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
      username: "",
      password: "",
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
      username: customer.username || "",
      password: "",
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
    if (!form.fullName || !form.phone || !form.username) {
      setError("نام، شماره موبایل و نام کاربری الزامی است.");
      return;
    }
    if (!editingCustomerId && !form.password) {
      setError("رمز عبور برای مشتری جدید الزامی است.");
      return;
    }
    if (Number(form.licenseLimit) < 1) {
      setError("سقف لایسنس باید حداقل ۱ باشد.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...form,
        licenseLimit: Number(form.licenseLimit),
        contractStartDate: toGregorianDate(form.contractStartDate),
        contractEndDate: toGregorianDate(form.contractEndDate),
        expireDate: toGregorianDate(form.contractEndDate),
      };

      if (!payload.password) {
        delete payload.password;
      }

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
    if(user.role !="admin"){
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
    const expire = new Date(expireDate);
    const today = new Date();
    expire.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = expire - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
    "username", // مثال: اگر نام کاربری و رمز عبور شماره موبایل است، ممکن است فیلد جداگانه ای هم نیاز باشد
    "password",
  ];

  const [uploadSuccessMessage, setUploadSuccessMessage] = useState("");

  // این تابع مسئول ارسال داده‌های پردازش شده به بک‌اند شماست.
  const handleDataToBackend = async (processedData) => {
    console.log("Data to send to backend:", processedData);
    // اینجا باید منطق فراخوانی API بک‌اند شما پیاده‌سازی شود.
    // مثال:

    const response = await api.post(
      "/customers/upload-customers",
      processedData,
    );
    if (!response.ok) {
      throw new Error("Failed to upload data");
    }
    const result = await response.json();
    return result;

    // برای نمایش، فقط یک Promise موفق را برمی‌گردانیم
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log("Data successfully processed by backend (simulated)");
        setUploadSuccessMessage("داده‌ها با موفقیت به پایگاه داده ارسال شدند.");
        resolve({ message: "Data received" });
      }, 1500);
    });
  };
  const [showModal, setShowModal] = useState(false);
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
        <div className="App">
          <h1>بارگذاری اطلاعات مشتریان</h1>
          {showModal && user.role =='admin' &&(
            <ExcelUploader
              dbFields={databaseFields}
              onDataUpload={handleDataToBackend}
              onClose={() => setShowModal(false)}
            />
          )}
          {uploadSuccessMessage && (
            <p
              style={{ color: "green", marginTop: "20px", textAlign: "center" }}
            >
              {uploadSuccessMessage}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* فرم افزودن مشتری */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sticky top-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
              <div className="w-full flex items-center justify-center gap-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Plus className="text-teal-700" size={20} />
                  افزودن مشتری جدید
                </h2>
               {user.role =='admin' &&<button
                  onClick={() => setShowModal(true)}
                  className=" bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <FileSpreadsheet size={20} />
                  <span>بارگذاری از اکسل</span>
                </button>}
              </div>
              <form onSubmit={saveCustomer} className="space-y-4">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نام کاربری مشتری *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      placeholder="مثال: customer01"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                      <User size={18} />
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    رمز عبور {editingCustomerId ? "(اختیاری برای تغییر)" : "*"}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      placeholder={
                        editingCustomerId
                          ? "برای تغییر رمز وارد کنید"
                          : "رمز عبور"
                      }
                      required={!editingCustomerId}
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                      <Lock size={18} />
                    </span>
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

                <div>
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

                <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm pt-3 pb-1 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        در حال پردازش...
                      </>
                    ) : (
                      <>
                        {editingCustomerId ? (
                          <Edit2 size={20} />
                        ) : (
                          <Plus size={20} />
                        )}
                        {editingCustomerId ? "ذخیره تغییرات" : "افزودن مشتری"}
                      </>
                    )}
                  </button>
                  {editingCustomerId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="w-full mt-2 border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg transition-colors duration-200 hover:bg-gray-50"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* جدول لیست مشتریان */}
          <div className="lg:col-span-2">
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
                <div className="panel-table-wrap max-h-[62vh]">
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
                        <th className="px-6 py-4 font-semibold text-center">
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
                              ? "مشتری یافت نشد. برای افزودن از فرم سمت راست استفاده کنید."
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
                              </td>
                              <td className="whitespace-nowrap text-center">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/licenses?customerId=${customer.id}`,
                                    )
                                  }
                                  className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-2 rounded-lg transition-colors ml-2"
                                  title="مشاهده لایسنس‌های مشتری"
                                >
                                  <KeyRound size={18} />
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/contracts?customerId=${customer.id}`,
                                    )
                                  }
                                  className="text-violet-600 hover:text-violet-800 hover:bg-violet-50 p-2 rounded-lg transition-colors ml-2"
                                  title="مشاهده قراردادهای مشتری"
                                >
                                  <FileText size={18} />
                                </button>
                                <button
                                  onClick={() => editCustomer(customer)}
                                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors ml-2"
                                  title="ویرایش مشتری"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => deleteCustomer(customer.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                  title="حذف مشتری"
                             
                                >
                                  <Trash2 size={18} />
                                </button>
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
      </div>
    </div>
  );
}

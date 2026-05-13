import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import moment from "jalali-moment";
import {
  CalendarDays,
  Edit2,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import JalaliDatePicker from "../components/DatePicker";
import api from "../services/api";
import { getAuthUser } from "../utils/auth";
import SearchableSelect from "../components/SearchableSelect";
import OverflowTooltip from "../components/OverflowTooltip";

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
  return parsed.isValid() ? parsed.locale("fa").format("jYYYY/jMM/jDD") : null;
};

const formatAmount = (value) =>
  `${Number(value || 0).toLocaleString("fa-IR")} تومان`;

export default function Contracts() {
  const [searchParams] = useSearchParams();
  const [authUser, setAuthUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    title: "",
    customerId: "",
    amount: "",
    startDate: null,
    endDate: null,
    status: "active",
    description: "",
  });

  const role = authUser?.role;
  const isCustomer = role === "customer";
  const canCreateContract = role === "admin" || role === "user";

  const loadCustomers = async (userRole = authUser?.role) => {
    if (userRole === "customer") return;
    const res = await api.get("/contracts/customers/options");
    setCustomers(res.data || []);
  };

  const loadContracts = async (customerId = "") => {
    setLoading(true);
    try {
      const query = customerId ? `?customerId=${customerId}` : "";
      const res = await api.get(`/contracts${query}`);
      setContracts(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "خطا در دریافت قراردادها");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const user = getAuthUser();
      setAuthUser(user);
      await loadCustomers(user?.role);

      const customerIdFromQuery = searchParams.get("customerId") || "";
      if (customerIdFromQuery && user?.role !== "customer") {
        setSelectedCustomer(customerIdFromQuery);
        setForm((prev) => ({ ...prev, customerId: customerIdFromQuery }));
        await loadContracts(customerIdFromQuery);
      } else {
        await loadContracts();
      }
    };

    bootstrap();
  }, []);

  const onCustomerChange = async (value) => {
    setSelectedCustomer(value);
    setForm((prev) => ({ ...prev, customerId: value }));
    await loadContracts(value);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: "",
      customerId: selectedCustomer || "",
      amount: "",
      startDate: null,
      endDate: null,
      status: "active",
      description: "",
    });
  };

  const editContract = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      customerId: String(item.customerId || ""),
      amount: item.amount || "",
      startDate: toJalaliDate(item.startDate),
      endDate: toJalaliDate(item.endDate),
      status: item.status || "active",
      description: item.description || "",
    });
    setSuccess("");
    setError("");
  };

  const saveContract = async (e) => {
    e.preventDefault();
    if (
      !form.title ||
      !form.amount ||
      !form.startDate ||
      !form.endDate ||
      !form.customerId
    ) {
      setError("عنوان، مشتری، مبلغ و تاریخ ها الزامی است.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        amount: Number(form.amount),
        startDate: toGregorianDate(form.startDate),
        endDate: toGregorianDate(form.endDate),
        customerId: Number(form.customerId),
      };

      if (editingId) {
        await api.put(`/contracts/${editingId}`, payload);
        setSuccess("قرارداد با موفقیت ویرایش شد.");
      } else {
        await api.post("/contracts", payload);
        setSuccess("قرارداد جدید ثبت شد.");
      }

      resetForm();
      await loadContracts(selectedCustomer);
    } catch (err) {
      setError(err?.response?.data?.message || "خطا در ثبت قرارداد");
    } finally {
      setSaving(false);
    }
  };

  const deleteContract = async (id) => {
    if (!window.confirm("آیا از حذف قرارداد مطمئن هستید؟")) return;
    try {
      await api.delete(`/contracts/${id}`);
      setSuccess("قرارداد حذف شد.");
      await loadContracts(selectedCustomer);
    } catch (err) {
      setError(err?.response?.data?.message || "خطا در حذف قرارداد");
    }
  };

  const filteredContracts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return contracts;

    return contracts.filter((item) => {
      const title = item.title?.toLowerCase() || "";
      const customer = item.customer?.fullName?.toLowerCase() || "";
      const creator = item.creator?.fullName?.toLowerCase() || "";
      return (
        title.includes(term) ||
        customer.includes(term) ||
        creator.includes(term)
      );
    });
  }, [contracts, searchTerm]);

  const summary = useMemo(() => {
    const totalAmount = contracts.reduce(
      (acc, item) => acc + Number(item.amount || 0),
      0,
    );
    const activeCount = contracts.filter(
      (item) => item.status === "active",
    ).length;
    const expiringSoon = contracts.filter(
      (item) =>
        typeof item.daysRemaining === "number" &&
        item.daysRemaining >= 0 &&
        item.daysRemaining <= 30,
    ).length;
    return { totalAmount, activeCount, expiringSoon };
  }, [contracts]);

  const customerOptions = useMemo(
    () =>
      customers.map((item) => ({
        value: String(item.id),
        label: item.fullName
          ? `${item.fullName}${item.company ? ` - ${item.company}` : ""}`
          : `#${item.id}`,
      })),
    [customers],
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="panel-card-soft p-6 md:p-7">
        <h1 className="panel-title flex items-center gap-3">
          <FileText className="text-teal-700" size={30} />
          مدیریت قراردادها
        </h1>
        <p className="panel-subtitle">
          ثبت قرارداد جدید، مشاهده سوابق و مدیریت انقضا
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel-card p-4">
          <p className="text-xs text-slate-500">کل مبلغ قراردادها</p>
          <p className="text-xl font-extrabold text-slate-900 mt-2">
            {formatAmount(summary.totalAmount)}
          </p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs text-slate-500">قراردادهای فعال</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-2">
            {summary.activeCount}
          </p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs text-slate-500">در آستانه پایان (30 روز)</p>
          <p className="text-xl font-extrabold text-amber-700 mt-2">
            {summary.expiringSoon}
          </p>
        </div>
      </div>

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

      <div
        className={`grid grid-cols-1 ${canCreateContract ? "xl:grid-cols-3" : ""} gap-5`}
      >
        {canCreateContract && (
          <div className="xl:col-span-1">
            <div className="panel-card p-5 xl:sticky xl:top-24">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                {editingId ? (
                  <Edit2 size={18} className="text-amber-600" />
                ) : (
                  <Plus size={18} className="text-teal-700" />
                )}
                {editingId ? "ویرایش قرارداد" : "ثبت قرارداد جدید"}
              </h2>

              <form className="space-y-3" onSubmit={saveContract}>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="عنوان قرارداد"
                  className="panel-input"
                />

                {!isCustomer && (
                  <SearchableSelect
                    value={form.customerId}
                    onChange={(value) =>
                      setForm({ ...form, customerId: value })
                    }
                    options={customerOptions}
                    placeholder="انتخاب مشتری"
                  />
                )}

                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="مبلغ قرارداد (تومان)"
                  className="panel-input"
                />

                <JalaliDatePicker
                  value={form.startDate}
                  onChange={(value) => setForm({ ...form, startDate: value })}
                  placeholder="تاریخ شروع"
                  inputClassName="panel-input"
                  className="w-full"
                />

                <JalaliDatePicker
                  value={form.endDate}
                  onChange={(value) => setForm({ ...form, endDate: value })}
                  placeholder="تاریخ پایان"
                  inputClassName="panel-input"
                  className="w-full"
                />

                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="panel-select"
                >
                  <option value="active">فعال</option>
                  <option value="expired">منقضی</option>
                  <option value="cancelled">لغو شده</option>
                </select>

                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="توضیحات قرارداد"
                  className="panel-textarea"
                />

                <button
                  type="submit"
                  disabled={saving}
                  className="panel-btn-primary w-full"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CalendarDays size={16} />
                  )}
                  {editingId ? "ذخیره تغییرات" : "ثبت قرارداد"}
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
        )}

        <div className={canCreateContract ? "xl:col-span-2" : ""}>
          <div className="panel-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              {!isCustomer && (
                <div className="w-full md:w-72">
                  <SearchableSelect
                    value={selectedCustomer}
                    onChange={onCustomerChange}
                    options={customerOptions}
                    placeholder="همه مشتریان"
                  />
                </div>
              )}

              <div className="relative w-full md:w-72">
                <Search
                  className="absolute right-3 top-3 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="جستجو قرارداد"
                  className="panel-input pr-9"
                />
              </div>
            </div>

            <div className="panel-table-wrap max-h-[65vh]">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>عنوان</th>
                    <th>مشتری</th>
                    <th>مبلغ</th>
                    <th>مانده</th>
                    <th>ثبت کننده</th>
                    {canCreateContract && <th>عملیات</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={canCreateContract ? "6" : "5"}
                        className="py-10 text-center text-slate-500"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="animate-spin" size={16} />
                          در حال بارگذاری...
                        </span>
                      </td>
                    </tr>
                  ) : filteredContracts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canCreateContract ? "6" : "5"}
                        className="py-10 text-center text-slate-500"
                      >
                        قراردادی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredContracts.map((item) => (
                      <tr key={item.id}>
                        <td className="min-w-[190px]">
                          <p className="font-semibold text-slate-900">
                            <OverflowTooltip
                              text={item.title}
                              className="max-w-[180px]"
                            />
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {item.startDate
                              ? new Date(item.startDate).toLocaleDateString(
                                  "fa-IR",
                                )
                              : ""}
                            {item.endDate
                              ? " تا " +
                                new Date(item.endDate).toLocaleDateString(
                                  "fa-IR",
                                )
                              : ""}
                          </p>
                        </td>
                        <td className="min-w-[170px]">
                          <OverflowTooltip
                            text={item.customer?.fullName || "-"}
                            className="max-w-[160px]"
                          />
                        </td>
                        <td className="whitespace-nowrap">
                          {formatAmount(item.amount)}
                        </td>
                        <td className="whitespace-nowrap">
                          <span
                            className={`inline-flex whitespace-nowrap px-2 py-1 rounded-full text-xs font-medium ${
                              item.daysRemaining < 0
                                ? "bg-rose-100 text-rose-700"
                                : item.daysRemaining <= 30
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {item.daysRemaining < 0
                              ? "منقضی"
                              : `${item.daysRemaining} روز`}
                          </span>
                        </td>
                        <td className="min-w-[150px]">
                          <OverflowTooltip
                            text={
                              item.creator?.fullName ||
                              item.creator?.username ||
                              "-"
                            }
                            className="max-w-[140px]"
                          />
                        </td>
                        {canCreateContract && (
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => editContract(item)}
                                className="panel-btn-secondary py-1.5 px-3"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteContract(item.id)}
                                className="panel-btn-danger py-1.5 px-3"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

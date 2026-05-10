import React, { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, Edit2, Save, X, Loader2, AlertCircle, Search, Phone, UserCircle2, Shield } from "lucide-react";
import api from "../services/api";

export default function UsersM() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    phone: "",
    role: "user",
  });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setUsers(res.data);
    } catch {
      setError("خطا در دریافت لیست کاربران.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (success) setSuccess("");
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (!form.username || (!editId && !form.password)) {
      setError("نام کاربری و رمز عبور الزامی است.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (editId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editId}`, payload);
        setSuccess("کاربر با موفقیت ویرایش شد.");
      } else {
        await api.post("/users", form);
        setSuccess("کاربر جدید با موفقیت اضافه شد.");
      }

      setForm({ fullName: "", username: "", password: "", phone: "", role: "user" });
      setEditId(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "خطا در ذخیره سازی.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (user) => {
    setForm({
      fullName: user.fullName || "",
      username: user.username || "",
      password: "",
      phone: user.phone || "",
      role: user.role || "user",
    });
    setEditId(user.id);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setForm({ fullName: "", username: "", password: "", phone: "", role: "user" });
    setEditId(null);
    setError("");
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => {
      const fullName = item.fullName?.toLowerCase() || "";
      const username = item.username?.toLowerCase() || "";
      const phone = item.phone?.toLowerCase() || "";
      return fullName.includes(term) || username.includes(term) || phone.includes(term);
    });
  }, [users, searchTerm]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="panel-card-soft p-6 md:p-7">
        <h1 className="panel-title flex items-center gap-3">
          <Users className="text-teal-700" size={30} />
          مدیریت کاربران
        </h1>
        <p className="panel-subtitle">افزودن، ویرایش و مدیریت نقش کاربران سامانه</p>
      </div>

      {success && <div className="panel-alert-success">{success}</div>}
      {error && <div className="panel-alert-error flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-1">
          <div className="panel-card p-5 xl:sticky xl:top-24">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              {editId ? <Edit2 className="text-amber-600" size={18} /> : <UserPlus className="text-teal-700" size={18} />}
              {editId ? "ویرایش کاربر" : "افزودن کاربر جدید"}
            </h2>

            <form onSubmit={saveUser} className="space-y-3">
              <div>
                <label className="panel-label">نام کامل</label>
                <div className="relative">
                  <UserCircle2 size={16} className="absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className="panel-input pr-9"
                    placeholder="نام و نام خانوادگی"
                  />
                </div>
              </div>

              <div>
                <label className="panel-label">نام کاربری *</label>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  className="panel-input"
                  placeholder="مثال: admin"
                  required
                />
              </div>

              <div>
                <label className="panel-label">رمز عبور {editId && "(اختیاری)"} *</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="panel-input"
                  placeholder={editId ? "برای تغییر وارد کنید" : "رمز عبور"}
                  required={!editId}
                />
              </div>

              <div>
                <label className="panel-label">شماره تماس</label>
                <div className="relative">
                  <Phone size={16} className="absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="panel-input pr-9"
                    placeholder="0912..."
                  />
                </div>
              </div>

              <div>
                <label className="panel-label">نقش کاربر</label>
                <div className="relative">
                  <Shield size={16} className="absolute right-3 top-3 text-slate-400" />
                  <select name="role" value={form.role} onChange={handleChange} className="panel-select pr-9">
                    <option value="user">کاربر</option>
                    <option value="agent">نماینده</option>
                    <option value="admin">ادمین</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="submit" disabled={loading} className="panel-btn-primary flex-1">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editId ? "ذخیره تغییرات" : "افزودن"}
                </button>
                {editId && (
                  <button type="button" onClick={cancelEdit} className="panel-btn-secondary px-3">
                    <X size={18} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="xl:col-span-2 panel-card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="relative w-full md:w-80">
              <Search className="absolute right-3 top-3 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجو براساس نام، نام کاربری یا تلفن"
                className="panel-input pr-9"
              />
            </div>
          </div>

          <div className="panel-table-wrap max-h-[65vh]">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>نام کاربر</th>
                  <th>نام کاربری</th>
                  <th>نقش</th>
                  <th>تلفن</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin text-teal-700" size={16} />
                        در حال بارگذاری...
                      </span>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      نتیجه ای یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="font-semibold text-slate-900">{user.fullName || "-"}</td>
                      <td className="text-slate-700">{user.username}</td>
                      <td>
                        <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
                          {user.role === "agent" ? "نماینده" : user.role === "admin" ? "ادمین" : "کاربر"}
                        </span>
                      </td>
                      <td className="text-slate-700" dir="ltr">
                        {user.phone || "-"}
                      </td>
                      <td>
                        <button onClick={() => startEdit(user)} className="panel-btn-secondary py-1.5 px-3">
                          <Edit2 size={14} />
                          ویرایش
                        </button>
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

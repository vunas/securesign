"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showToast } from "@/lib/swal";

interface TenantUser {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function TeamPage() {
  const router = useRouter();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
  });

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchAPI<TenantUser[]>("/api/tenant/users/"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải nhân sự.");
    }
  }, []);

  useEffect(() => {
    if (!getCurrentUsername()) {
      router.replace("/login");
      return;
    }
    if (localStorage.getItem("role") !== "TENANT_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    void Promise.resolve().then(loadUsers);
  }, [loadUsers, router]);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetchAPI("/api/tenant/users/", "POST", form);
      setForm({ username: "", full_name: "", email: "", password: "" });
      showToast("Đã tạo tài khoản nhân viên", "success");
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  const setActive = async (user: TenantUser) => {
    try {
      await fetchAPI(`/api/tenant/users/${user.id}`, "PATCH", {
        is_active: !user.is_active,
      });
      showToast(user.is_active ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản", "success");
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật tài khoản.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl grow px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-slate-900">Quản lý nhân sự</h1>
        <p className="mt-2 text-slate-600">
          Tạo tài khoản Operator và khóa hoặc mở khóa quyền đăng nhập.
        </p>

        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}

        <form onSubmit={createUser} className="mt-6 grid gap-4 rounded-xl bg-white p-5 shadow md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Tên đăng nhập
            <input
              required minLength={3} maxLength={50}
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Họ tên
            <input
              required minLength={2} maxLength={100}
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              required type="email" maxLength={100}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Mật khẩu ban đầu
            <input
              required type="password" minLength={12} maxLength={72}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            disabled={loading}
            className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50 md:col-span-2"
          >
            {loading ? "Đang tạo..." : "Tạo Operator"}
          </button>
        </form>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Tài khoản trong tổ chức</h2>
          {users.map((user) => (
            <article key={user.id} className="flex flex-col justify-between gap-3 rounded-xl bg-white p-4 shadow sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold text-slate-900">{user.full_name || user.username}</p>
                <p className="text-sm text-slate-600">
                  {user.username} · {user.email || "Chưa có email"} · {user.role}
                </p>
                <p className={`text-xs ${user.is_active ? "text-emerald-700" : "text-red-700"}`}>
                  {user.is_active ? "Đang hoạt động" : "Đã khóa"}
                </p>
              </div>
              {user.role === "TENANT_OPERATOR" && (
                <button
                  onClick={() => void setActive(user)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  {user.is_active ? "Khóa tài khoản" : "Mở khóa"}
                </button>
              )}
            </article>
          ))}
          {!users.length && <p className="rounded-lg bg-white p-5 text-slate-600">Chưa có nhân viên.</p>}
        </section>
      </main>
      <Footer />
    </div>
  );
}

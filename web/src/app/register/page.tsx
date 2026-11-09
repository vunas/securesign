"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { showAlert } from "@/lib/swal";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tenant_code: "",
    name: "",
    domain: "",
    email: "",
    admin_username: "",
    admin_full_name: "",
    password: "",
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, domain: form.domain || null }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Không thể gửi đăng ký tổ chức.");
      }
      await showAlert(
        "Đã gửi đăng ký",
        "Tài khoản quản trị đang chờ quản trị viên nền tảng xét duyệt.",
        "success",
      );
      router.push("/login");
    } catch (error: unknown) {
      await showAlert(
        "Đăng ký thất bại",
        error instanceof Error ? error.message : "Đã xảy ra lỗi.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">Đăng ký tổ chức phát hành</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tổ chức được kích hoạt sau khi thông tin đăng ký được xét duyệt.
        </p>
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Mã tổ chức
            <input required minLength={2} maxLength={50} value={form.tenant_code} onChange={(e) => update("tenant_code", e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tên tổ chức
            <input required minLength={2} maxLength={255} value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email tổ chức
            <input required type="email" maxLength={100} value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tên miền (không bắt buộc)
            <input maxLength={100} value={form.domain} onChange={(e) => update("domain", e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Họ tên quản trị viên
            <input required minLength={2} maxLength={100} value={form.admin_full_name} onChange={(e) => update("admin_full_name", e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tên đăng nhập
            <input required minLength={3} maxLength={50} value={form.admin_username} onChange={(e) => update("admin_username", e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Mật khẩu (tối thiểu 12 ký tự)
            <input required type="password" minLength={12} maxLength={72} value={form.password} onChange={(e) => update("password", e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <button disabled={loading} className="rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2">
            {loading ? "Đang gửi..." : "Gửi đăng ký"}
          </button>
        </form>
        <Link href="/login" className="mt-5 inline-block text-sm text-indigo-700 hover:underline">
          Đã có tài khoản? Đăng nhập
        </Link>
      </div>
    </main>
  );
}

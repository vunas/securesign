"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { showAlert } from "@/lib/swal";

interface InitialApiCredentials {
  api_key: string;
  api_secret: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialCredentials, setInitialCredentials] = useState<InitialApiCredentials | null>(null);

  const continueToApp = () => {
    router.push(
      localStorage.getItem("role") === "PLATFORM_SUPER_ADMIN"
        ? "/admin/tenants"
        : "/dashboard",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include",
        body: formData.toString(),
      });

      const data = await res.json();

      if (res.ok) {
        if (typeof window !== "undefined") {
          localStorage.setItem("username", data.username || username);
          localStorage.setItem("role", data.role || "");
          window.dispatchEvent(new Event("securesign:auth-changed"));
        }
        if (data.initial_api_credentials) {
          setInitialCredentials(data.initial_api_credentials);
        } else {
          continueToApp();
        }
      } else {
        throw new Error(data.detail || "Sai thông tin đăng nhập");
      }
    } catch (error: unknown) {
      const err = error as Error;
      await showAlert("Đăng nhập thất bại", err.message || "Lỗi hệ thống", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4 relative">
      <Link
        href="/"
        className="absolute top-10 left-10 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <i className="fa-solid fa-arrow-left mr-2 text-xs"></i> Trang chủ
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-xl bg-indigo-50">
            <i className="fa-solid fa-shield-halved text-indigo-600 text-xl"></i>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-gray-800">SecureSign</h2>
          <p className="text-sm text-gray-500 mt-1">
            Đăng nhập vào hệ thống chữ ký số
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm text-gray-600 font-medium">Tên đăng nhập</label>
            <div className="relative mt-1">
              <i className="fa-regular fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                placeholder="Nhập tên đăng nhập"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 font-medium">Mật khẩu</label>
            <div className="relative mt-1">
              <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition shadow-sm flex justify-center items-center cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2"></i> Đang xác thực...
              </>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Chưa có tài khoản tổ chức?{" "}
          <Link href="/register" className="font-semibold text-indigo-700 hover:underline">
            Đăng ký tổ chức
          </Link>
        </p>
      </div>

      {initialCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="initial-api-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="initial-api-title" className="text-xl font-bold text-slate-900">
              Thông tin tích hợp API
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Secret chỉ hiển thị một lần. Hãy sao chép và lưu tại nơi an toàn trước khi tiếp tục.
              API secret là giá trị dùng trong header <code>X-API-Key</code> khi tích hợp.
            </p>
            <div className="mt-5 space-y-4">
              <CredentialRow label="API key" value={initialCredentials.api_key} />
              <CredentialRow label="API secret" value={initialCredentials.api_secret} sensitive />
            </div>
            <button
              type="button"
              onClick={continueToApp}
              className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
            >
              Tôi đã lưu thông tin, tiếp tục
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  label,
  value,
  sensitive = false,
}: {
  label: string;
  value: string;
  sensitive?: boolean;
}) {
  const copy = () => void navigator.clipboard.writeText(value);
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-700">{label}</p>
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-2">
        <code className={`min-w-0 flex-1 break-all text-sm ${sensitive ? "text-amber-800" : "text-slate-800"}`}>
          {value}
        </code>
        <button type="button" onClick={copy} className="shrink-0 rounded bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          Sao chép
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { showAlert } from "@/lib/swal";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);

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
        }
        router.push("/dashboard");
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
                placeholder="Nhập username (VD: admin)"
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

        <p className="text-xs text-gray-400 text-center mt-6">
          © 2026 SecureSign • Demo
        </p>
      </div>
    </div>
  );
}


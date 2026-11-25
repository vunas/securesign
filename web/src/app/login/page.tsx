"use client";

import Link from "next/link";
import { useState } from "react";
import OneTimeCredentialsModal, {
  OneTimeCredentials,
} from "@/components/OneTimeCredentialsModal";
import { showAlert } from "@/lib/swal";

const DEMO_ACCOUNTS = [
  {
    username: "admin",
    password: "123456",
    label: "Điền tài khoản Admin mẫu",
    roleHint: "Quản trị hệ thống",
    icon: "fa-solid fa-shield-halved",
  },
  {
    username: "group",
    password: "123456",
    label: "Điền tài khoản Group mẫu",
    roleHint: "Quản lý tổ chức",
    icon: "fa-solid fa-building-user",
  },
  {
    username: "demo",
    password: "123456",
    label: "Điền tài khoản Demo mẫu",
    roleHint: "Trải nghiệm ký số",
    icon: "fa-solid fa-file-signature",
  },
] as const;

export default function LoginPage() {
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("123456");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialCredentials, setInitialCredentials] =
    useState<OneTimeCredentials | null>(null);
  const [userRole, setUserRole] = useState("");

  const continueToApp = (role = userRole) => {
    window.location.assign(
      role === "PLATFORM_SUPER_ADMIN" ? "/admin/tenants" : "/dashboard",
    );
  };

  const handleFillDemoAccount = (accUsername: string, accPassword: string) => {
    setUsername(accUsername);
    setPassword(accPassword);
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
        setUserRole(data.role || "");
        if (data.initial_api_credentials) {
          setInitialCredentials(data.initial_api_credentials);
        } else {
          continueToApp(data.role || "");
        }
      } else {
        throw new Error(data.detail || "Sai thông tin đăng nhập");
      }
    } catch (error: unknown) {
      const err = error as Error;
      await showAlert(
        "Đăng nhập thất bại",
        err.message || "Lỗi hệ thống",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen w-full grid-cols-1 bg-white lg:grid-cols-12">
      {/* LEFT PANEL: Full-height Brand & Platform Overview (5 cols) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-200/80 bg-slate-50 p-12 lg:col-span-5 lg:flex">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 p-2.5 text-white shadow-md shadow-blue-500/25 transition group-hover:shadow-blue-500/40">
              <i className="fa-solid fa-file-signature text-lg"></i>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Secure<span className="text-blue-600">Sign</span>
            </span>
          </Link>

          <div className="mt-12 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
              Hệ thống PKI Doanh nghiệp
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">
              Phát hành & Bảo chứng văn bằng số chuẩn PAdES
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Quản lý khóa mật mã tập trung, ký số văn bằng PDF kèm mã QR tra
              cứu và theo dõi nhật ký kiểm toán minh bạch.
            </p>
          </div>

          <ul className="mt-8 max-w-md space-y-4 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <i className="fa-solid fa-check text-[10px]"></i>
              </div>
              <span>
                Chữ ký nhị phân PAdES tương thích Adobe Acrobat Reader
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <i className="fa-solid fa-check text-[10px]"></i>
              </div>
              <span>Xác thực trực tuyến tức thì qua cổng tra cứu mã QR</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <i className="fa-solid fa-check text-[10px]"></i>
              </div>
              <span>
                Xử lý Stateless trên RAM, không lưu giữ PDF gốc nhạy cảm
              </span>
            </li>
          </ul>
        </div>

        <div className="relative z-10 max-w-md rounded-xl border border-slate-200/90 bg-white/90 p-4 text-center text-xs text-slate-600 shadow-2xs">
          Hệ thống áp dụng phân quyền chặt chẽ theo vai trò
        </div>
      </aside>

      {/* RIGHT PANEL: Full-height Login Form (7 cols) */}
      <section className="flex flex-col justify-between bg-white px-6 py-8 sm:px-12 lg:col-span-7 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <i className="fa-solid fa-arrow-left text-[11px] text-slate-500"></i>
            Trang chủ
          </Link>

          <p className="text-xs text-slate-500">
            Chưa có tài khoản tổ chức?{" "}
            <Link
              href="/register"
              className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>

        <div className="mx-auto my-auto w-full max-w-md py-8">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 p-2 text-white">
              <i className="fa-solid fa-file-signature text-base"></i>
            </div>
            <span className="text-lg font-extrabold text-slate-900">
              Secure<span className="text-blue-600">Sign</span>
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Đăng nhập hệ thống
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sử dụng tài khoản quản trị hoặc cán bộ nghiệp vụ được cấp quyền.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Tên đăng nhập
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <i className="fa-regular fa-user text-sm"></i>
                </span>
                <input
                  id="username"
                  type="text"
                  required
                  disabled={loading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <i className="fa-solid fa-lock text-sm"></i>
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  <i
                    className={`fa-regular ${
                      showPassword ? "fa-eye-slash" : "fa-eye"
                    } text-sm`}
                  ></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </>
              )}
            </button>
          </form>

          {/* QUICK DEMO ACCOUNTS SECTION */}
          <div className="mt-7">
            <div className="relative flex items-center">
              <div className="grow border-t border-slate-200/80" />
              <span className="mx-3 shrink text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Khám phá giao diện
              </span>
              <div className="grow border-t border-slate-200/80" />
            </div>

            <p className="mt-2.5 text-center text-xs text-slate-500">
              Chọn nhanh tài khoản mẫu theo từng vai trò trải nghiệm.
            </p>

            <div className="mt-3.5 space-y-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = username.trim() === acc.username;
                return (
                  <button
                    key={acc.username}
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleFillDemoAccount(acc.username, acc.password)
                    }
                    className={`group flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer disabled:opacity-60 ${
                      isSelected
                        ? "border-indigo-300 bg-indigo-50/60 text-indigo-900 ring-1 ring-indigo-500/15"
                        : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs transition ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-600"
                        }`}
                      >
                        <i className={acc.icon}></i>
                      </span>
                      <span className="text-xs font-semibold">{acc.label}</span>
                    </span>

                    <span className="flex items-center gap-2">
                      <span
                        className={`hidden rounded-md px-2 py-0.5 text-[10px] font-semibold sm:inline-block ${
                          isSelected
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {acc.roleHint}
                      </span>
                      <i
                        className={`fa-solid fa-arrow-right text-[11px] transition-transform group-hover:translate-x-0.5 ${
                          isSelected ? "text-indigo-600" : "text-slate-400"
                        }`}
                      ></i>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 lg:text-left">
          &copy; 2026 SecureSign. Nền tảng bảo chứng và thẩm định nguồn gốc văn
          bằng số.
        </p>
      </section>

      {initialCredentials && (
        <OneTimeCredentialsModal
          credentials={initialCredentials}
          onConfirm={continueToApp}
        />
      )}
    </main>
  );
}

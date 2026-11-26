"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { showAlert } from "@/lib/swal";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const passwordLength = form.password.length;
  const isPasswordValid = passwordLength >= 12;

  return (
    <main className="grid min-h-screen w-full grid-cols-1 bg-white lg:grid-cols-12">
      {/* LEFT PANEL: Full-height Brand & Process Guide (5 cols) */}
      <aside className="relative flex flex-col justify-between overflow-hidden border-b border-slate-200/80 bg-slate-50 px-6 py-8 sm:px-10 lg:col-span-5 lg:border-b-0 lg:border-r lg:px-12 lg:py-10">
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10">
          {/* Brand Logo (Synced with HomePage) */}
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 p-2.5 text-white shadow-md shadow-blue-500/25 transition group-hover:shadow-blue-500/40">
              <i className="fa-solid fa-file-signature text-lg"></i>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Secure<span className="text-blue-600">Sign</span>
            </span>
          </Link>

          <div className="mt-10 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <i className="fa-solid fa-building-shield text-[11px]"></i>
              Dành cho Tổ chức & Cơ sở đào tạo
            </span>
            <h2 className="mt-4 text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
              Thiết lập không gian phát hành văn bằng số
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Khởi tạo hạ tầng ký số chuẩn quốc tế PAdES, cấp phát chứng thư X.509 riêng biệt và cổng xác thực QR trực tuyến cho đơn vị của bạn.
            </p>
          </div>

          {/* 3-Step Process */}
          <ol className="mt-9 max-w-md space-y-5">
            <li className="flex items-start gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-xs">
                1
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Khai báo hồ sơ pháp nhân
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Điền thông tin tổ chức và khởi tạo tài khoản Quản trị viên (Tenant Admin).
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-700">
                2
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Phê duyệt định danh
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Quản trị viên nền tảng đối soát thông tin tổ chức trước khi kích hoạt.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-700">
                3
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Cấp khóa KMS & API tự động
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Tự động sinh cặp khóa mật mã riêng biệt và khóa tích hợp hệ thống khi được duyệt.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="relative z-10 mt-10 max-w-md rounded-xl border border-slate-200/90 bg-white/90 p-4 text-xs leading-relaxed text-slate-600 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-emerald-700">
            <i className="fa-solid fa-lock"></i>
            <span>Bảo mật & Cô lập dữ liệu đa tổ chức</span>
          </div>
          <p className="mt-1">
            Private Key được mã hóa bằng KMS trên máy chủ và hệ thống không lưu trữ bản sao tệp PDF gốc.
          </p>
        </div>
      </aside>

      {/* RIGHT PANEL: Full-height Form Workspace (7 cols) */}
      <section className="flex flex-col justify-between bg-white px-6 py-8 sm:px-12 lg:col-span-7 lg:px-16 lg:py-10">
        {/* Integrated Top Navigation */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <i className="fa-solid fa-arrow-left text-[11px] text-slate-500"></i>
            Trang chủ
          </Link>

          <p className="text-xs text-slate-500">
            Đã có tài khoản?{" "}
            <Link
              href="/login"
              className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>

        {/* Centered Spacious Form Inside Right Half */}
        <div className="mx-auto my-auto w-full max-w-2xl py-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Đăng ký tổ chức phát hành
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Vui lòng cung cấp thông tin chính xác để hệ thống khởi tạo chứng thư số X.509 cho đơn vị.
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-6">
            {/* Group 1: Thông tin tổ chức */}
            <div>
              <h3 className="mb-3.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <i className="fa-solid fa-building-columns text-indigo-600"></i>
                Thông tin tổ chức
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="tenant_code"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Mã tổ chức <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="tenant_code"
                    type="text"
                    required
                    minLength={2}
                    maxLength={50}
                    disabled={loading}
                    value={form.tenant_code}
                    onChange={(e) => update("tenant_code", e.target.value)}
                    placeholder="VD: SGU-EDU"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Tên đầy đủ tổ chức <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={255}
                    disabled={loading}
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="VD: Trường Đại học Sài Gòn"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Email tổ chức <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    maxLength={100}
                    disabled={loading}
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="daotao@donvi.edu.vn"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="domain"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Tên miền chính thức{" "}
                    <span className="font-normal text-slate-400">
                      (Không bắt buộc)
                    </span>
                  </label>
                  <input
                    id="domain"
                    type="text"
                    maxLength={100}
                    disabled={loading}
                    value={form.domain}
                    onChange={(e) => update("domain", e.target.value)}
                    placeholder="VD: sgu.edu.vn"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Group 2: Tài khoản Quản trị viên */}
            <div>
              <h3 className="mb-3.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <i className="fa-solid fa-user-shield text-indigo-600"></i>
                Tài khoản Quản trị viên (Tenant Admin)
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="admin_full_name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Họ tên quản trị viên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="admin_full_name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    disabled={loading}
                    value={form.admin_full_name}
                    onChange={(e) => update("admin_full_name", e.target.value)}
                    placeholder="VD: Nguyễn Minh Hoàng"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin_username"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Tên đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="admin_username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    disabled={loading}
                    value={form.admin_username}
                    onChange={(e) => update("admin_username", e.target.value)}
                    placeholder="VD: admin_sgu"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Mật khẩu quản trị <span className="text-rose-500">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-medium ${
                        passwordLength === 0
                          ? "text-slate-400"
                          : isPasswordValid
                            ? "text-emerald-600"
                            : "text-amber-600"
                      }`}
                    >
                      {passwordLength}/12 ký tự tối thiểu
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={12}
                      maxLength={72}
                      disabled={loading}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder="Nhập mật khẩu từ 12 ký tự trở lên"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
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
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Đang gửi hồ sơ đăng ký...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Gửi đăng ký tổ chức</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Subtle Bottom Copyright */}
        <p className="text-center text-xs text-slate-400 lg:text-left">
          &copy; 2026 SecureSign. Nền tảng bảo chứng và thẩm định nguồn gốc văn bằng số.
        </p>
      </section>
    </main>
  );
}
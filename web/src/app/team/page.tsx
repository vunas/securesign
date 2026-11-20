"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/lib/swal";
import { useClientSession } from "@/lib/hooks/use-client-session";
import { useUrlSearchParams } from "@/lib/hooks/use-url-search-params";
import DataSkeleton from "@/components/DataSkeleton";

export interface TenantUser {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function TeamClient() {
  const { isReady } = useClientSession("TENANT_ADMIN");
  const { searchParams, setSearchParam } = useUrlSearchParams();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const statusParam = searchParams.get("status");
  const statusFilter: "ALL" | "ACTIVE" | "LOCKED" =
    statusParam === "ACTIVE" || statusParam === "LOCKED"
      ? statusParam
      : "ALL";
  const setStatusFilter = (status: "ALL" | "ACTIVE" | "LOCKED") =>
    setSearchParam("status", status === "ALL" ? null : status, "replace");
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  const [form, setForm] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
  });

  const loadUsers = useCallback(async () => {
    setLoadingList(true);
    try {
      setUsers(await fetchAPI<TenantUser[]>("/api/tenant/users"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tải nhân sự.",
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void fetchAPI<TenantUser[]>("/api/tenant/users")
      .then((items) => {
        if (active) setUsers(items);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : "Không thể tải nhân sự.",
        );
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, [isReady]);

  if (!isReady || loadingList) return <DataSkeleton />;

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetchAPI("/api/tenant/users", "POST", form);
      setForm({ username: "", full_name: "", email: "", password: "" });
      showToast("Đã tạo tài khoản nhân viên", "success");
      await loadUsers();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tạo tài khoản.",
      );
    } finally {
      setLoading(false);
    }
  };

  const setActive = async (user: TenantUser) => {
    setTogglingUserId(user.id);
    setError("");
    try {
      await fetchAPI(`/api/tenant/users/${user.id}`, "PATCH", {
        is_active: !user.is_active,
      });
      showToast(
        user.is_active ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản",
        "success",
      );
      await loadUsers();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể cập nhật tài khoản.",
      );
    } finally {
      setTogglingUserId(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && user.is_active) ||
      (statusFilter === "LOCKED" && !user.is_active);
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      user.username.toLowerCase().includes(q) ||
      (user.full_name ?? "").toLowerCase().includes(q) ||
      (user.email ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const activeUsersCount = users.filter((u) => u.is_active).length;
  const passwordLength = form.password.length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl grow px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <i className="fa-solid fa-users text-base"></i>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Quản lý nhân sự tổ chức
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                  RBAC Workspace
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                Cấp phát tài khoản cán bộ nghiệp vụ (Operator) và kiểm soát trạng thái truy cập hệ thống.
              </p>
            </div>
          </div>

          <div className="self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600 sm:self-auto">
            Đang hoạt động:{" "}
            <strong className="font-bold text-emerald-700">
              {activeUsersCount}
            </strong>{" "}
            / {users.length} tài khoản
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700"
          >
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-rose-500 hover:text-rose-800 cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* 2-Column Horizontal Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* LEFT COLUMN: Create Operator Form + Role Info (5 cols) */}
          <div className="space-y-5 lg:sticky lg:top-20 lg:col-span-5">
            <form
              onSubmit={createUser}
              className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
            >
              <div className="border-b border-slate-100 pb-3.5">
                <h2 className="text-base font-bold text-slate-900">
                  Thêm cán bộ nghiệp vụ mới
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tài khoản mới sẽ được gán vai trò{" "}
                  <strong className="text-slate-700">Tenant Operator</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="opFullName"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="opFullName"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    disabled={loading}
                    value={form.full_name}
                    onChange={(event) =>
                      setForm({ ...form, full_name: event.target.value })
                    }
                    placeholder="VD: Lê Thị Minh Thư"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="opUsername"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Tên đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="opUsername"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    disabled={loading}
                    value={form.username}
                    onChange={(event) =>
                      setForm({ ...form, username: event.target.value })
                    }
                    placeholder="VD: operator_thu"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="opEmail"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Email công việc <span className="text-rose-500">*</span>
                </label>
                <input
                  id="opEmail"
                  type="email"
                  required
                  maxLength={100}
                  disabled={loading}
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="thu.ltm@donvi.edu.vn"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="opPassword"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Mật khẩu ban đầu <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-medium ${
                      passwordLength === 0
                        ? "text-slate-400"
                        : passwordLength >= 12
                          ? "text-emerald-600"
                          : "text-amber-600"
                    }`}
                  >
                    {passwordLength}/12 ký tự tối thiểu
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="opPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={12}
                    maxLength={72}
                    disabled={loading}
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                    placeholder="Tối thiểu 12 ký tự"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-user-plus"></i>
                    <span>Tạo tài khoản Operator</span>
                  </>
                )}
              </button>
            </form>

            {/* Role Scope Info */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm text-xs">
              <p className="font-bold text-slate-800">
                Phạm vi quyền hạn của Tenant Operator
              </p>
              <ul className="mt-2.5 space-y-1.5 text-slate-600">
                <li className="flex items-start gap-2">
                  <i className="fa-solid fa-check mt-0.5 text-emerald-600"></i>
                  <span>Ký số phát hành văn bằng bằng khóa tổ chức và tra cứu kiểm toán.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="fa-solid fa-xmark mt-0.5 text-slate-400"></i>
                  <span>Không được phép sinh/thu hồi khóa mật mã hoặc tạo API Key.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN: Staff Table (7 cols) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm lg:col-span-7">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tài khoản trong tổ chức
                </h2>
                <p className="text-xs text-slate-500">
                  Khóa hoặc mở khóa quyền đăng nhập của từng cán bộ
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm họ tên, username, email..."
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "ALL" | "ACTIVE" | "LOCKED",
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="LOCKED">Đã khóa</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Nhân sự
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Vai trò
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Trạng thái
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loadingList ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-sm text-slate-400"
                      >
                        <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                        Đang tải danh sách nhân sự...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-sm text-slate-400"
                      >
                        Không tìm thấy tài khoản nhân sự phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isAdmin = user.role === "TENANT_ADMIN";
                      const isToggling = togglingUserId === user.id;
                      return (
                        <tr
                          key={user.id}
                          className="transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                                {(user.full_name || user.username)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900">
                                  {user.full_name || user.username}
                                </div>
                                <div className="text-xs text-slate-500">
                                  @{user.username}
                                  {user.email ? ` · ${user.email}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-xs">
                            {isAdmin ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                                Tenant Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                                Operator
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-xs">
                            {user.is_active ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                Đã khóa
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            {user.role === "TENANT_OPERATOR" ? (
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => void setActive(user)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer ${
                                  user.is_active
                                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {isToggling
                                  ? "Đang xử lý..."
                                  : user.is_active
                                    ? "Khóa tài khoản"
                                    : "Mở khóa"}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Quản trị viên
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
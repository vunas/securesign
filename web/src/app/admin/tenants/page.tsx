"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI } from "@/lib/api";
import { getSwal, showAlert, showConfirm, showToast } from "@/lib/swal";
import { useClientSession } from "@/lib/hooks/use-client-session";
import { useUrlSearchParams } from "@/lib/hooks/use-url-search-params";
import DataSkeleton from "@/components/DataSkeleton";

export interface Tenant {
  id: number;
  tenant_code: string;
  name: string;
  email: string;
  domain: string | null;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  created_at: string;
  monthly_limit: number | null;
  used_count: number | null;
}

const STATUS_META: Record<
  Tenant["status"],
  { label: string; badge: string; dot: string }
> = {
  PENDING: {
    label: "Chờ xét duyệt",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  ACTIVE: {
    label: "Đang hoạt động",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Đã từ chối",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
  SUSPENDED: {
    label: "Đã tạm ngưng",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
  },
};

const QUOTA_PRESETS = [500, 1000, 5000, 10000];

export default function TenantApprovalClient() {
  const { isReady } = useClientSession("PLATFORM_SUPER_ADMIN");
  const { searchParams, setSearchParam } = useUrlSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const statusParam = searchParams.get("status");
  const statusFilter: "" | Tenant["status"] =
    statusParam === "PENDING" ||
    statusParam === "ACTIVE" ||
    statusParam === "REJECTED" ||
    statusParam === "SUSPENDED"
      ? statusParam
      : "";
  const setStatusFilter = (status: "" | Tenant["status"]) =>
    setSearchParam("status", status || null, "replace");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const refreshTenants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAPI<Tenant[]>("/api/admin/tenants");
      setTenants(data || []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể tải danh sách tổ chức.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void fetchAPI<Tenant[]>("/api/admin/tenants")
      .then((data) => {
        if (active) setTenants(data || []);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tải danh sách tổ chức.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isReady]);

  const counts = useMemo(() => {
    return {
      total: tenants.length,
      PENDING: tenants.filter((t) => t.status === "PENDING").length,
      ACTIVE: tenants.filter((t) => t.status === "ACTIVE").length,
      SUSPENDED: tenants.filter((t) => t.status === "SUSPENDED").length,
      REJECTED: tenants.filter((t) => t.status === "REJECTED").length,
    };
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.tenant_code.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.domain && t.domain.toLowerCase().includes(q))
      );
    });
  }, [tenants, statusFilter, searchQuery]);

  if (!isReady || loading) return <DataSkeleton />;

  const copyTenantCode = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast(`Đã sao chép mã ${code}`, "success");
    window.setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 1800);
  };

  const handleApprove = async (tenant: Tenant) => {
    const confirmed = await showConfirm({
      icon: "question",
      title: `Phê duyệt tổ chức "${tenant.name}"?`,
      text: "Hệ thống sẽ tự động khởi tạo chứng thư CA nhánh, khóa ký số và cấp phát thông tin tích hợp API ban đầu cho tổ chức này.",
      showCancelButton: true,
      confirmButtonText: "Duyệt & Khởi tạo",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await fetchAPI<Tenant>(`/api/admin/tenants/${tenant.id}/review`, "POST", {
        status: "ACTIVE",
        reason: null,
      });
      showToast("Đã duyệt và khởi tạo PKI/API key thành công", "success");
      await refreshTenants();
    } catch (cause) {
      await showAlert(
        "Không thể phê duyệt",
        cause instanceof Error ? cause.message : "Lỗi cập nhật tổ chức.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectWithSwal = async (tenant: Tenant) => {
    const Swal = getSwal();
    let reasonValue = "";

    if (Swal) {
      const container = document.createElement("div");
      container.className = "mt-2 space-y-3 text-left text-xs";

      const info = document.createElement("p");
      info.className =
        "rounded-lg border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-slate-600";
      info.innerHTML = `Tổ chức bị từ chối: <strong class="text-slate-900"></strong> (${tenant.tenant_code})`;
      info.querySelector("strong")!.textContent = tenant.name;

      const label = document.createElement("label");
      label.className = "block font-semibold text-slate-700";
      label.textContent = "Lý do từ chối đăng ký *";

      const textarea = document.createElement("textarea");
      textarea.rows = 3;
      textarea.placeholder =
        "Ví dụ: Tên miền email chưa khớp với tên miền chính thức của đơn vị...";
      textarea.className =
        "w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20";

      container.append(info, label, textarea);

      const { isConfirmed } = await Swal.fire({
        title: `<span class="text-lg font-bold text-slate-900">Từ chối hồ sơ đăng ký</span>`,
        html: container,
        showCancelButton: true,
        confirmButtonText: "Xác nhận từ chối",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#e11d48",
        cancelButtonColor: "#64748b",
        width: 480,
        didOpen: () => textarea.focus(),
        customClass: {
          popup: "rounded-2xl",
          confirmButton: "rounded-lg font-bold px-5 py-2.5",
          cancelButton: "rounded-lg font-bold px-5 py-2.5",
        },
      });

      if (!isConfirmed) return;
      reasonValue = textarea.value;
    } else {
      const prompted = window.prompt("Lý do từ chối đăng ký:");
      if (prompted === null) return;
      reasonValue = prompted;
    }

    if (!reasonValue.trim()) {
      await showAlert(
        "Thiếu lý do",
        "Vui lòng nhập lý do từ chối đăng ký.",
        "warning",
      );
      return;
    }

    setSubmitting(true);
    try {
      await fetchAPI<Tenant>(`/api/admin/tenants/${tenant.id}/review`, "POST", {
        status: "REJECTED",
        reason: reasonValue.trim(),
      });
      showToast("Đã từ chối hồ sơ đăng ký", "success");
      await refreshTenants();
    } catch (cause) {
      await showAlert(
        "Thao tác thất bại",
        cause instanceof Error ? cause.message : "Không thể từ chối tổ chức.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (tenant: Tenant) => {
    const nextStatus = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const isSuspending = nextStatus === "SUSPENDED";

    const confirmed = await showConfirm({
      icon: isSuspending ? "warning" : "question",
      title: isSuspending
        ? `Tạm ngưng hoạt động "${tenant.name}"?`
        : `Kích hoạt lại "${tenant.name}"?`,
      text: isSuspending
        ? "Mọi yêu cầu phát hành văn bằng và API Key của tổ chức này sẽ bị tạm khóa cho đến khi kích hoạt lại."
        : "Tổ chức sẽ được khôi phục quyền truy cập cổng quản trị và phát hành văn bằng.",
      showCancelButton: true,
      confirmButtonText: isSuspending ? "Tạm ngưng ngay" : "Kích hoạt lại",
      cancelButtonText: "Hủy",
      confirmButtonColor: isSuspending ? "#e11d48" : "#059669",
      cancelButtonColor: "#64748b",
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await fetchAPI(`/api/admin/tenants/${tenant.id}/status`, "PATCH", {
        status: nextStatus,
      });
      showToast(
        nextStatus === "ACTIVE"
          ? "Đã kích hoạt lại tổ chức"
          : "Đã tạm ngưng tổ chức",
        "success",
      );
      await refreshTenants();
    } catch (cause) {
      await showAlert(
        "Cập nhật thất bại",
        cause instanceof Error ? cause.message : "Không thể đổi trạng thái.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQuotaWithSwal = async (tenant: Tenant) => {
    const Swal = getSwal();
    let rawValue = String(tenant.monthly_limit ?? 1000);

    if (Swal) {
      const container = document.createElement("div");
      container.className = "mt-2 space-y-4 text-left text-xs";

      const summary = document.createElement("div");
      summary.className =
        "rounded-lg border border-slate-200/80 bg-slate-50/80 p-3.5 text-slate-600";
      const orgTitle = document.createElement("p");
      orgTitle.className = "font-bold text-slate-900";
      orgTitle.textContent = tenant.name;
      const orgUsage = document.createElement("p");
      orgUsage.className = "mt-1";
      orgUsage.textContent = `Đã sử dụng trong tháng: ${(tenant.used_count ?? 0).toLocaleString("vi-VN")} lượt phát hành`;
      summary.append(orgTitle, orgUsage);

      const fieldWrap = document.createElement("div");
      const label = document.createElement("label");
      label.className = "mb-1.5 block font-semibold text-slate-700";
      label.textContent = "Hạn ngạch tối đa / tháng";

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = rawValue;
      input.className =
        "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

      const presetsRow = document.createElement("div");
      presetsRow.className = "mt-2.5 flex flex-wrap gap-1.5";
      for (const preset of QUOTA_PRESETS) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.textContent = preset.toLocaleString("vi-VN");
        chip.className =
          "rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer";
        chip.onclick = () => {
          input.value = String(preset);
          input.focus();
        };
        presetsRow.append(chip);
      }

      fieldWrap.append(label, input, presetsRow);
      container.append(summary, fieldWrap);

      const { isConfirmed } = await Swal.fire({
        title: `<span class="text-lg font-bold text-slate-900">Điều chỉnh hạn ngạch tháng</span>`,
        html: container,
        showCancelButton: true,
        confirmButtonText: "Lưu hạn ngạch",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#4f46e5",
        cancelButtonColor: "#64748b",
        width: 460,
        didOpen: () => {
          input.focus();
          input.select();
        },
        customClass: {
          popup: "rounded-2xl",
          confirmButton: "rounded-lg font-bold px-5 py-2.5",
          cancelButton: "rounded-lg font-bold px-5 py-2.5",
        },
      });

      if (!isConfirmed) return;
      rawValue = input.value;
    } else {
      const prompted = window.prompt(
        `Hạn ngạch mới cho ${tenant.name}:`,
        rawValue,
      );
      if (prompted === null) return;
      rawValue = prompted;
    }

    const monthly_limit = Number(rawValue);
    if (!Number.isInteger(monthly_limit) || monthly_limit < 0) {
      await showAlert(
        "Giá trị không hợp lệ",
        "Hạn ngạch phải là số nguyên không âm.",
        "warning",
      );
      return;
    }

    setSubmitting(true);
    try {
      await fetchAPI(`/api/admin/tenants/${tenant.id}/quota`, "PUT", {
        monthly_limit,
      });
      showToast("Đã cập nhật hạn ngạch tháng", "success");
      await refreshTenants();
    } catch (cause) {
      await showAlert(
        "Cập nhật thất bại",
        cause instanceof Error
          ? cause.message
          : "Không thể cập nhật hạn ngạch.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl grow px-4 py-6">
        {/* Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <i className="fa-solid fa-building-shield text-base"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Quản lý tổ chức phát hành
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                Xét duyệt đăng ký tenant, cấp phát hạ tầng PKI và điều tiết hạn
                ngạch phát hành hàng tháng.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refreshTenants()}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:self-auto cursor-pointer"
          >
            <i
              className={`fa-solid fa-rotate-right ${
                loading ? "fa-spin text-indigo-600" : ""
              }`}
            ></i>
            <span>Làm mới</span>
          </button>
        </div>

        {/* KPI Overview Strip */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
              statusFilter === ""
                ? "border-indigo-300 bg-indigo-50/40 ring-2 ring-indigo-500/15"
                : "border-slate-200/90 bg-white hover:border-slate-300"
            }`}
          >
            <span className="text-xs font-semibold text-slate-500">
              Tổng số tổ chức
            </span>
            <p className="mt-1.5 text-2xl font-extrabold text-slate-900">
              {counts.total}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
              statusFilter === "PENDING"
                ? "border-amber-400 bg-amber-50/60 ring-2 ring-amber-500/20"
                : "border-slate-200/90 bg-white hover:border-amber-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Chờ xét duyệt
              </span>
              {counts.PENDING > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
              )}
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-amber-600">
              {counts.PENDING}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
              statusFilter === "ACTIVE"
                ? "border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                : "border-slate-200/90 bg-white hover:border-emerald-200"
            }`}
          >
            <span className="text-xs font-semibold text-slate-500">
              Đang hoạt động
            </span>
            <p className="mt-1.5 text-2xl font-extrabold text-emerald-600">
              {counts.ACTIVE}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("SUSPENDED")}
            className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
              statusFilter === "SUSPENDED"
                ? "border-rose-400 bg-rose-50/50 ring-2 ring-rose-500/20"
                : "border-slate-200/90 bg-white hover:border-rose-200"
            }`}
          >
            <span className="text-xs font-semibold text-slate-500">
              Đang tạm ngưng
            </span>
            <p className="mt-1.5 text-2xl font-extrabold text-rose-600">
              {counts.SUSPENDED}
            </p>
          </button>
        </div>

        {/* Filter Tabs & Search Toolbar */}
        <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { value: "", label: `Tất cả (${counts.total})` },
                { value: "PENDING", label: `Chờ duyệt (${counts.PENDING})` },
                { value: "ACTIVE", label: `Hoạt động (${counts.ACTIVE})` },
                {
                  value: "SUSPENDED",
                  label: `Tạm ngưng (${counts.SUSPENDED})`,
                },
                { value: "REJECTED", label: `Từ chối (${counts.REJECTED})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  statusFilter === tab.value
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên, mã tổ chức, email, domain..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
          >
            <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Tenant Cards List (3-Column Horizontal Layout) */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center text-sm text-slate-400 shadow-sm">
              <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
              Đang tải danh sách tổ chức...
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <i className="fa-solid fa-building-circle-xmark text-xl"></i>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-700">
                Không tìm thấy tổ chức phù hợp
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.
              </p>
            </div>
          ) : (
            filteredTenants.map((tenant) => {
              const statusMeta = STATUS_META[tenant.status];
              const used = tenant.used_count ?? 0;
              const limit = tenant.monthly_limit;
              const usagePercent =
                limit && limit > 0
                  ? Math.min(100, Math.round((used / limit) * 100))
                  : 0;

              return (
                <article
                  key={tenant.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                    {/* 1. LEFT: Organization Identity & Metadata */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="truncate text-base font-bold text-slate-900">
                          {tenant.name}
                        </h2>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badge}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                          ></span>
                          {statusMeta.label}
                        </span>

                        <button
                          type="button"
                          onClick={() => copyTenantCode(tenant.tenant_code)}
                          title="Nhấn để sao chép mã tổ chức"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                        >
                          <span>{tenant.tenant_code}</span>
                          <i
                            className={`fa-solid ${
                              copiedCode === tenant.tenant_code
                                ? "fa-check text-emerald-600"
                                : "fa-copy text-slate-400"
                            } text-[10px]`}
                          ></i>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <i className="fa-regular fa-envelope text-slate-400"></i>
                          {tenant.email}
                        </span>

                        {tenant.domain && (
                          <span className="inline-flex items-center gap-1.5">
                            <i className="fa-solid fa-globe text-slate-400"></i>
                            <span className="font-mono text-slate-700">
                              {tenant.domain}
                            </span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <i className="fa-regular fa-calendar text-slate-400"></i>
                          Đăng ký:{" "}
                          {new Date(tenant.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                        </span>
                      </div>
                    </div>

                    {/* 2. CENTER: Quota Progress Bar */}
                    <div className="w-full shrink-0 border-t border-slate-100 pt-3 lg:w-72 lg:border-x lg:border-t-0 lg:border-slate-100 lg:px-6 lg:pt-0 xl:w-80">
                      {limit == null ? (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                          <i className="fa-solid fa-gauge text-slate-400"></i>
                          <span>Hạn ngạch tháng: Chưa cấp phát</span>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-500">
                              Hạn ngạch tháng
                            </span>
                            <span className="font-mono font-bold text-slate-800">
                              {used.toLocaleString("vi-VN")} /{" "}
                              {limit.toLocaleString("vi-VN")} ({usagePercent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usagePercent >= 95
                                  ? "bg-rose-500"
                                  : usagePercent >= 80
                                    ? "bg-amber-500"
                                    : "bg-indigo-600"
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. RIGHT: Contextual Actions (Aligned width across rows) */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:min-w-57.5 lg:justify-end">
                      {tenant.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleRejectWithSwal(tenant)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                          >
                            <i className="fa-solid fa-xmark"></i>
                            <span>Từ chối</span>
                          </button>

                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleApprove(tenant)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            <i className="fa-solid fa-check"></i>
                            <span>Duyệt & Khởi tạo</span>
                          </button>
                        </>
                      )}

                      {tenant.status === "ACTIVE" && (
                        <>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              void handleUpdateQuotaWithSwal(tenant)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3.5 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100/80 disabled:opacity-50 cursor-pointer"
                          >
                            <i className="fa-solid fa-sliders"></i>
                            <span>Hạn ngạch</span>
                          </button>

                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleToggleSuspend(tenant)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                          >
                            <i className="fa-solid fa-pause"></i>
                            <span>Tạm ngưng</span>
                          </button>
                        </>
                      )}

                      {tenant.status === "SUSPENDED" && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleToggleSuspend(tenant)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                        >
                          <i className="fa-solid fa-play"></i>
                          <span>Kích hoạt lại</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

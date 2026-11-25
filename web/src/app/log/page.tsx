"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import { getSwal, showToast } from "@/lib/swal";
import { useClientSession } from "@/lib/hooks/use-client-session";
import { useUrlSearchParams } from "@/lib/hooks/use-url-search-params";
import DataSkeleton from "@/components/DataSkeleton";

interface AuditLog {
  id: number;
  tenant_id: number | null;
  user_id: number | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  level: string;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  payload: Record<string, unknown> | null;
  log_hash: string | null;
  created_at: string;
}

interface VerifyLog {
  id: number;
  tenant_id: number | null;
  credential_id: number | null;
  tracking_id: string | null;
  signature_id: number | null;
  verified_by_user_id: number | null;
  is_valid: boolean;
  is_integrity_valid: boolean | null;
  is_cert_valid: boolean | null;
  is_not_revoked: boolean | null;
  message: string | null;
  signer_snapshot: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditIntegrityResult {
  valid: boolean;
  checked_entries: number;
  legacy_entries: number;
  invalid_entry_id: number | null;
}

const ACTION_META: Record<string, { label: string; badge: string }> = {
  ISSUE_AND_SIGN_CREDENTIAL: {
    label: "Phát hành văn bằng",
    badge: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  SIGN_DOCUMENT: {
    label: "Ký số tài liệu",
    badge: "text-amber-700 bg-amber-50 border-amber-200",
  },
  REVOKE_CREDENTIAL: {
    label: "Thu hồi văn bằng",
    badge: "text-rose-700 bg-rose-50 border-rose-200",
  },
  GENERATE_KEY: {
    label: "Khởi tạo khóa",
    badge: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  REVOKE_KEY: {
    label: "Thu hồi khóa",
    badge: "text-rose-700 bg-rose-50 border-rose-200",
  },
  CREATE_API_KEY: {
    label: "Tạo API Key",
    badge: "text-purple-700 bg-purple-50 border-purple-200",
  },
  REVOKE_API_KEY: {
    label: "Thu hồi API Key",
    badge: "text-rose-700 bg-rose-50 border-rose-200",
  },
  USER_LOGIN: {
    label: "Đăng nhập",
    badge: "text-slate-700 bg-slate-100 border-slate-200",
  },
  REGISTER_USER: {
    label: "Tạo tài khoản",
    badge: "text-blue-700 bg-blue-50 border-blue-200",
  },
  REGISTER_TENANT: {
    label: "Đăng ký tổ chức",
    badge: "text-blue-700 bg-blue-50 border-blue-200",
  },
  REVIEW_TENANT: {
    label: "Xét duyệt tổ chức",
    badge: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  CREATE_ROOT_CA: {
    label: "Tạo Root CA",
    badge: "text-rose-700 bg-rose-50 border-rose-200",
  },
  UPLOAD_DOCUMENT: {
    label: "Tải lên tài liệu",
    badge: "text-sky-700 bg-sky-50 border-sky-200",
  },
  VERIFY_DOCUMENT: {
    label: "Xác thực tài liệu",
    badge: "text-cyan-700 bg-cyan-50 border-cyan-200",
  },
};

function toIsoBoundary(dateStr: string, endOfDay: boolean): string {
  const suffix = endOfDay ? "T23:59:59" : "T00:00:00";
  return new Date(`${dateStr}${suffix}`).toISOString();
}

function buildAuditDetailElement(log: AuditLog): HTMLElement {
  const root = document.createElement("div");
  root.className = "mt-2 space-y-4 text-left text-xs text-slate-700";

  // 1. Metadata summary grid
  const metaGrid = document.createElement("div");
  metaGrid.className =
    "grid grid-cols-2 gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5";

  const metaItems: [string, string][] = [
    ["Thời gian ghi nhận", new Date(log.created_at).toLocaleString("vi-VN")],
    ["Mã hành động", log.action],
    [
      "Chủ thể thực hiện",
      `User #${log.user_id ?? "N/A"} · Tenant #${log.tenant_id ?? "N/A"}`,
    ],
    ["Địa chỉ IP", log.ip_address || "Local"],
    [
      "Đối tượng tác động",
      `${log.target_type || "—"}${log.target_id ? ` #${log.target_id}` : ""}`,
    ],
    ["Trạng thái", log.status],
  ];

  for (const [label, value] of metaItems) {
    const cell = document.createElement("div");
    const dt = document.createElement("span");
    dt.className = "block text-[11px] font-medium text-slate-400";
    dt.textContent = label;
    const dd = document.createElement("span");
    dd.className = "mt-0.5 block font-mono font-semibold text-slate-800";
    dd.textContent = value;
    cell.append(dt, dd);
    metaGrid.append(cell);
  }
  root.append(metaGrid);

  // 2. HMAC Hash box
  const hmacSection = document.createElement("div");
  const hmacHeader = document.createElement("div");
  hmacHeader.className = "mb-1.5 flex items-center justify-between";
  const hmacLabel = document.createElement("span");
  hmacLabel.className = "font-bold text-slate-800";
  hmacLabel.textContent = "Chuỗi niêm phong HMAC-SHA256";
  hmacHeader.append(hmacLabel);

  if (log.log_hash) {
    const copyHashBtn = document.createElement("button");
    copyHashBtn.type = "button";
    copyHashBtn.className =
      "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-50 cursor-pointer";
    copyHashBtn.textContent = "Sao chép mã";
    copyHashBtn.onclick = () => {
      void navigator.clipboard?.writeText(log.log_hash!);
      copyHashBtn.textContent = "Đã sao chép ✓";
      window.setTimeout(() => {
        copyHashBtn.textContent = "Sao chép mã";
      }, 1500);
    };
    hmacHeader.append(copyHashBtn);
  }

  const hmacBox = document.createElement("div");
  hmacBox.className =
    "rounded-xl border border-slate-200/90 bg-slate-50 px-3.5 py-2.5 font-mono text-[11px] break-all leading-relaxed text-slate-600";
  hmacBox.textContent = log.log_hash || "N/A";
  hmacSection.append(hmacHeader, hmacBox);
  root.append(hmacSection);

  // 3. User-Agent (if present)
  if (log.user_agent) {
    const uaSection = document.createElement("div");
    const uaLabel = document.createElement("span");
    uaLabel.className = "mb-1.5 block font-bold text-slate-800";
    uaLabel.textContent = "Thiết bị / Trình duyệt (User-Agent)";
    const uaBox = document.createElement("div");
    uaBox.className =
      "rounded-xl border border-slate-200/90 bg-slate-50 px-3.5 py-2.5 font-mono text-[11px] break-all leading-relaxed text-slate-600";
    uaBox.textContent = log.user_agent;
    uaSection.append(uaLabel, uaBox);
    root.append(uaSection);
  }

  // 4. Light-themed Structured Payload Box
  const payloadSection = document.createElement("div");
  const payloadHeader = document.createElement("div");
  payloadHeader.className = "mb-1.5 flex items-center justify-between";
  const payloadLabel = document.createElement("span");
  payloadLabel.className = "font-bold text-slate-800";
  payloadLabel.textContent = "Dữ liệu chi tiết (Payload)";
  payloadHeader.append(payloadLabel);

  const payloadEntries =
    log.payload && typeof log.payload === "object"
      ? Object.entries(log.payload)
      : [];

  if (payloadEntries.length > 0) {
    const jsonText = JSON.stringify(log.payload, null, 2);
    const copyPayloadBtn = document.createElement("button");
    copyPayloadBtn.type = "button";
    copyPayloadBtn.className =
      "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600 cursor-pointer";
    copyPayloadBtn.textContent = "Copy JSON";
    copyPayloadBtn.onclick = () => {
      void navigator.clipboard?.writeText(jsonText);
      copyPayloadBtn.textContent = "Đã copy ✓";
      window.setTimeout(() => {
        copyPayloadBtn.textContent = "Copy JSON";
      }, 1500);
    };
    payloadHeader.append(copyPayloadBtn);

    const kvWrapper = document.createElement("div");
    kvWrapper.className =
      "divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/70";

    for (const [k, v] of payloadEntries) {
      const row = document.createElement("div");
      row.className =
        "flex items-start justify-between gap-4 px-3.5 py-2.5 text-xs";
      const keyEl = document.createElement("span");
      keyEl.className = "shrink-0 font-mono font-medium text-slate-500";
      keyEl.textContent = k;

      const valEl = document.createElement("span");
      valEl.className =
        "break-all text-right font-mono font-semibold text-slate-800";
      valEl.textContent =
        v === null || v === undefined
          ? "null"
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);

      row.append(keyEl, valEl);
      kvWrapper.append(row);
    }
    payloadSection.append(payloadHeader, kvWrapper);
  } else {
    const emptyBox = document.createElement("div");
    emptyBox.className =
      "rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-3 text-center text-slate-400";
    emptyBox.textContent = "Không có dữ liệu payload bổ sung.";
    payloadSection.append(payloadHeader, emptyBox);
  }

  root.append(payloadSection);
  return root;
}

export default function LogClient() {
  const { user, isReady } = useClientSession();
  const { searchParams, setSearchParam, setSearchParams } =
    useUrlSearchParams();
  const role = user?.role ?? null;
  const activeTab = searchParams.get("tab") === "verify" ? "verify" : "audit";
  const setActiveTab = (tab: "audit" | "verify") =>
    setSearchParam("tab", tab === "audit" ? null : tab, "push");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [verifyLogs, setVerifyLogs] = useState<VerifyLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Audit Filters
  const actionFilter = searchParams.get("action") ?? "";
  const setActionFilter = (value: string) =>
    setSearchParam("action", value || null);
  const statusFilter = searchParams.get("status") ?? "";
  const setStatusFilter = (value: string) =>
    setSearchParam("status", value || null);
  const auditSince = searchParams.get("since") ?? "";
  const setAuditSince = (value: string) =>
    setSearchParam("since", value || null);
  const auditUntil = searchParams.get("until") ?? "";
  const setAuditUntil = (value: string) =>
    setSearchParam("until", value || null);
  const auditLimitParam = searchParams.get("limit");
  const auditLimit =
    auditLimitParam === "100" || auditLimitParam === "200"
      ? auditLimitParam
      : "50";
  const setAuditLimit = (value: string) =>
    setSearchParam("limit", value === "50" ? null : value);

  // Verify Filters
  const validParam = searchParams.get("valid");
  const validFilter: "" | "true" | "false" =
    validParam === "true" || validParam === "false" ? validParam : "";
  const setValidFilter = (value: "" | "true" | "false") =>
    setSearchParam("valid", value || null);
  const verifySince = searchParams.get("verifySince") ?? "";
  const setVerifySince = (value: string) =>
    setSearchParam("verifySince", value || null);
  const verifyUntil = searchParams.get("verifyUntil") ?? "";
  const setVerifyUntil = (value: string) =>
    setSearchParam("verifyUntil", value || null);
  const verifyLimitParam = searchParams.get("verifyLimit");
  const verifyLimit =
    verifyLimitParam === "100" || verifyLimitParam === "200"
      ? verifyLimitParam
      : "50";
  const setVerifyLimit = (value: string) =>
    setSearchParam("verifyLimit", value === "50" ? null : value);

  // Integrity Chain & Copy Feedback
  const [checkingChain, setCheckingChain] = useState(false);
  const [integrityResult, setIntegrityResult] =
    useState<AuditIntegrityResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isReady) return;
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab") === "verify" ? "verify" : "audit";
    const initialQuery = new URLSearchParams();
    const initialLimit =
      initialTab === "verify" ? params.get("verifyLimit") : params.get("limit");
    initialQuery.set(
      "limit",
      initialLimit === "100" || initialLimit === "200" ? initialLimit : "50",
    );

    if (initialTab === "audit") {
      for (const key of ["action", "status"] as const) {
        const value = params.get(key);
        if (value) initialQuery.set(key, value);
      }
      const since = params.get("since");
      const until = params.get("until");
      if (since) initialQuery.set("since", toIsoBoundary(since, false));
      if (until) initialQuery.set("until", toIsoBoundary(until, true));
    } else {
      const valid = params.get("valid");
      const since = params.get("verifySince");
      const until = params.get("verifyUntil");
      if (valid === "true" || valid === "false") {
        initialQuery.set("valid", valid);
      }
      if (since) initialQuery.set("since", toIsoBoundary(since, false));
      if (until) initialQuery.set("until", toIsoBoundary(until, true));
    }

    const endpoint =
      initialTab === "audit" ? "/api/logs/audit" : "/api/logs/verify";
    const loadInitialLogs = async () => {
      if (initialTab === "audit") {
        const logs = await fetchAPI<AuditLog[]>(`${endpoint}?${initialQuery}`);
        if (active) setAuditLogs(logs);
      } else {
        const logs = await fetchAPI<VerifyLog[]>(`${endpoint}?${initialQuery}`);
        if (active) setVerifyLogs(logs);
      }
    };

    void loadInitialLogs()
      .catch((cause: unknown) => {
        if (!active) return;
        const message =
          cause instanceof Error ? cause.message : "Không thể tải nhật ký.";
        setLoadError(message);
        showToast(message, "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isReady]);

  const canManageAdminLogs =
    role === "PLATFORM_SUPER_ADMIN" || role === "TENANT_ADMIN";

  const scopeLabel =
    role === "PLATFORM_SUPER_ADMIN"
      ? "Toàn nền tảng"
      : role === "TENANT_ADMIN"
        ? "Toàn tổ chức"
        : "Tài khoản cá nhân";

  const copyText = (text: string, tag: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(tag);
    showToast("Đã sao chép vào bộ nhớ tạm", "success");
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === tag ? null : prev));
    }, 1800);
  };

  const openAuditDetailModal = (log: AuditLog) => {
    const Swal = getSwal();
    if (Swal) {
      void Swal.fire({
        title: `<span class="text-lg font-bold text-slate-900"><i class="fa-solid fa-file-lines text-indigo-600 mr-2"></i>Chi tiết nhật ký #${log.id}</span>`,
        html: buildAuditDetailElement(log),
        width: 600,
        confirmButtonText: "Đóng",
        confirmButtonColor: "#4f46e5",
        customClass: {
          popup: "rounded-2xl",
          confirmButton: "rounded-xl font-bold px-6 py-2.5",
        },
      });
    } else {
      alert(
        `Audit #${log.id} (${log.action})\nPayload: ${JSON.stringify(log.payload ?? {}, null, 2)}`,
      );
    }
  };

  const checkAuditChain = async () => {
    setCheckingChain(true);
    try {
      const result = await fetchAPI<AuditIntegrityResult>(
        "/api/logs/audit/verify-chain",
      );
      setIntegrityResult(result);
      showToast(
        result.valid
          ? `Chuỗi khớp (${result.checked_entries} bản ghi, ${result.legacy_entries} đời cũ).`
          : `Phát hiện sai lệch tại bản ghi #${result.invalid_entry_id}.`,
        result.valid && result.legacy_entries === 0 ? "success" : "warning",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể kiểm tra chuỗi Audit.",
        "error",
      );
    } finally {
      setCheckingChain(false);
    }
  };

  const buildAuditQueryParams = (includeLimit = true) => {
    const params = new URLSearchParams();
    if (includeLimit) params.set("limit", auditLimit);
    if (actionFilter) params.set("action", actionFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (auditSince) params.set("since", toIsoBoundary(auditSince, false));
    if (auditUntil) params.set("until", toIsoBoundary(auditUntil, true));
    return params;
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = buildAuditQueryParams(true);
      const data = await fetchAPI<AuditLog[]>(`/api/logs/audit?${params}`);
      setAuditLogs(data || []);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Không thể tải nhật ký hoạt động.";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadVerifyLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: verifyLimit });
      if (validFilter) params.set("valid", validFilter);
      if (verifySince) params.set("since", toIsoBoundary(verifySince, false));
      if (verifyUntil) params.set("until", toIsoBoundary(verifyUntil, true));
      const data = await fetchAPI<VerifyLog[]>(`/api/logs/verify?${params}`);
      setVerifyLogs(data || []);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Không thể tải lịch sử xác thực.";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: "audit" | "verify") => {
    setActiveTab(tab);
    if (tab === "audit") {
      void loadAuditLogs();
    } else {
      void loadVerifyLogs();
    }
  };

  const resetAuditFilters = () => {
    setSearchParams(
      {
        action: null,
        status: null,
        since: null,
        until: null,
        limit: null,
      },
      "replace",
    );
    setLoading(true);
    fetchAPI<AuditLog[]>("/api/logs/audit?limit=50")
      .then((data) => setAuditLogs(data || []))
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error ? cause.message : "Không thể tải nhật ký.";
        setLoadError(message);
        showToast(message, "error");
      })
      .finally(() => setLoading(false));
  };

  const resetVerifyFilters = () => {
    setSearchParams(
      {
        valid: null,
        verifySince: null,
        verifyUntil: null,
        verifyLimit: null,
      },
      "replace",
    );
    setLoading(true);
    fetchAPI<VerifyLog[]>("/api/logs/verify?limit=50")
      .then((data) => setVerifyLogs(data || []))
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error ? cause.message : "Không thể tải lịch sử.";
        setLoadError(message);
        showToast(message, "error");
      })
      .finally(() => setLoading(false));
  };

  if (!isReady || loading) return <DataSkeleton />;

  const renderActionBadge = (action: string) => {
    const meta = ACTION_META[action] || {
      label: action,
      badge: "text-slate-700 bg-slate-100 border-slate-200",
    };
    return (
      <span
        className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}
        title={action}
      >
        {meta.label}
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    if (status === "SUCCESS") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          Thành công
        </span>
      );
    }
    if (status === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
          Thất bại
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
        Đang xử lý
      </span>
    );
  };

  const exportCsvHref = `/api/logs/audit/export?${buildAuditQueryParams(false)}`;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-slate-50/80">
      <main className="w-full grow px-4 py-6 sm:px-6 lg:px-8">
        {loadError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {loadError}
          </div>
        )}
        {/* Top Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <i className="fa-solid fa-clock-rotate-left text-base"></i>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Nhật ký kiểm toán & Xác thực
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  <i className="fa-solid fa-eye text-[10px] text-indigo-600"></i>
                  Phạm vi: {scopeLabel}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                Truy vết thao tác bảo mật được niêm phong chuỗi HMAC-SHA256 và
                lịch sử đối soát văn bằng.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canManageAdminLogs && (
              <button
                type="button"
                disabled={checkingChain}
                onClick={() => void checkAuditChain()}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 cursor-pointer"
              >
                <i
                  className={`fa-solid ${
                    checkingChain ? "fa-spinner fa-spin" : "fa-link"
                  }`}
                ></i>
                <span>Kiểm tra chuỗi HMAC</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                activeTab === "audit"
                  ? void loadAuditLogs()
                  : void loadVerifyLogs()
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
            >
              <i
                className={`fa-solid fa-rotate-right ${
                  loading ? "fa-spin text-indigo-600" : ""
                }`}
              ></i>
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* HMAC Integrity Banner */}
        {integrityResult && (
          <div
            className={`mb-6 flex flex-col justify-between gap-3 rounded-2xl border p-4 text-xs sm:flex-row sm:items-center ${
              integrityResult.valid && integrityResult.legacy_entries === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <i
                className={`fa-solid mt-0.5 text-base ${
                  integrityResult.valid
                    ? "fa-circle-check text-emerald-600"
                    : "fa-triangle-exclamation text-rose-600"
                }`}
              ></i>
              <div>
                <p className="font-bold">
                  {integrityResult.valid
                    ? `Chuỗi toàn vẹn HMAC khớp ${integrityResult.checked_entries} bản ghi (Bản ghi đời cũ chưa ký HMAC: ${integrityResult.legacy_entries}).`
                    : `Cảnh báo: Chuỗi băm bị đứt gãy tại bản ghi #${integrityResult.invalid_entry_id}.`}
                </p>
                <p className="mt-0.5 opacity-80">
                  Mỗi bản ghi mới đều liên kết mã băm với bản ghi liền trước để
                  chống sửa đổi dữ liệu lịch sử.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIntegrityResult(null)}
              className="self-end text-xs font-semibold underline opacity-75 hover:opacity-100 sm:self-center cursor-pointer"
            >
              Ẩn thông báo
            </button>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => handleTabChange("audit")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "audit"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-shield-halved"></i>
              <span>Nhật ký hệ thống (Audit)</span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                {auditLogs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("verify")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "verify"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-file-shield"></i>
              <span>Lịch sử xác thực (Verify)</span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                {verifyLogs.length}
              </span>
            </button>
          </div>

          {activeTab === "audit" && canManageAdminLogs && (
            <a
              href={exportCsvHref}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <i className="fa-solid fa-file-csv text-emerald-600"></i>
              <span>Xuất báo cáo CSV</span>
            </a>
          )}
        </div>

        {/* TAB 1: AUDIT LOGS */}
        {activeTab === "audit" && (
          <>
            {/* Filter Toolbar */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void loadAuditLogs();
              }}
              className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-12"
            >
              <div className="lg:col-span-3">
                <label
                  htmlFor="audit-action-filter"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Loại hành động
                </label>
                <select
                  id="audit-action-filter"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Tất cả hành động</option>
                  {Object.entries(ACTION_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor="audit-status-filter"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Trạng thái
                </label>
                <select
                  id="audit-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Mọi trạng thái</option>
                  <option value="SUCCESS">Thành công</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="PENDING">Đang xử lý</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor="audit-since"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Từ ngày
                </label>
                <input
                  id="audit-since"
                  type="date"
                  value={auditSince}
                  onChange={(e) => setAuditSince(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor="audit-until"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Đến ngày
                </label>
                <input
                  id="audit-until"
                  type="date"
                  value={auditUntil}
                  onChange={(e) => setAuditUntil(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                <select
                  aria-label="Số dòng hiển thị"
                  value={auditLimit}
                  onChange={(e) => setAuditLimit(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="50">50 dòng</option>
                  <option value="100">100 dòng</option>
                  <option value="200">200 dòng</option>
                </select>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-indigo-700 cursor-pointer"
                >
                  Lọc dữ liệu
                </button>
                {(actionFilter || statusFilter || auditSince || auditUntil) && (
                  <button
                    type="button"
                    onClick={resetAuditFilters}
                    title="Đặt lại bộ lọc"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </form>

            {/* Audit Logs Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Thời gian
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Hành động
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Đối tượng
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Trạng thái
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Địa chỉ IP
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Chuỗi băm HMAC
                      </th>
                      <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Chi tiết
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-xs">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-12 text-center text-sm text-slate-400"
                        >
                          <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                          Đang tải nhật ký hệ thống...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-12 text-center text-sm text-slate-400"
                        >
                          Không tìm thấy bản ghi nhật ký phù hợp.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => {
                        const date = new Date(log.created_at).toLocaleString(
                          "vi-VN",
                        );
                        const hashShort = log.log_hash
                          ? `${log.log_hash.slice(0, 18)}...`
                          : "N/A";

                        return (
                          <tr
                            key={log.id}
                            className="transition-colors hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-600">
                              {date}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {renderActionBadge(log.action)}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {log.target_type && (
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {log.target_type}
                                </span>
                              )}
                              <span className="font-mono font-semibold text-slate-800">
                                {log.target_id ? `#${log.target_id}` : "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {renderStatusBadge(log.status)}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-500">
                              {log.ip_address || "Local"}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {log.log_hash ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyText(log.log_hash!, `hash-${log.id}`)
                                  }
                                  title="Nhấn để sao chép toàn bộ mã HMAC"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                                >
                                  <span>{hashShort}</span>
                                  <i
                                    className={`fa-solid ${
                                      copiedId === `hash-${log.id}`
                                        ? "fa-check text-emerald-600"
                                        : "fa-copy text-slate-400"
                                    }`}
                                  ></i>
                                </button>
                              ) : (
                                <span className="text-slate-400">N/A</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => openAuditDetailModal(log)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                              >
                                <i className="fa-solid fa-magnifying-glass-chart text-indigo-600"></i>
                                <span>Xem</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center">
                <span>
                  Đang hiển thị <strong>{auditLogs.length}</strong> bản ghi
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                  <i className="fa-solid fa-lock"></i>
                  Niêm phong toàn vẹn bằng chuỗi HMAC-SHA256
                </span>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: VERIFY LOGS */}
        {activeTab === "verify" && (
          <>
            {/* Verify Filter Toolbar */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void loadVerifyLogs();
              }}
              className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-12"
            >
              <div className="lg:col-span-3">
                <label
                  htmlFor="verify-valid-filter"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Kết quả đối soát
                </label>
                <select
                  id="verify-valid-filter"
                  value={validFilter}
                  onChange={(e) =>
                    setValidFilter(e.target.value as "" | "true" | "false")
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Tất cả kết quả</option>
                  <option value="true">Hợp lệ</option>
                  <option value="false">Không hợp lệ / Cảnh báo</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <label
                  htmlFor="verify-since"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Từ ngày
                </label>
                <input
                  id="verify-since"
                  type="date"
                  value={verifySince}
                  onChange={(e) => setVerifySince(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="lg:col-span-3">
                <label
                  htmlFor="verify-until"
                  className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Đến ngày
                </label>
                <input
                  id="verify-until"
                  type="date"
                  value={verifyUntil}
                  onChange={(e) => setVerifyUntil(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                <select
                  aria-label="Số dòng hiển thị"
                  value={verifyLimit}
                  onChange={(e) => setVerifyLimit(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="50">50 dòng</option>
                  <option value="100">100 dòng</option>
                  <option value="200">200 dòng</option>
                </select>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-indigo-700 cursor-pointer"
                >
                  Lọc dữ liệu
                </button>
                {(validFilter || verifySince || verifyUntil) && (
                  <button
                    type="button"
                    onClick={resetVerifyFilters}
                    title="Đặt lại bộ lọc"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </form>

            {/* Verify Logs List */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
              {loading ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                  Đang tải lịch sử xác thực...
                </div>
              ) : verifyLogs.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Chưa có lượt xác thực văn bằng nào phù hợp.
                </div>
              ) : (
                <div className="space-y-4">
                  {verifyLogs.map((log) => {
                    const date = new Date(log.created_at).toLocaleString(
                      "vi-VN",
                    );

                    return (
                      <div
                        key={log.id}
                        className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 transition lg:flex-row lg:items-center ${
                          log.is_valid
                            ? "border-emerald-200/80 bg-emerald-50/20 hover:border-emerald-300"
                            : "border-rose-200/80 bg-rose-50/20 hover:border-rose-300"
                        }`}
                      >
                        {/* Left Metadata */}
                        <div className="space-y-2 lg:w-1/3 lg:border-r lg:border-slate-200/70 lg:pr-5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>
                              <i className="fa-regular fa-clock mr-1"></i>
                              {date}
                            </span>
                            {log.ip_address && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                                {log.ip_address}
                              </span>
                            )}
                          </div>

                          <div className="text-sm font-bold text-slate-900">
                            {log.tracking_id ? (
                              <Link
                                href={`/verify/${encodeURIComponent(log.tracking_id)}`}
                                className="inline-flex items-center gap-1.5 font-mono text-indigo-600 hover:underline"
                              >
                                <i className="fa-solid fa-qrcode text-xs"></i>
                                <span>{log.tracking_id}</span>
                              </Link>
                            ) : log.credential_id ? (
                              <span>Văn bằng #{log.credential_id}</span>
                            ) : (
                              <span className="text-slate-700">
                                Kiểm tra tệp PDF tải lên trực tiếp
                              </span>
                            )}
                          </div>

                          {/* 3 Sub-verification Pills */}
                          <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-semibold">
                            {log.is_integrity_valid !== null && (
                              <span
                                className={`rounded-md px-2 py-0.5 ${
                                  log.is_integrity_valid
                                    ? "bg-emerald-100/80 text-emerald-800"
                                    : "bg-rose-100/80 text-rose-800"
                                }`}
                              >
                                {log.is_integrity_valid
                                  ? "✓ Toàn vẹn PDF"
                                  : "✕ Tệp bị sửa"}
                              </span>
                            )}
                            {log.is_cert_valid !== null && (
                              <span
                                className={`rounded-md px-2 py-0.5 ${
                                  log.is_cert_valid
                                    ? "bg-emerald-100/80 text-emerald-800"
                                    : "bg-rose-100/80 text-rose-800"
                                }`}
                              >
                                {log.is_cert_valid
                                  ? "✓ Chứng thư hợp lệ"
                                  : "✕ Lỗi chứng thư"}
                              </span>
                            )}
                            {log.is_not_revoked !== null && (
                              <span
                                className={`rounded-md px-2 py-0.5 ${
                                  log.is_not_revoked
                                    ? "bg-emerald-100/80 text-emerald-800"
                                    : "bg-rose-100/80 text-rose-800"
                                }`}
                              >
                                {log.is_not_revoked
                                  ? "✓ Chưa thu hồi"
                                  : "✕ Đã thu hồi"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Verdict Message */}
                        <div className="flex items-start gap-3.5 lg:w-2/3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              log.is_valid
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-rose-100 text-rose-600"
                            }`}
                          >
                            <i
                              className={`fa-solid ${
                                log.is_valid
                                  ? "fa-check"
                                  : "fa-triangle-exclamation"
                              }`}
                            ></i>
                          </div>
                          <div>
                            <p
                              className={`text-xs font-extrabold uppercase tracking-wide ${
                                log.is_valid
                                  ? "text-emerald-800"
                                  : "text-rose-800"
                              }`}
                            >
                              {log.is_valid
                                ? "Kết quả xác thực: Hợp lệ"
                                : "Kết quả xác thực: Không hợp lệ / Cảnh báo"}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-700">
                              {log.message || "Không có ghi chú chi tiết."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

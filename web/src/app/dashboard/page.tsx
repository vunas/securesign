"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, fetchAPIResponse } from "@/lib/api";
import { showToast, getSwal } from "@/lib/swal";
import { useClientSession } from "@/lib/hooks/use-client-session";
import DataSkeleton from "@/components/DataSkeleton";
import { useUrlSearchParams } from "@/lib/hooks/use-url-search-params";

interface KeyItem {
  id: number;
  name: string;
  algorithm: string;
  storage_type: "server";
  created_at: string;
  public_key: string;
  key_fingerprint: string;
  category: "ROOT_CA" | "INTERMEDIATE_CA" | "TSA" | "SIGNING" | "UNCERTIFIED" | "OTHER";
  is_revoked: boolean;
}

interface CredentialItem {
  id: number;
  name: string;
  hash: string;
  size: number;
  tracking_id: string;
  credential_number: string | null;
  recipient_name: string;
  status: "DRAFT" | "ISSUED" | "REVOKED";
  revocation_reason: string | null;
}

interface SignatureItem {
  id: number;
  credential_name: string;
  key_id: number;
  key_name: string;
  signer: string;
  algorithm: string;
  signed_at: string;
  signature_base64: string;
}

export interface DashboardData {
  stats: {
    total_keys: number;
    total_credentials: number;
    total_sigs: number;
    monthly_signing_limit: number;
    monthly_signing_used: number;
    period_start: string;
    period_end: string;
  };
  permissions: {
    can_manage_api_keys: boolean;
    can_revoke_keys: boolean;
    can_revoke_credentials: boolean;
  };
  keys: KeyItem[];
  credentials: CredentialItem[];
  signatures: SignatureItem[];
}

type DashboardSection = "overview" | "credentials" | "keys" | "audit";

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractDayLabel(signedAt: string): string {
  const isoMatch = signedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}`;
  const vnMatch = signedAt.match(/^(\d{2})\/(\d{2})\/\d{4}/);
  if (vnMatch) return `${vnMatch[1]}/${vnMatch[2]}`;
  return signedAt.slice(0, 10);
}

export default function DashboardClient() {
  const { user, isReady } = useClientSession();
  const { searchParams, setSearchParam } = useUrlSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const sectionParam = searchParams.get("section");
  const activeSection: DashboardSection =
    sectionParam === "credentials" ||
    sectionParam === "keys" ||
    sectionParam === "audit"
      ? sectionParam
      : "overview";
  const setActiveSection = (section: DashboardSection) =>
    setSearchParam("section", section === "overview" ? null : section, "push");

  // Search & filter states
  const [credSearch, setCredSearch] = useState("");
  const credentialStatusParam = searchParams.get("credentialStatus");
  const credStatusFilter: "ALL" | "ISSUED" | "REVOKED" =
    credentialStatusParam === "ISSUED" || credentialStatusParam === "REVOKED"
      ? credentialStatusParam
      : "ALL";
  const setCredStatusFilter = (status: "ALL" | "ISSUED" | "REVOKED") =>
    setSearchParam(
      "credentialStatus",
      status === "ALL" ? null : status,
      "replace",
    );
  const [sigSearch, setSigSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Revoke credential modal states
  const [revokeTarget, setRevokeTarget] = useState<CredentialItem | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokePassword, setRevokePassword] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [revoking, setRevoking] = useState(false);

  const username = user?.username ?? "";

  const loadDashboard = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await fetchAPI<DashboardData>("/dashboard-api/summary"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể tải Dashboard.";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void fetchAPI<DashboardData>("/dashboard-api/summary")
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Không thể tải Dashboard.";
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

  const signingChartData = useMemo(() => {
    const sigs = data?.signatures ?? [];
    if (!sigs.length) return [];
    const counts = new Map<string, number>();
    [...sigs].reverse().forEach((s) => {
      const day = extractDayLabel(s.signed_at);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    });
    const entries = Array.from(counts.entries()).slice(-7);
    const maxVal = Math.max(...entries.map(([, c]) => c), 1);
    return entries.map(([label, count]) => ({
      label,
      count,
      heightPercent: Math.max(14, Math.round((count / maxVal) * 100)),
    }));
  }, [data?.signatures]);

  const credentialBreakdown = useMemo(() => {
    const list = data?.credentials ?? [];
    const total = list.length;
    const issued = list.filter((c) => c.status === "ISSUED").length;
    const revoked = list.filter((c) => c.status === "REVOKED").length;
    const draft = list.filter((c) => c.status === "DRAFT").length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      issued,
      revoked,
      draft,
      issuedPct: pct(issued),
      revokedPct: pct(revoked),
      draftPct: pct(draft),
    };
  }, [data?.credentials]);

  if (!isReady || loading) return <DataSkeleton />;
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50/80">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl grow px-4 py-16">
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-700"
          >
            {loadError || "Không thể tải dữ liệu Dashboard."}
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="ml-3 font-semibold underline"
            >
              Thử lại
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const copyToClipboard = (text: string, tag: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(tag);
    showToast("Đã sao chép vào bộ nhớ tạm", "success");
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === tag ? null : prev));
    }, 1800);
  };

  const openRevokeModal = (credential: CredentialItem) => {
    setRevokeTarget(credential);
    setRevokeReason("");
    setRevokePassword("");
    setRevokeError("");
  };

  const closeRevokeModal = () => {
    if (revoking) return;
    setRevokeTarget(null);
    setRevokeReason("");
    setRevokePassword("");
    setRevokeError("");
  };

  const handleRevokeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!revokeTarget) return;

    const trimmedReason = revokeReason.trim();
    if (!trimmedReason || !revokePassword) {
      setRevokeError("Vui lòng nhập đầy đủ lý do và mật khẩu xác nhận.");
      return;
    }

    setRevoking(true);
    setRevokeError("");

    try {
      const response = await fetchAPIResponse(
        `/api/credentials/${revokeTarget.id}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: revokePassword,
            reason: trimmedReason,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        const detail = result.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail?.message || "Không thể thu hồi văn bằng.",
        );
      }
      const refreshed = await fetchAPI<DashboardData>("/dashboard-api/summary");
      setData(refreshed);
      setRevokeTarget(null);
      setRevokeReason("");
      setRevokePassword("");
      showToast("Đã thu hồi văn bằng", "success");
    } catch (error: unknown) {
      setRevokeError(
        error instanceof Error ? error.message : "Không thể thu hồi văn bằng.",
      );
    } finally {
      setRevoking(false);
    }
  };

  const revokeKey = async (key: KeyItem) => {
    const Swal = getSwal();
    if (Swal) {
      const confirmResult = await Swal.fire({
        icon: "warning",
        title: "Thu hồi vĩnh viễn khóa ký số?",
        html: `<p class="text-sm text-slate-600">Khóa <b class="text-slate-900">${escapeHtml(key.name)}</b> và chứng thư X.509 liên kết sẽ ngừng hoạt động ngay lập tức.</p>`,
        showCancelButton: true,
        confirmButtonText: "Thu hồi vĩnh viễn",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#e11d48",
      });
      if (!confirmResult.isConfirmed) return;
    } else if (
      !window.confirm(`Thu hồi vĩnh viễn khóa "${key.name}" và chứng thư liên kết?`)
    ) {
      return;
    }

    try {
      await fetchAPI(`/api/keys/${key.id}/revoke`, "POST");
      const refreshed = await fetchAPI<DashboardData>("/dashboard-api/summary");
      setData(refreshed);
      showToast("Đã thu hồi vĩnh viễn khóa và chứng thư liên kết.", "success");
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Không thể thu hồi khóa.",
        "error",
      );
    }
  };

  const downloadPubKey = (key: KeyItem) => {
    const blob = new Blob([key.public_key], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `public_key_${key.id}.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast("Đã tải Public Key an toàn", "success");
  };

  const viewPubKey = (key: KeyItem) => {
    const Swal = getSwal();
    if (Swal) {
      Swal.fire({
        title:
          '<span class="text-lg font-bold text-slate-900"><i class="fa-solid fa-key text-indigo-600 mr-2"></i>Khóa Công Khai (Public Key)</span>',
        html: `<div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <textarea readonly class="h-56 w-full resize-none border-0 bg-transparent p-2 font-mono text-xs leading-relaxed text-slate-700 outline-none">${escapeHtml(key.public_key)}</textarea>
               </div>
               <p class="mt-3 text-left text-xs text-slate-500"><i class="fa-solid fa-circle-info text-indigo-600 mr-1"></i> Public Key này được nhúng công khai vào PDF để đối tác xác thực chữ ký của tổ chức.</p>`,
        width: 650,
        confirmButtonText: "Đóng",
        confirmButtonColor: "#4f46e5",
      });
    } else {
      alert(key.public_key);
    }
  };

  const viewSignatureDetails = (sig: SignatureItem) => {
    const Swal = getSwal();
    if (Swal) {
      Swal.fire({
        title:
          '<span class="text-lg font-bold text-slate-900"><i class="fa-solid fa-file-shield text-indigo-600 mr-2"></i>Chi Tiết Chữ Ký Số</span>',
        html: `<div class="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs">
              <div><span class="text-slate-500">Tài liệu:</span> <b class="text-slate-900">${escapeHtml(sig.credential_name)}</b></div>
              <div><span class="text-slate-500">Người đại diện ký:</span> <b class="text-slate-900">${escapeHtml(sig.signer)}</b></div>
              <div><span class="text-slate-500">Khóa sử dụng:</span> <b class="text-slate-900">${escapeHtml(sig.key_name)}</b></div>
              <div><span class="text-slate-500">Thuật toán:</span> <b class="font-mono text-indigo-700">${escapeHtml(sig.algorithm)}</b></div>
              <div><span class="text-slate-500">Thời gian (TSA):</span> <b class="text-slate-900">${escapeHtml(sig.signed_at)}</b></div>
              <div class="border-t border-slate-200 pt-2.5 font-mono text-[10px] break-all text-slate-600">
                <b class="text-slate-800">Giá trị chữ ký (Base64):</b><br/>${escapeHtml(sig.signature_base64.substring(0, 96))}...
              </div>
             </div>
             <p class="mt-3 text-left text-xs text-slate-500"><i class="fa-solid fa-shield-check text-emerald-600 mr-1"></i> Tệp PDF đã ký được trả trực tiếp về thiết bị của người phát hành theo kiến trúc Stateless.</p>`,
        width: 600,
        confirmButtonText: "Đóng",
        confirmButtonColor: "#4f46e5",
      });
    }
  };

  const quotaLimit = data?.stats.monthly_signing_limit ?? 0;
  const quotaUsed = data?.stats.monthly_signing_used ?? 0;
  const quotaPercent =
    quotaLimit > 0
      ? Math.min(100, Math.round((quotaUsed / quotaLimit) * 100))
      : 0;

  const filteredCredentials = (data?.credentials ?? []).filter((cred) => {
    const matchesStatus =
      credStatusFilter === "ALL" || cred.status === credStatusFilter;
    const q = credSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      cred.recipient_name.toLowerCase().includes(q) ||
      cred.tracking_id.toLowerCase().includes(q) ||
      (cred.credential_number ?? "").toLowerCase().includes(q) ||
      (cred.name ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const filteredSignatures = (data?.signatures ?? []).filter((sig) => {
    const q = sigSearch.trim().toLowerCase();
    return (
      !q ||
      sig.credential_name.toLowerCase().includes(q) ||
      sig.signer.toLowerCase().includes(q) ||
      sig.key_name.toLowerCase().includes(q)
    );
  });

  const navItems: {
    id: DashboardSection;
    label: string;
    icon: string;
    count?: number;
  }[] = [
    { id: "overview", label: "Tổng quan", icon: "fa-chart-pie" },
    {
      id: "credentials",
      label: "Văn bằng đã phát hành",
      icon: "fa-file",
      count: data?.stats.total_credentials,
    },
    {
      id: "keys",
      label: "Khóa & Chứng thư",
      icon: "fa-key",
      count: data?.stats.total_keys,
    },
    {
      id: "audit",
      label: "Nhật ký kiểm toán",
      icon: "fa-clock-rotate-left",
      count: data?.stats.total_sigs,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">
      <Navbar />

      {/* Full-width Main Container matching Navbar horizontal padding */}
      <main className="w-full grow px-4 py-6 sm:px-6 lg:px-8">
        {/* Mobile Section Switcher (< lg) */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className={`fa-solid ${item.icon}`}></i>
                <span>{item.label}</span>
                {typeof item.count === "number" && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Full-bleed 2-Column Workspace Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* LEFT SIDEBAR (Aligned from top) */}
          <aside className="hidden space-y-5 lg:sticky lg:top-20 lg:col-span-3 xl:col-span-2 lg:block">
            <nav className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Danh mục quản lý
              </div>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition cursor-pointer ${
                        active
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <i
                          className={`fa-solid ${item.icon} w-4 shrink-0 text-center ${
                            active ? "text-indigo-600" : "text-slate-400"
                          }`}
                        ></i>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.count === "number" && (
                        <span
                          className={`ml-1.5 shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] ${
                            active
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {data?.permissions.can_manage_api_keys && (
                <>
                  <div className="my-2.5 border-t border-slate-100" />
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Quản trị mở rộng
                  </div>
                  <div className="space-y-1">
                    <Link
                      href="/api-keys"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <span className="flex items-center gap-2.5">
                        <i className="fa-solid fa-plug w-4 text-center text-slate-400"></i>
                        API Keys
                      </span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400"></i>
                    </Link>
                    <Link
                      href="/team"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <span className="flex items-center gap-2.5">
                        <i className="fa-solid fa-users w-4 text-center text-slate-400"></i>
                        Nhân sự
                      </span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400"></i>
                    </Link>
                  </div>
                </>
              )}
            </nav>

            {/* Monthly Quota Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Hạn ngạch tháng
                </span>
                <span className="font-mono font-semibold text-indigo-600">
                  {loading ? "..." : `${quotaPercent}%`}
                </span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    quotaPercent >= 90 ? "bg-amber-500" : "bg-indigo-600"
                  }`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
                <span>Đã dùng</span>
                <span className="font-semibold text-slate-900">
                  {loading ? "..." : `${quotaUsed} / ${quotaLimit}`}
                </span>
              </div>
              {data?.stats.period_start && data?.stats.period_end && (
                <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">
                  {data.stats.period_start} → {data.stats.period_end}
                </p>
              )}
            </div>
          </aside>

          {/* RIGHT MAIN DASHBOARD WORKSPACE DIV */}
          <div className="space-y-6 lg:col-span-9 xl:col-span-10">
            {/* INTEGRATED WORKSPACE HEADER CARD */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    Không gian quản trị tổ chức
                  </h1>
                  {username && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      {username}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Theo dõi hạn ngạch ký số, quản lý danh sách văn bằng đã bảo
                  chứng và lịch sử kiểm toán.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                <Link
                  href="/sign"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700"
                >
                  <i className="fa-solid fa-pen-nib"></i>
                  Phát hành văn bằng
                </Link>
                <Link
                  href="/generate-key"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <i className="fa-solid fa-plus text-indigo-600"></i>
                  Khởi tạo khóa
                </Link>
              </div>
            </div>

            {/* KPI SUMMARY CARDS + VISUAL CHARTS (OVERVIEW) */}
            {activeSection === "overview" && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setActiveSection("keys")}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 cursor-pointer"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <i className="fa-solid fa-key text-lg"></i>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Khóa & Chứng thư
                      </p>
                      <p className="mt-0.5 text-2xl font-extrabold text-slate-900">
                        {loading ? "..." : (data?.stats.total_keys ?? 0)}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("credentials")}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 cursor-pointer"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <i className="fa-solid fa-file-pdf text-lg"></i>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Văn bằng phát hành
                      </p>
                      <p className="mt-0.5 text-2xl font-extrabold text-slate-900">
                        {loading ? "..." : (data?.stats.total_credentials ?? 0)}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("audit")}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 cursor-pointer"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <i className="fa-solid fa-signature text-lg"></i>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Lượt ký thành công
                      </p>
                      <p className="mt-0.5 text-2xl font-extrabold text-slate-900">
                        {loading ? "..." : (data?.stats.total_sigs ?? 0)}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <i className="fa-solid fa-gauge-high text-lg"></i>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Hạn ngạch tháng
                      </p>
                      <p className="mt-0.5 text-xl font-extrabold text-slate-900">
                        {loading ? "..." : `${quotaUsed} / ${quotaLimit}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* VISUAL ANALYTICS CHARTS ROW */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  {/* Chart 1: Smooth Area / Line Chart */}
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm xl:col-span-7">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Xu hướng ký phát hành gần đây
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Biến động số lượt ký số hoàn tất theo từng ngày hoạt
                          động
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/80 px-2.5 py-1 font-mono text-xs font-bold text-indigo-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                        Tổng: {data?.stats.total_sigs ?? 0} lượt
                      </span>
                    </div>

                    {loading ? (
                      <div className="flex h-52 items-center justify-center text-xs text-slate-400">
                        <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                        Đang tổng hợp biểu đồ...
                      </div>
                    ) : signingChartData.length === 0 ? (
                      <div className="mt-4 flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-xs text-slate-400">
                        <i className="fa-solid fa-chart-line mb-2 text-lg text-slate-300"></i>
                        Chưa có dữ liệu ký số để hiển thị biểu đồ đường
                      </div>
                    ) : (
                      (() => {
                        const width = 560;
                        const height = 185;
                        const padLeft = 34;
                        const padRight = 22;
                        const padTop = 24;
                        const padBottom = 28;
                        const plotW = width - padLeft - padRight;
                        const plotH = height - padTop - padBottom;
                        const maxCount = Math.max(
                          ...signingChartData.map((d) => d.count),
                          1,
                        );

                        const points = signingChartData.map((item, idx) => {
                          const x =
                            signingChartData.length === 1
                              ? padLeft + plotW / 2
                              : padLeft +
                                (idx / (signingChartData.length - 1)) * plotW;
                          const y =
                            padTop + plotH - (item.count / maxCount) * plotH;
                          return { ...item, x, y };
                        });

                        // Smooth cubic bezier path
                        const linePath = points.reduce((acc, pt, i, arr) => {
                          if (i === 0) return `M ${pt.x} ${pt.y}`;
                          const prev = arr[i - 1];
                          const cpX = (prev.x + pt.x) / 2;
                          return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`;
                        }, "");

                        const areaPath =
                          points.length > 1
                            ? `${linePath} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
                            : "";

                        const yTicks = [maxCount, Math.ceil(maxCount / 2), 0];

                        return (
                          <div className="mt-4 w-full">
                            <svg
                              viewBox={`0 0 ${width} ${height}`}
                              className="h-52 w-full overflow-visible"
                              role="img"
                              aria-label="Biểu đồ đường xu hướng ký số"
                            >
                              <defs>
                                <linearGradient
                                  id="signingAreaGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor="#4f46e5"
                                    stopOpacity="0.24"
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="#4f46e5"
                                    stopOpacity="0.0"
                                  />
                                </linearGradient>
                              </defs>

                              {/* Horizontal Gridlines & Y-axis labels */}
                              {yTicks.map((tickVal, idx) => {
                                const yPos =
                                  padTop + plotH - (tickVal / maxCount) * plotH;
                                return (
                                  <g key={`${tickVal}-${idx}`}>
                                    <line
                                      x1={padLeft}
                                      y1={yPos}
                                      x2={width - padRight}
                                      y2={yPos}
                                      stroke="#e2e8f0"
                                      strokeDasharray={
                                        tickVal === 0 ? undefined : "4 4"
                                      }
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={padLeft - 8}
                                      y={yPos + 4}
                                      textAnchor="end"
                                      className="fill-slate-400 font-mono text-[10px]"
                                    >
                                      {tickVal}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Area Fill */}
                              {areaPath && (
                                <path
                                  d={areaPath}
                                  fill="url(#signingAreaGradient)"
                                />
                              )}

                              {/* Smooth Curve Line */}
                              {points.length > 1 && (
                                <path
                                  d={linePath}
                                  fill="none"
                                  stroke="#4f46e5"
                                  strokeWidth="2.75"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}

                              {/* Data Nodes, Count Badges & X-Axis Labels */}
                              {points.map((pt) => (
                                <g key={pt.label} className="group">
                                  <line
                                    x1={pt.x}
                                    y1={pt.y}
                                    x2={pt.x}
                                    y2={padTop + plotH}
                                    stroke="#c7d2fe"
                                    strokeDasharray="3 3"
                                    strokeWidth="1"
                                  />
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r="5"
                                    className="fill-white stroke-indigo-600 transition-all group-hover:r-6"
                                    strokeWidth="2.75"
                                  />
                                  <text
                                    x={pt.x}
                                    y={pt.y - 10}
                                    textAnchor="middle"
                                    className="fill-slate-800 font-mono text-[11px] font-bold"
                                  >
                                    {pt.count}
                                  </text>
                                  <text
                                    x={pt.x}
                                    y={height - 6}
                                    textAnchor="middle"
                                    className="fill-slate-500 font-mono text-[11px] font-medium"
                                  >
                                    {pt.label}
                                  </text>
                                </g>
                              ))}
                            </svg>
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* Chart 2: Donut Chart (Credential Lifecycle Distribution) */}
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm xl:col-span-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Tình trạng hiệu lực văn bằng
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Tỷ trọng trạng thái xác thực trên cổng tra cứu
                      </p>
                    </div>

                    {(() => {
                      const size = 148;
                      const strokeWidth = 18;
                      const radius = (size - strokeWidth) / 2;
                      const circumference = 2 * Math.PI * radius;
                      const total = credentialBreakdown.total;

                      const segments = [
                        {
                          key: "issued",
                          label: "Đang có hiệu lực",
                          tag: "Issued",
                          count: credentialBreakdown.issued,
                          pct: credentialBreakdown.issuedPct,
                          color: "#10b981", // emerald-500
                          dotClass: "bg-emerald-500",
                        },
                        {
                          key: "revoked",
                          label: "Đã thu hồi",
                          tag: "Revoked",
                          count: credentialBreakdown.revoked,
                          pct: credentialBreakdown.revokedPct,
                          color: "#f43f5e", // rose-500
                          dotClass: "bg-rose-500",
                        },
                        {
                          key: "draft",
                          label: "Bản nháp",
                          tag: "Draft",
                          count: credentialBreakdown.draft,
                          pct: credentialBreakdown.draftPct,
                          color: "#94a3b8", // slate-400
                          dotClass: "bg-slate-400",
                        },
                      ];

                      let accumulatedRatio = 0;

                      return (
                        <div className="my-auto flex flex-col items-center gap-6 pt-4 sm:flex-row xl:flex-col 2xl:flex-row">
                          {/* Donut Ring */}
                          <div className="relative flex shrink-0 items-center justify-center">
                            <svg
                              width={size}
                              height={size}
                              viewBox={`0 0 ${size} ${size}`}
                              className="-rotate-90"
                              role="img"
                              aria-label="Biểu đồ tròn phân bổ trạng thái văn bằng"
                            >
                              {/* Base Track */}
                              <circle
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                stroke="#f1f5f9"
                                strokeWidth={strokeWidth}
                              />

                              {total > 0 &&
                                segments.map((seg) => {
                                  if (seg.count === 0) return null;
                                  const ratio = seg.count / total;
                                  const dashLength = ratio * circumference;
                                  const dashOffset =
                                    -accumulatedRatio * circumference;
                                  accumulatedRatio += ratio;

                                  return (
                                    <circle
                                      key={seg.key}
                                      cx={size / 2}
                                      cy={size / 2}
                                      r={radius}
                                      fill="none"
                                      stroke={seg.color}
                                      strokeWidth={strokeWidth}
                                      strokeDasharray={`${dashLength} ${circumference}`}
                                      strokeDashoffset={dashOffset}
                                      strokeLinecap={
                                        segments.filter((s) => s.count > 0)
                                          .length === 1
                                          ? "butt"
                                          : "round"
                                      }
                                      className="transition-all duration-500"
                                    />
                                  );
                                })}
                            </svg>

                            {/* Center Label inside Donut */}
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                              <span className="text-[11px] font-semibold text-slate-400">
                                Tổng cộng
                              </span>
                              <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                                {loading ? "..." : total}
                              </span>
                            </div>
                          </div>

                          {/* Legend List */}
                          <div className="w-full flex-1 space-y-2.5 text-xs">
                            {segments.map((seg) => (
                              <div
                                key={seg.key}
                                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                              >
                                <span className="flex items-center gap-2 font-medium text-slate-700">
                                  <span
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.dotClass}`}
                                  ></span>
                                  <span>{seg.label}</span>
                                </span>
                                <span className="font-mono font-bold text-slate-900">
                                  {seg.count}{" "}
                                  <span className="font-normal text-slate-400">
                                    ({seg.pct}%)
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* SECTION: VĂN BẰNG ĐÃ PHÁT HÀNH */}
            {(activeSection === "overview" ||
              activeSection === "credentials") && (
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-700">
                      <i className="fa-solid fa-folder-open text-sm"></i>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {activeSection === "overview"
                          ? "Văn bằng phát hành gần đây"
                          : "Danh sách văn bằng đã phát hành"}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Tra cứu mã xác thực công khai hoặc thu hồi hiệu lực văn
                        bằng
                      </p>
                    </div>
                  </div>

                  {activeSection === "overview" ? (
                    <button
                      type="button"
                      onClick={() => setActiveSection("credentials")}
                      className="self-start text-xs font-semibold text-indigo-600 hover:text-indigo-800 sm:self-auto cursor-pointer"
                    >
                      Xem tất cả ({data?.credentials.length ?? 0}) →
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={credSearch}
                        onChange={(e) => setCredSearch(e.target.value)}
                        placeholder="Tìm người nhận, số hiệu, mã..."
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                      />
                      <select
                        value={credStatusFilter}
                        onChange={(e) =>
                          setCredStatusFilter(
                            e.target.value as "ALL" | "ISSUED" | "REVOKED",
                          )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="ISSUED">Đã phát hành</option>
                        <option value="REVOKED">Đã thu hồi</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Văn bằng / Người nhận
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Mã tra cứu
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Trạng thái
                        </th>
                        <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-10 text-center text-sm text-slate-400"
                          >
                            <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                            Đang tải kho văn bằng...
                          </td>
                        </tr>
                      ) : filteredCredentials.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-10 text-center text-sm text-slate-400"
                          >
                            Không tìm thấy văn bằng phù hợp.
                          </td>
                        </tr>
                      ) : (
                        (activeSection === "overview"
                          ? filteredCredentials.slice(0, 5)
                          : filteredCredentials
                        ).map((cred) => (
                          <tr
                            key={cred.id}
                            className="transition-colors hover:bg-slate-50/70"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                                  <i className="fa-solid fa-file-pdf"></i>
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-900">
                                    {cred.credential_number ||
                                      cred.name ||
                                      "Văn bằng"}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {cred.recipient_name}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                              <div className="inline-flex items-center gap-2">
                                <Link
                                  href={`/verify/${encodeURIComponent(cred.tracking_id)}`}
                                  className="font-semibold text-indigo-600 hover:underline"
                                >
                                  {cred.tracking_id}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      cred.tracking_id,
                                      `cred-${cred.id}`,
                                    )
                                  }
                                  title="Sao chép mã tra cứu"
                                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  <i
                                    className={`fa-solid ${
                                      copiedId === `cred-${cred.id}`
                                        ? "fa-check text-emerald-600"
                                        : "fa-copy"
                                    }`}
                                  ></i>
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs">
                              {cred.status === "REVOKED" ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                  Đã thu hồi
                                </span>
                              ) : cred.status === "ISSUED" ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  Đã phát hành
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">
                                  Bản nháp
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-2">
                                <Link
                                  href={`/verify/${encodeURIComponent(cred.tracking_id)}`}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Đối soát
                                </Link>
                                {cred.status === "ISSUED" &&
                                  data?.permissions.can_revoke_credentials && (
                                    <button
                                      type="button"
                                      onClick={() => openRevokeModal(cred)}
                                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 cursor-pointer"
                                    >
                                      Thu hồi
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION: KHÓA & CHỨNG THƯ */}
            {(activeSection === "overview" || activeSection === "keys") && (
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-700">
                      <i className="fa-solid fa-key text-sm"></i>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Khóa ký & Chứng thư số tổ chức
                      </h2>
                      <p className="text-xs text-slate-500">
                        Quản lý cặp khóa mật mã KMS và xuất tệp Public Key
                        (.pem)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {data?.permissions.can_manage_api_keys && (
                      <Link
                        href="/api-keys"
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Quản lý API Key
                      </Link>
                    )}
                    <Link
                      href="/generate-key"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i>
                      Khởi tạo khóa
                    </Link>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Tên khóa / Fingerprint
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Lưu trữ & Trạng thái
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Ngày khởi tạo
                        </th>
                        <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                          Công cụ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-10 text-center text-sm text-slate-400"
                          >
                            <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                            Đang tải danh sách khóa...
                          </td>
                        </tr>
                      ) : !data?.keys || data.keys.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-10 text-center text-sm text-slate-400"
                          >
                            Tổ chức chưa khởi tạo khóa ký số nào.
                          </td>
                        </tr>
                      ) : (
                        data.keys.map((k) => (
                          <tr
                            key={k.id}
                            className="transition-colors hover:bg-slate-50/70"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-slate-900">
                                {k.name}
                              </div>
                              <div className="mt-1 inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                                <span>
                                  {k.algorithm} · {k.key_fingerprint}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                  <i className="fa-solid fa-server text-[10px]"></i>
                                  KMS Server
                                </span>
                                <span className="inline-flex items-center rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                  {{
                                    ROOT_CA: "Root CA",
                                    INTERMEDIATE_CA: "Intermediate CA",
                                    TSA: "TSA",
                                    SIGNING: "Khóa ký văn bằng",
                                    UNCERTIFIED: "Chưa cấp chứng thư",
                                    OTHER: "Khóa khác",
                                  }[k.category] || "Khóa khác"}
                                </span>
                                {k.is_revoked ? (
                                  <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                    Đã thu hồi
                                  </span>
                                ) : (
                                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                    Đang hoạt động
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                              {k.created_at}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => viewPubKey(k)}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-indigo-600 cursor-pointer"
                              >
                                <i className="fa-solid fa-eye mr-1.5"></i>Xem
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadPubKey(k)}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-emerald-600 cursor-pointer"
                              >
                                <i className="fa-solid fa-download mr-1.5"></i>
                                .PEM
                              </button>
                              {!k.is_revoked &&
                                data?.permissions.can_revoke_keys && (
                                  <button
                                    type="button"
                                    onClick={() => void revokeKey(k)}
                                    className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 cursor-pointer"
                                  >
                                    Thu hồi vĩnh viễn
                                  </button>
                                )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION: NHẬT KÝ KIỂM TOÁN */}
            {(activeSection === "overview" || activeSection === "audit") && (
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100/80 text-blue-700">
                      <i className="fa-solid fa-clock-rotate-left text-sm"></i>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Nhật ký kiểm toán chữ ký (Audit Trail)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Lịch sử ký phát hành kèm dấu thời gian TSA và thông tin
                        khóa sử dụng
                      </p>
                    </div>
                  </div>

                  {activeSection === "overview" ? (
                    <button
                      type="button"
                      onClick={() => setActiveSection("audit")}
                      className="self-start text-xs font-semibold text-indigo-600 hover:text-indigo-800 sm:self-auto cursor-pointer"
                    >
                      Xem toàn bộ ({data?.signatures.length ?? 0}) →
                    </button>
                  ) : (
                    <input
                      type="text"
                      value={sigSearch}
                      onChange={(e) => setSigSearch(e.target.value)}
                      placeholder="Tìm tài liệu, người ký, khóa..."
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                    />
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Tài liệu đã ký
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Khóa sử dụng
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Người đại diện ký
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Thời gian (TSA)
                        </th>
                        <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                          Chi tiết
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-10 text-center text-sm text-slate-400"
                          >
                            <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                            Đang tải lịch sử kiểm toán...
                          </td>
                        </tr>
                      ) : filteredSignatures.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-10 text-center text-sm text-slate-400"
                          >
                            Chưa có bản ghi ký duyệt nào.
                          </td>
                        </tr>
                      ) : (
                        (activeSection === "overview"
                          ? filteredSignatures.slice(0, 5)
                          : filteredSignatures
                        ).map((s) => (
                          <tr
                            key={s.id}
                            className="transition-colors hover:bg-slate-50/70"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                              <i className="fa-solid fa-file-signature mr-2 text-indigo-500"></i>
                              {s.credential_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600">
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                                {s.key_name}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-800">
                              {s.signer}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                              {s.signed_at}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => viewSignatureDetails(s)}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                              >
                                <i className="fa-solid fa-file-shield mr-1.5 text-indigo-600"></i>
                                Bằng chứng
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* REVOKE CREDENTIAL MODAL */}
      {revokeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <i className="fa-solid fa-ban text-sm"></i>
                </div>
                <div>
                  <h3
                    id="revoke-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Thu hồi hiệu lực văn bằng
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thao tác này không thể hoàn tác
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={revoking}
                onClick={closeRevokeModal}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleRevokeSubmit} className="space-y-4 p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
                Văn bằng{" "}
                <strong className="text-slate-900">
                  {revokeTarget.credential_number || revokeTarget.name}
                </strong>{" "}
                của{" "}
                <strong className="text-slate-900">
                  {revokeTarget.recipient_name}
                </strong>{" "}
                sẽ hiển thị cảnh báo đã bị thu hồi khi tra cứu công khai.
              </div>

              {revokeError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {revokeError}
                </div>
              )}

              <div>
                <label
                  htmlFor="revokeReasonInput"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Lý do thu hồi <span className="text-rose-500">*</span>
                </label>
                <input
                  id="revokeReasonInput"
                  type="text"
                  required
                  disabled={revoking}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="VD: Sai lệch thông tin văn bằng..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="revokePasswordInput"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Mật khẩu xác nhận <span className="text-rose-500">*</span>
                </label>
                <input
                  id="revokePasswordInput"
                  type="password"
                  required
                  disabled={revoking}
                  value={revokePassword}
                  onChange={(e) => setRevokePassword(e.target.value)}
                  placeholder="Nhập mật khẩu tài khoản hiện tại"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={revoking}
                  onClick={closeRevokeModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={revoking}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-55 cursor-pointer"
                >
                  {revoking ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Đang thu hồi...</span>
                    </>
                  ) : (
                    <span>Xác nhận thu hồi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

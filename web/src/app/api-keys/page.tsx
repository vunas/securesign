"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/lib/swal";
import { useClientSession } from "@/lib/hooks/use-client-session";
import DataSkeleton from "@/components/DataSkeleton";

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  rate_limit_per_min: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface ApiKeyCreated extends ApiKey {
  secret: string;
}

export default function ApiKeysClient() {
  const { isReady } = useClientSession("TENANT_ADMIN");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState(60);
  const [expiresAt, setExpiresAt] = useState("");

  const [newSecret, setNewSecret] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const items = await fetchAPI<ApiKey[]>("/api/api-keys");
      setKeys(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void fetchAPI<ApiKey[]>("/api/api-keys")
      .then((items) => {
        if (active) setKeys(items);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoadError(
          cause instanceof Error ? cause.message : "Không thể tải API keys.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isReady]);

  if (!isReady || loading) return <DataSkeleton />;

  const createKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    try {
      const created = await fetchAPI<ApiKeyCreated>("/api/api-keys", "POST", {
        name: trimmedName,
        rate_limit_per_min: rateLimit,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setNewSecret(created.secret);
      setCopiedSecret(false);
      setName("");
      setExpiresAt("");
      await loadKeys();
      showToast("Đã khởi tạo API key mới", "success");
    } catch {
      showToast(
        "Không thể tạo API key. Kiểm tra quyền quản trị tổ chức.",
        "error",
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmRevokeKey = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await fetchAPI(`/api/api-keys/${revokeTarget.id}`, "DELETE");
      await loadKeys();
      setRevokeTarget(null);
      showToast("API key đã được thu hồi.", "success");
    } catch {
      showToast("Không thể thu hồi API key.", "error");
    } finally {
      setRevoking(false);
    }
  };

  const copySecret = () => {
    if (!newSecret) return;
    void navigator.clipboard.writeText(newSecret);
    setCopiedSecret(true);
    showToast("Đã sao chép API secret", "success");
  };

  const filteredKeys = keys.filter((key) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      !q ||
      key.name.toLowerCase().includes(q) ||
      key.key_prefix.toLowerCase().includes(q)
    );
  });

  const activeCount = keys.filter((k) => k.is_active).length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl grow px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {loadError && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() =>
                void loadKeys().catch((cause: unknown) =>
                  setLoadError(
                    cause instanceof Error
                      ? cause.message
                      : "Không thể tải API keys.",
                  ),
                )
              }
              className="font-semibold underline"
            >
              Thử lại
            </button>
          </div>
        )}
        {/* Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <i className="fa-solid fa-plug text-base"></i>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Quản lý API Keys
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                  RESTful Integration
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                Cấp phát và thu hồi khóa tích hợp tự động từ hệ thống LMS, SIS
                hoặc ERP của tổ chức.
              </p>
            </div>
          </div>

          <div className="self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600 sm:self-auto">
            Đang hoạt động:{" "}
            <strong className="font-bold text-emerald-700">
              {activeCount}
            </strong>{" "}
            / {keys.length} khóa
          </div>
        </div>

        {/* One-time Secret Banner */}
        {newSecret && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
                  <span>
                    Lưu API Secret ngay bây giờ — Hệ thống không hiển thị lại
                  </span>
                </div>
                <p className="text-xs text-amber-800">
                  Truyền giá trị này vào HTTP Header{" "}
                  <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono font-semibold">
                    X-API-Key
                  </code>{" "}
                  khi gọi endpoint ký số hàng loạt.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-xl border border-amber-200 bg-white px-3.5 py-2 font-mono text-xs font-semibold text-slate-900 break-all">
                  {newSecret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    copiedSecret
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-300 bg-white text-slate-800 hover:bg-amber-100/50"
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      copiedSecret ? "fa-check" : "fa-copy"
                    }`}
                  ></i>
                  <span>{copiedSecret ? "Đã sao chép" : "Sao chép"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewSecret("")}
                  className="rounded-xl bg-amber-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-950 cursor-pointer"
                >
                  Tôi đã lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Horizontal Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* LEFT COLUMN: Create Form + Integration Guide (5 cols) */}
          <div className="space-y-5 lg:sticky lg:top-20 lg:col-span-5">
            <form
              onSubmit={createKey}
              className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
            >
              <div className="border-b border-slate-100 pb-3.5">
                <h2 className="text-base font-bold text-slate-900">
                  Khởi tạo API Key mới
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Thiết lập tên gợi nhớ, giới hạn tần suất và thời hạn sử dụng.
                </p>
              </div>

              <div>
                <label
                  htmlFor="apiKeyName"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Tên định danh ứng dụng{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  id="apiKeyName"
                  type="text"
                  required
                  maxLength={100}
                  disabled={creating}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="VD: Hệ thống Quản lý Đào tạo (SIS)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="rateLimit"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Giới hạn (req / phút){" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="rateLimit"
                    type="number"
                    min={1}
                    max={6000}
                    required
                    disabled={creating}
                    value={rateLimit}
                    onChange={(event) =>
                      setRateLimit(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="expiresAt"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Ngày hết hạn{" "}
                    <span className="font-normal text-slate-400">
                      (Tùy chọn)
                    </span>
                  </label>
                  <input
                    id="expiresAt"
                    type="datetime-local"
                    disabled={creating}
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
              >
                {creating ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Đang tạo khóa...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    <span>Tạo API Key</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Developer Reference */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <i className="fa-solid fa-code text-indigo-600"></i>
                <span>Cấu trúc xác thực Header</span>
              </div>
              <pre className="mt-2.5 overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
                {`POST /api/credentials/issue\nX-API-Key: <YOUR_API_SECRET>\nContent-Type: multipart/form-data`}
              </pre>
            </div>
          </div>

          {/* RIGHT COLUMN: API Keys Table (7 cols) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm lg:col-span-7">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Danh sách API Keys đã cấp
                </h2>
                <p className="text-xs text-slate-500">
                  Thu hồi ngay lập tức nếu khóa có dấu hiệu bị lộ
                </p>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên hoặc prefix..."
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Ứng dụng / Prefix
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Rate Limit
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
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-sm text-slate-400"
                      >
                        <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                        Đang tải danh sách API key...
                      </td>
                    </tr>
                  ) : filteredKeys.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-sm text-slate-400"
                      >
                        Chưa có API key nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map((key) => (
                      <tr
                        key={key.id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900">
                            {key.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                              {key.key_prefix}...
                            </code>
                            {key.expires_at && (
                              <span className="text-[11px] text-slate-400">
                                Hết hạn: {key.expires_at.slice(0, 10)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                          {key.rate_limit_per_min} req/p
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs">
                          {key.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              Đang hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                              Đã thu hồi
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          {key.is_active ? (
                            <button
                              type="button"
                              onClick={() => setRevokeTarget(key)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 cursor-pointer"
                            >
                              Thu hồi
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* REVOKE API KEY CONFIRMATION MODAL */}
      {revokeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <i className="fa-solid fa-ban text-sm"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Thu hồi API Key
                  </h3>
                  <p className="text-xs text-slate-500">
                    Các hệ thống đang dùng khóa này sẽ bị từ chối kết nối
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-xs leading-relaxed text-slate-600">
                Bạn có chắc chắn muốn vô hiệu hóa vĩnh viễn khóa{" "}
                <strong className="text-slate-900">{revokeTarget.name}</strong>{" "}
                (
                <code className="font-mono text-slate-800">
                  {revokeTarget.key_prefix}...
                </code>
                )?
              </p>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={revoking}
                  onClick={() => setRevokeTarget(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={revoking}
                  onClick={() => void confirmRevokeKey()}
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
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

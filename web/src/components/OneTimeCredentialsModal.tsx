"use client";

import { useState } from "react";
import { showToast } from "@/lib/swal";

export interface OneTimeCredentials {
  api_key: string;
  api_secret: string;
}

interface OneTimeCredentialsModalProps {
  credentials: OneTimeCredentials;
  onConfirm: () => void;
  title?: string;
  subtitle?: string;
}

export default function OneTimeCredentialsModal({
  credentials,
  onConfirm,
  title = "Thông tin tích hợp API ban đầu",
  subtitle = "Cấp phát tự động cho phiên kích hoạt đầu tiên",
}: OneTimeCredentialsModalProps) {
  const [hasCopiedSecret, setHasCopiedSecret] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const envContent = `SECURESIGN_API_KEY=${credentials.api_key}\nSECURESIGN_API_SECRET=${credentials.api_secret}\n`;

  const handleCopyEnv = () => {
    void navigator.clipboard?.writeText(envContent);
    setHasCopiedSecret(true);
    setCopiedEnv(true);
    showToast("Đã sao chép cấu hình .env", "success");
    window.setTimeout(() => setCopiedEnv(false), 1800);
  };

  const handleDownloadEnv = () => {
    const blob = new Blob([envContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "securesign-api.env";
    link.click();
    URL.revokeObjectURL(url);
    setHasCopiedSecret(true);
    showToast("Đã tải xuống securesign-api.env", "success");
  };

  const canProceed = hasCopiedSecret || acknowledged;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-fadeIn">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="one-time-api-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <i className="fa-solid fa-key text-sm"></i>
          </div>
          <div>
            <h2
              id="one-time-api-title"
              className="text-base font-bold text-slate-900"
            >
              {title}
            </h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 overflow-y-auto p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs leading-relaxed text-amber-900">
            <i className="fa-solid fa-triangle-exclamation mr-1.5 text-amber-600"></i>
            <strong>API Secret chỉ hiển thị duy nhất một lần.</strong> Hệ thống
            không lưu bản rõ nên không thể xem lại sau khi đóng cửa sổ này. Giá
            trị này dùng trong header{" "}
            <code className="rounded bg-amber-100/90 px-1.5 py-0.5 font-mono font-semibold">
              X-API-Key
            </code>{" "}
            khi gọi API phát hành văn bằng.
          </div>

          <div className="space-y-4">
            <CredentialRow label="API Key" value={credentials.api_key} />
            <CredentialRow
              label="API Secret"
              value={credentials.api_secret}
              sensitive
              onCopied={() => setHasCopiedSecret(true)}
            />
          </div>

          {/* Quick Developer Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyEnv}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
            >
              <i
                className={`fa-solid ${
                  copiedEnv
                    ? "fa-check text-emerald-600"
                    : "fa-code text-indigo-600"
                }`}
              ></i>
              <span>
                {copiedEnv ? "Đã sao chép .env" : "Sao chép dạng .env"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadEnv}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
            >
              <i className="fa-solid fa-download text-indigo-600"></i>
              <span>Tải tệp .env</span>
            </button>
          </div>

          {/* Fallback confirmation if user didn't click copy */}
          {!hasCopiedSecret && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Tôi xác nhận đã ghi lại <strong>API Secret</strong> hoặc không
                có nhu cầu sử dụng tích hợp API lúc này.
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            disabled={!canProceed}
            onClick={onConfirm}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <i className="fa-solid fa-arrow-right"></i>
            <span>Tiếp tục vào hệ thống</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  sensitive = false,
  onCopied,
}: {
  label: string;
  value: string;
  sensitive?: boolean;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        {sensitive && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200/80">
            Bảo mật
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <code
          className={`min-w-0 flex-1 break-all font-mono text-xs ${
            sensitive ? "font-semibold text-amber-800" : "text-slate-800"
          }`}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            copied
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
          }`}
        >
          <i
            className={`fa-solid ${copied ? "fa-check" : "fa-copy"} text-[11px]`}
          ></i>
          <span>{copied ? "Đã chép" : "Sao chép"}</span>
        </button>
      </div>
    </div>
  );
}

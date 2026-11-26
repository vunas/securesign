"use client";

import { useState } from "react";
import { fetchAPIResponse } from "@/lib/api";
import { showToast } from "@/lib/swal";
import type { CredentialItem } from "../_lib/types";

export default function RevokeCredentialModal({
  target,
  onClose,
  onRevoked,
}: {
  target: CredentialItem;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason || !password) {
      setError("Vui lòng nhập đầy đủ lý do và mật khẩu xác nhận.");
      return;
    }

    setRevoking(true);
    setError("");

    try {
      const response = await fetchAPIResponse(
        `/api/credentials/${target.id}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, reason: trimmedReason }),
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

      showToast("Đã thu hồi văn bằng", "success");
      onRevoked();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Không thể thu hồi văn bằng.",
      );
    } finally {
      setRevoking(false);
    }
  };

  return (
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
              <i className="fa-solid fa-ban text-sm" />
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
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
            Văn bằng{" "}
            <strong className="text-slate-900">
              {target.credential_number || target.name}
            </strong>{" "}
            của <strong className="text-slate-900">{target.recipient_name}</strong>{" "}
            sẽ hiển thị cảnh báo đã bị thu hồi khi tra cứu công khai.
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {error}
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
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu tài khoản hiện tại"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={revoking}
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={revoking}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-55"
            >
              {revoking ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
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
  );
}
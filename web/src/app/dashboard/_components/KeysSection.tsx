"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { getSwal, showToast } from "@/lib/swal";
import { escapeHtml, openPublicKeyModal } from "../_lib/utils";
import type { KeyItem } from "../_lib/types";

const CATEGORY_LABELS: Record<KeyItem["category"], string> = {
  ROOT_CA: "Root CA",
  INTERMEDIATE_CA: "Intermediate CA",
  TSA: "TSA",
  SIGNING: "Khóa ký văn bằng",
  UNCERTIFIED: "Chưa cấp chứng thư",
  OTHER: "Khóa khác",
};

export default function KeysSection({
  keys,
  canManageApiKeys,
  canRevokeKeys,
}: {
  keys: KeyItem[];
  canManageApiKeys: boolean;
  canRevokeKeys: boolean;
}) {
  const router = useRouter();

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
      showToast("Đã thu hồi vĩnh viễn khóa và chứng thư liên kết.", "success");
      router.refresh();
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Không thể thu hồi khóa.",
        "error",
      );
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-700">
            <i className="fa-solid fa-key text-sm" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Khóa ký & Chứng thư số tổ chức
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý cặp khóa mật mã KMS và xuất tệp Public Key (.pem)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageApiKeys && (
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
            <i className="fa-solid fa-plus text-[10px]" />
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
            {keys.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-10 text-center text-sm text-slate-400"
                >
                  Tổ chức chưa khởi tạo khóa ký số nào.
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr
                  key={k.id}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">
                      {k.name}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                      <span>
                        {k.algorithm} · {k.key_fingerprint}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        <i className="fa-solid fa-server text-[10px]" />
                        KMS Server
                      </span>
                      <span className="inline-flex items-center rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        {CATEGORY_LABELS[k.category] || "Khóa khác"}
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
                  <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">
                    {k.created_at}
                  </td>
                  <td className="space-x-1.5 whitespace-nowrap px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openPublicKeyModal(k)}
                      className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-indigo-600"
                    >
                      <i className="fa-solid fa-eye mr-1.5" />
                      Xem
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPubKey(k)}
                      className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <i className="fa-solid fa-download mr-1.5" />
                      .PEM
                    </button>
                    {!k.is_revoked && canRevokeKeys && (
                      <button
                        type="button"
                        onClick={() => void revokeKey(k)}
                        className="inline-flex cursor-pointer items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
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
  );
}
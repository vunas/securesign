"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/lib/swal";
import type { CredentialItem } from "../_lib/types";
import RevokeCredentialModal from "./RevokeCredentialModal";

export default function CredentialsSection({
  credentials,
  canRevokeCredentials,
  mode = "full",
}: {
  credentials: CredentialItem[];
  canRevokeCredentials: boolean;
  mode?: "preview" | "full";
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ISSUED" | "REVOKED">(
    "ALL",
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CredentialItem | null>(null);

  const copyToClipboard = (text: string, id: number) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    showToast("Đã sao chép vào bộ nhớ tạm", "success");
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const filtered = credentials.filter((cred) => {
    const matchesStatus =
      statusFilter === "ALL" || cred.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      cred.recipient_name.toLowerCase().includes(q) ||
      cred.tracking_id.toLowerCase().includes(q) ||
      (cred.credential_number ?? "").toLowerCase().includes(q) ||
      (cred.name ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const rows = mode === "preview" ? filtered.slice(0, 5) : filtered;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-700">
              <i className="fa-solid fa-folder-open text-sm" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === "preview"
                  ? "Văn bằng phát hành gần đây"
                  : "Danh sách văn bằng đã phát hành"}
              </h2>
              <p className="text-xs text-slate-500">
                Tra cứu mã xác thực công khai hoặc thu hồi hiệu lực văn bằng
              </p>
            </div>
          </div>

          {mode === "preview" ? (
            <Link
              href="/dashboard/credentials"
              className="self-start text-xs font-semibold text-indigo-600 hover:text-indigo-800 sm:self-auto"
            >
              Xem tất cả ({credentials.length}) →
            </Link>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm người nhận, số hiệu, mã..."
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    Không tìm thấy văn bằng phù hợp.
                  </td>
                </tr>
              ) : (
                rows.map((cred) => (
                  <tr
                    key={cred.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                          <i className="fa-solid fa-file-pdf" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {cred.credential_number || cred.name || "Văn bằng"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {cred.recipient_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
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
                            copyToClipboard(cred.tracking_id, cred.id)
                          }
                          title="Sao chép mã tra cứu"
                          className="cursor-pointer text-slate-400 hover:text-slate-700"
                        >
                          <i
                            className={`fa-solid ${
                              copiedId === cred.id
                                ? "fa-check text-emerald-600"
                                : "fa-copy"
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs">
                      {cred.status === "REVOKED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Đã thu hồi
                        </span>
                      ) : cred.status === "ISSUED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Đã phát hành
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">
                          Bản nháp
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/verify/${encodeURIComponent(cred.tracking_id)}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Đối soát
                        </Link>
                        {cred.status === "ISSUED" && canRevokeCredentials && (
                          <button
                            type="button"
                            onClick={() => setRevokeTarget(cred)}
                            className="cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
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

      {revokeTarget && (
        <RevokeCredentialModal
          target={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onRevoked={() => {
            setRevokeTarget(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
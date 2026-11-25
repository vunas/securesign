// src/app/dashboard/_components/AuditSection.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { openSignatureDetailsModal } from "../_lib/utils";
import type { SignatureItem } from "../_lib/types";

export default function AuditSection({
  signatures,
  mode = "full",
}: {
  signatures: SignatureItem[];
  mode?: "preview" | "full";
}) {
  const [search, setSearch] = useState("");

  const filtered = signatures.filter((sig) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      sig.credential_name.toLowerCase().includes(q) ||
      sig.signer.toLowerCase().includes(q) ||
      sig.key_name.toLowerCase().includes(q)
    );
  });

  const rows = mode === "preview" ? filtered.slice(0, 5) : filtered;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100/80 text-blue-700">
            <i className="fa-solid fa-clock-rotate-left text-sm" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Nhật ký kiểm toán chữ ký (Audit Trail)
            </h2>
            <p className="text-xs text-slate-500">
              Lịch sử ký phát hành kèm dấu thời gian TSA và thông tin khóa sử
              dụng
            </p>
          </div>
        </div>

        {mode === "preview" ? (
          <Link
            href="/dashboard/audit"
            className="self-start text-xs font-semibold text-indigo-600 hover:text-indigo-800 sm:self-auto"
          >
            Xem toàn bộ ({signatures.length}) →
          </Link>
        ) : (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-sm text-slate-400"
                >
                  Chưa có bản ghi ký duyệt nào.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr
                  key={s.id}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-slate-800">
                    <i className="fa-solid fa-file-signature mr-2 text-indigo-500" />
                    {s.credential_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                      {s.key_name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold text-slate-800">
                    {s.signer}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-500">
                    {s.signed_at}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openSignatureDetailsModal(s)}
                      className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <i className="fa-solid fa-file-shield mr-1.5 text-indigo-600" />
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
  );
}
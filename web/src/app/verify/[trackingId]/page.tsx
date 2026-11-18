"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { showToast } from "@/lib/swal";
import Image from "next/image";

interface CredentialStatus {
  tracking_id: string;
  credential_number: string | null;
  recipient_name: string;
  recipient_id: string | null;
  issue_date: string;
  status: "DRAFT" | "ISSUED" | "REVOKED";
  revocation_reason: string | null;
  revoked_at: string | null;
  organization_name: string;
  organization_logo_url: string | null;
  organization_website_url: string | null;
}

export default function TrackingPage() {
  const params = useParams<{ trackingId: string }>();
  const [credential, setCredential] = useState<CredentialStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const trackingId = encodeURIComponent(params.trackingId);
    fetch(`/api/verify/credentials/${trackingId}`)
      .then(async (response) => {
        if (response.status === 404)
          throw new Error("Không tìm thấy văn bằng với mã tra cứu này.");
        if (!response.ok) throw new Error("Không thể tra cứu văn bằng.");
        return (await response.json()) as CredentialStatus;
      })
      .then(setCredential)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tra cứu văn bằng.",
        );
      })
      .finally(() => setLoading(false));
  }, [params.trackingId]);

  const handleCopyTrackingId = () => {
    void navigator.clipboard?.writeText(params.trackingId);
    setCopied(true);
    showToast("Đã sao chép mã tra cứu", "success");
    window.setTimeout(() => setCopied(false), 1800);
  };

  const revoked = credential?.status === "REVOKED";
  const isDraft = credential?.status === "DRAFT";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl grow px-4 py-8 sm:px-6 lg:py-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          {/* Card Top Bar */}
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
            <div>
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                Hồ sơ xác thực văn bằng số
              </h1>
              <div className="mt-1 inline-flex items-center gap-2 font-mono text-xs text-slate-600">
                <span>Mã tra cứu:</span>
                <strong className="rounded bg-white px-2 py-0.5 text-indigo-700 ring-1 ring-slate-200">
                  {params.trackingId}
                </strong>
                <button
                  type="button"
                  onClick={handleCopyTrackingId}
                  title="Sao chép mã tra cứu"
                  className="text-slate-400 transition hover:text-slate-700 cursor-pointer"
                >
                  <i
                    className={`fa-solid ${
                      copied ? "fa-check text-emerald-600" : "fa-copy"
                    }`}
                  ></i>
                </button>
              </div>
            </div>

            <Link
              href={`/verify?trackingId=${encodeURIComponent(params.trackingId)}`}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:self-auto"
            >
              <i className="fa-solid fa-file-shield text-emerald-600"></i>
              <span>Kiểm tra tệp PDF</span>
            </Link>
          </div>

          <div className="p-6 sm:p-8">
            {loading && (
              <div className="py-12 text-center text-sm text-slate-500">
                <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
                Đang đối soát thông tin trên sổ cái...
              </div>
            )}

            {!loading && error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              >
                <i className="fa-solid fa-circle-xmark mt-0.5 text-rose-600"></i>
                <div>
                  <p className="font-bold">Không thể xác minh hồ sơ</p>
                  <p className="mt-0.5 text-xs text-rose-700">{error}</p>
                </div>
              </div>
            )}

            {!loading && credential && (
              <>
                {/* Status Banner */}
                <div
                  className={`flex items-start gap-3.5 rounded-xl border p-5 ${
                    revoked
                      ? "border-rose-200 bg-rose-50 text-rose-900"
                      : isDraft
                        ? "border-slate-200 bg-slate-100 text-slate-800"
                        : "border-emerald-200 bg-emerald-50/90 text-emerald-900"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      revoked
                        ? "bg-rose-100 text-rose-600"
                        : isDraft
                          ? "bg-slate-200 text-slate-600"
                          : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        revoked
                          ? "fa-ban"
                          : isDraft
                            ? "fa-file-lines"
                            : "fa-circle-check"
                      } text-lg`}
                    ></i>
                  </div>
                  <div>
                    <p className="text-base font-extrabold">
                      {revoked
                        ? "VĂN BẰNG ĐÃ BỊ THU HỒI HIỆU LỰC"
                        : isDraft
                          ? "HỒ SƠ BẢN NHÁP (CHƯA PHÁT HÀNH)"
                          : "VĂN BẰNG HỢP LỆ & ĐÃ ĐƯỢC PHÁT HÀNH"}
                    </p>
                    <p className="mt-0.5 text-xs opacity-85">
                      {revoked
                        ? "Đơn vị cấp đã hủy hiệu lực sử dụng của văn bằng này trên hệ thống."
                        : "Thông tin văn bằng được ghi nhận chính thức bởi đơn vị phát hành."}
                    </p>
                  </div>
                </div>

                {/* Credential Metadata */}
                <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Người được cấp
                    </dt>
                    <dd className="mt-1 text-base font-bold text-slate-900">
                      {credential.recipient_name}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Mã định danh người nhận
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-slate-800">
                      {credential.recipient_id || "Không cung cấp"}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Số hiệu văn bằng
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-slate-800">
                      {credential.credential_number || "Không cung cấp"}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Ngày cấp phát
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-800">
                      {new Date(
                        `${credential.issue_date}T00:00:00`,
                      ).toLocaleDateString("vi-VN")}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:col-span-2">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Đơn vị phát hành
                    </dt>
                    <dd className="mt-1.5 flex items-center gap-3">
                      {credential.organization_logo_url && (
                        <Image
                          src={credential.organization_logo_url}
                          alt={credential.organization_name}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
                        />
                      )}
                      {credential.organization_website_url ? (
                        <a
                          href={credential.organization_website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:underline"
                        >
                          <span>{credential.organization_name}</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                        </a>
                      ) : (
                        <span className="text-sm font-bold text-slate-900">
                          {credential.organization_name}
                        </span>
                      )}
                    </dd>
                  </div>

                  {revoked && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 sm:col-span-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                        Lý do thu hồi
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-rose-900">
                        {credential.revocation_reason ||
                          "Không nêu lý do cụ thể"}
                      </dd>
                      {credential.revoked_at && (
                        <p className="mt-1 text-xs text-rose-700">
                          Thời điểm thu hồi: {credential.revoked_at}
                        </p>
                      )}
                    </div>
                  )}
                </dl>

                {/* Cross-check Footer Note */}
                <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3.5 text-xs text-slate-600 sm:flex-row sm:items-center">
                  <p>
                    <i className="fa-solid fa-circle-info mr-1.5 text-indigo-600"></i>
                    Muốn kiểm tra tệp PDF trên tay có bị chỉnh sửa nội dung hay
                    không?
                  </p>
                  <Link
                    href={`/verify?trackingId=${encodeURIComponent(credential.tracking_id)}`}
                    className="shrink-0 font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Đối soát chữ ký tệp PDF →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

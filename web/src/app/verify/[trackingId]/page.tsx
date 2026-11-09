"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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

  useEffect(() => {
    const trackingId = encodeURIComponent(params.trackingId);
    fetch(`/api/verify/credentials/${trackingId}`)
      .then(async (response) => {
        if (response.status === 404) throw new Error("Không tìm thấy văn bằng.");
        if (!response.ok) throw new Error("Không thể tra cứu văn bằng.");
        return (await response.json()) as CredentialStatus;
      })
      .then(setCredential)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Không thể tra cứu văn bằng.");
      })
      .finally(() => setLoading(false));
  }, [params.trackingId]);

  const revoked = credential?.status === "REVOKED";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl grow px-4 py-12 sm:px-6">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Tra cứu văn bằng</h1>
          <p className="mt-2 break-all text-sm text-slate-500">
            Mã tra cứu: {params.trackingId}
          </p>

          {loading && <p className="mt-8 text-slate-600">Đang tra cứu...</p>}
          {!loading && error && (
            <div role="alert" className="mt-8 rounded-lg bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}
          {!loading && credential && (
            <>
              <div
                className={`mt-8 rounded-xl p-5 ${
                  revoked ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
                }`}
              >
                <p className="text-lg font-bold">
                  {revoked ? "VĂN BẰNG ĐÃ BỊ THU HỒI" : "VĂN BẰNG ĐÃ ĐƯỢC PHÁT HÀNH"}
                </p>
                <p className="mt-1 text-sm">
                  Trạng thái hồ sơ: {credential.status}
                </p>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Người nhận
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {credential.recipient_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Mã người nhận
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {credential.recipient_id || "Không cung cấp"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Số hiệu văn bằng
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {credential.credential_number || "Không cung cấp"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Ngày cấp
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {new Date(`${credential.issue_date}T00:00:00`).toLocaleDateString("vi-VN")}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Đơn vị cấp
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {credential.organization_website_url ? (
                      <a
                        href={credential.organization_website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline"
                      >
                        {credential.organization_name}
                      </a>
                    ) : (
                      credential.organization_name
                    )}
                  </dd>
                </div>
                {revoked && credential.revocation_reason && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-red-600">
                      Lý do thu hồi
                    </dt>
                    <dd className="mt-1 text-red-800">{credential.revocation_reason}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-500">
                Thông tin này chỉ xác nhận trạng thái phát hành và thu hồi. Để kiểm tra
                chữ ký điện tử và tính toàn vẹn, hãy tải PDF đã ký lên trang xác thực.
              </p>
            </>
          )}
          <Link href="/verify" className="mt-6 inline-block text-sm font-semibold text-blue-700">
            Xác thực tệp PDF
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

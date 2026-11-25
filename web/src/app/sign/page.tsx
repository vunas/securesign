"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI, fetchAPIResponse } from "@/lib/api";
import { showAlert, showAlertWithLinks } from "@/lib/swal";
import { useClientSession } from "@/lib/hooks/use-client-session";
import DataSkeleton from "@/components/DataSkeleton";

export interface KeyOption {
  id: number;
  key_name: string;
  algorithm: string;
  key_size: number;
  key_fingerprint: string;
  is_revoked?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const REASON_PRESETS = [
  "Cấp phát văn bằng",
  "Chứng nhận hoàn thành khóa học",
  "Cấp chứng chỉ nghiệp vụ",
  "Xác thực bản sao điện tử",
];

export default function SignClient() {
  const { user, isReady } = useClientSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [keys, setKeys] = useState<KeyOption[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysError, setKeysError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [recipientName, setRecipientName] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [credentialNumber, setCredentialNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const username = user?.username ?? "";
  const role = user?.role ?? "";
  const signerName = user?.full_name || user?.username || "";
  const [signerReason, setSignerReason] = useState("Cấp phát văn bằng");
  const [loading, setLoading] = useState(false);

  const [keyId, setKeyId] = useState("");

  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void fetchAPI<KeyOption[]>("/api/keys")
      .then((items) => {
        if (!active) return;
        const signingKeys = items.filter((item) => !item.is_revoked);
        setKeys(signingKeys);
        setKeyId(signingKeys.length ? String(signingKeys[0].id) : "");
        setIssueDate(new Date().toISOString().slice(0, 10));
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Không thể tải danh sách khóa.";
        setKeysError(message);
      })
      .finally(() => {
        if (active) setKeysLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isReady]);

  if (!isReady || keysLoading) return <DataSkeleton />;

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    if (
      selected.type !== "application/pdf" &&
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      void showAlert("Tệp không hợp lệ", "Chỉ chấp nhận tệp PDF.", "error");
      return;
    }
    if (selected.size === 0) {
      void showAlert("Tệp rỗng", "Tệp PDF không có dữ liệu.", "error");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      void showAlert("Tệp quá lớn", "Dung lượng tối đa là 20 MB.", "error");
      return;
    }
    setFile(selected);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !keyId) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("key_id", keyId);
    formData.append("recipient_name", recipientName.trim());
    if (recipientId.trim()) formData.append("recipient_id", recipientId.trim());
    if (credentialNumber.trim())
      formData.append("credential_number", credentialNumber.trim());
    if (issueDate) formData.append("issue_date", issueDate);
    formData.append("signer_name", signerName.trim());
    formData.append("signer_reason", signerReason.trim());

    try {
      const response = await fetchAPIResponse("/api/credentials/issue", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const detail = errorBody?.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail?.message || "Không thể phát hành văn bằng.",
        );
      }

      const trackingId = response.headers.get("X-Tracking-ID");
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("Máy chủ không trả về tệp PDF đã ký.");
      }
      const signedPdf = await response.blob();
      if (!signedPdf.size) {
        throw new Error("Tệp PDF đã ký bị rỗng.");
      }
      const downloadUrl = URL.createObjectURL(signedPdf);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const downloadName = file.name.replace(/\.pdf$/i, "") + "-signed.pdf";
      link.download = downloadName;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }

      const verificationUrl = trackingId
        ? `${window.location.origin}/verify/${trackingId}`
        : "";
      try {
        await showAlertWithLinks(
          "Phát hành thành công",
          trackingId
            ? `Mã tra cứu: ${trackingId}. Hãy tải tệp PDF đã ký về máy.`
            : "Hãy tải tệp PDF đã ký về máy.",
          [
            {
              text: "Tải PDF đã ký",
              href: downloadUrl,
              download: downloadName,
            },
            ...(trackingId
              ? [{ text: "Mở hồ sơ xác thực", href: verificationUrl }]
              : []),
          ],
          "success",
        );
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }

      // Reset thông tin hồ sơ vừa cấp để tránh ký nhầm cho người tiếp theo
      clearFile();
      setRecipientName("");
      setRecipientId("");
      setCredentialNumber("");
    } catch (error: unknown) {
      await showAlert(
        "Không thể phát hành",
        error instanceof Error ? error.message : "Đã xảy ra lỗi.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedKey = keys.find((item) => String(item.id) === keyId);
  const isRecipientComplete = Boolean(recipientName.trim() && issueDate);
  const isSignerComplete = Boolean(signerName.trim() && signerReason.trim());
  const isReadyToSign = Boolean(
    file && keyId && isRecipientComplete && isSignerComplete,
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-slate-50/80">
      <main className="mx-auto w-full max-w-6xl grow px-4 py-6">
        {keysError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {keysError}
          </div>
        )}
        {/* Top Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <i className="fa-solid fa-pen-nib text-base"></i>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Phát hành văn bằng số
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                  PAdES + QR Verify
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                Tải lên tệp PDF gốc, khai báo thông tin người nhận và đóng dấu
                mật mã PAdES kèm mã QR xác thực.
              </p>
            </div>
          </div>

          {username && (
            <div className="self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600 sm:self-auto">
              Tài khoản phát hành:{" "}
              <span className="font-semibold text-slate-900">{username}</span>
            </div>
          )}
        </div>

        {/* 2-Column Horizontal Layout */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start"
        >
          {/* LEFT COLUMN: Form Inputs (8 cols) */}
          <div className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7 lg:col-span-8">
            {/* Step 1: Tệp PDF văn bằng */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    1
                  </span>
                  Tệp PDF văn bằng gốc <span className="text-rose-500">*</span>
                </h2>
                <span className="text-xs text-slate-400">
                  Định dạng .pdf (tối đa 20 MB)
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                required={!file}
                disabled={loading}
                onChange={(event) => selectFile(event.target.files?.[0])}
                className="sr-only"
              />

              {!file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
                    isDragOver
                      ? "border-indigo-500 bg-indigo-50/70"
                      : "border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/30"
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200/80 transition group-hover:scale-105">
                    <i className="fa-solid fa-file-arrow-up text-lg"></i>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    Nhấn để chọn tệp hoặc kéo thả PDF vào đây
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Mã QR xác thực sẽ được nhúng tại góc dưới bên trái trang
                    cuối của tài liệu
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <i className="fa-solid fa-file-pdf text-lg"></i>
                    </div>
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-slate-900"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Sẵn sàng
                        ký số
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                    >
                      Đổi tệp
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={clearFile}
                      title="Gỡ tệp"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Step 2: Thông tin văn bằng */}
            <div>
              <h2 className="mb-3.5 flex items-center gap-2 text-sm font-bold text-slate-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  2
                </span>
                Thông tin văn bằng & Người nhận
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="recipientName"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Họ tên người nhận <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="recipientName"
                    type="text"
                    required
                    maxLength={150}
                    disabled={loading}
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="VD: Nguyễn Văn An"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="recipientId"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Mã người nhận{" "}
                    <span className="font-normal text-slate-400">
                      (MSSV / CCCD)
                    </span>
                  </label>
                  <input
                    id="recipientId"
                    type="text"
                    maxLength={50}
                    disabled={loading}
                    value={recipientId}
                    onChange={(event) => setRecipientId(event.target.value)}
                    placeholder="VD: SV2026001"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="credentialNumber"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Số hiệu văn bằng{" "}
                    <span className="font-normal text-slate-400">
                      (Số vào sổ)
                    </span>
                  </label>
                  <input
                    id="credentialNumber"
                    type="text"
                    maxLength={100}
                    disabled={loading}
                    value={credentialNumber}
                    onChange={(event) =>
                      setCredentialNumber(event.target.value)
                    }
                    placeholder="VD: VB-2026/0892"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="issueDate"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Ngày cấp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="issueDate"
                    type="date"
                    required
                    disabled={loading}
                    value={issueDate}
                    onChange={(event) => setIssueDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Step 3: Cấu hình khóa & Người ký */}
            <div>
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    3
                  </span>
                  Khóa ký & Thẩm quyền ký duyệt
                </h2>
                {role !== "TENANT_OPERATOR" && (
                  <button
                    type="button"
                    onClick={() => router.push("/generate-key")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-[10px]"></i>
                    Tạo khóa mới
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="keySelect"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Khóa ký sử dụng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="keySelect"
                    required
                    disabled={loading || keys.length === 0}
                    value={keyId}
                    onChange={(event) => setKeyId(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  >
                    <option value="">
                      {keys.length === 0
                        ? "Chưa có khóa khả dụng"
                        : "-- Chọn khóa ký --"}
                    </option>
                    {keys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.key_name} ({key.algorithm} {key.key_size}-bit)
                      </option>
                    ))}
                  </select>

                  {keys.length === 0 && (
                    <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
                      <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0 text-amber-600"></i>
                      <div className="leading-relaxed">
                        <span className="font-semibold text-amber-900">
                          Tổ chức chưa có khóa ký khả dụng.
                        </span>
                        <p className="mt-0.5 text-amber-700">
                          Vui lòng liên hệ{" "}
                          <strong className="font-semibold text-amber-900">
                            Quản trị viên tổ chức (Tenant Admin)
                          </strong>{" "}
                          để khởi tạo khóa và cấp chứng thư số trước khi thực
                          hiện ký văn bằng.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="signerName"
                    className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700"
                  >
                    <span>
                      Người đại diện ký <span className="text-rose-500">*</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-500">
                      <i className="fa-solid fa-lock text-[10px] text-slate-400"></i>
                      Định danh tài khoản
                    </span>
                  </label>
                  <input
                    id="signerName"
                    type="text"
                    required
                    readOnly
                    disabled={loading}
                    value={signerName}
                    placeholder="Họ tên từ tài khoản đăng nhập"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-3.5 py-2.5 text-sm font-medium text-slate-700 cursor-not-allowed transition focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tự động gắn vào metadata chữ ký và Nhật ký kiểm toán.
                  </p>
                </div>

                {/* Taller Textarea for Signer Reason + Quick Presets */}
                <div className="sm:col-span-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="signerReason"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Lý do ký (Metadata PAdES){" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="font-mono text-[11px] text-slate-400">
                      {signerReason.length}/255
                    </span>
                  </div>

                  <textarea
                    id="signerReason"
                    rows={3}
                    required
                    maxLength={255}
                    disabled={loading}
                    value={signerReason}
                    onChange={(event) => setSignerReason(event.target.value)}
                    placeholder="Nhập mục đích hoặc căn cứ pháp lý ký duyệt (VD: Cấp phát bằng tốt nghiệp đại học theo QĐ số 128/QĐ-ĐHSG)..."
                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] font-medium text-slate-400">
                      Gợi ý nhanh:
                    </span>
                    {REASON_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={loading}
                        onClick={() => setSignerReason(preset)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                          signerReason === preset
                            ? "border-indigo-200 bg-indigo-50 font-semibold text-indigo-700"
                            : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Technical Specs, Readiness & Submit (4 cols) */}
          <div className="space-y-5 lg:sticky lg:top-20 lg:col-span-4">
            {/* Card 1: Selected Cryptographic Key Details */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/60 px-5 py-3.5">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
                  <i className="fa-solid fa-shield-halved text-indigo-600"></i>
                  Thông số mật mã & Quy cách
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                    isReadyToSign
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isReadyToSign ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  ></span>
                  {isReadyToSign ? "Sẵn sàng ký" : "Chưa đủ điều kiện"}
                </span>
              </div>

              <div className="divide-y divide-slate-100 px-5 py-1.5 text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-500">Khóa ký đang chọn</span>
                  <span className="max-w-[58%] truncate font-bold text-slate-900">
                    {selectedKey ? selectedKey.key_name : "Chưa chọn khóa"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-500">Thuật toán</span>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono font-semibold text-indigo-700">
                    {selectedKey
                      ? `${selectedKey.algorithm} ${selectedKey.key_size}-bit`
                      : "—"}
                  </span>
                </div>

                <div className="py-2.5">
                  <span className="block text-slate-500">
                    Key Fingerprint (SHA-256)
                  </span>
                  <code className="mt-1 block break-all rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                    {selectedKey
                      ? selectedKey.key_fingerprint
                      : "Chưa có dữ liệu"}
                  </code>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-500">Chuẩn chữ ký</span>
                  <span className="font-semibold text-slate-800">
                    PAdES + RFC 3161 TSA
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-500">Vị trí mã QR nhúng</span>
                  <span className="font-medium text-slate-700">
                    Góc dưới trái trang cuối
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-500">Lưu trữ tệp gốc</span>
                  <span className="font-semibold text-emerald-700">
                    Stateless (Không lưu PDF)
                  </span>
                </div>
              </div>

              {/* Readiness Checklist */}
              <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Điều kiện phát hành
                </p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center gap-2">
                    <i
                      className={`fa-solid ${
                        file
                          ? "fa-circle-check text-emerald-600"
                          : "fa-circle text-slate-300"
                      }`}
                    ></i>
                    <span
                      className={file ? "text-slate-700" : "text-slate-500"}
                    >
                      Tệp PDF hợp lệ (dưới 20 MB)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <i
                      className={`fa-solid ${
                        keyId
                          ? "fa-circle-check text-emerald-600"
                          : "fa-circle text-slate-300"
                      }`}
                    ></i>
                    <span
                      className={keyId ? "text-slate-700" : "text-slate-500"}
                    >
                      Khóa ký tổ chức đang hoạt động
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <i
                      className={`fa-solid ${
                        isRecipientComplete && isSignerComplete
                          ? "fa-circle-check text-emerald-600"
                          : "fa-circle text-slate-300"
                      }`}
                    ></i>
                    <span
                      className={
                        isRecipientComplete && isSignerComplete
                          ? "text-slate-700"
                          : "text-slate-500"
                      }
                    >
                      Đầy đủ người nhận, ngày cấp & lý do ký
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isReadyToSign}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Đang ký và phát hành...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-signature"></i>
                  <span>Ký và phát hành văn bằng</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

    </div>
  );
}

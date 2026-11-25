"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { showAlert } from "@/lib/swal";

interface SignerInfo {
  subject: string;
  issuer: string;
  reason: string;
  has_tsa: boolean;
  is_entire_file: boolean;
}

interface VerifyResult {
  is_valid: boolean;
  message: string;
  signer_info?: SignerInfo;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function isVerifyResult(value: unknown): value is VerifyResult {
  if (
    !value ||
    typeof value !== "object" ||
    !("is_valid" in value) ||
    typeof value.is_valid !== "boolean" ||
    !("message" in value) ||
    typeof value.message !== "string"
  ) {
    return false;
  }

  if (!("signer_info" in value) || value.signer_info == null) {
    return true;
  }

  const signerInfo = value.signer_info;
  return (
    typeof signerInfo === "object" &&
    "subject" in signerInfo &&
    typeof signerInfo.subject === "string" &&
    "issuer" in signerInfo &&
    typeof signerInfo.issuer === "string" &&
    "reason" in signerInfo &&
    typeof signerInfo.reason === "string" &&
    "has_tsa" in signerInfo &&
    typeof signerInfo.has_tsa === "boolean" &&
    "is_entire_file" in signerInfo &&
    typeof signerInfo.is_entire_file === "boolean"
  );
}

function VerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [trackingId, setTrackingId] = useState(
    () => searchParams.get("trackingId") ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      void showAlert(
        "Định dạng không hỗ trợ",
        "Vui lòng tải lên tệp định dạng PDF.",
        "error",
      );
      return;
    }
    if (file.size === 0) {
      void showAlert("Tệp rỗng", "Tệp PDF không có dữ liệu.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      void showAlert("Tệp quá lớn", "Dung lượng tối đa là 20 MB.", "error");
      return;
    }
    setSelectedFile(file);
    setResult(null);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      await showAlert(
        "Chưa chọn tệp",
        "Vui lòng chọn tệp PDF cần kiểm tra.",
        "warning",
      );
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/verify/pdf", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          data && typeof data === "object" && "detail" in data
            ? data.detail
            : null;
        throw new Error(
          typeof detail === "string"
            ? detail
            : "Máy chủ không thể xác thực tệp PDF.",
        );
      }
      if (!isVerifyResult(data)) {
        throw new Error("Máy chủ trả về kết quả xác thực không hợp lệ.");
      }
      setResult(data);
    } catch (error: unknown) {
      setResult({
        is_valid: false,
        message:
          error instanceof Error
            ? error.message
            : "Không thể kết nối đến máy chủ xác thực.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl grow px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-200">
            <i className="fa-solid fa-shield-halved text-base"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Xác thực văn bằng & Chữ ký số
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Tra cứu trạng thái phát hành qua mã QR hoặc tải tệp PDF gốc để
              kiểm tra toàn vẹn chữ ký PAdES.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Tracking ID Lookup Bar */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trackingId.trim()) {
            router.push(`/verify/${encodeURIComponent(trackingId.trim())}`);
          }
        }}
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
      >
        <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-700">
          <i className="fa-solid fa-qrcode text-indigo-600"></i>
          <span>Tra cứu theo mã hồ sơ:</span>
        </div>
        <label htmlFor="tracking-id" className="sr-only">
          Mã tra cứu văn bằng
        </label>
        <input
          id="tracking-id"
          value={trackingId}
          onChange={(event) => setTrackingId(event.target.value)}
          placeholder="Nhập mã tra cứu trên văn bằng (VD: TRK-...)"
          className="min-w-0 grow rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          type="submit"
          disabled={!trackingId.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <i className="fa-solid fa-magnifying-glass"></i>
          <span>Tra cứu trạng thái</span>
        </button>
      </form>

      {/* Main 2-Column Equal-Height Verification Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: PDF Upload Form (7 cols) */}
        <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7 lg:col-span-7">
          <form
            onSubmit={handleVerify}
            className="flex flex-1 flex-col justify-between gap-5"
          >
            <div className="space-y-5">
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-800">
                    Kiểm tra tính toàn vẹn tệp PDF đã ký
                  </label>
                  <span className="text-xs text-slate-400">
                    Định dạng .pdf (tối đa 20 MB)
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="application/pdf,.pdf"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  className="hidden"
                />

                {!selectedFile ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      handleFileSelect(e.dataTransfer.files?.[0]);
                    }}
                    className={`group flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition ${
                      isDragOver
                        ? "border-emerald-500 bg-emerald-50/70"
                        : "border-slate-300 bg-slate-50/70 hover:border-emerald-500 hover:bg-emerald-50/30"
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-2xs ring-1 ring-slate-200/80 transition group-hover:scale-105">
                      <i className="fa-solid fa-file-shield text-lg"></i>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      Kéo thả tệp PDF vào đây hoặc nhấn để chọn
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Hệ thống bóc tách chữ ký PAdES và đối soát chuỗi chứng thư
                      Root CA
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <i className="fa-solid fa-file-pdf text-lg"></i>
                      </div>
                      <div className="min-w-0">
                        <span
                          className="block truncate text-sm font-semibold text-slate-900"
                          title={selectedFile.name}
                        >
                          {selectedFile.name}
                        </span>
                        <span className="text-xs text-emerald-700">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB •
                          Sẵn sàng kiểm tra
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                    >
                      Đổi tệp
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs leading-relaxed text-slate-600">
                <i className="fa-solid fa-circle-info mr-1.5 text-indigo-600"></i>
                Hệ thống kiểm tra hàm băm mật mã (SHA-256) và chữ ký bất đối
                xứng theo chuẩn PAdES, phát hiện mọi thay đổi dù chỉ một ký tự
                hoặc khoảng trắng sau thời điểm ký.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Đang phân tích cấu trúc PDF...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-shield-check"></i>
                  <span>Quét & Xác thực chữ ký</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Cryptographic Verification Result (5 cols) */}
        <div className="flex flex-col lg:col-span-5">
          {!result ? (
            <div className="flex min-h-70 flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <i className="fa-solid fa-file-circle-question text-2xl"></i>
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-700">
                Chờ tệp PDF kiểm tra
              </h2>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">
                Tải lên tệp văn bằng PDF ở cột bên trái để xem thông tin người
                ký, tổ chức cấp và tình trạng toàn vẹn dữ liệu.
              </p>
            </div>
          ) : result.is_valid ? (
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-emerald-500 bg-white shadow-sm">
              <div className="bg-emerald-50/90 px-6 py-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <i className="fa-solid fa-shield-halved text-xl"></i>
                </div>
                <h2 className="mt-3 text-lg font-extrabold text-emerald-800">
                  CHỮ KÝ SỐ HỢP LỆ
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                  {result.signer_info && !result.signer_info.is_entire_file
                    ? "Chữ ký gốc hợp lệ, nhưng phát hiện tệp đã bị chèn thêm dữ liệu sau khi ký."
                    : "Tệp PDF nguyên vẹn 100% và khớp chuỗi chứng thư tin cậy của hệ thống."}
                </p>
              </div>

              {result.signer_info && (
                <div className="flex flex-1 flex-col divide-y divide-slate-100 px-6 pt-2 text-xs">
                  <div className="py-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Người ký (Subject)
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-slate-900">
                      {result.signer_info.subject}
                    </span>
                  </div>

                  <div className="py-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Đơn vị chứng thực (Issuer)
                    </span>
                    <span className="mt-0.5 block font-medium text-slate-800">
                      {result.signer_info.issuer}
                    </span>
                  </div>

                  <div className="py-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Lý do ký (Reason)
                    </span>
                    <span className="mt-0.5 block font-medium text-slate-800">
                      {result.signer_info.reason || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Dấu thời gian TSA
                    </span>
                    {result.signer_info.has_tsa ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <i className="fa-solid fa-clock"></i> RFC 3161 TSA
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-500">
                        Không có TSA
                      </span>
                    )}
                  </div>

                  <div
                    className={`-mx-6 mt-auto px-6 py-3.5 ${
                      result.signer_info.is_entire_file
                        ? "bg-emerald-50/70 text-emerald-800"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
                      Tính toàn vẹn tài liệu
                    </span>
                    {result.signer_info.is_entire_file ? (
                      <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <i className="fa-solid fa-circle-check"></i>
                        Toàn vẹn 100% (Không có chỉnh sửa sau khi ký)
                      </span>
                    ) : (
                      <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-amber-700">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        Phát hiện dữ liệu bị sửa đổi/chèn thêm sau khi ký
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-70 flex-1 flex-col justify-center overflow-hidden rounded-2xl border-2 border-rose-500 bg-rose-50/40 shadow-sm">
              <div className="px-6 py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <i
                    className={`fa-solid ${
                      result.message.toLowerCase().includes("chưa được ký")
                        ? "fa-file-circle-xmark"
                        : "fa-triangle-exclamation"
                    } text-xl`}
                  ></i>
                </div>
                <h2 className="mt-3 text-lg font-extrabold text-rose-800">
                  {result.message.toLowerCase().includes("chưa được ký")
                    ? "TỆP CHƯA ĐƯỢC KÝ SỐ"
                    : "XÁC THỰC THẤT BẠI"}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-rose-700">
                  {result.message || "Không thể xác minh tính hợp lệ của tệp."}
                </p>
              </div>

              {result.signer_info && (
                <div className="mx-6 mb-6 space-y-2 rounded-xl border border-rose-200/80 bg-white p-4 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-500">Người ký: </span>
                    <strong className="text-slate-900">
                      {result.signer_info.subject}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Chứng thư cấp bởi: </span>
                    <strong className="text-slate-900">
                      {result.signer_info.issuer}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-slate-50/80">
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-6xl grow px-4 py-12 text-center text-sm text-slate-500">
            <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i>
            Đang tải cổng xác thực...
          </main>
        }
      >
        <VerifyPageContent />
      </Suspense>
    </div>
  );
}

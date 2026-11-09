"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCurrentUsername } from "@/lib/api";
import { showAlert, showAlertWithLinks } from "@/lib/swal";

interface KeyOption {
  id: number;
  key_name: string;
  algorithm: string;
  key_size: number;
  key_fingerprint: string;
  is_revoked?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function SignPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keys, setKeys] = useState<KeyOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [keyId, setKeyId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [credentialNumber, setCredentialNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [signerName, setSignerName] = useState("");
  const [signerReason, setSignerReason] = useState("Cấp phát văn bằng");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getCurrentUsername()) {
      router.replace("/login");
      return;
    }

    fetch("/api/keys/", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải danh sách khóa.");
        return (await response.json()) as KeyOption[];
      })
      .then((items) => {
        const activeKeys = items.filter((item) => !item.is_revoked);
        setKeys(activeKeys);
        if (activeKeys.length) setKeyId(String(activeKeys[0].id));
      })
      .catch((error: unknown) => {
        void showAlert("Không thể tải khóa ký", (error as Error).message, "error");
      });
  }, [router]);

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
      void showAlert("Tệp không hợp lệ", "Chỉ chấp nhận tệp PDF.", "error");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      void showAlert("Tệp quá lớn", "Dung lượng tối đa là 20 MB.", "error");
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !keyId) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("key_id", keyId);
    formData.append("recipient_name", recipientName);
    if (recipientId) formData.append("recipient_id", recipientId);
    if (credentialNumber) formData.append("credential_number", credentialNumber);
    if (issueDate) formData.append("issue_date", issueDate);
    formData.append("signer_name", signerName);
    formData.append("signer_reason", signerReason);

    try {
      const response = await fetch("/api/credentials/issue", {
        method: "POST",
        credentials: "include",
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
            { text: "Tải PDF đã ký", href: downloadUrl, download: downloadName },
            ...(trackingId
              ? [{ text: "Mở hồ sơ xác thực", href: verificationUrl }]
              : []),
          ],
          "success",
        );
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl grow px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Phát hành văn bằng</h1>
          <p className="mt-2 text-slate-600">
            Nhập thông tin người nhận, ký PAdES và tải PDF đã ký có mã tra cứu QR.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-6 shadow">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Thông tin văn bằng</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Họ tên người nhận
                <input
                  required
                  maxLength={150}
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Mã người nhận
                <input
                  maxLength={50}
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Số hiệu văn bằng
                <input
                  maxLength={100}
                  value={credentialNumber}
                  onChange={(event) => setCredentialNumber(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Ngày cấp
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Tệp PDF</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(event) => selectFile(event.target.files?.[0])}
              className="block w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            {file && <p className="text-sm text-slate-600">{file.name}</p>}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Khóa ký
              <select
                required
                value={keyId}
                onChange={(event) => setKeyId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Chọn khóa</option>
                {keys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.key_name} ({key.algorithm} {key.key_size})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Người đại diện ký
              <input
                required
                maxLength={100}
                value={signerName}
                onChange={(event) => setSignerName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Lý do ký
              <input
                required
                value={signerReason}
                onChange={(event) => setSignerReason(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </section>

          <button
            type="submit"
            disabled={loading || !file || !keyId}
            className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang ký và phát hành..." : "Ký và phát hành văn bằng"}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}

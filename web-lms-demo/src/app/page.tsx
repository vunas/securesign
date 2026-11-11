"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type DocumentItem = {
  file: File;
  recipientName: string;
  recipientId: string;
  credentialNumber: string;
  issueDate: string;
  signerName: string;
  signerReason: string;
  signerLocation: string;
};

type ManifestRow = Partial<Omit<DocumentItem, "file">> & {
  file_name?: string;
  filename?: string;
  recipient_name?: string;
  recipient_id?: string;
  credential_number?: string;
  issue_date?: string;
  signer_name?: string;
  signer_reason?: string;
  signer_location?: string;
};

type ResultState = {
  trackingIds: string[];
  fileName: string;
  size: number;
};

const today = () => new Date().toISOString().slice(0, 10);

function createDocument(file: File, defaults: Pick<DocumentItem, "signerName" | "signerReason" | "signerLocation">): DocumentItem {
  return {
    file,
    recipientName: "",
    recipientId: "",
    credentialNumber: "",
    issueDate: today(),
    signerName: defaults.signerName,
    signerReason: defaults.signerReason,
    signerLocation: defaults.signerLocation,
  };
}

function parseCsv(content: string): ManifestRow[] {
  const rows = content.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return [];
  const parseLine = (line: string) => {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        values.push(value.trim());
        value = "";
      } else {
        value += character;
      }
    }
    values.push(value.trim());
    return values;
  };
  const headers = parseLine(rows[0]).map((header) => header.toLowerCase());
  return rows.slice(1).map((row) => {
    const values = parseLine(row);
    return headers.reduce<ManifestRow>((item, header, index) => {
      item[header as keyof ManifestRow] = values[index] || "";
      return item;
    }, {});
  });
}

async function readManifest(file: File): Promise<ManifestRow[]> {
  const content = await file.text();
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("Manifest JSON phải là một mảng.");
    return parsed as ManifestRow[];
  }
  return parseCsv(content);
}

export default function HomePage() {
  const [apiKeyStatus, setApiKeyStatus] = useState("Đang kiểm tra credential server-side...");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [defaults, setDefaults] = useState({
    signerName: "",
    signerReason: "Cấp phát văn bằng",
    signerLocation: "Việt Nam",
  });

  useEffect(() => {
    fetch("/api/integration-config")
      .then(async (response) => {
        if (!response.ok) throw new Error("Không đọc được cấu hình tích hợp.");
        return response.json();
      })
      .then((config: { configured: boolean }) => {
        setApiKeyStatus(
          config.configured
            ? "Credential đã được cấu hình server-side"
            : "Chưa cấu hình API secret trong .env.local",
        );
      })
      .catch(() => setApiKeyStatus("Không kiểm tra được cấu hình tích hợp."));
  }, []);

  const totalSize = useMemo(
    () => documents.reduce((total, item) => total + item.file.size, 0),
    [documents],
  );

  const updateDocument = (index: number, patch: Partial<DocumentItem>) => {
    setDocuments((current) =>
      current.map((document, documentIndex) =>
        documentIndex === index ? { ...document, ...patch } : document,
      ),
    );
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    setError("");
    setNotice("");
    if (selected.length > 10) return setError("Mỗi lô chỉ được tối đa 10 tệp PDF.");
    if (selected.some((file) => file.type !== "application/pdf")) return setError("Chỉ chấp nhận tệp PDF.");
    if (selected.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) {
      return setError("Tổng dung lượng lô không được vượt quá 50 MB.");
    }
    setDocuments(selected.map((file) => createDocument(file, defaults)));
  };

  const handleManifest = async (event: ChangeEvent<HTMLInputElement>) => {
    const manifest = event.target.files?.[0];
    if (!manifest || documents.length === 0) {
      setError("Hãy chọn PDF trước, sau đó import manifest.");
      return;
    }
    try {
      const rows = await readManifest(manifest);
      const byFileName = new Map(
        rows.map((row) => [row.file_name || row.filename || "", row]),
      );
      let matched = 0;
      setDocuments((current) =>
        current.map((document) => {
          const row = byFileName.get(document.file.name);
          if (!row) return document;
          matched += 1;
          return {
            ...document,
            recipientName: String(row.recipient_name || ""),
            recipientId: String(row.recipient_id || ""),
            credentialNumber: String(row.credential_number || ""),
            issueDate: String(row.issue_date || document.issueDate),
            signerName: String(row.signer_name || defaults.signerName),
            signerReason: String(row.signer_reason || defaults.signerReason),
            signerLocation: String(row.signer_location || defaults.signerLocation),
          };
        }),
      );
      setNotice(`Đã import ${matched}/${documents.length} dòng metadata theo tên file.`);
      if (!matched) setError("Không tìm thấy file_name trùng với các PDF đã chọn.");
    } catch (manifestError) {
      setError(manifestError instanceof Error ? manifestError.message : "Manifest không hợp lệ.");
    } finally {
      event.target.value = "";
    }
  };

  const applyDefaults = () => {
    setDocuments((current) =>
      current.map((document) => ({
        ...document,
        signerName: defaults.signerName,
        signerReason: defaults.signerReason,
        signerLocation: defaults.signerLocation,
      })),
    );
    setNotice("Đã áp dụng thông tin đơn vị ký cho toàn bộ lô.");
  };

  const removeDocument = (index: number) => {
    setDocuments((current) => current.filter((_, documentIndex) => documentIndex !== index));
  };

  const submitBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setResult(null);
    if (documents.length === 0) return setError("Vui lòng chọn ít nhất một tệp PDF.");
    if (documents.some((document) => !document.recipientName.trim() || !document.signerName.trim())) {
      return setError("Hãy import manifest hoặc bổ sung người nhận/người ký còn thiếu.");
    }

    const formData = new FormData();
    formData.append(
      "batch_metadata",
      JSON.stringify(
        documents.map((document) => ({
          recipient_name: document.recipientName.trim(),
          recipient_id: document.recipientId.trim() || null,
          credential_number: document.credentialNumber.trim() || null,
          issue_date: document.issueDate || null,
          signer_name: document.signerName.trim(),
          signer_reason: document.signerReason.trim() || defaults.signerReason,
          signer_location: document.signerLocation.trim() || defaults.signerLocation,
        })),
      ),
    );
    documents.forEach((document) => formData.append("files", document.file));

    setLoading(true);
    try {
      const response = await fetch("/api/batch-sign", { method: "POST", body: formData });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { detail?: string | { code?: string; message?: string } }
          | null;
        const detail =
          typeof payload?.detail === "string"
            ? payload.detail
            : payload?.detail?.message || payload?.detail?.code;
        throw new Error(detail || `API trả về HTTP ${response.status}.`);
      }
      const blob = await response.blob();
      const trackingHeader = response.headers.get("X-Tracking-IDs");
      const trackingIds = trackingHeader ? (JSON.parse(trackingHeader) as string[]) : [];
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = "signed-credentials.zip";
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      setResult({ trackingIds, fileName: "signed-credentials.zip", size: blob.size });
      setNotice("Đã ký thành công. File ZIP đã được tải xuống.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể kết nối API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white">U</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">UniLMS</p>
              <h1 className="text-lg font-bold text-slate-900">Integration Console</h1>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/" className="text-blue-600">Ký hàng loạt</Link>
            <Link href="/api-keys" className="text-slate-500 hover:text-blue-600">Quản lý API key</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-9 max-w-3xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-600">University LMS / SIS</p>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">Cấp phát văn bằng số từ LMS</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Chọn cả lô PDF, import bảng dữ liệu người học và gửi một request ký số.
            Thông tin người ký mặc định được tổ chức triển khai quản lý tập trung.
          </p>
        </div>

        <form onSubmit={submitBatch} className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">01</p><h3 className="mt-1 text-xl font-bold">Cấu hình tích hợp</h3></div>
                <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Server-side secret</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-800">{apiKeyStatus}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">API key và secret nằm trong .env.local của LMS demo, không gửi xuống trình duyệt.</p>
              </div>
              <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                Core SecureSign tự chọn khóa ký mặc định hợp lệ của tenant dựa trên API key.
              </p>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Người ký mặc định của tổ chức *</span>
                <input value={defaults.signerName} onChange={(event) => setDefaults({ ...defaults, signerName: event.target.value })} className="field" placeholder="Phòng Đào tạo / Hiệu trưởng" />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={defaults.signerReason} onChange={(event) => setDefaults({ ...defaults, signerReason: event.target.value })} className="field" placeholder="Lý do ký" />
                <input value={defaults.signerLocation} onChange={(event) => setDefaults({ ...defaults, signerLocation: event.target.value })} className="field" placeholder="Địa điểm ký" />
              </div>
              <button type="button" onClick={applyDefaults} className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800">Áp dụng thông tin tổ chức cho cả lô</button>
            </div>

            <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Manifest contract</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">Import CSV hoặc JSON với khóa <code className="text-blue-300">file_name</code> để ghép tự động theo tên PDF.</p>
              <code className="mt-4 block overflow-x-auto rounded-lg bg-white/10 p-3 text-xs leading-6 text-slate-200">file_name,recipient_name,recipient_id,credential_number,issue_date</code>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="mb-6 flex items-start justify-between">
              <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">02 — 03</p><h3 className="mt-1 text-xl font-bold">Chọn tệp & import dữ liệu</h3></div>
              <label className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                + Chọn PDF
                <input type="file" accept="application/pdf" multiple onChange={handleFiles} className="hidden" />
              </label>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex-1 text-sm text-blue-900"><strong>Không nhập từng người?</strong><br /><span className="text-xs text-blue-700">Import CSV/JSON để điền metadata theo tên file.</span></div>
              <label className="cursor-pointer rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
                Import manifest
                <input type="file" accept=".csv,.json,application/json,text/csv" onChange={handleManifest} className="hidden" />
              </label>
            </div>

            {documents.length === 0 ? (
              <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-6 text-center hover:border-blue-400">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-blue-600 shadow-sm">⇧</span>
                <span className="font-bold text-slate-800">Chọn một lô PDF của sinh viên</span>
                <span className="mt-2 text-sm text-slate-500">Tối đa 10 file, tổng 50 MB</span>
                <input type="file" accept="application/pdf" multiple onChange={handleFiles} className="hidden" />
              </label>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-700">{documents.length} tài liệu đã chọn</span>
                  <span className="text-slate-500">{(totalSize / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                {documents.map((document, index) => (
                  <article key={`${document.file.name}-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{document.file.name}</p><p className="mt-1 text-xs text-slate-500">{document.recipientName || "Chưa có metadata người nhận"}</p></div>
                      <button type="button" onClick={() => removeDocument(index)} className="text-xs font-bold text-rose-600 hover:text-rose-800">Xóa</button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <input value={document.recipientName} onChange={(event) => updateDocument(index, { recipientName: event.target.value })} placeholder="Người nhận *" className="field" />
                      <input value={document.recipientId} onChange={(event) => updateDocument(index, { recipientId: event.target.value })} placeholder="Mã SV" className="field" />
                      <input value={document.credentialNumber} onChange={(event) => updateDocument(index, { credentialNumber: event.target.value })} placeholder="Số văn bằng" className="field" />
                    </div>
                  </article>
                ))}
                <button type="submit" disabled={loading} className="mt-3 flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">
                  {loading ? "Đang ký và đóng gói ZIP..." : "Thực thi ký hàng loạt"}
                </button>
              </div>
            )}

            {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
            {notice && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}
            {result && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-emerald-800">04 — Nhận kết quả</p><p className="mt-1 text-xs text-emerald-700">{result.fileName} · {(result.size / 1024).toFixed(1)} KB</p></div><span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">200 OK</span></div><div className="mt-4 space-y-2">{result.trackingIds.map((trackingId, index) => <div key={trackingId} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"><span className="text-slate-500">Tài liệu {index + 1}</span><code className="font-semibold text-slate-700">{trackingId}</code></div>)}</div></div>}
          </section>
        </form>
      </div>
    </main>
  );
}

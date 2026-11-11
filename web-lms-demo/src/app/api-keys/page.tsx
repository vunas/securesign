"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IntegrationConfig = {
  configured: boolean;
  apiUrl: string;
  apiKeyPrefix: string;
};

export default function ApiKeysPage() {
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [copied, setCopied] = useState(false);

  const loadConfig = () => {
    fetch("/api/integration-config")
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  };

  useEffect(loadConfig, []);

  const copyEnvTemplate = async () => {
    await navigator.clipboard.writeText(
      "SECURESIGN_API_URL=http://localhost:8000\nSECURESIGN_API_KEY=\nSECURESIGN_API_SECRET=",
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="grid-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white">U</div>
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">UniLMS</p><h1 className="text-lg font-bold">Quản lý API key</h1></div>
          </div>
          <Link href="/" className="text-sm font-bold text-blue-600 hover:text-blue-800">← Về ký hàng loạt</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Integration credentials</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Cấu hình kết nối SecureSign</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            API key/secret được lưu ở server-side `.env.local` của ứng dụng LMS,
            không hiển thị và không truyền xuống trình duyệt.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Trạng thái hiện tại</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${config?.configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {config?.configured ? "Đã cấu hình" : "Chưa cấu hình"}
              </span>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-5 border-b border-slate-100 pb-3"><dt className="text-slate-500">API URL</dt><dd className="font-semibold text-slate-800">{config?.apiUrl || "Đang tải..."}</dd></div>
              <div className="flex justify-between gap-5 border-b border-slate-100 pb-3"><dt className="text-slate-500">API key prefix</dt><dd className="font-mono font-semibold text-slate-800">{config?.apiKeyPrefix || "—"}</dd></div>
            </dl>
            <button type="button" onClick={loadConfig} className="mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Làm mới trạng thái</button>
          </section>
          <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Thiết lập sau khi đăng ký tenant</p>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
              <li><strong className="text-white">1.</strong> Tạo API key trong SecureSign Tenant Portal.</li>
              <li><strong className="text-white">2.</strong> Sao chép secret một lần duy nhất vào `.env.local`.</li>
              <li><strong className="text-white">3.</strong> Core tự chọn khóa ký mặc định hợp lệ của tenant.</li>
              <li><strong className="text-white">4.</strong> Khởi động lại LMS demo và kiểm tra trạng thái.</li>
            </ol>
            <button type="button" onClick={copyEnvTemplate} className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500">
              {copied ? "Đã copy mẫu .env" : "Copy mẫu .env.local"}
            </button>
          </section>
        </div>
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-6 text-sm leading-6 text-blue-900">
          <strong>Lưu ý bảo mật:</strong> backend SecureSign hiện xác thực bằng secret
          trong header `X-API-Key`. Vì vậy `SECURESIGN_API_SECRET` là giá trị được
          gửi khi ký; `SECURESIGN_API_KEY` được giữ để lưu identifier/prefix nếu tổ
          chức cấp riêng key và secret.
        </div>
      </div>
    </main>
  );
}

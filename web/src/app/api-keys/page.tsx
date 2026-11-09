"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showToast } from "@/lib/swal";

interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  rate_limit_per_min: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface ApiKeyCreated extends ApiKey {
  secret: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState(60);
  const [expiresAt, setExpiresAt] = useState("");
  const [newSecret, setNewSecret] = useState("");

  const loadKeys = useCallback(async () => {
    const items = await fetchAPI<ApiKey[]>("/api/api-keys");
    setKeys(items);
  }, []);

  useEffect(() => {
    if (!getCurrentUsername()) {
      router.replace("/login");
      return;
    }
    let active = true;
    fetchAPI<ApiKey[]>("/api/api-keys")
      .then((items) => {
        if (active) setKeys(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);

  const createKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const created = await fetchAPI<ApiKeyCreated>("/api/api-keys", "POST", {
        name,
        rate_limit_per_min: rateLimit,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setNewSecret(created.secret);
      setName("");
      setExpiresAt("");
      await loadKeys();
    } catch {
      showToast("Không thể tạo API key. Kiểm tra quyền quản trị tổ chức.", "error");
    }
  };

  const revokeKey = async (apiKey: ApiKey) => {
    if (!window.confirm(`Thu hồi API key "${apiKey.name}"?`)) return;
    try {
      await fetchAPI(`/api/api-keys/${apiKey.id}`, "DELETE");
      await loadKeys();
      showToast("API key đã được thu hồi.", "success");
    } catch {
      showToast("Không thể thu hồi API key.", "error");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl grow px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-slate-900">Quản lý API key</h1>
        <p className="mt-2 text-slate-600">
          Dùng API key để tích hợp ký hàng loạt. Secret chỉ hiển thị ngay sau khi tạo.
        </p>

        {newSecret && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Lưu secret này ngay; hệ thống sẽ không hiển thị lại.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="break-all text-sm text-slate-900">{newSecret}</code>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(newSecret)}
                className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Sao chép
              </button>
              <button type="button" onClick={() => setNewSecret("")} className="text-sm text-slate-600 underline">
                Đã lưu
              </button>
            </div>
          </div>
        )}

        <form onSubmit={createKey} className="mt-6 grid gap-4 rounded-xl bg-white p-5 shadow sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Tên key
            <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Giới hạn yêu cầu mỗi phút
            <input type="number" min={1} max={6000} required value={rateLimit} onChange={(event) => setRateLimit(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Hết hạn (không bắt buộc)
            <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <button className="rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white sm:col-span-3">
            Tạo API key
          </button>
        </form>

        <div className="mt-6 overflow-hidden rounded-xl bg-white shadow">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3">Prefix</th>
                <th className="px-4 py-3">Giới hạn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-sm">{key.key_prefix}...</td>
                  <td className="px-4 py-3">{key.rate_limit_per_min}/phút</td>
                  <td className="px-4 py-3">{key.is_active ? "Đang hoạt động" : "Đã thu hồi"}</td>
                  <td className="px-4 py-3">
                    {key.is_active && (
                      <button onClick={() => void revokeKey(key)} className="text-sm font-semibold text-red-700">
                        Thu hồi
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!keys.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chưa có API key.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}

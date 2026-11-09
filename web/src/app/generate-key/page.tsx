"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showAlert } from "@/lib/swal";

interface CreatedKey {
  id: number;
  key_name: string;
}

export default function GenerateKeyPage() {
  const router = useRouter();
  const [keyName, setKeyName] = useState("");
  const [algorithm, setAlgorithm] = useState<"RSA" | "ECDSA">("RSA");
  const [keySize, setKeySize] = useState(2048);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getCurrentUsername()) router.replace("/login");
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const key = await fetchAPI<CreatedKey>("/api/keys/", "POST", {
        key_name: keyName,
        algorithm,
        key_size: algorithm === "RSA" ? keySize : 256,
        storage_type: "server",
      });

      await fetchAPI("/api/certificates/", "POST", {
        cert_name: `Chứng chỉ ${keyName}`,
        key_id: key.id,
        issuer: "SecureSign Internal CA",
        subject: getCurrentUsername() || keyName,
        valid_days: 365,
        cert_type: "END_ENTITY",
      });

      await showAlert(
        "Tạo khóa thành công",
        "Khóa ký và chứng thư số đã được liên kết.",
        "success",
      );
      router.push("/sign");
    } catch (error: unknown) {
      await showAlert(
        "Không thể tạo khóa",
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
      <main className="mx-auto w-full max-w-2xl grow px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-slate-900">Tạo khóa ký số</h1>
        <p className="mt-2 text-slate-600">
          SecureSign sinh khóa trên máy chủ, mã hóa private key và không trả private key về trình duyệt.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl bg-white p-6 shadow">
          <label className="block text-sm font-medium text-slate-700">
            Tên khóa
            <input
              required
              maxLength={100}
              value={keyName}
              onChange={(event) => setKeyName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Thuật toán
            <select
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value as "RSA" | "ECDSA")}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="RSA">RSA</option>
              <option value="ECDSA">ECDSA P-256</option>
            </select>
          </label>

          {algorithm === "RSA" && (
            <label className="block text-sm font-medium text-slate-700">
              Độ dài khóa
              <select
                value={keySize}
                onChange={(event) => setKeySize(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value={2048}>RSA 2048</option>
                <option value={4096}>RSA 4096</option>
              </select>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            {loading ? "Đang tạo khóa và chứng thư..." : "Tạo khóa"}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}

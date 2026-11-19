"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  fetchAPI,
  fetchUserProfile,
  getCurrentRole,
  getCurrentTenantName,
  getCurrentUsername,
} from "@/lib/api";
import { showAlert } from "@/lib/swal";

interface CreatedKey {
  id: number;
  key_name: string;
}

type AlgorithmType = "RSA" | "ECDSA";

const emptySubscribe = () => () => {};

const QUICK_KEY_SUGGESTIONS = [
  "Chữ ký hợp đồng 2026",
  "Chữ ký tổ chức",
  "Phê duyệt văn bằng chứng chỉ",
];

export default function GenerateKeyPage() {
  const router = useRouter();
  const [keyName, setKeyName] = useState("");
  const [algorithm, setAlgorithm] = useState<AlgorithmType>("RSA");
  const [keySize, setKeySize] = useState<number>(2048);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");

  const initialTenantName = useSyncExternalStore(
    emptySubscribe,
    () => getCurrentTenantName() || "",
    () => "",
  );
  const [tenantName, setTenantName] = useState(initialTenantName);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (!getCurrentUsername()) {
      router.replace("/login");
      return;
    }

    const currentRole = getCurrentRole();
    if (currentRole && currentRole !== "TENANT_ADMIN") {
      void showAlert(
        "Từ chối truy cập",
        "Chỉ Quản trị viên tổ chức (Tenant Admin) mới có quyền khởi tạo khóa và cấp phát chứng thư số.",
        "error",
      );
      router.replace("/sign");
      return;
    }

    let isMounted = true;
    fetchUserProfile().then((profile) => {
      if (!isMounted) return;
      if (!profile || profile.role !== "TENANT_ADMIN") {
        void showAlert(
          "Từ chối truy cập",
          "Chỉ Quản trị viên tổ chức (Tenant Admin) mới có quyền khởi tạo khóa và cấp phát chứng thư số.",
          "error",
        );
        router.replace("/sign");
        return;
      }
      if (profile.tenant_name) {
        setTenantName(profile.tenant_name);
      }
      setCheckingAuth(false);
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = keyName.trim();
    if (!trimmedName) return;

    setLoading(true);
    setLoadingStep("Đang sinh cặp khóa mật mã trên máy chủ...");

    try {
      const key = await fetchAPI<CreatedKey>("/api/keys/", "POST", {
        key_name: trimmedName,
        algorithm,
        key_size: algorithm === "RSA" ? keySize : 256,
        storage_type: "server",
      });

      setLoadingStep("Đang cấp phát chứng thư số từ Internal CA...");

      const effectiveSubject = tenantName || initialTenantName || trimmedName;
      await fetchAPI("/api/certificates/", "POST", {
        cert_name: `Chứng chỉ ${trimmedName}`,
        key_id: key.id,
        issuer: "SecureSign Internal CA",
        subject: effectiveSubject,
        valid_days: 365,
        cert_type: "end_entity",
      });

      await showAlert(
        "Tạo khóa thành công",
        "Khóa ký và chứng thư số X.509 đã được liên kết an toàn với tổ chức.",
        "success",
      );
      router.push("/sign");
    } catch (error: unknown) {
      await showAlert(
        "Không thể tạo khóa",
        error instanceof Error ? error.message : "Đã xảy ra lỗi hệ thống.",
        "error",
      );
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const trimmedPreviewName = keyName.trim();
  const specLabel =
    algorithm === "RSA" ? `RSA ${keySize}-bit` : "ECDSA P-256 (256-bit)";

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50/80">
        <Navbar />
        <main className="mx-auto flex w-full max-w-6xl grow items-center justify-center px-4 py-20">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-600"></i>
            <span className="text-sm font-medium">Đang xác thực quyền quản trị tổ chức...</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl grow px-4 py-6">
        {/* Top Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <i className="fa-solid fa-key text-base"></i>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Khởi tạo khóa ký số
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                  Server KMS
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                Sinh cặp khóa mật mã trên máy chủ và liên kết tự động với chứng
                thư số nội bộ.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 sm:self-auto cursor-pointer"
          >
            <i className="fa-solid fa-arrow-left text-slate-400"></i>
            Quay lại
          </button>
        </div>

        {/* 2-Column Horizontal Layout on Desktop */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start"
        >
          {/* LEFT COLUMN: Key Configuration (7 cols) */}
          <div className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7 lg:col-span-7">
            {/* Step 1: Tên định danh */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="keyName"
                  className="flex items-center gap-2 text-sm font-bold text-slate-800"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    1
                  </span>
                  Tên định danh khóa <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-medium text-slate-400">
                  {keyName.length}/100
                </span>
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <i className="fa-solid fa-tag text-sm"></i>
                </span>
                <input
                  id="keyName"
                  type="text"
                  required
                  maxLength={100}
                  disabled={loading}
                  value={keyName}
                  onChange={(event) => setKeyName(event.target.value)}
                  placeholder="Nhập tên gợi nhớ cho cặp khóa..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                />
              </div>

              {/* Gợi ý điền nhanh */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Gợi ý:</span>
                {QUICK_KEY_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={loading}
                    onClick={() => setKeyName(suggestion)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Step 2: Thuật toán mật mã */}
            <div>
              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  2
                </span>
                Thuật toán mật mã
              </label>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setAlgorithm("RSA")}
                  className={`flex flex-col rounded-xl border p-4 text-left transition cursor-pointer ${
                    algorithm === "RSA"
                      ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-bold text-slate-900">RSA</span>
                    {algorithm === "RSA" ? (
                      <i className="fa-solid fa-circle-check text-indigo-600"></i>
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300"></span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    Tiêu chuẩn phổ biến nhất, tương thích cao với mọi trình đọc
                    PDF và hệ thống xác thực truyền thống.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setAlgorithm("ECDSA");
                    setKeySize(256);
                  }}
                  className={`flex flex-col rounded-xl border p-4 text-left transition cursor-pointer ${
                    algorithm === "ECDSA"
                      ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        ECDSA P-256
                      </span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        256-bit (NIST P-256)
                      </span>
                    </div>
                    {algorithm === "ECDSA" ? (
                      <i className="fa-solid fa-circle-check text-indigo-600"></i>
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300"></span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    Đường cong Elliptic secp256r1. Ký nhanh, kích thước chữ ký
                    nhỏ gọn với độ an toàn tương đương RSA 3072.
                  </p>
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Step 3: Tham số kích thước khóa */}
            <div>
              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  3
                </span>
                Tham số kích thước khóa
              </label>

              {algorithm === "RSA" ? (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {[
                    {
                      size: 2048,
                      label: "RSA 2048-bit",
                      badge: "Khuyên dùng",
                      desc: "Cân bằng tối ưu giữa tốc độ ký và độ an toàn tiêu chuẩn.",
                    },
                    {
                      size: 4096,
                      label: "RSA 4096-bit",
                      badge: "Cực đại",
                      desc: "Chống giải mã dài hạn, thời gian sinh khóa lâu hơn.",
                    },
                  ].map((option) => {
                    const isSelected = keySize === option.size;
                    return (
                      <button
                        key={option.size}
                        type="button"
                        disabled={loading}
                        onClick={() => setKeySize(option.size)}
                        className={`flex flex-col rounded-xl border p-4 text-left transition cursor-pointer ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {option.label}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {option.badge}
                            </span>
                          </div>
                          {isSelected ? (
                            <i className="fa-solid fa-circle-check text-indigo-600"></i>
                          ) : (
                            <span className="h-4 w-4 rounded-full border border-slate-300"></span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                          {option.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setKeySize(256)}
                      className="flex flex-col rounded-xl border border-indigo-600 bg-indigo-50/60 p-4 text-left ring-1 ring-indigo-600 transition cursor-pointer"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            ECDSA 256-bit
                          </span>
                          <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            NIST P-256
                          </span>
                        </div>
                        <i className="fa-solid fa-circle-check text-indigo-600"></i>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        Đường cong elliptic <strong>secp256r1 (256-bit)</strong>. Tốc độ ký vượt trội, kích thước chữ ký nhỏ gọn, an toàn tương đương RSA 3072.
                      </p>
                    </button>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-xs text-slate-700">
                    <i className="fa-solid fa-circle-info mt-0.5 text-emerald-600 shrink-0"></i>
                    <span>
                      ECDSA 256-bit tuân thủ chuẩn ký số hiện đại FIPS 186-4 và tương thích đầy đủ với Adobe Acrobat và cơ chế nhúng chữ ký PAdES.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Live Certificate Preview & Submit (5 cols) */}
          <div className="space-y-5 lg:sticky lg:top-8 lg:col-span-5">
            {/* Digital Certificate Preview Card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                    <i className="fa-solid fa-certificate"></i>
                    Xem trước chứng thư số
                  </span>
                  <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] ">
                    X.509 v3
                  </span>
                </div>
                <p className="mt-2 truncate text-base">
                  {trimmedPreviewName
                    ? `Chứng chỉ ${trimmedPreviewName}`
                    : "Chứng chỉ [Chưa đặt tên khóa]"}
                </p>
              </div>

              <div className="divide-y divide-slate-100 px-5 py-2 text-xs">
                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-500">Chủ thể (Subject)</span>
                  <span
                    className="max-w-[60%] truncate font-semibold text-slate-900"
                    title={tenantName || initialTenantName || "Tổ chức chưa xác định"}
                  >
                    {tenantName || initialTenantName || "Tổ chức chưa xác định"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-500">Nhà cung cấp (Issuer)</span>
                  <span className="font-semibold text-slate-900">
                    SecureSign Internal CA
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-500">Chuẩn mật mã</span>
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono font-semibold text-indigo-700">
                    {specLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-500">Thời hạn hiệu lực</span>
                  <span className="font-semibold text-slate-900">
                    365 ngày (End-Entity)
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-500">Cơ chế lưu trữ</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <i className="fa-solid fa-lock text-[11px]"></i>
                    Mã hóa KMS Server
                  </span>
                </div>
              </div>

              {/* Security Notice Footer inside Preview Card */}
              <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3.5">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                  <i className="fa-solid fa-shield-halved mt-0.5 shrink-0 text-emerald-600"></i>
                  <span>
                    Private Key được sinh và mã hóa trực tiếp trên máy chủ,
                    tuyệt đối không xuất ra trình duyệt.
                  </span>
                </p>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading || !trimmedPreviewName}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Tạo khóa & Cấp chứng thư số</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}

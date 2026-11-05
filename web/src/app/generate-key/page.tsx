"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showAlert } from "@/lib/swal";

export default function GenerateKeyPage() {
  const router = useRouter();
  const [keyName, setKeyName] = useState("");
  const [keyAlgorithm, setKeyAlgorithm] = useState("RSA_2048");
  const [storageType, setStorageType] = useState<"server" | "local">("server");
  const [passphraseMode, setPassphraseMode] = useState<"auto" | "custom">("auto");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  useEffect(() => {
    const user = getCurrentUsername();
    if (!user) {
      router.push("/login");
    }
  }, [router]);

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let customPass: string | null = null;
    if (storageType === "server" && passphraseMode === "custom") {
      if (passphrase !== confirmPassphrase) {
        await showAlert("Lỗi", "Mật khẩu xác nhận không trùng khớp!", "warning");
        return;
      }
      customPass = passphrase;
    }

    setLoading(true);
    setLoadingText("Đang tính toán sinh khóa...");

    const keySize = keyAlgorithm === "RSA_4096" ? 4096 : 2048;

    try {
      // 1. Tạo Khóa RSA
      const keyBody = {
        key_name: keyName,
        storage_type: storageType,
        passphrase: customPass,
        algorithm: "RSA",
        key_size: keySize,
      };

      const keyData = await fetchAPI<{
        id: number;
        raw_private_key?: string;
        key_name: string;
      }>("/api/keys/", "POST", keyBody);

      // 2. Yêu cầu cấp chứng chỉ End-User từ Intermediate CA
      setLoadingText("Đang yêu cầu cấp Chứng chỉ...");

      const username = getCurrentUsername() || "Người dùng hệ thống";
      const certBody = {
        cert_name: `Chứng chỉ của ${keyName}`,
        key_id: keyData.id,
        issuer: "SecureSign Internal CA",
        subject: username,
        valid_days: 365,
        passphrase: customPass,
        raw_private_key: storageType === "local" ? keyData.raw_private_key : null,
        cert_type: "END_ENTITY",
      };

      await fetchAPI("/api/certificates/", "POST", certBody);

      // 3. Xử lý tải Private Key nếu là local
      if (storageType === "local" && keyData.raw_private_key) {
        const safeKeyName = keyName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        downloadTextFile(`private_key_${safeKeyName}.pem`, keyData.raw_private_key);

        await showAlert(
          "Hoàn tất!",
          "Hệ thống đã cấp chứng chỉ. File Private Key (.pem) đã được tải xuống máy bạn!",
          "success"
        );
      } else {
        await showAlert(
          "Khởi tạo thành công!",
          "Khóa và Chứng chỉ đã được liên kết tự động và mã hóa an toàn trên server.",
          "success"
        );
      }

      router.push("/sign");
    } catch (error: unknown) {
      const err = error as Error;
      await showAlert("Lỗi", err.message || "Đã xảy ra lỗi khi tạo khóa/chứng chỉ.", "error");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
              <h3 className="text-xl font-bold text-indigo-800">
                <i className="fa-solid fa-key mr-2"></i> Khởi Tạo Cặp Khóa Mới
              </h3>
              <p className="text-sm text-indigo-600 mt-1">
                Tạo khóa công khai, khóa bí mật và tự động xin cấp chứng chỉ (CSR) từ Internal CA.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Tên khóa và Thuật toán */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Tên gợi nhớ cho Khóa
                  </label>
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="VD: Khóa Cá Nhân 2026..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Thuật toán & Độ dài khóa
                  </label>
                  <select
                    value={keyAlgorithm}
                    onChange={(e) => setKeyAlgorithm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none"
                  >
                    <option value="RSA_2048">RSA 2048-bit (Chuẩn mực, khuyên dùng)</option>
                    <option value="RSA_4096">RSA 4096-bit (Bảo mật tối đa)</option>
                  </select>
                </div>
              </div>

              {/* Tùy chọn lưu trữ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Nơi lưu trữ Private Key
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option Server */}
                  <label
                    onClick={() => setStorageType("server")}
                    className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${
                      storageType === "server"
                        ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="storageType"
                      value="server"
                      checked={storageType === "server"}
                      onChange={() => setStorageType("server")}
                      className="sr-only"
                    />
                    <span className="flex flex-1">
                      <span className="flex flex-col">
                        <span className="block text-sm font-medium text-gray-900">
                          <i className="fa-solid fa-cloud text-indigo-600 mr-1"></i> Lưu trên Server
                        </span>
                        <span className="mt-1 flex items-center text-sm text-gray-500">
                          Tiện lợi. Khóa được mã hóa an toàn.
                        </span>
                      </span>
                    </span>
                    {storageType === "server" && (
                      <i className="fa-solid fa-circle-check text-indigo-600 mt-0.5 h-5 w-5"></i>
                    )}
                  </label>

                  {/* Option Local */}
                  <label
                    onClick={() => setStorageType("local")}
                    className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${
                      storageType === "local"
                        ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="storageType"
                      value="local"
                      checked={storageType === "local"}
                      onChange={() => setStorageType("local")}
                      className="sr-only"
                    />
                    <span className="flex flex-1">
                      <span className="flex flex-col">
                        <span className="block text-sm font-medium text-gray-900">
                          <i className="fa-solid fa-laptop-file text-gray-600 mr-1"></i> Lưu thiết bị cá nhân (Local)
                        </span>
                        <span className="mt-1 flex items-center text-sm text-gray-500">
                          Bảo mật cao. Server không lưu Private Key.
                        </span>
                      </span>
                    </span>
                    {storageType === "local" && (
                      <i className="fa-solid fa-circle-check text-indigo-600 mt-0.5 h-5 w-5"></i>
                    )}
                  </label>
                </div>
              </div>

              {/* Box cấu hình Server */}
              {storageType === "server" && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Tùy chọn Bảo vệ Khóa trên Server
                  </label>
                  <div className="flex items-center space-x-6 mb-4">
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="passphraseMode"
                        value="auto"
                        checked={passphraseMode === "auto"}
                        onChange={() => setPassphraseMode("auto")}
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2"
                      />
                      Server tự động mã hóa (Master Key)
                    </label>
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="passphraseMode"
                        value="custom"
                        checked={passphraseMode === "custom"}
                        onChange={() => setPassphraseMode("custom")}
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2"
                      />
                      Tự đặt Passphrase (Zero-Knowledge)
                    </label>
                  </div>

                  {passphraseMode === "custom" && (
                    <div className="mt-4">
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg mb-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <i className="fa-solid fa-triangle-exclamation text-yellow-400"></i>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                              Nếu quên Passphrase này, bạn sẽ mất vĩnh viễn khóa. Hệ thống cũng không thể khôi phục giúp bạn!
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Nhập Passphrase
                          </label>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            placeholder="Mật khẩu mã hóa khóa"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Xác nhận lại Passphrase
                          </label>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={confirmPassphrase}
                            onChange={(e) => setConfirmPassphrase(e.target.value)}
                            placeholder="Nhập lại mật khẩu"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {passphraseMode === "auto" && (
                    <p className="text-sm text-gray-500 italic mt-2">
                      <i className="fa-solid fa-shield-halved text-green-500"></i> Hệ thống sử dụng KMS Master Key để tự động mã hóa bảo vệ khóa của bạn. Rất tiện lợi cho việc ký hàng loạt.
                    </p>
                  )}
                </div>
              )}

              {/* Box cảnh báo Local */}
              {storageType === "local" && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <i className="fa-solid fa-download text-blue-500"></i>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-bold text-blue-800">
                        Tải File Private Key (.pem)
                      </h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Hệ thống sẽ tải file Private Key về máy tính của bạn ngay sau khi tạo và <b>không lưu vào CSDL</b>. Hãy cất giữ file này cẩn thận!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nút submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-md cursor-pointer disabled:opacity-70 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i> {loadingText}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Bắt Đầu Khởi Tạo Khóa
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

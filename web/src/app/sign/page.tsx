"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showAlert, getSwal } from "@/lib/swal";

interface KeyOption {
  id: number;
  name?: string;
  key_name?: string;
  algorithm: string;
  storage_type: "server" | "local";
}

interface CredentialOption {
  id: number;
  file_name?: string;
  name?: string;
  original_hash?: string;
}

export default function SignPage() {
  const router = useRouter();
  const [currentFileMode, setCurrentFileMode] = useState<"upload" | "select">(
    "upload",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Form fields
  const [keys, setKeys] = useState<KeyOption[]>([]);
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | "">("");
  const [selectedCredId, setSelectedCredId] = useState<number | "">("");
  const [signerName, setSignerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("username") || "Người dùng SecureSign";
    }
    return "Người dùng SecureSign";
  });
  const [signerReason, setSignerReason] = useState(
    "Xác nhận tính pháp lý tài liệu",
  );
  const [signerLocation] = useState("Việt Nam");
  const [passphrase, setPassphrase] = useState("");
  const [localKeyFile, setLocalKeyFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const localKeyInputRef = useRef<HTMLInputElement>(null);
  function escapeHtml(str: string | null | undefined): string {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  useEffect(() => {
    let isMounted = true;
    const user = getCurrentUsername();
    if (!user) {
      router.push("/login");
      return;
    }

    Promise.all([
      fetchAPI<KeyOption[]>("/api/keys/"),
      fetchAPI<CredentialOption[]>("/api/documents/"),
    ])
      .then(([keysData, credsData]) => {
        if (isMounted) {
          setKeys(keysData);
          if (keysData.length > 0) {
            setSelectedKeyId(keysData[0].id);
          }
          setCredentials(credsData);
        }
      })
      .catch((e) => {
        console.error("Lỗi tải danh mục:", e);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      showAlert(
        "Định dạng không hỗ trợ",
        "Hệ thống chỉ hỗ trợ xử lý file PDF!",
        "error",
      );
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const selectedKey = keys.find((k) => k.id === selectedKeyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      await showAlert(
        "Khoan đã",
        "Vui lòng chọn hoặc tải lên tệp PDF cần ký.",
        "warning",
      );
      return;
    }

    if (!selectedKeyId) {
      await showAlert("Khoan đã", "Vui lòng chọn khóa ký.", "warning");
      return;
    }

    setLoading(true);

    try {
      let rawKeyContent: string | null = null;
      if (selectedKey?.storage_type === "local") {
        if (!localKeyFile) {
          await showAlert(
            "Lỗi",
            "Vui lòng tải lên file Private Key (.pem)",
            "error",
          );
          setLoading(false);
          return;
        }
        // Đã chuyển vào trong khối try...catch
        rawKeyContent = await readFileAsText(localKeyFile);
      }

      let credId = selectedCredId ? Number(selectedCredId) : null;

      // 1. Nếu là mode upload hoặc chưa có credential ID, upload credential trước
      if (currentFileMode === "upload" || !credId) {
        setLoadingText("Đang tải file lên và khởi tạo Credential...");
        const uploadForm = new FormData();
        uploadForm.append("file", selectedFile);

        const credData = await fetchAPI<{ id: number }>(
          "/api/documents/upload",
          "POST",
          uploadForm,
          true,
        );
        credId = credData.id;
      }

      // 2. Ký PDF
      setLoadingText("Đang tính toán & Nhúng chữ ký PAdES...");

      const signFormData = new FormData();
      signFormData.append("file", selectedFile);
      signFormData.append("credential_id", String(credId));
      signFormData.append("key_id", String(selectedKeyId));
      signFormData.append("signer_name", signerName);
      signFormData.append("signer_reason", signerReason);
      signFormData.append("signer_location", signerLocation);
      if (passphrase) {
        signFormData.append("passphrase", passphrase);
      }
      if (rawKeyContent) {
        signFormData.append("raw_private_key", rawKeyContent);
      }

      const response = await fetch("/api/signatures/sign-pdf", {
        method: "POST",
        credentials: "include",
        body: signFormData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || "Không thể thực hiện ký số.");
      }

      const signedHash = response.headers.get("X-Signed-Hash") || "";

      const downloadName = selectedFile.name.replace(/\.pdf$/i, "_signed.pdf");
      const safeDownloadName = escapeHtml(downloadName);

      const Swal = getSwal();
      if (Swal) {
        Swal.fire({
          icon: "success",
          title: "Ký duyệt thành công!",
          html: `<p class="text-sm text-slate-600 mb-2">Chữ ký số và con dấu trực quan đã được nhúng vào file PDF.</p>
               <p class="text-xs text-slate-500 font-mono bg-slate-100 p-2 rounded">SHA256: ${escapeHtml(signedHash ? signedHash.substring(0, 32) + "..." : "Thành công")}</p>
               <p class="text-xs text-emerald-600 font-medium mt-2"><i class="fa-solid fa-download mr-1"></i> File <b>${safeDownloadName}</b> đã được tải về máy của bạn.</p>`,
          confirmButtonColor: "#4f46e5",
          confirmButtonText: "Vào Dashboard",
          showCancelButton: true,
          cancelButtonText: "Xác thực file vừa ký",
        });
      }
    } catch (error: unknown) {
      const err = error as Error;
      await showAlert(
        "Lỗi hệ thống",
        err.message || "Không thể thực hiện ký số.",
        "error",
      );
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const isFormReady = selectedFile && selectedKeyId;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          {/* Header Page */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              <i className="fa-solid fa-pen-nib text-blue-600 mr-3"></i>Thực
              Hiện Ký Số PAdES
            </h2>
            <p className="text-slate-500 mt-2 text-lg">
              Hệ thống sẽ nhúng chữ ký bảo mật và dấu mộc điện tử trực tiếp vào
              tài liệu của bạn theo kiến trúc Stateless.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* CỘT 1: CHỌN FILE (Chiếm 5 cột) */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <div className="bg-white shadow-xl shadow-slate-200/40 rounded-2xl p-6 border border-slate-100 grow flex flex-col">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-3">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Tài liệu cần ký
                  </h3>
                </div>

                {/* TABS CHUYỂN ĐỔI CHẾ ĐỘ FILE */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-5">
                  <button
                    type="button"
                    onClick={() => setCurrentFileMode("upload")}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      currentFileMode === "upload"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <i className="fa-solid fa-cloud-arrow-up mr-1.5"></i>Tải lên
                    mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentFileMode("select")}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      currentFileMode === "select"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <i className="fa-solid fa-folder-open mr-1.5"></i>Chọn từ
                    kho
                  </button>
                </div>

                {/* PANEL 1: UPLOAD FILE MỚI */}
                {currentFileMode === "upload" && (
                  <div className="grow">
                    {!selectedFile ? (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragOver(true);
                        }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`drop-zone relative group flex flex-col items-center justify-center h-48 rounded-2xl cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300 overflow-hidden ${
                          isDragOver ? "dragover" : ""
                        }`}
                      >
                        <i className="fa-solid fa-file-arrow-up text-4xl text-blue-400 mb-3 group-hover:-translate-y-1 transition-transform duration-300"></i>
                        <p className="text-slate-700 font-semibold mb-1">
                          Nhấn hoặc kéo thả file vào đây
                        </p>
                        <p className="text-xs text-slate-400">
                          Chỉ hỗ trợ .pdf (Tối đa 15MB)
                        </p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileSelect(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="h-48 flex flex-col justify-center">
                        <div className="bg-white border-2 border-emerald-400 rounded-2xl p-5 shadow-lg shadow-emerald-100 relative">
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-full flex items-center justify-center shadow-sm transition-colors cursor-pointer"
                            title="Gỡ bỏ file"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>

                          <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner">
                              <i className="fa-solid fa-file-pdf"></i>
                            </div>
                            <p
                              className="font-bold text-slate-800 w-full truncate px-4"
                              title={selectedFile.name}
                            >
                              {selectedFile.name}
                            </p>
                            <div className="flex items-center justify-center mt-2 space-x-2">
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded text-xs font-medium">
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)}{" "}
                                MB
                              </span>
                              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-xs font-semibold">
                                <i className="fa-solid fa-check mr-1"></i> Sẵn
                                sàng tải lên & ký
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* PANEL 2: CHỌN FILE TỪ KHO */}
                {currentFileMode === "select" && (
                  <div className="grow flex flex-col justify-center min-h-48 space-y-4">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Chọn tài liệu từ kho (Metadata)
                      </label>
                      <select
                        value={selectedCredId}
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          setSelectedCredId(id);
                        }}
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">-- Chọn tài liệu đã có --</option>
                        {credentials.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.id} - {c.file_name || c.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-3 flex items-start">
                        <i className="fa-solid fa-lightbulb text-amber-500 mt-0.5 mr-1.5"></i>
                        Theo chính sách Stateless, file PDF gốc không lưu vĩnh
                        viễn trên máy chủ. Vui lòng đính kèm file PDF gốc bên
                        dưới để ký.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tệp PDF gốc tương ứng:
                      </label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                  <h4 className="text-sm font-bold text-blue-800 mb-2">
                    <i className="fa-solid fa-stamp text-blue-500 mr-2"></i>{" "}
                    Tính năng an toàn
                  </h4>
                  <ul className="text-xs text-blue-700/80 space-y-1.5 ml-1">
                    <li className="flex items-start">
                      <i className="fa-solid fa-check-circle text-emerald-500 mt-0.5 mr-2"></i>
                      <span>
                        Xử lý trong bộ nhớ RAM, chống rò rỉ dữ liệu tài liệu
                        nhạy cảm.
                      </span>
                    </li>
                    <li className="flex items-start">
                      <i className="fa-solid fa-check-circle text-emerald-500 mt-0.5 mr-2"></i>
                      <span>
                        Tự động đính kèm mộc chữ ký ở góc văn bản kèm dấu thời
                        gian TSA.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CỘT 2: THIẾT LẬP CHỮ KÝ (Chiếm 7 cột) */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              <div className="bg-white shadow-xl shadow-slate-200/40 rounded-2xl p-6 border border-slate-100 space-y-6">
                {/* Step 2: Chọn Khóa Ký */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mr-3">
                        2
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">
                        Chọn Khóa Ký
                      </h3>
                    </div>
                    <Link
                      href="/generate-key"
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <i className="fa-solid fa-plus mr-1"></i> Tạo Khóa Mới
                    </Link>
                  </div>

                  <select
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyId(Number(e.target.value))}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Chọn Khóa Ký Của Bạn --</option>
                    {keys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.key_name || k.name} ({k.algorithm} -{" "}
                        {k.storage_type === "server" ? "Server" : "Local File"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Thông tin người ký */}
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-3">
                      3
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Thông tin đại diện & Mộc
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Người đại diện ký
                      </label>
                      <input
                        type="text"
                        required
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Họ và tên..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Lý do ký
                      </label>
                      <input
                        type="text"
                        required
                        value={signerReason}
                        onChange={(e) => setSignerReason(e.target.value)}
                        placeholder="VD: Xác nhận chứng chỉ..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Security Zone: Passphrase hoặc File Private Key */}
                {selectedKey && (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <div className="flex items-center mb-3">
                      <i className="fa-solid fa-lock text-indigo-600 mr-2"></i>
                      <h4 className="text-sm font-bold text-indigo-900">
                        Xác Thực Bảo Mật Cho Khóa &quot;
                        {selectedKey.key_name || selectedKey.name}&quot;
                      </h4>
                    </div>

                    {selectedKey.storage_type === "server" ? (
                      <div>
                        <label className="block text-xs font-semibold text-indigo-700 mb-1">
                          Passphrase mở khóa (Nếu thiết lập tùy chỉnh)
                        </label>
                        <input
                          type="password"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          placeholder="Để trống nếu khóa do Server tự động bảo vệ qua KMS"
                          className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm text-slate-700 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-indigo-700 mb-1">
                          Tải lên file Private Key (.pem) của bạn
                        </label>
                        <input
                          type="file"
                          ref={localKeyInputRef}
                          accept=".pem"
                          required
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setLocalKeyFile(e.target.files[0]);
                            }
                          }}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!isFormReady || loading}
                  className={`w-full py-4 px-4 rounded-xl font-bold flex items-center justify-center text-lg transition-all duration-200 cursor-pointer shadow-lg ${
                    isFormReady && !loading
                      ? "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30 transform hover:-translate-y-1"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  }`}
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>{" "}
                      {loadingText}
                    </>
                  ) : !selectedFile ? (
                    <>
                      <i className="fa-solid fa-file-circle-xmark mr-2"></i> Chờ
                      Chọn PDF...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-signature mr-2"></i> Thực Hiện
                      Ký Nhúng & Tải Về
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}

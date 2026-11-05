"use client";

import { useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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

export default function VerifyPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showAlert("Định dạng không hỗ trợ", "Vui lòng tải lên file định dạng PDF!", "error");
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
      await showAlert("Khoan đã", "Vui lòng chọn file PDF cần kiểm tra!", "warning");
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

      const data: VerifyResult = await response.json();
      setResult(data);
    } catch (error: unknown) {
      console.error(error);
      await showAlert("Lỗi kết nối", "Không thể kết nối đến máy chủ xác thực.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">
              <i className="fa-solid fa-shield-halved text-emerald-500 mr-2"></i> Xác Thực Chữ Ký Nhúng (PAdES)
            </h2>
            <p className="text-gray-500 mt-2">
              Upload file PDF đã được ký để hệ thống bóc tách và kiểm tra tính toàn vẹn.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Nhập Liệu */}
            <div className="lg:col-span-7 bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
              <form onSubmit={handleVerify} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Chọn File PDF Cần Kiểm Tra
                  </label>

                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      className={`drop-zone flex flex-col items-center justify-center h-40 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-emerald-400 transition-all ${
                        isDragOver ? "dragover" : ""
                      }`}
                    >
                      <i className="fa-solid fa-file-shield text-4xl text-emerald-500 mb-3"></i>
                      <p className="text-sm font-medium text-gray-600">
                        Kéo thả file PDF vào đây hoặc nhấn để chọn
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
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm text-green-800 block truncate max-w-xs sm:max-w-md">
                          {selectedFile.name}
                        </span>
                        <span className="text-xs text-green-600">
                          <i className="fa-solid fa-check mr-1"></i> Đã tải file lên ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="text-xs bg-white border border-red-200 text-red-500 px-3 py-1 rounded hover:bg-red-50 transition cursor-pointer"
                      >
                        <i className="fa-solid fa-arrows-rotate mr-1"></i> Đổi file
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <i className="fa-solid fa-circle-info mr-1"></i> Hệ thống sử dụng công nghệ kiểm tra mã Hash và thuật toán bất đối xứng RSA để phát hiện 100% mọi sự thay đổi dù là nhỏ nhất (thêm dấu chấm, xóa khoảng trắng) sau khi file được ký.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition duration-200 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2 mt-1"></i> Đang quét cấu trúc PDF...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-magnifying-glass mr-2 mt-1"></i> Quét & Xác Thực Chữ Ký
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Khung Kết Quả */}
            <div className="lg:col-span-5 flex flex-col">
              {!result ? (
                <div className="bg-white shadow-xl rounded-2xl p-8 border border-slate-100 h-full flex flex-col justify-center items-center text-center transition-all duration-500">
                  <i className="fa-solid fa-file-circle-question text-6xl text-gray-200 mb-4"></i>
                  <h3 className="text-xl font-medium text-gray-400">Chờ tệp PDF...</h3>
                  <p className="text-sm text-gray-400 mt-2">
                    Kết quả phân tích chữ ký số sẽ hiển thị tại đây.
                  </p>
                </div>
              ) : result.is_valid ? (
                <div className="bg-green-50 shadow-xl rounded-2xl p-6 border-2 border-green-500 h-full flex flex-col justify-center items-center text-center transition-all duration-500">
                  <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <i className="fa-solid fa-shield-halved text-3xl text-green-500"></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-green-700">CHỮ KÝ HỢP LỆ</h3>
                  <p className="text-green-600 font-medium text-sm mb-2">
                    {result.signer_info && !result.signer_info.is_entire_file ? (
                      <>
                        Chữ ký HỢP LỆ trên dữ liệu gốc.
                        <span className="text-amber-600 mt-2 block font-semibold">
                          ⚠️ TUY NHIÊN: Phát hiện tài liệu đã bị sửa đổi/chèn thêm sau thời điểm ký!
                        </span>
                      </>
                    ) : (
                      "Chữ ký HỢP LỆ. Dữ liệu nguyên vẹn tuyệt đối và chứng chỉ hoàn toàn KHỚP với Root CA."
                    )}
                  </p>

                  {result.signer_info && (
                    <div className="w-full text-left text-xs">
                      <ul className="space-y-3 mt-4 text-left bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                        <li className="pb-2 border-b border-gray-50">
                          <b className="text-gray-500 block mb-1 text-[10px] uppercase tracking-wider">
                            Người ký (Subject)
                          </b>
                          <span className="text-indigo-700 font-bold text-sm">
                            {result.signer_info.subject}
                          </span>
                        </li>
                        <li className="pb-2 border-b border-gray-50">
                          <b className="text-gray-500 block mb-1 text-[10px] uppercase tracking-wider">
                            Đơn vị cấp (Issuer)
                          </b>
                          <span className="text-gray-800 text-sm">
                            {result.signer_info.issuer}
                          </span>
                        </li>
                        <li className="pb-2 border-b border-gray-50">
                          <b className="text-gray-500 block mb-1 text-[10px] uppercase tracking-wider">
                            Lý do ký (Reason)
                          </b>
                          <span className="text-gray-800 text-sm">
                            {result.signer_info.reason}
                          </span>
                        </li>
                        <li className="pb-2 border-b border-gray-50 flex justify-between items-center">
                          <b className="text-gray-500 text-[10px] uppercase tracking-wider">
                            Nguồn thời gian
                          </b>
                          <span className="text-sm">
                            {result.signer_info.has_tsa ? (
                              <span className="text-emerald-600 font-bold">
                                <i className="fa-solid fa-clock mr-1"></i> Có (Timestamp Authority)
                              </span>
                            ) : (
                              <span className="text-gray-500 font-bold">
                                <i className="fa-solid fa-desktop mr-1"></i> Không (Từ máy tính)
                              </span>
                            )}
                          </span>
                        </li>
                        <li className="pt-1 bg-amber-50 -mx-4 -mb-4 p-4 rounded-b-lg border-t border-amber-100">
                          <b className="text-gray-600 block mb-1 text-[10px] uppercase tracking-wider">
                            Tình trạng tài liệu
                          </b>
                          <span className="text-sm block">
                            {result.signer_info.is_entire_file ? (
                              <span className="text-emerald-600 font-bold block mt-1">
                                <i className="fa-solid fa-check-circle mr-1"></i> Toàn vẹn 100% (Không sửa đổi)
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold block mt-1">
                                <i className="fa-solid fa-triangle-exclamation mr-1"></i> Có dữ liệu mới chèn sau khi ký
                              </span>
                            )}
                          </span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 shadow-xl rounded-2xl p-6 border-2 border-red-500 h-full flex flex-col justify-center items-center text-center transition-all duration-500">
                  <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <i
                      className={`fa-solid ${
                        result.message && result.message.toLowerCase().includes("chưa được ký")
                          ? "fa-file-circle-xmark"
                          : "fa-triangle-exclamation"
                      } text-3xl text-red-500`}
                    ></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-red-700">
                    {result.message && result.message.toLowerCase().includes("chưa được ký")
                      ? "VĂN BẢN CHƯA KÝ"
                      : "XÁC THỰC THẤT BẠI"}
                  </h3>
                  <p className="text-red-600 font-medium text-sm mb-4">
                    {result.message || "Lỗi không xác định."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


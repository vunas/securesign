"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showAlert, showToast, getSwal } from "@/lib/swal";

interface KeyItem {
  id: number;
  name: string;
  algorithm: string;
  storage_type: "server" | "local";
  created_at: string;
  public_key: string;
  private_key_encrypted?: string;
}

interface CredentialItem {
  id: number;
  name: string;
  hash: string;
  size: number;
}

interface SignatureItem {
  id: number;
  credential_name: string;
  key_id: number;
  key_name: string;
  signer: string;
  algorithm: string;
  signed_at: string;
  signature_base64: string;
}

interface DashboardData {
  stats: {
    total_keys: number;
    total_credentials: number;
    total_sigs: number;
  };
  keys: KeyItem[];
  credentials: CredentialItem[];
  signatures: SignatureItem[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const user = getCurrentUsername();
    if (!user) {
      router.push("/login");
      return;
    }
    fetchAPI<DashboardData>("/dashboard-api/summary")
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          showToast("Lỗi tải dữ liệu Dashboard", "error");
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleDownloadCredential = async (credId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/documents/${credId}/download`, {
        method: "GET",
        credentials: "include",
      });

      if (response.status === 410) {
        const errJson = await response.json().catch(() => ({}));
        await showAlert(
          "Chính Sách Stateless & Zero-Knowledge",
          errJson.detail ||
            "PDF không được lưu trữ theo chính sách Stateless & Zero-Knowledge. Hãy tải lại file để xác thực hoặc ký.",
          "info"
        );
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Không thể tải file từ máy chủ");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast("Đã tải tài liệu thành công!", "success");
    } catch (error: unknown) {
      const err = error as Error;
      await showAlert("Lỗi tải file", err.message, "error");
    }
  };

  const downloadPubKey = (key: KeyItem) => {
    const blob = new Blob([key.public_key], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `public_key_${key.id}.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast("Đã tải Public Key an toàn", "success");
  };

  const viewPubKey = (key: KeyItem) => {
    const Swal = getSwal();
    if (Swal) {
      Swal.fire({
        title: '<span class="text-xl font-bold text-slate-800"><i class="fa-solid fa-key text-indigo-500 mr-2"></i>Khóa Công Khai (Public Key)</span>',
        html: `<div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                <textarea readonly class="w-full h-56 p-3 text-xs font-mono bg-transparent border-0 resize-none outline-none text-slate-700 leading-relaxed">${key.public_key}</textarea>
               </div>
               <p class="text-xs text-slate-500 mt-3 text-left"><i class="fa-solid fa-circle-info text-blue-500 mr-1"></i> Public Key này được nhúng công khai vào PDF để đối tác xác thực chữ ký của bạn.</p>`,
        width: 650,
        confirmButtonText: "Đóng",
        confirmButtonColor: "#3b82f6",
        customClass: {
          confirmButton: "rounded-xl font-bold px-6 py-2.5",
        },
      });
    } else {
      alert(key.public_key);
    }
  };

  const viewSignatureDetails = (sig: SignatureItem) => {
    const Swal = getSwal();
    if (Swal) {
      Swal.fire({
        title: '<span class="text-xl font-bold text-slate-800"><i class="fa-solid fa-file-shield text-blue-500 mr-2"></i>Chi Tiết Chữ Ký Số</span>',
        html: `<div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 text-left space-y-2 text-xs">
                <div><b>Tài liệu:</b> ${sig.credential_name}</div>
                <div><b>Người ký:</b> ${sig.signer}</div>
                <div><b>Khóa sử dụng:</b> ${sig.key_name}</div>
                <div><b>Thuật toán:</b> ${sig.algorithm}</div>
                <div><b>Thời gian:</b> ${sig.signed_at}</div>
                <div class="pt-2 border-t border-slate-200 font-mono text-[10px] break-all"><b>Giá trị chữ ký (Base64):</b><br/>${sig.signature_base64.substring(0, 80)}...</div>
               </div>
               <p class="text-xs text-slate-500 mt-3 text-left"><i class="fa-solid fa-shield-check text-emerald-500 mr-1"></i> Theo kiến trúc Stateless & Zero-Knowledge, bản PDF đã ký được gửi trực tiếp về máy người dùng ngay tại thời điểm ký.</p>`,
        width: 600,
        confirmButtonText: "Đóng",
        confirmButtonColor: "#3b82f6",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* KHỐI 1: SUMMARY THỐNG KÊ */}
          <div>
            <div className="flex items-center mb-6">
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                <i className="fa-solid fa-chart-pie text-blue-600 mr-3"></i>Tổng Quan Hệ Thống
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Thẻ 1 */}
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 p-6 flex items-center transform transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center shadow-inner">
                  <i className="fa-solid fa-key text-2xl text-indigo-600"></i>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Khóa & Chứng Chỉ
                  </p>
                  <p className="text-4xl font-extrabold text-slate-800">
                    {loading ? "..." : data?.stats.total_keys ?? 0}
                  </p>
                </div>
              </div>

              {/* Thẻ 2 */}
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 p-6 flex items-center transform transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center shadow-inner">
                  <i className="fa-solid fa-file-pdf text-2xl text-emerald-600"></i>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Tài Liệu / Credentials
                  </p>
                  <p className="text-4xl font-extrabold text-slate-800">
                    {loading ? "..." : data?.stats.total_credentials ?? 0}
                  </p>
                </div>
              </div>

              {/* Thẻ 3 */}
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 p-6 flex items-center transform transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center shadow-inner">
                  <i className="fa-solid fa-signature text-2xl text-blue-600"></i>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Lượt Ký Thành Công
                  </p>
                  <p className="text-4xl font-extrabold text-slate-800">
                    {loading ? "..." : data?.stats.total_sigs ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* KHỐI 2: QUẢN LÝ KHÓA (KEYS) */}
          <div className="bg-white shadow-xl shadow-slate-200/40 rounded-2xl border border-slate-100 overflow-hidden mb-8">
            <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-inner">
                  <i className="fa-solid fa-key text-lg"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Danh Sách Khóa (RSA Keys)
                </h3>
              </div>
              <Link
                href="/generate-key"
                className="w-full sm:w-auto flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 text-sm"
              >
                <i className="fa-solid fa-plus mr-2"></i> Khởi Tạo Khóa Mới
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tên Khóa / Hệ Mật
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Môi Trường Lưu Trữ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Ngày Khởi Tạo
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Công Cụ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-medium">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl mr-2 text-indigo-500"></i> Đang tải danh sách khóa...
                      </td>
                    </tr>
                  ) : !data?.keys || data.keys.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-medium">
                        Bạn chưa khởi tạo khóa RSA nào.
                      </td>
                    </tr>
                  ) : (
                    data.keys.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="font-bold text-slate-800 text-sm mb-1">{k.name}</div>
                          <div className="text-xs text-slate-500 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded">
                            {k.algorithm}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          {k.storage_type === "server" ? (
                            <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <i className="fa-solid fa-cloud mr-1.5 mt-0.5"></i> Lưu Server
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                              <i className="fa-solid fa-laptop mr-1.5 mt-0.5"></i> File Local
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-500">
                          {k.created_at}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-right space-x-2">
                          <button
                            onClick={() => viewPubKey(k)}
                            className="inline-flex items-center justify-center px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                            title="Xem chuỗi Khóa công khai"
                          >
                            <i className="fa-solid fa-eye mr-1.5"></i> Xem
                          </button>
                          <button
                            onClick={() => downloadPubKey(k)}
                            className="inline-flex items-center justify-center px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-emerald-600 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                            title="Tải file .pem Khóa Công Khai"
                          >
                            <i className="fa-solid fa-download mr-1.5"></i> Tải Pub
                          </button>
                          <button
                            disabled
                            className="inline-flex items-center justify-center px-3 py-1.5 bg-slate-50 border border-slate-100 text-slate-400 rounded-lg text-xs font-semibold cursor-not-allowed opacity-70"
                            title="Khóa bảo mật: Hệ thống không cho phép tải Khóa Bí Mật nhằm đảm bảo tính chống chối bỏ."
                          >
                            <i className="fa-solid fa-lock mr-1.5"></i> Pri Key
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KHỐI 3: QUẢN LÝ TÀI LIỆU / CREDENTIALS */}
          <div className="bg-white shadow-xl shadow-slate-200/40 rounded-2xl border border-slate-100 overflow-hidden mb-8">
            <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mr-3 shadow-inner">
                  <i className="fa-solid fa-folder-open text-lg"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Kho Tài Liệu PDF (Credentials)</h3>
              </div>
              <Link
                href="/sign"
                className="w-full sm:w-auto flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5 text-sm"
              >
                <i className="fa-solid fa-upload mr-2"></i> Tải Lên & Ký Ngay
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tên Tài Liệu
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Mã Băm Gốc (SHA256)
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-slate-400 font-medium">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl mr-2 text-emerald-500"></i> Đang tải kho tài liệu...
                      </td>
                    </tr>
                  ) : !data?.credentials || data.credentials.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-slate-400 font-medium">
                        Chưa có tài liệu nào trong hệ thống.
                      </td>
                    </tr>
                  ) : (
                    data.credentials.map((cred) => (
                      <tr key={cred.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center">
                            <i className="fa-solid fa-file-pdf text-2xl text-red-400 mr-4 opacity-80 group-hover:opacity-100 transition-opacity"></i>
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{cred.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: #{cred.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-mono text-slate-500">
                          {cred.hash ? `${cred.hash.substring(0, 24)}...` : "N/A"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleDownloadCredential(cred.id, cred.name)}
                              className="inline-flex items-center justify-center px-3 py-2 bg-white text-slate-600 hover:bg-slate-50 rounded-lg transition-all duration-200 text-xs font-semibold border border-slate-200 shadow-sm cursor-pointer"
                              title="Tải tài liệu nháp ban đầu"
                            >
                              <i className="fa-solid fa-download mr-1.5"></i> Bản Gốc
                            </button>
                            <Link
                              href={`/sign?credential_id=${cred.id}`}
                              className="inline-flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg transition-all duration-200 text-sm font-bold border border-blue-200 hover:border-transparent shadow-sm"
                              title="Mang tài liệu này đi ký điện tử"
                            >
                              <i className="fa-solid fa-pen-nib mr-2"></i> Ký Lại
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KHỐI 4: LỊCH SỬ CHỮ KÝ */}
          <div className="bg-white shadow-xl shadow-slate-200/40 rounded-2xl border border-slate-100 overflow-hidden mb-8">
            <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-inner">
                  <i className="fa-solid fa-history text-lg"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Lịch Sử Hoạt Động Ký Số
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tài liệu đã ký
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Khóa được dùng
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Người đại diện ký
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Thời gian (TSA)
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-medium">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl mr-2 text-blue-500"></i> Đang tải lịch sử ký...
                      </td>
                    </tr>
                  ) : !data?.signatures || data.signatures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-medium">
                        Chưa có lịch sử ký duyệt.
                      </td>
                    </tr>
                  ) : (
                    data.signatures.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700 text-sm">
                          <i className="fa-solid fa-file-signature mr-2 text-blue-500"></i> {s.credential_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600">
                          <i className="fa-solid fa-key text-xs mr-2 text-slate-400"></i> {s.key_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                          {s.signer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">
                          {s.signed_at}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => viewSignatureDetails(s)}
                            className="inline-flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition-all duration-200 text-xs font-bold border border-emerald-200 hover:border-transparent shadow-sm cursor-pointer"
                            title="Xem chi tiết chữ ký"
                          >
                            <i className="fa-solid fa-file-shield mr-1.5"></i> Chi Tiết Chữ Ký
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

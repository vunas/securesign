"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { showConfirm } from "@/lib/swal";

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const username = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
    () => (typeof window !== "undefined" ? localStorage.getItem("username") : null),
    () => null
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleScroll = () => {
        if (window.scrollY > 10) {
          setScrolled(true);
        } else {
          setScrolled(false);
        }
      };

      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const handleDownloadRootCA = async (e: React.MouseEvent) => {
    e.preventDefault();
    const confirmed = await showConfirm({
      title: "Tải Chứng Chỉ Root CA?",
      html: '<p class="text-sm text-slate-600 text-left mb-2">Bạn chuẩn bị tải xuống file chứng chỉ <b>SecureSign_Root_CA.cer</b>.</p><p class="text-sm text-slate-600 text-left">Vui lòng cài đặt file này vào mục <i><b>Trusted Root Certification Authorities</b></i> trên thiết bị của bạn để phần mềm (như Adobe Acrobat) có thể xác minh chữ ký hợp lệ.</p>',
      icon: "info",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b",
      confirmButtonText: '<i class="fa-solid fa-download mr-2"></i> Tải Xuống',
      cancelButtonText: "Hủy bỏ",
    });

    if (confirmed) {
      const link = document.createElement("a");
      link.href = "/api/certificates/download-root-ca";
      link.download = "SecureSign_Root_CA.cer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  return (
    <div className="bg-slate-50 text-slate-800 font-sans antialiased flex flex-col min-h-screen overflow-x-hidden">
      {/* NAVBAR */}
      <nav
        className={`bg-white/70 backdrop-blur-lg fixed w-full top-0 z-50 transition-all duration-300 border-b ${
          scrolled ? "shadow-sm border-slate-200" : "border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div
              className="flex items-center space-x-3 group cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all duration-300">
                <i className="fa-solid fa-file-signature text-xl"></i>
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-slate-900">
                Secure<span className="text-blue-600">Sign</span>
              </span>
            </div>

            {/* Navigation */}
            <div className="hidden md:flex space-x-10">
              <a
                href="#about"
                className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
              >
                Về hệ thống
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
              >
                Hướng dẫn
              </a>
              <a
                href="#certificate"
                className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
              >
                Root CA
              </a>
            </div>

            {/* Auth Button */}
            <div className="flex items-center space-x-4">
              {username ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/30 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mr-2">
                    <i className="fa-solid fa-user text-xs"></i>
                  </div>
                  {username}
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="hidden text-sm font-semibold text-slate-700 hover:text-indigo-700 sm:inline"
                  >
                    Đăng ký tổ chức
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-blue-600 shadow-md hover:shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    Đăng nhập <i className="fa-solid fa-arrow-right ml-2"></i>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-32 lg:pb-32 overflow-hidden bg-slate-50 min-h-[90vh] flex items-center">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-grid-pattern z-0 pointer-events-none"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full pointer-events-none z-0">
          <div className="absolute top-20 left-0 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse-slow"></div>
          <div
            className="absolute top-40 right-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse-slow"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            {/* Left: Typography */}
            <div className="w-full lg:w-1/2 text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-bold tracking-wide mb-6 border border-blue-100 shadow-sm">
                <span className="flex h-2 w-2 relative mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                Hệ thống PKI Doanh Nghiệp
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
                Ký Kết Tài Liệu <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Bảo Mật Tuyệt Đối
                </span>
              </h1>

              <p className="text-lg text-slate-600 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Giải pháp chữ ký số chuẩn PAdES-LTV. Đảm bảo toàn vẹn dữ liệu,
                chống chối bỏ và đáp ứng tính pháp lý cao nhất với Timestamp nội bộ độc lập.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-5">
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all transform hover:-translate-y-1 flex items-center justify-center text-lg"
                >
                  Bắt đầu ký ngay
                </Link>
                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 rounded-xl font-bold transition-all flex items-center justify-center text-lg"
                >
                  <i className="fa-regular fa-circle-play mr-2"></i> Xem cách hoạt động
                </a>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap justify-center lg:justify-start gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center space-x-2 font-bold text-slate-500">
                  <i className="fa-solid fa-lock"></i>
                  <span>RSA-2048</span>
                </div>
                <div className="flex items-center space-x-2 font-bold text-slate-500">
                  <i className="fa-solid fa-file-pdf"></i>
                  <span>PAdES Standard</span>
                </div>
                <div className="flex items-center space-x-2 font-bold text-slate-500">
                  <i className="fa-solid fa-clock"></i>
                  <span>RFC 3161 TSA</span>
                </div>
              </div>
            </div>

            {/* Right: Mockup Illustration */}
            <div className="w-full lg:w-1/2 relative lg:h-[600px] flex justify-center items-center">
              <div className="absolute top-10 right-10 w-20 h-20 bg-emerald-400/20 rounded-full blur-2xl"></div>
              <div className="absolute bottom-20 left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>

              {/* CSS Mockup Document */}
              <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 p-8 z-10 animate-float">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                  <div className="w-24 h-4 bg-slate-200 rounded-full"></div>
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <i className="fa-solid fa-file-contract"></i>
                  </div>
                </div>

                <div className="space-y-4 mb-12">
                  <div className="w-full h-3 bg-slate-100 rounded-full"></div>
                  <div className="w-5/6 h-3 bg-slate-100 rounded-full"></div>
                  <div className="w-full h-3 bg-slate-100 rounded-full"></div>
                  <div className="w-4/5 h-3 bg-slate-100 rounded-full"></div>
                  <div className="w-full h-3 bg-slate-100 rounded-full"></div>
                  <div className="w-2/3 h-3 bg-slate-100 rounded-full"></div>
                </div>

                <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 mt-8 bg-slate-50">
                  <div className="w-32 h-3 bg-slate-200 rounded-full mb-2"></div>
                  <div className="w-24 h-3 bg-slate-200 rounded-full"></div>

                  <div className="absolute -bottom-6 -right-6 bg-emerald-50 border-2 border-emerald-500 text-emerald-600 p-3 rounded-xl shadow-xl transform -rotate-12 flex items-center space-x-3 backdrop-blur-sm">
                    <i className="fa-solid fa-certificate text-2xl"></i>
                    <div>
                      <div className="font-black text-xs uppercase tracking-wider">
                        Đã Ký Số
                      </div>
                      <div className="text-[10px] font-medium opacity-80">
                        Nguyễn Văn A
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: TẠI SAO CHỌN SECURESIGN (ABOUT) */}
      <section id="about" className="py-24 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-sm font-black text-blue-600 tracking-widest uppercase mb-3">
              Tính Năng Cốt Lõi
            </h2>
            <h3 className="text-3xl md:text-4xl font-black text-slate-900">
              Bảo Mật Ở Mức Độ Doanh Nghiệp
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-2 transition-all duration-300">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl mb-8 group-hover:scale-110 transition-transform duration-300">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Toàn Vẹn Dữ Liệu
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                Sử dụng thuật toán băm SHA-256. Bất kỳ sự thay đổi nhỏ nào lên văn bản sau khi ký đều làm mất hiệu lực chữ ký ngay lập tức.
              </p>
            </div>

            <div className="group bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-300">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center text-2xl mb-8 group-hover:scale-110 transition-transform duration-300">
                <i className="fa-solid fa-fingerprint"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Chống Chối Bỏ</h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                Khóa bí mật RSA-2048 được mã hóa AES-256 trên hệ thống. Dấu thời gian (Timestamp) được cấp bởi Internal TSA đáng tin cậy.
              </p>
            </div>

            <div className="group bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-red-500/10 hover:-translate-y-2 transition-all duration-300">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-2xl mb-8 group-hover:scale-110 transition-transform duration-300">
                <i className="fa-solid fa-file-pdf"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Chuẩn Ký PAdES-LTV
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                Hỗ trợ Long-Term Validation. Chứng chỉ X.509 được nhúng trực tiếp, giúp Adobe Acrobat tự động xác minh (Tích Xanh) trọn đời.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: HƯỚNG DẪN SỬ DỤNG (HOW IT WORKS) */}
      <section
        id="how-it-works"
        className="py-32 bg-[#0B1120] text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
          <div
            className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-sm font-black text-blue-500 tracking-widest uppercase mb-3">
              Quy Trình
            </h2>
            <h3 className="text-4xl md:text-5xl font-black mb-6">
              4 Bước Ký Số Nhanh Chóng
            </h3>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Hệ thống được thiết kế tối giản hóa trải nghiệm người dùng, giúp bạn hoàn thành việc ký kết chỉ trong vài thao tác cơ bản.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-[5rem] left-[10%] right-[10%] h-[2px] border-t-2 border-dashed border-slate-700/70 -z-10"></div>

            {/* Step 1 */}
            <div className="relative group">
              <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl hover:bg-slate-800/80 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] h-full flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-3xl text-blue-400 mb-8 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-xl relative">
                  <i className="fa-solid fa-key relative z-10"></i>
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center border-4 border-slate-800/50 shadow-lg">
                    1
                  </div>
                </div>
                <h4 className="text-xl font-bold mb-4 text-white group-hover:text-blue-300 transition-colors">
                  Tạo Cặp Khóa
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Sinh khóa RSA & nhận Chứng chỉ X.509 định danh cá nhân hoàn toàn tự động.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative group">
              <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl hover:bg-slate-800/80 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] h-full flex flex-col items-center text-center mt-0 md:mt-12">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-3xl text-blue-400 mb-8 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-xl relative">
                  <i className="fa-solid fa-cloud-arrow-up relative z-10"></i>
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center border-4 border-slate-800/50 shadow-lg">
                    2
                  </div>
                </div>
                <h4 className="text-xl font-bold mb-4 text-white group-hover:text-blue-300 transition-colors">
                  Upload PDF
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Kéo thả tài liệu, văn bản hoặc hợp đồng cần ký kết lên hệ thống lưu trữ.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative group">
              <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl hover:bg-slate-800/80 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] h-full flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-3xl text-blue-400 mb-8 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-xl relative">
                  <i className="fa-solid fa-pen-nib relative z-10"></i>
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center border-4 border-slate-800/50 shadow-lg">
                    3
                  </div>
                </div>
                <h4 className="text-xl font-bold mb-4 text-white group-hover:text-blue-300 transition-colors">
                  Ký Mật Mã
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Nhập Passphrase để giải mã Private Key an toàn và đóng mộc điện tử.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative group">
              <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl hover:bg-slate-800/80 hover:border-emerald-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] h-full flex flex-col items-center text-center mt-0 md:mt-12">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-3xl text-blue-400 mb-8 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 shadow-xl relative">
                  <i className="fa-solid fa-check-double relative z-10"></i>
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center border-4 border-slate-800/50 shadow-lg">
                    4
                  </div>
                </div>
                <h4 className="text-xl font-bold mb-4 text-white group-hover:text-emerald-400 transition-colors">
                  Xác Thực Xanh
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Mở trên phần mềm PDF để xem chứng nhận Tích Xanh LTV và TSA hợp lệ.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: DOWNLOAD ROOT CA */}
      <section id="certificate" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 border border-blue-100 rounded-[2.5rem] p-10 md:p-16 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="w-full md:w-2/3 text-center md:text-left">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold tracking-wide mb-6">
                  <i className="fa-solid fa-shield-halved mr-2"></i> Trust Anchor
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">
                  Cài Đặt Root CA Nội Bộ
                </h2>
                <p className="text-slate-600 text-lg leading-relaxed mb-6 font-medium">
                  Để Windows và các phần mềm như <b>Adobe Acrobat</b> tin tưởng hoàn toàn vào chữ ký của hệ thống, bạn cần tải và cài đặt Chứng chỉ gốc (Root CA) này.
                </p>
                <p className="text-slate-600 text-lg leading-relaxed mb-6 font-medium">
                  Lưu ý: Chứng chỉ này chỉ phục vụ mục đích demo. Sau khi thử nghiệm, bạn nên xóa khỏi danh sách nguồn tin cậy của Adobe để tránh nhầm lẫn.
                </p>
                <div className="flex items-center justify-center md:justify-start space-x-4 text-sm font-semibold text-slate-500">
                  <span className="flex items-center">
                    <i className="fa-regular fa-file-code mr-2 text-blue-500"></i> Định dạng .CER
                  </span>
                  <span className="flex items-center">
                    <i className="fa-brands fa-windows mr-2 text-blue-500"></i> Hỗ trợ Windows
                  </span>
                </div>
              </div>

              <div className="w-full md:w-1/3 flex justify-center md:justify-end">
                <button
                  type="button"
                  onClick={handleDownloadRootCA}
                  className="group relative inline-flex items-center justify-center px-8 py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all shadow-[0_15px_30px_-10px_rgba(0,0,0,0.3)] hover:-translate-y-1 overflow-hidden w-full md:w-auto text-lg cursor-pointer"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  <i className="fa-solid fa-cloud-arrow-down text-2xl mr-3"></i>
                  <span>Tải Root CA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 mb-6 md:mb-0">
            <div
              className="flex items-center space-x-3 group cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all duration-300">
                <i className="fa-solid fa-file-signature text-xl"></i>
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-slate-900">
                Secure<span className="text-blue-600">Sign</span>
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-500 font-medium text-center md:text-left mb-6 md:mb-0">
            &copy; 2026 by <span className="font-semibold text-gray-900">SecureSign</span>. All rights reserved.
          </p>

          <div className="flex space-x-5">
            <a
              href="https://github.com/Vunas/digital-signature-system"
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
            >
              <i className="fa-brands fa-github text-lg"></i>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

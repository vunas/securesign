"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Footer from "@/components/Footer";
import { showConfirm } from "@/lib/swal";

function subscribeAuth(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("securesign:auth-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("securesign:auth-changed", callback);
  };
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  const username = useSyncExternalStore(
    subscribeAuth,
    () =>
      typeof window !== "undefined" ? localStorage.getItem("username") : null,
    () => null,
  );

  const role = useSyncExternalStore(
    subscribeAuth,
    () => (typeof window !== "undefined" ? localStorage.getItem("role") : null),
    () => null,
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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

  const workspaceHref =
    role === "PLATFORM_SUPER_ADMIN" ? "/admin/tenants" : "/dashboard";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      {/* COMPACT LANDING NAVBAR (h-14 synced with app Navbar) */}
      <header
        className={`fixed top-0 z-50 w-full border-b transition-all duration-200 ${
          scrolled
            ? "border-slate-200/90 bg-white/95 backdrop-blur-md"
            : "border-transparent bg-white/75 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Logo */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group inline-flex items-center gap-2.5 cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xs transition group-hover:shadow-indigo-500/30">
              <i className="fa-solid fa-file-signature text-xs"></i>
            </div>
            <span className="text-base font-extrabold tracking-tight text-slate-900">
              Secure<span className="text-blue-600">Sign</span>
            </span>
          </button>

          {/* Center: Section Links + Public Verify */}
          <nav
            aria-label="Điều hướng trang chủ"
            className="hidden items-center gap-7 md:flex"
          >
            <a
              href="#about"
              className="text-[13px] font-semibold text-slate-600 transition hover:text-indigo-600"
            >
              Về hệ thống
            </a>
            <a
              href="#how-it-works"
              className="text-[13px] font-semibold text-slate-600 transition hover:text-indigo-600"
            >
              Quy trình
            </a>
            <a
              href="#certificate"
              className="text-[13px] font-semibold text-slate-600 transition hover:text-indigo-600"
            >
              Root CA
            </a>
            <Link
              href="/verify"
              className="text-[13px] font-semibold text-slate-600 transition hover:text-indigo-600"
            >
              <span>Xác thực văn bằng</span>
            </Link>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/verify"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 md:hidden"
            >
              <i className="fa-solid fa-shield-halved text-[11px]"></i>
              <span>Xác thực</span>
            </Link>

            {username ? (
              <Link
                href={workspaceHref}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">
                  <i className="fa-solid fa-user"></i>
                </span>
                <span className="max-w-30 truncate">{username}</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="hidden rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700 sm:inline-flex"
                >
                  Đăng ký tổ chức
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-600"
                >
                  <span>Đăng nhập</span>
                  <i className="fa-solid fa-arrow-right text-[11px]"></i>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative flex items-center overflow-hidden  pt-24 bg-white">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-12 lg:flex-row">
            {/* Left: Typography & CTAs */}
            <div className="w-full text-center lg:w-1/2 lg:text-left">
              <div className="mb-5 inline-flex items-center  border border-blue-100  px-3.5 py-1.5 text-xs font-bold tracking-wide text-blue-700 ">
                <span className="relative mr-2 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
                </span>
                Hệ thống Chữ ký số PKI
              </div>

              <h1 className="mb-5 text-4xl font-black leading-[1.12] tracking-tight text-slate-900 sm:text-5xl xl:text-6xl">
                Ký Kết Tài Liệu <br />
                <span className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Bảo Mật Tuyệt Đối
                </span>
              </h1>

              <p className="mx-auto mb-8 max-w-xl text-base font-medium leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
                Giải pháp phát hành & ký số văn bằng chuẩn PAdES-LTV. Đảm bảo
                toàn vẹn dữ liệu, chống chối bỏ và xác thực trực tuyến tức thì
                qua mã QR.
              </p>

              <div className="flex flex-col items-center justify-center gap-3.5 sm:flex-row lg:justify-start">
                <Link
                  href={username ? workspaceHref : "/login"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white  hover:-translate-y-0.5 hover:bg-indigo-700 sm:w-auto sm:text-base"
                >
                  <span>Bắt đầu ký ngay</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </Link>

                <Link
                  href="/verify"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800 sm:w-auto sm:text-base"
                >
                  <i className="fa-solid fa-shield-halved text-emerald-600"></i>
                  <span>Xác thực văn bằng</span>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 flex flex-wrap justify-center gap-6 border-t border-slate-200/80 pt-7 text-xs font-bold text-slate-500 lg:justify-start">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-lock text-indigo-600"></i>
                  <span>RSA-2048 / ECDSA</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-file-pdf text-rose-500"></i>
                  <span>PAdES-LTV Standard</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-clock text-emerald-600"></i>
                  <span>RFC 3161 TSA</span>
                </div>
              </div>
            </div>

            {/* Right: DotLottie Animation */}
            <div className="relative flex w-full items-center justify-center lg:w-1/2">
              <div className="relative aspect-square w-full max-w-115">
                <DotLottieReact
                  src="/hero-sign.lottie"
                  loop
                  autoplay
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: TẠI SAO CHỌN SECURESIGN (ABOUT) */}
      <section id="about" className="relative z-10 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-blue-600">
              Tính Năng Cốt Lõi
            </h2>
            <h3 className="text-3xl font-black text-slate-900 md:text-4xl">
              Bảo Mật Ở Mức Độ Doanh Nghiệp
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="group rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-500/10">
              <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-500 transition-transform duration-300 group-hover:scale-110">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">
                Toàn Vẹn Dữ Liệu
              </h3>
              <p className="font-medium leading-relaxed text-slate-600">
                Sử dụng thuật toán băm SHA-256. Bất kỳ sự thay đổi nhỏ nào lên
                văn bản sau khi ký đều làm mất hiệu lực chữ ký ngay lập tức.
              </p>
            </div>

            <div className="group rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/10">
              <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-500 transition-transform duration-300 group-hover:scale-110">
                <i className="fa-solid fa-fingerprint"></i>
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">
                Chống Chối Bỏ
              </h3>
              <p className="font-medium leading-relaxed text-slate-600">
                Khóa bí mật được mã hóa AES-256 trên hệ thống. Dấu thời gian
                (Timestamp) được cấp bởi Internal TSA đáng tin cậy.
              </p>
            </div>

            <div className="group rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-rose-500/10">
              <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-500 transition-transform duration-300 group-hover:scale-110">
                <i className="fa-solid fa-file-pdf"></i>
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">
                Chuẩn Ký PAdES-LTV
              </h3>
              <p className="font-medium leading-relaxed text-slate-600">
                Hỗ trợ Long-Term Validation. Chứng chỉ X.509 được nhúng trực
                tiếp, giúp Adobe Acrobat tự động xác minh (Tích Xanh) trọn đời.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: HƯỚNG DẪN SỬ DỤNG (HOW IT WORKS) */}
      <section
        id="how-it-works"
        className="relative overflow-hidden bg-[#0B1120] py-28 text-white"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-pulse-slow absolute top-0 left-1/4 h-125 w-125 rounded-full bg-blue-600/20 mix-blend-screen blur-[120px]"></div>
          <div
            className="animate-pulse-slow absolute right-1/4 bottom-0 h-125 w-125 rounded-full bg-indigo-600/20 mix-blend-screen blur-[120px]"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-20 text-center">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-blue-500">
              Quy Trình
            </h2>
            <h3 className="mb-5 text-3xl font-black md:text-5xl">
              4 Bước Ký Số Nhanh Chóng
            </h3>
            <p className="mx-auto max-w-2xl text-base text-slate-400 sm:text-lg">
              Hệ thống tối giản hóa thao tác phát hành văn bằng số, bảo mật
              tuyệt đối từ khâu tạo khóa đến đối soát QR.
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="absolute top-20 right-[10%] left-[10%] -z-10 hidden h-0.5 border-t-2 border-dashed border-slate-700/70 md:block"></div>

            {/* Step 1 */}
            <div className="group relative">
              <div className="flex h-full flex-col items-center rounded-3xl border border-slate-700/50 bg-slate-800/40 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-blue-500/50 hover:bg-slate-800/80">
                <div className="relative mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl text-blue-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white">
                  <i className="fa-solid fa-key relative z-10"></i>
                  <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-800/50 bg-blue-500 text-xs font-bold text-white shadow-lg">
                    1
                  </div>
                </div>
                <h4 className="mb-3 text-lg font-bold text-white transition-colors group-hover:text-blue-300">
                  Tạo Cặp Khóa
                </h4>
                <p className="text-sm leading-relaxed text-slate-400">
                  Sinh cặp khóa mật mã & nhận Chứng chỉ X.509 định danh tổ chức
                  hoàn toàn tự động.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative">
              <div className="mt-0 flex h-full flex-col items-center rounded-3xl border border-slate-700/50 bg-slate-800/40 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-blue-500/50 hover:bg-slate-800/80 md:mt-10">
                <div className="relative mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl text-blue-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white">
                  <i className="fa-solid fa-cloud-arrow-up relative z-10"></i>
                  <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-800/50 bg-blue-500 text-xs font-bold text-white shadow-lg">
                    2
                  </div>
                </div>
                <h4 className="mb-3 text-lg font-bold text-white transition-colors group-hover:text-blue-300">
                  Tải Văn Bằng PDF
                </h4>
                <p className="text-sm leading-relaxed text-slate-400">
                  Tải lên tệp PDF văn bằng/chứng chỉ và chọn vị trí đóng dấu
                  hiển thị cùng mã QR.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative">
              <div className="flex h-full flex-col items-center rounded-3xl border border-slate-700/50 bg-slate-800/40 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-blue-500/50 hover:bg-slate-800/80">
                <div className="relative mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl text-blue-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white">
                  <i className="fa-solid fa-pen-nib relative z-10"></i>
                  <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-800/50 bg-blue-500 text-xs font-bold text-white shadow-lg">
                    3
                  </div>
                </div>
                <h4 className="mb-3 text-lg font-bold text-white transition-colors group-hover:text-blue-300">
                  Ký Mật Mã
                </h4>
                <p className="text-sm leading-relaxed text-slate-400">
                  Nhập Passphrase để mở khóa Private Key trên RAM và nhúng chữ
                  ký PAdES tức thì.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="group relative">
              <div className="mt-0 flex h-full flex-col items-center rounded-3xl border border-slate-700/50 bg-slate-800/40 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-emerald-500/50 hover:bg-slate-800/80 md:mt-10">
                <div className="relative mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl text-blue-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white">
                  <i className="fa-solid fa-check-double relative z-10"></i>
                  <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-800/50 bg-emerald-500 text-xs font-bold text-white shadow-lg">
                    4
                  </div>
                </div>
                <h4 className="mb-3 text-lg font-bold text-white transition-colors group-hover:text-emerald-400">
                  Xác Thực Xanh
                </h4>
                <p className="text-sm leading-relaxed text-slate-400">
                  Quét QR tra cứu trạng thái trực tuyến hoặc kiểm tra Tích Xanh
                  trên Adobe Acrobat.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: DOWNLOAD ROOT CA */}
      <section id="certificate" className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-lg bg-linear-to-br from-slate-50 to-blue-50/50 p-10 md:p-14">
            <div className="relative z-10 flex flex-col items-center justify-between gap-10 md:flex-row">
              <div className="w-full text-center md:w-2/3 md:text-left">
                <div className="mb-5 inline-flex items-center rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-bold tracking-wide text-emerald-700">
                  <i className="fa-solid fa-shield-halved mr-2"></i> Trust
                  Anchor
                </div>
                <h2 className="mb-4 text-3xl font-black text-slate-900 md:text-4xl">
                  Cài Đặt Root CA Nội Bộ
                </h2>
                <p className="mb-4 text-base font-medium leading-relaxed text-slate-600">
                  Để Windows và <b>Adobe Acrobat</b> tin tưởng hoàn toàn vào chữ
                  ký số của hệ thống, bạn cần tải và cài đặt Chứng chỉ gốc (Root
                  CA) này.
                </p>
                <p className="mb-6 text-sm leading-relaxed text-slate-500">
                  Lưu ý: Chứng chỉ này phục vụ môi trường thử nghiệm/nội bộ. Sau
                  khi kiểm thử, bạn có thể gỡ khỏi danh sách Trusted Root của
                  thiết bị.
                </p>
                <div className="flex items-center justify-center gap-5 text-xs font-semibold text-slate-500 md:justify-start">
                  <span className="flex items-center">
                    <i className="fa-regular fa-file-code mr-2 text-blue-500"></i>
                    Định dạng .CER
                  </span>
                  <span className="flex items-center">
                    <i className="fa-brands fa-windows mr-2 text-blue-500"></i>
                    Hỗ trợ Windows & Adobe
                  </span>
                </div>
              </div>

              <div className="flex w-full justify-center md:w-1/3 md:justify-end">
                <button
                  type="button"
                  onClick={handleDownloadRootCA}
                  className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-900 px-7 py-4 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-slate-800 md:w-auto cursor-pointer"
                >
                  <i className="fa-solid fa-cloud-arrow-down mr-3 text-xl"></i>
                  <span>Tải Root CA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

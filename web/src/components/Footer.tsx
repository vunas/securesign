"use client";

import Link from "next/link";

export default function Footer() {
  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="mt-auto border-t border-slate-200/90 bg-white py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
        {/* Brand */}
        <button
          type="button"
          onClick={scrollToTop}
          className="group inline-flex items-center gap-2.5 cursor-pointer"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xs transition group-hover:shadow-indigo-500/30">
            <i className="fa-solid fa-file-signature text-xs"></i>
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">
            Secure<span className="text-blue-600">Sign</span>
          </span>
        </button>

        {/* Quick Links & Copyright */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
          <Link href="/verify" className="transition hover:text-indigo-600">
            Xác thực văn bằng
          </Link>
          <Link href="/register" className="transition hover:text-indigo-600">
            Đăng ký tổ chức
          </Link>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <span>
            &copy; 2026{" "}
            <strong className="font-semibold text-slate-800">SecureSign</strong>
            . All rights reserved.
          </span>
        </div>

        {/* GitHub */}
        <a
          href="https://github.com/vunas/digital-signature-system"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-slate-900 hover:text-white"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub Repository"
        >
          <i className="fa-brands fa-github text-sm"></i>
        </a>
      </div>
    </footer>
  );
}

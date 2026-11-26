"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingHeaderClient({
  username,
  workspaceHref,
}: {
  username: string | null;
  workspaceHref: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full border-b transition-all duration-200 ${
        scrolled
          ? "border-slate-200/90 bg-white/95 backdrop-blur-md"
          : "border-transparent bg-white/75 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5"
          aria-label="SecureSign - Trang chủ"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xs transition group-hover:shadow-indigo-500/30">
            <i className="fa-solid fa-file-signature text-xs"></i>
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">
            Secure<span className="text-blue-600">Sign</span>
          </span>
        </Link>

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
            Xác thực văn bằng
          </Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 md:hidden"
          >
            <i className="fa-solid fa-shield-halved text-[11px]"></i>
            <span>Xác thực</span>
          </Link>

          {username ? (
            <Link
              href={workspaceHref}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
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
                className="hidden rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700 sm:inline-flex"
              >
                Đăng ký tổ chức
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-600"
              >
                <span>Đăng nhập</span>
                <i className="fa-solid fa-arrow-right text-[11px]"></i>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

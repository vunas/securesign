"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useState } from "react";
import { forceLogout } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: "fa-solid fa-chart-pie" },
  { href: "/generate-key", label: "Khóa & Chứng thư", icon: "fa-solid fa-key" },
  { href: "/sign", label: "Ký văn bằng", icon: "fa-solid fa-pen-nib" },
  { href: "/verify", label: "Xác thực", icon: "fa-solid fa-shield-halved" },
  { href: "/log", label: "Hoạt động", icon: "fa-solid fa-clock-rotate-left" },
  { href: "/api-keys", label: "API Keys", icon: "fa-solid fa-plug" },
];

const PLATFORM_ADMIN_ITEMS = [
  {
    href: "/admin/tenants",
    label: "Quản lý tổ chức",
    icon: "fa-solid fa-building-shield",
  },
  {
    href: "/log",
    label: "Audit toàn hệ thống",
    icon: "fa-solid fa-clock-rotate-left",
  },
];

const TENANT_ADMIN_ITEMS = [
  { href: "/team", label: "Nhân sự", icon: "fa-solid fa-users" },
];

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("securesign:auth-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("securesign:auth-changed", callback);
  };
}

function getUsernameSnapshot() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("username") || "";
  }
  return "";
}

function getRoleSnapshot() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("role") || "";
  }
  return "";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const username = useSyncExternalStore(
    subscribe,
    getUsernameSnapshot,
    () => "",
  );
  const role = useSyncExternalStore(subscribe, getRoleSnapshot, () => "");

  const isAuthenticated = Boolean(username && role);

  const navItems =
    role === "PLATFORM_SUPER_ADMIN"
      ? PLATFORM_ADMIN_ITEMS
      : role === "TENANT_ADMIN"
        ? [...NAV_ITEMS, ...TENANT_ADMIN_ITEMS]
        : NAV_ITEMS.filter(
            (item) =>
              item.href !== "/api-keys" && item.href !== "/generate-key",
          );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => router.replace("/login");
    window.addEventListener("securesign:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener(
        "securesign:session-expired",
        handleSessionExpired,
      );
  }, [router]);

  const handleLogout = async () => {
    await forceLogout();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 1. LEFT: Brand Logo */}
        <div className="flex flex-1 items-center justify-start">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2.5 group cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xs transition group-hover:shadow-indigo-500/30">
              <i className="fa-solid fa-file-signature text-xs"></i>
            </div>
            <span className="text-base font-extrabold tracking-tight text-slate-900">
              Secure<span className="text-blue-600">Sign</span>
            </span>
          </Link>
        </div>

        {/* 2. CENTER: Navigation */}
        {isAuthenticated ? (
          <nav
            aria-label="Điều hướng chính"
            className="hidden items-center justify-center gap-0.5 xl:gap-1 lg:flex"
          >
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/verify" && pathname.startsWith("/verify/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs xl:px-2.5 xl:text-[13px] transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                  }`}
                >
                  <i
                    className={`${item.icon} text-xs ${
                      isActive ? "text-indigo-600" : "text-slate-400"
                    }`}
                  ></i>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="hidden items-center justify-center sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-emerald-700">
              <i className="fa-solid fa-shield-halved text-[11px]"></i>
              Cổng xác thực văn bằng điện tử
            </span>
          </div>
        )}

        {/* 3. RIGHT: Auth User Controls OR Public Login Action */}
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 px-2.5 py-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  <i className="fa-regular fa-user text-[11px]"></i>
                </div>
                <div className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-35 truncate text-xs font-semibold text-slate-800">
                    {username}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                title="Đăng xuất"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-sm"></i>
              </button>

              {/* Hamburger Button (Only < lg when logged in) */}
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:hidden cursor-pointer"
                aria-expanded={mobileMenuOpen}
                aria-label="Mở menu điều hướng"
              >
                <i
                  className={`fa-solid ${
                    mobileMenuOpen ? "fa-xmark" : "fa-bars"
                  } text-sm`}
                ></i>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {pathname !== "/verify" && (
                <Link
                  href="/verify"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Xác thực PDF
                </Link>
              )}
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white"
              >
                <i className="fa-solid fa-right-to-bracket text-[11px]"></i>
                <span>Đăng nhập</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu (< lg, only when authenticated) */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="border-t border-slate-200/80 bg-white px-4 py-3 shadow-lg lg:hidden">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <i
                    className={`${item.icon} w-4 text-center text-xs ${
                      isActive ? "text-indigo-600" : "text-slate-400"
                    }`}
                  ></i>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useState } from "react";
import { forceLogout } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: "fa-solid fa-chart-pie" },
  { href: "/generate-key", label: "Quản lý Khóa", icon: "fa-solid fa-key" },
  { href: "/sign", label: "Ký Văn Bản", icon: "fa-solid fa-pen-nib" },
  { href: "/verify", label: "Xác Thực", icon: "fa-solid fa-shield-halved" },
  { href: "/log", label: "Hoạt động", icon: "fa-solid fa-clock-rotate-left" },
  { href: "/api-keys", label: "API Keys", icon: "fa-solid fa-plug" },
];

const PLATFORM_ADMIN_ITEMS = [
  { href: "/admin/tenants", label: "Quản lý tổ chức", icon: "fa-solid fa-building-shield" },
  { href: "/log", label: "Audit toàn hệ thống", icon: "fa-solid fa-clock-rotate-left" },
];

const TENANT_ADMIN_ITEMS = [
  { href: "/team", label: "Quản lý nhân sự", icon: "fa-solid fa-users" },
];

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("securesign:auth-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("securesign:auth-changed", callback);
  };
}

function getSnapshot() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("username") || "Admin User";
  }
  return "Admin User";
}

function getServerSnapshot() {
  return "Admin User";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const username = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const role = useSyncExternalStore(
    subscribe,
    () => typeof window !== "undefined" ? localStorage.getItem("role") : null,
    () => null,
  );
  const navItems = role === "PLATFORM_SUPER_ADMIN"
    ? PLATFORM_ADMIN_ITEMS
    : role === "TENANT_ADMIN"
      ? [...NAV_ITEMS, ...TENANT_ADMIN_ITEMS]
      : NAV_ITEMS.filter((item) => item.href !== "/api-keys");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => router.replace("/login");
    window.addEventListener("securesign:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("securesign:session-expired", handleSessionExpired);
  }, [router]);

  const handleLogout = async () => {
    await forceLogout();
  };

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 w-auto">
            <Link href="/" className="flex items-center space-x-2 cursor-pointer">
              <div className="bg-blue-600 text-white p-2 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-file-signature text-lg"></i>
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 hidden sm:block">
                Secure<span className="text-blue-600">Sign</span>
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden 2xl:flex flex-1 justify-center items-center space-x-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              let activeClass = "text-slate-600 hover:text-slate-900 hover:bg-slate-100";
              if (isActive) {
                if (item.href === "/sign") {
                  activeClass = "ring-2 ring-blue-300 bg-blue-100 text-blue-700 font-semibold";
                } else {
                  activeClass = "bg-blue-50 text-blue-700 font-semibold";
                }
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeClass}`}
                >
                  <i className={`${item.icon} mr-1.5 ${isActive ? "opacity-100" : "opacity-70"} transition-opacity`}></i>
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center justify-end flex-shrink-0">
            <div className="flex items-center space-x-2 sm:space-x-3 md:border-l md:border-gray-200 md:pl-4">
              <div className="flex items-center space-x-2 text-sm font-medium text-slate-700">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                  <i className="fa-regular fa-user"></i>
                </div>
                <span className="hidden sm:inline-block truncate max-w-[120px] lg:max-w-[200px]">
                  {username}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                title="Đăng xuất"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-lg"></i>
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                type="button"
                className="2xl:hidden inline-flex items-center justify-center p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none transition-all cursor-pointer"
                aria-expanded={mobileMenuOpen}
              >
                <span className="sr-only">Mở menu chính</span>
                <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-xl`}></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="2xl:hidden bg-white border-t border-gray-100 shadow-lg absolute w-full left-0 top-16 origin-top">
          <div className="px-4 pt-2 pb-4 space-y-1 sm:px-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const activeClass = isActive
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-3 rounded-md text-base font-medium transition-all ${activeClass}`}
                >
                  <i className={`${item.icon} w-6 text-center ${isActive ? "opacity-100" : "opacity-70"} mr-2`}></i>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}

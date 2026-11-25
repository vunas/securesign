"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchUserProfile, forceLogout, type UserProfile } from "@/lib/api";

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

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavbarClient({
  initialProfile,
  hasSession,
}: {
  initialProfile: UserProfile | null;
  hasSession: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Đồng bộ tự động với initialProfile mới từ Server mà không bị stale state
  const [overrideProfile, setOverrideProfile] = useState<{
    base: UserProfile | null;
    value: UserProfile | null;
  } | null>(null);

  const profile =
    overrideProfile && overrideProfile.base === initialProfile
      ? overrideProfile.value
      : initialProfile;

  const username = profile?.username || "Tài khoản";
  const role = profile?.role || "";
  const isAuthenticated = Boolean(profile) || hasSession;

  const navItems =
    role === "PLATFORM_SUPER_ADMIN"
      ? PLATFORM_ADMIN_ITEMS
      : role === "TENANT_ADMIN"
        ? [...NAV_ITEMS, ...TENANT_ADMIN_ITEMS]
        : NAV_ITEMS.filter(
            (item) =>
              item.href !== "/api-keys" && item.href !== "/generate-key",
          );

  // Tự đóng mobile menu khi chuyển URL (kể cả bấm Back/Forward trình duyệt)
  const [openMenuPathname, setOpenMenuPathname] = useState<string | null>(null);
  const mobileMenuOpen = openMenuPathname === pathname;

  useEffect(() => {
    const handleSessionExpired = () => {
      router.replace("/login");
      router.refresh();
    };
    const handleAuthChanged = (event: Event) => {
      const nextProfile = (event as CustomEvent<UserProfile | null>).detail;
      setOverrideProfile({
        base: initialProfile,
        value: nextProfile ?? null,
      });
    };

    window.addEventListener("securesign:session-expired", handleSessionExpired);
    window.addEventListener("securesign:auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener(
        "securesign:session-expired",
        handleSessionExpired,
      );
      window.removeEventListener("securesign:auth-changed", handleAuthChanged);
    };
  }, [initialProfile, router]);

  useEffect(() => {
    if (initialProfile || !hasSession) return;
    let active = true;

    void fetchUserProfile().then((nextProfile) => {
      if (active) {
        setOverrideProfile({
          base: initialProfile,
          value: nextProfile,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [hasSession, initialProfile]);

  const handleLogout = async () => {
    setOpenMenuPathname(null);
    await forceLogout();
    router.refresh();
  };

  return (
    <>
      {/* 2. CENTER: Navigation */}
      {isAuthenticated ? (
        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center justify-center gap-0.5 lg:flex xl:gap-1"
        >
          {navItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap transition-all xl:px-2.5 xl:text-[13px] ${
                  isActive
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <i
                  className={`${item.icon} text-xs ${
                    isActive ? "text-indigo-600" : "text-slate-400"
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : (
        <div className="hidden items-center justify-center sm:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-emerald-700">
            <i
              className="fa-solid fa-shield-halved text-[11px]"
              aria-hidden="true"
            />
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
                <i
                  className="fa-regular fa-user text-[11px]"
                  aria-hidden="true"
                />
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
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <i
                className="fa-solid fa-arrow-right-from-bracket text-sm"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setOpenMenuPathname((prev) =>
                  prev === pathname ? null : pathname,
                )
              }
              aria-expanded={mobileMenuOpen}
              aria-label={
                mobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"
              }
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:hidden"
            >
              <i
                className={`fa-solid ${
                  mobileMenuOpen ? "fa-xmark" : "fa-bars"
                } text-sm`}
                aria-hidden="true"
              />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {!isNavItemActive(pathname, "/verify") && (
              <Link
                href="/verify"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Xác thực PDF
              </Link>
            )}
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
            >
              <i
                className="fa-solid fa-right-to-bracket text-[11px]"
                aria-hidden="true"
              />
              <span>Đăng nhập</span>
            </Link>
          </div>
        )}
      </div>

      {/* Mobile / Tablet Dropdown Menu (< lg) */}
      {isAuthenticated && mobileMenuOpen && (
        <nav
          aria-label="Điều hướng di động"
          className="absolute top-14 right-0 left-0 border-b border-slate-200/80 bg-white px-4 py-3 shadow-lg lg:hidden"
        >
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpenMenuPathname(null)}
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
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

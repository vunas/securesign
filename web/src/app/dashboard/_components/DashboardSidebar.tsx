"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  counts?: {
    credentials: number;
    keys: number;
    signatures: number;
  };
  canManageApiKeys?: boolean;
  quotaSlot?: React.ReactNode;
}

export default function DashboardSidebar({
  counts,
  canManageApiKeys = false,
  quotaSlot,
}: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Tổng quan", icon: "fa-chart-pie" },
    {
      href: "/dashboard/credentials",
      label: "Văn bằng đã phát hành",
      icon: "fa-file",
      count: counts?.credentials,
    },
    {
      href: "/dashboard/keys",
      label: "Khóa & Chứng thư",
      icon: "fa-key",
      count: counts?.keys,
    },
    {
      href: "/dashboard/audit",
      label: "Nhật ký kiểm toán",
      icon: "fa-clock-rotate-left",
      count: counts?.signatures,
    },
  ];

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <>
      {/* Mobile Route Tabs (< lg) */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:col-span-12 lg:hidden">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className={`fa-solid ${item.icon}`} />
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Desktop Left Sidebar */}
      <aside className="hidden space-y-5 lg:sticky lg:top-20 lg:col-span-3 lg:block xl:col-span-2">
        <nav className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Danh mục quản lý
          </div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <i
                      className={`fa-solid ${item.icon} w-4 shrink-0 text-center ${
                        active ? "text-indigo-600" : "text-slate-400"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.count === "number" && (
                    <span
                      className={`ml-1.5 shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] ${
                        active
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {canManageApiKeys && (
            <>
              <div className="my-2.5 border-t border-slate-100" />
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quản trị mở rộng
              </div>
              <div className="space-y-1">
                <Link
                  href="/api-keys"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="flex items-center gap-2.5">
                    <i className="fa-solid fa-plug w-4 text-center text-slate-400" />
                    API Keys
                  </span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400" />
                </Link>
                <Link
                  href="/team"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="flex items-center gap-2.5">
                    <i className="fa-solid fa-users w-4 text-center text-slate-400" />
                    Nhân sự
                  </span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400" />
                </Link>
              </div>
            </>
          )}
        </nav>

        {quotaSlot}
      </aside>
    </>
  );
}
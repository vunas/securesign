import { Suspense } from "react";
import Link from "next/link";
import { getDashboardSummary } from "./_lib/dashboard-data";
import DashboardSidebar from "./_components/DashboardSidebar";
import {
  NumberSkeleton,
  OverviewPageSkeleton,
  SidebarQuotaSkeleton,
} from "./_components/DashboardSkeletons";

const metrics = [
  {
    label: "Khóa & Chứng thư",
    icon: "fa-key",
    iconStyle: "bg-indigo-50 text-indigo-600",
    valueStyle: "text-2xl",
    href: "/dashboard/keys",
    value: "keys",
  },
  {
    label: "Văn bằng phát hành",
    icon: "fa-file-pdf",
    iconStyle: "bg-emerald-50 text-emerald-600",
    valueStyle: "text-2xl",
    href: "/dashboard/credentials",
    value: "credentials",
  },
  {
    label: "Lượt ký thành công",
    icon: "fa-signature",
    iconStyle: "bg-blue-50 text-blue-600",
    valueStyle: "text-2xl",
    href: "/dashboard/audit",
    value: "signatures",
  },
  {
    label: "Hạn ngạch tháng",
    icon: "fa-gauge-high",
    iconStyle: "bg-amber-50 text-amber-600",
    valueStyle: "text-xl",
    href: null,
    value: "quota",
  },
] as const;

async function MetricValue({
  metric,
}: {
  metric: (typeof metrics)[number]["value"];
}) {
  const data = await getDashboardSummary();
  if (!data) return <>—</>;

  switch (metric) {
    case "keys":
      return <>{data.stats.total_keys}</>;
    case "credentials":
      return <>{data.stats.total_credentials}</>;
    case "signatures":
      return <>{data.stats.total_sigs}</>;
    case "quota":
      return (
        <>
          {data.stats.monthly_signing_used} / {data.stats.monthly_signing_limit}
        </>
      );
  }
}

async function SidebarWithData() {
  const data = await getDashboardSummary();
  const limit = data?.stats.monthly_signing_limit ?? 0;
  const used = data?.stats.monthly_signing_used ?? 0;
  const percent =
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <DashboardSidebar
      counts={
        data
          ? {
              credentials: data.stats.total_credentials,
              keys: data.stats.total_keys,
              signatures: data.stats.total_sigs,
            }
          : undefined
      }
      canManageApiKeys={data?.permissions.can_manage_api_keys}
      quotaSlot={
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">Hạn ngạch tháng</span>
            {!data ? (
              <span className="font-mono font-semibold text-slate-400">—</span>
            ) : (
              <span className="font-mono font-semibold text-indigo-600">
                {percent}%
              </span>
            )}
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            {data && (
              <div
                className={`h-full rounded-full transition-all ${
                  percent >= 90 ? "bg-amber-500" : "bg-indigo-600"
                }`}
                style={{ width: `${percent}%` }}
              />
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
            <span>Đã dùng</span>
            {!data ? (
              <span className="font-semibold text-slate-400">—</span>
            ) : (
              <span className="font-semibold text-slate-900">
                {used} / {limit}
              </span>
            )}
          </div>
          {data?.stats.period_start && data?.stats.period_end && (
            <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">
              {data.stats.period_start} → {data.stats.period_end}
            </p>
          )}
        </div>
      }
    />
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">
      <main className="w-full grow">
        {/* Welcome Header */}
        <header className="mx-4 mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:mx-6 sm:flex-row sm:items-center sm:p-6 lg:mx-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Không gian quản trị tổ chức
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Theo dõi hạn ngạch ký số, quản lý danh sách văn bằng đã bảo chứng
              và lịch sử kiểm toán.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link
              href="/sign"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700"
            >
              <i className="fa-solid fa-pen-nib" />
              Phát hành văn bằng
            </Link>
            <Link
              href="/generate-key"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <i className="fa-solid fa-plus text-indigo-600" />
              Khởi tạo khóa
            </Link>
          </div>
        </header>

        {/* Top 4 Metrics */}
        <section
          aria-label="Chỉ số tổng quan"
          className="w-full px-4 pt-6 sm:px-6 lg:px-8"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const content = (
                <>
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${metric.iconStyle}`}
                  >
                    <i className={`fa-solid ${metric.icon} text-lg`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      {metric.label}
                    </p>
                    <div
                      className={`mt-0.5 font-extrabold text-slate-900 ${metric.valueStyle}`}
                    >
                      <Suspense fallback={<NumberSkeleton />}>
                        <MetricValue metric={metric.value} />
                      </Suspense>
                    </div>
                  </div>
                </>
              );

              const cardClass =
                "flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm";

              return metric.href ? (
                <Link
                  key={metric.value}
                  href={metric.href}
                  className={`${cardClass} transition hover:border-indigo-300`}
                >
                  {content}
                </Link>
              ) : (
                <div key={metric.value} className={cardClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        {/* Workspace Grid: Sidebar + Page Route Content */}
        <section className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            <Suspense
              fallback={
                <DashboardSidebar quotaSlot={<SidebarQuotaSkeleton />} />
              }
            >
              <SidebarWithData />
            </Suspense>

            <div className="space-y-6 lg:col-span-9 xl:col-span-10">
              <Suspense fallback={<OverviewPageSkeleton />}>
                {children}
              </Suspense>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

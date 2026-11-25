import type { CSSProperties } from "react";

export function NumberSkeleton({
  className = "h-7 w-16",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded-md bg-slate-200 align-middle ${className}`}
    />
  );
}

export function LineSkeleton({
  className = "h-4 w-full",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse rounded bg-slate-200/90 ${className}`}
    />
  );
}

export function ProgressBarSkeleton({
  className = "h-2 w-full",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-full bg-slate-200 ${className}`}
    />
  );
}

export function PanelSkeleton({
  className = "h-48 w-full",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-slate-100 ${className}`}
    />
  );
}

export function TableRowsSkeleton({
  rows = 4,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true">
          {Array.from({ length: columns }, (_, colIndex) => (
            <td key={colIndex} className="px-6 py-4">
              <LineSkeleton
                className={
                  colIndex === 0
                    ? "h-4 w-40"
                    : colIndex === columns - 1
                      ? "ml-auto h-7 w-20 rounded-lg"
                      : "h-4 w-24"
                }
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SidebarQuotaSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải hạn ngạch tháng"
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-800">Hạn ngạch tháng</span>
        <NumberSkeleton className="h-4 w-10" />
      </div>
      <ProgressBarSkeleton className="mt-2.5 h-2 w-full" />
      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
        <span>Đã dùng</span>
        <NumberSkeleton className="h-4 w-20" />
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2">
        <LineSkeleton className="h-3 w-36" />
      </div>
    </div>
  );
}

export function ChartsRowSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải biểu đồ thống kê"
      className="grid grid-cols-1 gap-6 xl:grid-cols-12"
    >
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm xl:col-span-7">
        <LineSkeleton className="h-4 w-48" />
        <LineSkeleton className="mt-2 h-3 w-72" />
        <PanelSkeleton className="mt-5 h-52 w-full" />
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm xl:col-span-5">
        <LineSkeleton className="h-4 w-44" />
        <LineSkeleton className="mt-2 h-3 w-60" />
        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="h-36 w-36 shrink-0 animate-pulse rounded-full border-18 border-slate-100" />
          <div className="hidden w-full space-y-2.5 sm:block">
            <PanelSkeleton className="h-9 w-full" />
            <PanelSkeleton className="h-9 w-full" />
            <PanelSkeleton className="h-9 w-full" />
          </div>
        </div>
      </section>
    </div>
  );
}

export function TableCardSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải danh sách dữ liệu"
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <PanelSkeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <LineSkeleton className="h-4 w-48" />
            <LineSkeleton className="h-3 w-64" />
          </div>
        </div>
        <LineSkeleton className="h-8 w-28 rounded-xl" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/70">
            <tr>
              {Array.from({ length: columns }, (_, idx) => (
                <th key={idx} className="px-6 py-3.5 text-left">
                  <LineSkeleton
                    className={`h-3 ${idx === columns - 1 ? "ml-auto w-16" : "w-28"}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            <TableRowsSkeleton rows={rows} columns={columns} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OverviewPageSkeleton() {
  return (
    <div className="space-y-6">
      <ChartsRowSkeleton />
      <TableCardSkeleton rows={4} columns={4} />
      <TableCardSkeleton rows={3} columns={4} />
    </div>
  );
}

export function CredentialsPageSkeleton() {
  return <TableCardSkeleton rows={6} columns={4} />;
}

export function KeysPageSkeleton() {
  return <TableCardSkeleton rows={5} columns={4} />;
}

export function AuditPageSkeleton() {
  return <TableCardSkeleton rows={6} columns={5} />;
}
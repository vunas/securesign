export default function DataSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-slate-50/80">
      <main
        aria-label="Đang tải dữ liệu"
        aria-busy="true"
        className="mx-auto w-full max-w-7xl grow px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200/80 pb-5">
          <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-8" />
          <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-4" />
        </div>
        <span className="sr-only">Đang tải dữ liệu...</span>
      </main>
    </div>
  );
}

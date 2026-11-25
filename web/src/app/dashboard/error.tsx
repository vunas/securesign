// src/app/dashboard/error.tsx
"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="w-full rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-700 shadow-sm"
    >
      <p>{error.message || "Không thể tải dữ liệu Dashboard."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 cursor-pointer font-semibold underline"
      >
        Thử tải lại
      </button>
    </div>
  );
}
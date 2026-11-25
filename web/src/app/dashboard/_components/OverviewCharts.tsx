import { extractDayLabel } from "../_lib/utils";
import type { CredentialItem, SignatureItem } from "../_lib/types";

export default function OverviewCharts({
  totalSigs,
  signatures,
  credentials,
}: {
  totalSigs: number;
  signatures: SignatureItem[];
  credentials: CredentialItem[];
}) {
  // 1. Tính dữ liệu biểu đồ đường 7 ngày gần nhất
  const counts = new Map<string, number>();
  [...signatures].reverse().forEach((s) => {
    const day = extractDayLabel(s.signed_at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  });
  const entries = Array.from(counts.entries()).slice(-7);
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);

  const width = 560;
  const height = 185;
  const padLeft = 34;
  const padRight = 22;
  const padTop = 24;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = entries.map(([label, count], idx) => {
    const x =
      entries.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (entries.length - 1)) * plotW;
    const y = padTop + plotH - (count / maxCount) * plotH;
    return { label, count, x, y };
  });

  const linePath = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`;
  }, "");

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
      : "";

  const yTicks = [maxCount, Math.ceil(maxCount / 2), 0];

  // 2. Tính dữ liệu biểu đồ tròn Donut
  const total = credentials.length;
  const issued = credentials.filter((c) => c.status === "ISSUED").length;
  const revoked = credentials.filter((c) => c.status === "REVOKED").length;
  const draft = credentials.filter((c) => c.status === "DRAFT").length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const segments = [
    {
      key: "issued",
      label: "Đang có hiệu lực",
      count: issued,
      pct: pct(issued),
      color: "#10b981",
      dotClass: "bg-emerald-500",
    },
    {
      key: "revoked",
      label: "Đã thu hồi",
      count: revoked,
      pct: pct(revoked),
      color: "#f43f5e",
      dotClass: "bg-rose-500",
    },
    {
      key: "draft",
      label: "Bản nháp",
      count: draft,
      pct: pct(draft),
      color: "#94a3b8",
      dotClass: "bg-slate-400",
    },
  ];

  const size = 148;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const activeSegmentsCount = segments.filter((s) => s.count > 0).length;
  let accumulatedRatio = 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Chart 1: Smooth Area / Line Chart */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm xl:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Xu hướng ký phát hành gần đây
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Biến động số lượt ký số hoàn tất theo từng ngày hoạt động
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/80 px-2.5 py-1 font-mono text-xs font-bold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            Tổng: {totalSigs} lượt
          </span>
        </div>

        {points.length === 0 ? (
          <div className="mt-4 flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-xs text-slate-400">
            <i className="fa-solid fa-chart-line mb-2 text-lg text-slate-300" />
            Chưa có dữ liệu ký số để hiển thị biểu đồ đường
          </div>
        ) : (
          <div className="mt-4 w-full">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-52 w-full overflow-visible"
              role="img"
              aria-label="Biểu đồ đường xu hướng ký số"
            >
              <defs>
                <linearGradient
                  id="signingAreaGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {yTicks.map((tickVal, idx) => {
                const yPos = padTop + plotH - (tickVal / maxCount) * plotH;
                return (
                  <g key={`${tickVal}-${idx}`}>
                    <line
                      x1={padLeft}
                      y1={yPos}
                      x2={width - padRight}
                      y2={yPos}
                      stroke="#e2e8f0"
                      strokeDasharray={tickVal === 0 ? undefined : "4 4"}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[10px]"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {areaPath && (
                <path d={areaPath} fill="url(#signingAreaGradient)" />
              )}

              {points.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((pt) => (
                <g key={pt.label} className="group">
                  <line
                    x1={pt.x}
                    y1={pt.y}
                    x2={pt.x}
                    y2={padTop + plotH}
                    stroke="#c7d2fe"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    className="fill-white stroke-indigo-600 transition-all group-hover:r-6"
                    strokeWidth="2.75"
                  />
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    className="fill-slate-800 font-mono text-[11px] font-bold"
                  >
                    {pt.count}
                  </text>
                  <text
                    x={pt.x}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-slate-500 font-mono text-[11px] font-medium"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* Chart 2: Donut Chart */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm xl:col-span-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Tình trạng hiệu lực văn bằng
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Tỷ trọng trạng thái xác thực trên cổng tra cứu
          </p>
        </div>

        <div className="my-auto flex flex-col items-center gap-6 pt-4 sm:flex-row xl:flex-col 2xl:flex-row">
          <div className="relative flex shrink-0 items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90"
              role="img"
              aria-label="Biểu đồ tròn phân bổ trạng thái văn bằng"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
              />
              {total > 0 &&
                segments.map((seg) => {
                  if (seg.count === 0) return null;
                  const ratio = seg.count / total;
                  const dashLength = ratio * circumference;
                  const dashOffset = -accumulatedRatio * circumference;
                  accumulatedRatio += ratio;

                  return (
                    <circle
                      key={seg.key}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${dashLength} ${circumference}`}
                      strokeDashoffset={dashOffset}
                      strokeLinecap={
                        activeSegmentsCount === 1 ? "butt" : "round"
                      }
                      className="transition-all duration-500"
                    />
                  );
                })}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-semibold text-slate-400">
                Tổng cộng
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                {total}
              </span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-2.5 text-xs">
            {segments.map((seg) => (
              <div
                key={seg.key}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
              >
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.dotClass}`}
                  />
                  <span>{seg.label}</span>
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {seg.count}{" "}
                  <span className="font-normal text-slate-400">
                    ({seg.pct}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
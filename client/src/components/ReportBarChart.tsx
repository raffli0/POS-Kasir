import { useState } from "react";
import { cn } from "../lib/cn";

export type BarChartItem = {
  label: string; // Bottom label (e.g. "08", "Mg 1", "Jan")
  value: number; // Raw numeric value
  formattedValue: string; // Formatted IDR (e.g. "Rp 1.842.000")
  isPeak?: boolean; // Highlight with caramel amber (bg-counterlime)
  subtext?: string; // Optional subtext (e.g. "12 transaksi")
};

type ReportBarChartProps = {
  title: string;
  items: BarChartItem[];
  className?: string;
  emptyLabel?: string;
};

export function ReportBarChart({
  title,
  items,
  className,
  emptyLabel = "Belum ada transaksi pada periode ini",
}: ReportBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(1, ...items.map((it) => it.value));
  const hasData = items.some((it) => it.value > 0);

  return (
    <article
      className={cn(
        "relative rounded-2xl border border-ink/8 bg-white p-5 md:p-6 shadow-2xs transition-shadow",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold tracking-tight text-ink md:text-lg">
          {title}
        </h3>
        {hasData && (
          <span className="label-caps text-[10px] font-semibold text-ink/40">
            Penjualan Bersih
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="flex h-52 items-center justify-center text-center">
          <p className="text-sm font-medium text-ink/40">{emptyLabel}</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col justify-end">
          {/* Bars Row */}
          <div className="relative flex h-44 md:h-52 items-end justify-between gap-1.5 sm:gap-2.5 md:gap-3 px-1">
            {items.map((item, idx) => {
              const heightPercent =
                item.value > 0
                  ? Math.max(10, Math.round((item.value / maxValue) * 100))
                  : 0;
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={`${item.label}-${idx}`}
                  className="group relative flex flex-1 flex-col items-center justify-end h-full"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Floating Tooltip */}
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-full mb-2 z-20 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center text-white shadow-lg transition-all duration-150",
                      isHovered
                        ? "opacity-100 translate-y-0 scale-100"
                        : "opacity-0 translate-y-1 scale-95",
                    )}
                  >
                    <p className="text-[10px] font-medium text-white/70">
                      {item.label}
                    </p>
                    <p className="font-display text-xs font-bold text-primary">
                      {item.formattedValue}
                    </p>
                    {item.subtext && (
                      <p className="text-[10px] text-white/60">{item.subtext}</p>
                    )}
                    {/* Tooltip Arrow */}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
                  </div>

                  {/* The Bar */}
                  <div
                    className={cn(
                      "w-full max-w-14 rounded-t-lg transition-all duration-300 pressable",
                      item.isPeak
                        ? "bg-primary shadow-xs"
                        : item.value > 0
                        ? "bg-ink hover:bg-ink/80"
                        : "bg-ink/10 h-1.5",
                      isHovered && "ring-2 ring-primary/40",
                    )}
                    style={{
                      height: item.value > 0 ? `${heightPercent}%` : "4px",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Baseline Horizontal Line */}
          <div className="h-[1.5px] w-full bg-ink/10 mt-1" />

          {/* X-Axis Labels */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 md:gap-3 px-1 pt-2">
            {items.map((item, idx) => (
              <div
                key={`label-${item.label}-${idx}`}
                className="flex flex-1 justify-center min-w-0"
              >
                <span
                  className={cn(
                    "truncate text-[10px] sm:text-xs font-semibold text-center",
                    item.isPeak
                      ? "text-ink font-bold"
                      : "text-ink/60 group-hover:text-ink",
                  )}
                  title={item.label}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

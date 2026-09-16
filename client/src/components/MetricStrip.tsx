import { runningOrdersCount, salesToday, usePos } from "./PosContext";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";

export function MetricStrip() {
  const { orders } = usePos();
  const running = runningOrdersCount(orders);
  const paidOrders = orders.filter((o) => o.status === "sudah-dibayar");
  const avgOrder =
    paidOrders.length > 0
      ? Math.round(
        paidOrders.reduce((sum, o) => sum + o.total, 0) / paidOrders.length,
      )
      : 185000;

  return (
    <section
      aria-label="Ringkasan operasional"
      className="grid grid-cols-2 divide-ink/8 overflow-hidden rounded-xl border border-ink/8 bg-white lg:grid-cols-4 lg:divide-x shadow-2xs"
    >
      <MetricCell
        active
        label={t.metrics.running}
        value={String(running).padStart(2, "0")}
        delta={t.metrics.runningDelta}
      />
      <MetricCell
        label={t.metrics.todaySales}
        value={formatIDR(salesToday(orders))}
        delta={t.metrics.salesDelta}
      />
      <MetricCell
        label={t.metrics.avgOrder}
        value={formatIDR(avgOrder)}
        delta={t.metrics.avgWindow}
      />
    </section>
  );
}

function MetricCell({
  label,
  value,
  delta,
  active = false,
}: {
  label: string;
  value: string;
  delta: string;
  active?: boolean;
}) {
  return (
    <div className="relative min-w-0 px-4 py-2.5">
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-counterlime"
        />
      )}
      <p className="label-caps text-[10px] font-semibold text-ink/50">{label}</p>
      <p className="mt-0.5 truncate font-display text-base font-bold tracking-tight text-ink md:text-lg">
        {value}
      </p>
      <p className="truncate text-[11px] text-ink/50">{delta}</p>
    </div>
  );
}

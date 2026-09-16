import { useLocation } from "wouter";
import { ArrowRight, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { Header } from "../components/Header";
import { usePos, type OrderStatus } from "../components/PosContext";
import { useAuth } from "../components/AuthContext";
import { getPrinterDriver } from "../services/printer";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

export default function Orders() {
  const [, navigate] = useLocation();
  const { orders, setLastReceipt } = usePos();
  const { currentStaff } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header title={t.ordersPage.title} />
      <div className="flex-1 p-5 md:p-8">
        <p className="-mt-1 mb-5 text-sm text-ink/55">{t.ordersPage.subtitle}</p>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/10 bg-mineral/60">
                <th scope="col" className="label-caps px-5 py-3 text-[11px] font-semibold text-ink/50">
                  {t.ordersPage.colNo}
                </th>
                <th scope="col" className="label-caps px-5 py-3 text-[11px] font-semibold text-ink/50">
                  {t.ordersPage.colStatus}
                </th>
                <th scope="col" className="label-caps px-5 py-3 text-right text-[11px] font-semibold text-ink/50">
                  {t.ordersPage.colTotal}
                </th>
                <th scope="col" className="px-5 py-3" aria-label={t.ordersPage.colAction} />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.no}
                  className="relative border-b border-ink/6 last:border-0 hover:bg-mineral/40"
                >
                  <td className="relative px-5 py-4">
                    {order.status !== "sudah-dibayar" && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold tracking-tight text-ink">
                        #{order.no}
                      </p>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink/50">
                      {(() => {
                        const orderDate = order.paidAt || order.createdAt;
                        const timeStr = orderDate
                          ? new Date(orderDate).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }).replace(".", ":")
                          : "";
                        return (
                          <span>
                            {timeStr
                              ? `Hari ini, ${timeStr} · ${t.ordersPage.itemsUnit(order.itemCount)}`
                              : t.ordersPage.metaLine(order.itemCount)}
                          </span>
                        );
                      })()}
                      {order.cashierName && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-ink/85 bg-primary/20 text-[11px] px-1.5 py-0.2 rounded border border-primary/30">
                            Kasir: {order.cashierName}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusChip status={order.status} />
                  </td>
                  <td className="px-5 py-4 text-right font-display font-bold tracking-tight text-ink">
                    {formatIDR(order.total)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Cetak struk pesanan ini"
                        onClick={() => {
                          setLastReceipt(order);
                          void getPrinterDriver().printReceipt({
                            orderNo: order.no,
                            total: formatIDR(order.total),
                            cashierName: order.cashierName || currentStaff.name,
                            timestamp: order.paidAt || order.createdAt,
                            lines: (order.items || []).map((it) => ({
                              qty: it.qty,
                              name: it.note ? `${it.name} (${it.note})` : it.name,
                              amount: formatIDR(it.price * it.qty),
                            })),
                          });
                        }}
                      >
                        <Printer size={14} aria-hidden="true" />
                        Cetak
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast(t.toasts.orderOpened(order.no));
                          navigate("/");
                        }}
                      >
                        {t.ordersPage.open}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: OrderStatus | string }) {
  const isPaid = status === "sudah-dibayar";
  return (
    <Badge tone={isPaid ? "success" : "warning"}>
      {isPaid ? t.ordersPage.statusDibayar : t.ordersPage.statusDisimpan}
    </Badge>
  );
}

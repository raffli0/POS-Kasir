import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Banknote,
  QrCode,
  Wallet,
  X,
  CheckCircle2,
  Delete,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { usePos, type PayMethod } from "./PosContext";
import { useAuth } from "./AuthContext";
import { getPrinterDriver } from "../services/printer";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

export function PaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orderNo, totals, payOrder } = usePos();
  const { currentStaff } = useAuth();
  const [method, setMethod] = useState<PayMethod>("tunai");
  const [cash, setCash] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Initialize or reset when opened
  useEffect(() => {
    if (!open) return;
    setMethod("tunai");
    setCash("");
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Generate QRIS code
  useEffect(() => {
    if (method !== "qris") return;
    const payload = `KASA|QRIS-SIMULASI|PESANAN-${orderNo}|${totals.total}`;
    void QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      color: { dark: "#14211f", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [method, orderNo, totals.total]);

  const cashNum = Number.parseInt(cash.replace(/\D/g, ""), 10) || 0;
  const shortage = Math.max(0, totals.total - cashNum);
  const change = cashNum >= totals.total ? cashNum - totals.total : null;
  const canPay = method === "qris" || (method === "tunai" && cashNum >= totals.total);

  // Quick cash suggestions (Roundups based on total)
  const quickSuggestions = useMemo(() => {
    const total = totals.total;
    if (total <= 0) return [10000, 20000, 50000, 100000];
    const set = new Set<number>();

    // Next 10.000 round up
    const next10k = Math.ceil(total / 10000) * 10000;
    if (next10k > total) set.add(next10k);

    // Next 20.000 round up
    const next20k = Math.ceil(total / 20000) * 20000;
    if (next20k > total) set.add(next20k);

    // Next 50.000 round up
    const next50k = Math.ceil(total / 50000) * 50000;
    if (next50k > total) set.add(next50k);

    // Next 100.000 round up
    const next100k = Math.ceil(total / 100000) * 100000;
    if (next100k > total) set.add(next100k);

    // Also include 50k & 100k if not already included and total is under them
    if (total < 50000) set.add(50000);
    if (total < 100000) set.add(100000);

    return Array.from(set)
      .filter((v) => v > total)
      .sort((a, b) => a - b)
      .slice(0, 3);
  }, [totals.total]);

  // Numpad Touch Keypad Handlers
  const handleNumpadDigit = useCallback((d: string) => {
    setCash((prev) => {
      const combined = (prev + d).replace(/^0+/, "");
      return combined || "0";
    });
  }, []);

  const handleNumpadThousands = useCallback(() => {
    setCash((prev) => {
      if (!prev || prev === "0") return "";
      return prev + "000";
    });
  }, []);

  const handleNumpadBackspace = useCallback(() => {
    setCash((prev) => prev.slice(0, -1));
  }, []);

  const handleNumpadClear = useCallback(() => {
    setCash("");
  }, []);

  const handleExactCash = useCallback(() => {
    setCash(String(totals.total));
  }, [totals.total]);

  const handleSetQuickCash = useCallback((val: number) => {
    setCash(String(val));
  }, []);

  // Submit payment
  const handlePay = useCallback(() => {
    if (!canPay) return;
    const result = payOrder(method, method === "tunai" ? cashNum : undefined);
    if (method === "tunai" && result.change !== null) {
      toast.success(t.payment.successTitle, {
        description: `${t.payment.successDesc(result.orderNo, formatIDR(result.total))} · ${t.payment.successWithChange(formatIDR(result.change))}`,
      });
    } else {
      toast.success(t.payment.successTitle, {
        description: t.payment.successDesc(result.orderNo, formatIDR(result.total)),
      });
    }
    onClose();

    // Auto-trigger print for the paid order
    setTimeout(() => {
      void getPrinterDriver().printReceipt({
        orderNo: result.orderNo,
        total: formatIDR(result.total),
        cashierName: result.order.cashierName || currentStaff.name,
        timestamp: result.order.paidAt || result.order.createdAt,
        lines: (result.order.items || []).map((it) => ({
          qty: it.qty,
          name: it.note ? `${it.name} (${it.note})` : it.name,
          amount: formatIDR(it.price * it.qty),
        })),
      });
    }, 250);
  }, [canPay, payOrder, method, cashNum, totals.total, onClose, currentStaff]);

  // Physical Keyboard Listener (Works for desktop/laptop numpads)
  useEffect(() => {
    if (!open) return;

    const onPhysicalKeyDown = (e: KeyboardEvent) => {
      if (method !== "tunai") return;
      if (e.key >= "0" && e.key <= "9") {
        handleNumpadDigit(e.key);
      } else if (e.key === "Backspace") {
        handleNumpadBackspace();
      } else if (e.key.toLowerCase() === "c" || e.key === "Delete") {
        handleNumpadClear();
      } else if (e.key === "Enter" && canPay) {
        e.preventDefault();
        handlePay();
      }
    };

    window.addEventListener("keydown", onPhysicalKeyDown);
    return () => window.removeEventListener("keydown", onPhysicalKeyDown);
  }, [
    open,
    method,
    canPay,
    handleNumpadDigit,
    handleNumpadBackspace,
    handleNumpadClear,
    handlePay,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/65 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl border border-ink/15 bg-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-ink/10 bg-mineral/30 px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-counterlime/30 text-ink border border-counterlime/40 shadow-xs">
              <Banknote size={20} className="text-counterlime-dark" />
            </div>
            <div>
              <p className="label-caps text-[10px] font-semibold text-ink/50 leading-none">
                {t.payment.orderLabel(orderNo)}
              </p>
              <h2
                id="payment-title"
                className="mt-0.5 font-display text-base sm:text-lg font-bold tracking-tight text-ink"
              >
                Pembayaran Transaksi
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Main Content (2-Column on Tablet/Desktop, 1-Column on Mobile) */}
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-ink/10">
          {/* LEFT COLUMN: Total, Method Selection & Complete Action (5 of 12 cols) */}
          <div className="md:col-span-5 p-5 sm:p-6 flex flex-col justify-between space-y-5 bg-white shrink-0">
            <div className="space-y-4">
              {/* Total Tagihan Banner */}
              <div className="rounded-2xl bg-mineral/40 border border-ink/10 p-4">
                <p className="label-caps text-[10px] font-semibold text-ink/50 uppercase tracking-wider">
                  Total Tagihan
                </p>
                <p className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mt-1">
                  {formatIDR(totals.total)}
                </p>
                {/* <div className="mt-2 pt-2 border-t border-ink/8 flex items-center justify-between text-xs text-ink/60 font-medium">
                  <span>Kasir Bertugas:</span>
                  <span className="font-bold text-ink">{currentStaff.name}</span>
                </div> */}
              </div>

              {/* Payment Method Switcher (Tunai & QRIS) */}
              <div className="space-y-2">
                <label className="label-caps block text-[10px] font-bold text-ink/60 uppercase tracking-wider">
                  Pilih Metode Pembayaran:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod("tunai")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center transition-all cursor-pointer",
                      method === "tunai"
                        ? "border-counterlime-dark bg-counterlime text-ink font-bold shadow-xs ring-2 ring-counterlime/40"
                        : "border-ink/15 bg-white text-ink/70 hover:bg-mineral/40 hover:text-ink font-semibold"
                    )}
                  >
                    <Banknote size={22} />
                    <span className="text-xs">Tunai (Cash)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("qris")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center transition-all cursor-pointer",
                      method === "qris"
                        ? "border-counterlime-dark bg-counterlime text-ink font-bold shadow-xs ring-2 ring-counterlime/40"
                        : "border-ink/15 bg-white text-ink/70 hover:bg-mineral/40 hover:text-ink font-semibold"
                    )}
                  >
                    <Wallet size={22} />
                    <span className="text-xs">QRIS</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Complete & Cancel Action Buttons */}
            <div className="pt-4 border-t border-ink/10 space-y-2">
              <Button
                variant="primary"
                size="lg"
                disabled={!canPay}
                onClick={handlePay}
                className="w-full font-bold text-sm h-12 rounded-xl shadow-xs gap-2"
              >
                <CheckCircle2 size={18} />
                Selesaikan Pembayaran
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="w-full text-xs text-ink/60 hover:text-ink"
              >
                Batal (Esc)
              </Button>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Cash Keypad or QRIS Display (7 of 12 cols) */}
          <div className="md:col-span-7 p-4 sm:p-5 flex flex-col justify-between bg-mineral/20 space-y-3">
            {method === "tunai" ? (
              <div className="flex flex-col h-full space-y-3">
                {/* Cash Input & Calculated Change/Shortage Display */}
                <div className="rounded-2xl border border-ink/15 bg-white p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink/60 uppercase tracking-wider">
                      Uang Tunai Diterima:
                    </span>
                    {cash && (
                      <button
                        type="button"
                        onClick={handleNumpadClear}
                        className="text-[11px] font-bold text-coral hover:text-coral/80 flex items-center gap-1"
                      >
                        <RotateCcw size={11} />
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Formatted Cash Display */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-ink/40 font-display font-bold text-base">
                      Rp
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={cash ? Number(cash).toLocaleString("id-ID") : "0"}
                      placeholder="0"
                      className="w-full h-11 pl-11 pr-3 rounded-xl border border-ink/15 bg-white font-display text-xl sm:text-2xl font-extrabold text-ink tracking-tight select-none focus:outline-none"
                    />
                  </div>

                  {/* Realtime Kembalian / Kurang Banner */}
                  <div className="min-h-8 flex items-center">
                    {cashNum > 0 && shortage > 0 && (
                      <div className="w-full px-3 py-1.5 rounded-lg bg-coral/10 border border-coral/25 flex items-center justify-between text-xs text-coral font-bold">
                        <span>Kurang:</span>
                        <span>{formatIDR(shortage)}</span>
                      </div>
                    )}

                    {change !== null && (
                      <div className="w-full px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 font-bold">
                        <span>{change === 0 ? "✓ Uang Pas" : "Kembalian:"}</span>
                        <span className="text-sm font-extrabold">{formatIDR(change)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Cash Buttons: "Uang Pas" + Rounded Multiple Suggestions */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">
                    Pilihan Cepat Uang Pelanggan:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {/* Main "Uang Pas" Button */}
                    <button
                      type="button"
                      onClick={handleExactCash}
                      className={cn(
                        "py-2 px-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer",
                        cashNum === totals.total
                          ? "bg-ink text-white border-ink shadow-xs ring-2 ring-primary/40"
                          : "bg-counterlime/40 hover:bg-counterlime text-ink border-counterlime-dark/50 shadow-2xs"
                      )}
                    >
                      <Sparkles size={12} className="text-counterlime-dark" />
                      <span>Uang Pas</span>
                    </button>

                    {/* Dynamic Roundup Suggestions */}
                    {quickSuggestions.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSetQuickCash(val)}
                        className={cn(
                          "py-2 px-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center truncate",
                          cashNum === val
                            ? "bg-ink text-white border-ink shadow-xs ring-2 ring-primary/40"
                            : "bg-white text-ink/80 hover:bg-mineral/50 border-ink/15 shadow-2xs"
                        )}
                      >
                        {formatIDR(val)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Touchscreen Numpad (3-Column standard layout) */}
                <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-[190px]">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpadDigit(num)}
                      className="flex items-center justify-center rounded-xl bg-white border border-ink/15 text-lg sm:text-xl font-bold font-display text-ink hover:bg-counterlime/20 active:scale-95 shadow-2xs transition-all cursor-pointer py-2.5"
                    >
                      {num}
                    </button>
                  ))}

                  {/* Row 4: 000, 0, Backspace */}
                  <button
                    type="button"
                    onClick={handleNumpadThousands}
                    className="flex items-center justify-center rounded-xl bg-mineral/40 border border-ink/15 text-sm sm:text-base font-bold font-display text-ink hover:bg-counterlime/20 active:scale-95 shadow-2xs transition-all cursor-pointer py-2.5"
                  >
                    000
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNumpadDigit("0")}
                    className="flex items-center justify-center rounded-xl bg-white border border-ink/15 text-lg sm:text-xl font-bold font-display text-ink hover:bg-counterlime/20 active:scale-95 shadow-2xs transition-all cursor-pointer py-2.5"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={handleNumpadBackspace}
                    className="flex items-center justify-center rounded-xl bg-coral/10 border border-coral/20 text-coral hover:bg-coral/20 active:scale-95 shadow-2xs transition-all cursor-pointer py-2.5"
                    title="Hapus satu angka"
                  >
                    <Delete size={18} />
                  </button>
                </div>
              </div>
            ) : (
              /* QRIS Scan Screen */
              <div className="flex flex-col items-center justify-center h-full p-4 rounded-2xl bg-white border border-ink/10 text-center space-y-3">
                <p className="text-xs font-bold text-ink/70">
                  Scan QRIS dengan Semua Aplikasi Pembayaran & Bank:
                </p>

                <div className="p-3 rounded-2xl bg-white border-2 border-dashed border-ink/20 shadow-xs">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QRIS Dinamis"
                      className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg mx-auto"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center rounded-lg bg-ink/5">
                      <QrCode size={48} className="text-ink/25 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <p className="font-display text-xl font-extrabold text-ink">
                    {formatIDR(totals.total)}
                  </p>
                  <p className="text-xs text-ink/50">
                    BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

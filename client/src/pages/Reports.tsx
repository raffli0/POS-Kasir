import { useMemo, useState, useRef, useEffect } from "react";
import {
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { Header } from "../components/Header";
import { usePos } from "../components/PosContext";
import { usePrint } from "../components/PrintContext";
import { Button } from "../components/ui/Button";
import { ReportBarChart, type BarChartItem } from "../components/ReportBarChart";
import {
  computeDailyReport,
  computeMonthlyReport,
  computeYearlyReport,
  generateSampleHistoricalOrders,
} from "../lib/reports";
import { exportReportExcel, groupDaily, groupMonthly } from "../lib/exporters";
import { db } from "../lib/db";
import { toast } from "sonner";
import { cn } from "../lib/cn";

const MONTH_NAMES = [
  { index: 0, full: "Januari", short: "Jan" },
  { index: 1, full: "Februari", short: "Feb" },
  { index: 2, full: "Maret", short: "Mar" },
  { index: 3, full: "April", short: "Apr" },
  { index: 4, full: "Mei", short: "Mei" },
  { index: 5, full: "Juni", short: "Jun" },
  { index: 6, full: "Juli", short: "Jul" },
  { index: 7, full: "Agustus", short: "Agu" },
  { index: 8, full: "September", short: "Sep" },
  { index: 9, full: "Oktober", short: "Okt" },
  { index: 10, full: "November", short: "Nov" },
  { index: 11, full: "Desember", short: "Des" },
];

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function toMonthInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function Reports() {
  const { orders } = usePos();
  const { printReport } = usePrint();

  // Active Tab: "harian" | "bulanan" | "tahunan"
  const [tab, setTab] = useState<"harian" | "bulanan" | "tahunan">("harian");

  // Selected Period State
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const monthInputRef = useRef<HTMLInputElement>(null);

  // Popover Picker States
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [yearPageStart, setYearPageStart] = useState(() => Math.floor(new Date().getFullYear() / 12) * 12);
  const [dailyPickerMonth, setDailyPickerMonth] = useState(() => new Date().getMonth());
  const [dailyPickerYear, setDailyPickerYear] = useState(() => new Date().getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Generate calendar days for daily custom date picker
  const dailyCalendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(dailyPickerYear, dailyPickerMonth, 1);
    const lastDayOfMonth = new Date(dailyPickerYear, dailyPickerMonth + 1, 0);
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Senin = 0, Minggu = 6
    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      dayNum: number;
    }> = [];

    const prevMonthLastDay = new Date(dailyPickerYear, dailyPickerMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(dailyPickerYear, dailyPickerMonth - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: isSameDay(d, new Date()),
        isSelected: isSameDay(d, selectedDate),
        dayNum: d.getDate(),
      });
    }

    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const curDate = new Date(dailyPickerYear, dailyPickerMonth, d);
      days.push({
        date: curDate,
        isCurrentMonth: true,
        isToday: isSameDay(curDate, new Date()),
        isSelected: isSameDay(curDate, selectedDate),
        dayNum: d,
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(dailyPickerYear, dailyPickerMonth + 1, d);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: isSameDay(nextDate, new Date()),
        isSelected: isSameDay(nextDate, selectedDate),
        dayNum: d,
      });
    }

    return days;
  }, [dailyPickerYear, dailyPickerMonth, selectedDate]);

  const handleDailyPrevMonth = () => {
    if (dailyPickerMonth === 0) {
      setDailyPickerMonth(11);
      setDailyPickerYear((y) => y - 1);
    } else {
      setDailyPickerMonth((m) => m - 1);
    }
  };

  const handleDailyNextMonth = () => {
    if (dailyPickerMonth === 11) {
      setDailyPickerMonth(0);
      setDailyPickerYear((y) => y + 1);
    } else {
      setDailyPickerMonth((m) => m + 1);
    }
  };

  // Close popover on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  // Filter only completed and paid orders
  const paidOrders = useMemo(
    () => orders.filter((o) => o.status === "sudah-dibayar" && o.paidAt),
    [orders],
  );

  // Selected parameters
  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth() + 1; // 1-indexed

  // Compute reports for the 3 tabs
  const dailyReport = useMemo(
    () => computeDailyReport(paidOrders, selectedDate),
    [paidOrders, selectedDate],
  );

  const monthlyReport = useMemo(
    () => computeMonthlyReport(paidOrders, currentYear, currentMonth),
    [paidOrders, currentYear, currentMonth],
  );

  const yearlyReport = useMemo(
    () => computeYearlyReport(paidOrders, currentYear),
    [paidOrders, currentYear],
  );

  // Period Navigation handlers
  const handlePrevPeriod = () => {
    const next = new Date(selectedDate);
    if (tab === "harian") {
      next.setDate(next.getDate() - 1);
    } else if (tab === "bulanan") {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setFullYear(next.getFullYear() - 1);
    }
    setSelectedDate(next);
  };

  const handleNextPeriod = () => {
    const next = new Date(selectedDate);
    if (tab === "harian") {
      next.setDate(next.getDate() + 1);
    } else if (tab === "bulanan") {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setFullYear(next.getFullYear() + 1);
    }
    setSelectedDate(next);
  };

  const handleResetToToday = () => {
    setSelectedDate(new Date());
  };

  // Seed sample data helper for demo
  const [isSeeding, setIsSeeding] = useState(false);
  const handleSeedDemoData = async () => {
    try {
      setIsSeeding(true);
      const sample = generateSampleHistoricalOrders();
      await db.orders.bulkAdd(sample);
      toast.success("Data simulasi laporan berhasil dimuat!", {
        description: `${sample.length} transaksi contoh ditambahkan untuk uji coba grafik & metrik.`,
      });
    } catch {
      toast.error("Gagal menambahkan data simulasi");
    } finally {
      setIsSeeding(false);
    }
  };

  // Chart data preparation
  const chartItems: BarChartItem[] = useMemo(() => {
    if (tab === "harian") {
      return dailyReport.hourlyBuckets.map((b) => ({
        label: b.hour,
        value: b.sales,
        formattedValue: formatIDR(b.sales),
        isPeak: b.isPeak,
        subtext: b.orders > 0 ? `${b.orders} transaksi` : undefined,
      }));
    }
    if (tab === "bulanan") {
      return monthlyReport.weeklyBuckets.map((w) => ({
        label: `Mg ${w.weekNumber}`,
        value: w.totalSales,
        formattedValue: formatIDR(w.totalSales),
        isPeak: w.isPeak,
        subtext: `${w.orders} transaksi`,
      }));
    }
    return yearlyReport.monthlyBuckets.map((m) => ({
      label: m.monthShort,
      value: m.totalSales,
      formattedValue: formatIDR(m.totalSales),
      isPeak: m.isPeak,
      subtext: `${m.orders} transaksi`,
    }));
  }, [tab, dailyReport, monthlyReport, yearlyReport]);

  const chartTitle = useMemo(() => {
    if (tab === "harian") return t.reportsPage.hourlyTitle;
    if (tab === "bulanan") return t.reportsPage.weeklyTitle;
    return t.reportsPage.yearlyBarTitle;
  }, [tab]);

  // Export handlers
  const handleExcel = () => {
    const dailyRows = dailyReport.timeWindows.map((tw) => ({
      Waktu: tw.window,
      "Item Terlaris": tw.topItem,
      Terjual: tw.soldQty,
      Omzet: tw.sales,
    }));

    const hourlyRows = dailyReport.hourlyBuckets.map((hb) => ({
      Jam: `${hb.hour}:00`,
      Transaksi: hb.orders,
      Omzet: hb.sales,
    }));

    const weeklyRows = monthlyReport.weeklyBuckets.map((wb) => ({
      Minggu: wb.weekLabel,
      Transaksi: wb.orders,
      "Rata-rata Harian": wb.dailyAverage,
      Total: wb.totalSales,
    }));

    const yearlyRows = yearlyReport.monthlyBuckets.map((mb) => ({
      Bulan: mb.monthName,
      Transaksi: mb.orders,
      "Rata-rata / Transaksi": mb.avgPerOrder,
      Total: mb.totalSales,
    }));

    const summaryRows = [
      { Kategori: "Harian", Metrik: "Tanggal", Nilai: dailyReport.formattedDate },
      { Kategori: "Harian", Metrik: "Total Penjualan", Nilai: dailyReport.totalSales },
      { Kategori: "Harian", Metrik: "Jumlah Transaksi", Nilai: dailyReport.orderCount },
      { Kategori: "Harian", Metrik: "Rasio Tunai vs QRIS", Nilai: `${dailyReport.cashPct}% / ${dailyReport.qrisPct}%` },
      { Kategori: "Bulanan", Metrik: "Bulan", Nilai: monthlyReport.monthLabel },
      { Kategori: "Bulanan", Metrik: "Total Penjualan", Nilai: monthlyReport.totalSales },
      { Kategori: "Bulanan", Metrik: "Hari Terbaik", Nilai: monthlyReport.bestDay },
      { Kategori: "Tahunan", Metrik: "Tahun", Nilai: yearlyReport.yearLabel },
      { Kategori: "Tahunan", Metrik: "Total Penjualan", Nilai: yearlyReport.totalSales },
      { Kategori: "Tahunan", Metrik: "Bulan Terbaik", Nilai: yearlyReport.bestMonth },
    ];

    void exportReportExcel(groupDaily(paidOrders), groupMonthly(paidOrders), {
      dailyRows,
      hourlyRows,
      weeklyRows,
      yearlyRows,
      summaryRows,
    });
    toast.success("Laporan berhasil diekspor ke Excel (.xlsx)");
  };

  const handlePdf = () => {
    if (tab === "harian") {
      printReport({
        title: `${t.reportsPage.printTitle} — Harian`,
        period: dailyReport.formattedDate,
        rows: dailyReport.timeWindows.map((tw) => ({
          label: `${tw.window} (${tw.topItem})`,
          orders: tw.soldQty,
          items: tw.soldQty,
          sales: formatIDR(tw.sales),
        })),
        totalSales: formatIDR(dailyReport.totalSales),
        totalOrders: dailyReport.orderCount,
      });
    } else if (tab === "bulanan") {
      printReport({
        title: `${t.reportsPage.printTitle} — Bulanan`,
        period: monthlyReport.monthLabel,
        rows: monthlyReport.weeklyBuckets.map((wb) => ({
          label: wb.weekLabel,
          orders: wb.orders,
          items: wb.orders,
          sales: formatIDR(wb.totalSales),
        })),
        totalSales: formatIDR(monthlyReport.totalSales),
        totalOrders: monthlyReport.orderCount,
      });
    } else {
      printReport({
        title: `${t.reportsPage.printTitle} — Tahunan`,
        period: yearlyReport.yearLabel,
        rows: yearlyReport.monthlyBuckets.map((mb) => ({
          label: mb.monthName,
          orders: mb.orders,
          items: mb.orders,
          sales: formatIDR(mb.totalSales),
        })),
        totalSales: formatIDR(yearlyReport.totalSales),
        totalOrders: yearlyReport.orderCount,
      });
    }
  };

  // Header display texts
  const currentTitle =
    tab === "harian"
      ? t.reportsPage.dailyTitle
      : tab === "bulanan"
      ? t.reportsPage.monthlyTitle
      : t.reportsPage.yearlyTitle;

  const currentSubtitle =
    tab === "harian"
      ? t.reportsPage.dailySubtitle
      : tab === "bulanan"
      ? t.reportsPage.monthlySubtitle
      : t.reportsPage.yearlySubtitle(currentYear);

  const currentPeriodLabel =
    tab === "harian"
      ? dailyReport.formattedDate
      : tab === "bulanan"
      ? monthlyReport.monthLabel
      : yearlyReport.yearLabel;

  return (
    <div className="flex min-h-screen flex-col bg-mineral">
      <Header title={t.reportsPage.title} />

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Control Bar: Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Segmented Tab Pill */}
          <div className="inline-flex rounded-xl border border-ink/10 bg-white/80 p-1 shadow-2xs backdrop-blur-xs">
            {(
              [
                { key: "harian", label: t.reportsPage.tabHarian },
                { key: "bulanan", label: t.reportsPage.tabBulanan },
                { key: "tahunan", label: t.reportsPage.tabTahunan },
              ] as const
            ).map(({ key, label }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setTab(key);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "pressable rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all",
                    active
                      ? "bg-counterlime text-ink shadow-xs"
                      : "text-ink/60 hover:text-ink hover:bg-black/5",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Right Actions: Excel, PDF, and Demo Data */}
          <div className="flex flex-wrap items-center gap-2">
            {paidOrders.length <= 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDemoData}
                disabled={isSeeding}
                className="border-counterlime/60 bg-counterlime/15 text-ink hover:bg-counterlime/30"
                title="Tambahkan data pesanan simulasi untuk menguji grafik dan laporan lengkap"
              >
                <Sparkles size={14} className="text-counterlime-dark" />
                {isSeeding ? "Memuat..." : "Muat Data Contoh"}
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleExcel}>
              <FileSpreadsheet size={15} aria-hidden="true" />
              {t.reportsPage.exportExcel}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePdf}>
              <Printer size={15} aria-hidden="true" />
              {t.reportsPage.exportPdf}
            </Button>
          </div>
        </div>

        {/* Report View Header: Title, Subtitle, & Period Navigation Chip */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {currentTitle}
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-medium text-ink/55">
              {currentSubtitle}
            </p>
          </div>

          {/* Period Selector Capsule with Prev/Next Controls */}
          <div className="flex items-center gap-1.5 rounded-full border border-ink/10 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevPeriod}
              aria-label="Periode sebelumnya"
              className="pressable flex h-8 w-8 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink"
              title="Periode sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Middle Capsule Trigger (opens modern custom datepicker, month picker, or year picker) */}
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => {
                  if (tab === "harian") {
                    setDailyPickerMonth(selectedDate.getMonth());
                    setDailyPickerYear(selectedDate.getFullYear());
                    setPickerOpen((prev) => !prev);
                  } else if (tab === "bulanan") {
                    setPickerYear(selectedDate.getFullYear());
                    setPickerOpen((prev) => !prev);
                  } else if (tab === "tahunan") {
                    setYearPageStart(Math.floor(selectedDate.getFullYear() / 12) * 12);
                    setPickerOpen((prev) => !prev);
                  }
                }}
                className={cn(
                  "pressable flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-3.5 py-1 text-xs sm:text-sm font-bold text-ink hover:bg-ink/5 cursor-pointer transition-colors",
                  pickerOpen && "bg-ink/10 text-ink",
                )}
                title={
                  tab === "harian"
                    ? "Pilih Tanggal Laporan (Date Picker)"
                    : tab === "bulanan"
                    ? "Pilih Bulan Laporan (Month Picker)"
                    : "Pilih Tahun Laporan (Year Picker)"
                }
              >
                <Calendar size={14} className="text-ink/60" />
                <span>{currentPeriodLabel}</span>
                <ChevronDown
                  size={13}
                  className={cn(
                    "text-ink/40 transition-transform duration-200",
                    pickerOpen && "rotate-180 text-ink/70",
                  )}
                />
              </button>

              {/* Modern Custom Date Picker Popover (Harian) */}
              {tab === "harian" && pickerOpen && (
                <div
                  role="dialog"
                  aria-label="Pilih Tanggal"
                  className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-76 sm:w-84 rounded-2xl border border-ink/12 bg-white p-3.5 sm:p-4 shadow-xl"
                >
                  {/* Calendar Header (Month & Year navigation) */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-ink/8">
                    <button
                      type="button"
                      onClick={handleDailyPrevMonth}
                      aria-label="Bulan sebelumnya"
                      className="pressable flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink"
                      title="Bulan sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="font-display font-bold text-sm text-ink">
                      {MONTH_NAMES[dailyPickerMonth].full} {dailyPickerYear}
                    </span>
                    <button
                      type="button"
                      onClick={handleDailyNextMonth}
                      aria-label="Bulan berikutnya"
                      className="pressable flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink"
                      title="Bulan berikutnya"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Day of Week Labels */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-ink/45 uppercase tracking-wider">
                    {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {dailyCalendarDays.map((d, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d.date);
                          setPickerOpen(false);
                        }}
                        className={cn(
                          "pressable h-8 w-8 sm:h-8.5 sm:w-8.5 mx-auto flex items-center justify-center rounded-xl text-xs font-semibold transition-all",
                          d.isSelected
                            ? "bg-counterlime text-ink font-bold shadow-xs border border-counterlime-dark/30"
                            : d.isToday
                            ? "bg-ink/5 text-ink font-bold border border-ink/20 hover:bg-ink/10"
                            : d.isCurrentMonth
                            ? "text-ink hover:bg-ink/5"
                            : "text-ink/30 hover:text-ink/60 hover:bg-ink/5",
                        )}
                        title={d.date.toLocaleDateString("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      >
                        {d.dayNum}
                      </button>
                    ))}
                  </div>

                  {/* Date Picker Footer */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-ink/8 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setSelectedDate(now);
                          setDailyPickerMonth(now.getMonth());
                          setDailyPickerYear(now.getFullYear());
                          setPickerOpen(false);
                        }}
                        className="font-medium text-counterlime-dark hover:underline"
                      >
                        Hari Ini
                      </button>
                      <span className="text-ink/20">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          const yesterday = new Date();
                          yesterday.setDate(yesterday.getDate() - 1);
                          setSelectedDate(yesterday);
                          setDailyPickerMonth(yesterday.getMonth());
                          setDailyPickerYear(yesterday.getFullYear());
                          setPickerOpen(false);
                        }}
                        className="font-medium text-ink/60 hover:text-ink hover:underline"
                      >
                        Kemarin
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(false)}
                      className="text-ink/50 hover:text-ink font-medium"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}

              {/* Native Month input helper */}
              {tab === "bulanan" && (
                <input
                  ref={monthInputRef}
                  type="month"
                  value={toMonthInputValue(selectedDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m] = e.target.value.split("-").map(Number);
                      const next = new Date(selectedDate);
                      next.setFullYear(y);
                      next.setMonth(m - 1);
                      setSelectedDate(next);
                      setPickerOpen(false);
                    }
                  }}
                  className="sr-only"
                  aria-label="Pilih bulan laporan"
                />
              )}

              {/* Interactive Month Picker Popover */}
              {tab === "bulanan" && pickerOpen && (
                <div
                  role="dialog"
                  aria-label="Pilih Bulan"
                  className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-72 sm:w-80 rounded-2xl border border-ink/12 bg-white p-3.5 sm:p-4 shadow-xl"
                >
                  {/* Month Picker Header (Year Navigation) */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-ink/8">
                    <button
                      type="button"
                      onClick={() => setPickerYear((y) => y - 1)}
                      aria-label="Tahun sebelumnya"
                      className="pressable flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink"
                      title="Tahun sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="font-display font-bold text-sm text-ink">
                      {pickerYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickerYear((y) => y + 1)}
                      aria-label="Tahun berikutnya"
                      className="pressable flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink"
                      title="Tahun berikutnya"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* 12 Months Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {MONTH_NAMES.map((m) => {
                      const isSelected =
                        selectedDate.getMonth() === m.index &&
                        selectedDate.getFullYear() === pickerYear;
                      const isCurrent =
                        new Date().getMonth() === m.index &&
                        new Date().getFullYear() === pickerYear;
                      return (
                        <button
                          key={m.index}
                          type="button"
                          onClick={() => {
                            const next = new Date(selectedDate);
                            next.setFullYear(pickerYear);
                            next.setMonth(m.index);
                            setSelectedDate(next);
                            setPickerOpen(false);
                          }}
                          className={cn(
                            "pressable py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center",
                            isSelected
                              ? "bg-counterlime text-ink font-bold shadow-xs border border-counterlime-dark/30"
                              : isCurrent
                              ? "bg-ink/5 text-ink border border-ink/15 hover:bg-ink/10"
                              : "text-ink/70 hover:text-ink hover:bg-ink/5",
                          )}
                        >
                          {m.full}
                        </button>
                      );
                    })}
                  </div>

                  {/* Month Picker Footer */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-ink/8 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setPickerYear(now.getFullYear());
                        setSelectedDate(now);
                        setPickerOpen(false);
                      }}
                      className="font-medium text-counterlime-dark hover:underline"
                    >
                      Bulan Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(false)}
                      className="text-ink/50 hover:text-ink font-medium"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive Year Picker Popover */}
              {tab === "tahunan" && pickerOpen && (
                <div
                  role="dialog"
                  aria-label="Pilih Tahun"
                  className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-72 sm:w-80 rounded-2xl border border-ink/12 bg-white p-3.5 sm:p-4 shadow-xl"
                >
                  {/* Year Picker Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-ink/8">
                    <button
                      type="button"
                      onClick={() => setYearPageStart((y) => y - 12)}
                      aria-label="12 tahun sebelumnya"
                      className="pressable flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink"
                      title="12 tahun sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="font-display font-bold text-sm text-ink">
                      {yearPageStart} – {yearPageStart + 11}
                    </span>
                    <button
                      type="button"
                      onClick={() => setYearPageStart((y) => y + 12)}
                      aria-label="12 tahun berikutnya"
                      className="pressable flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink"
                      title="12 tahun berikutnya"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* 12 Years Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((yr) => {
                      const isSelected = selectedDate.getFullYear() === yr;
                      const isCurrent = new Date().getFullYear() === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            const next = new Date(selectedDate);
                            next.setFullYear(yr);
                            setSelectedDate(next);
                            setPickerOpen(false);
                          }}
                          className={cn(
                            "pressable py-2.5 px-1 rounded-xl text-xs font-semibold transition-all text-center",
                            isSelected
                              ? "bg-counterlime text-ink font-bold shadow-xs border border-counterlime-dark/30"
                              : isCurrent
                              ? "bg-ink/5 text-ink border border-ink/15 hover:bg-ink/10"
                              : "text-ink/70 hover:text-ink hover:bg-ink/5",
                          )}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>

                  {/* Year Picker Footer */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-ink/8 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setSelectedDate(now);
                        setYearPageStart(Math.floor(now.getFullYear() / 12) * 12);
                        setPickerOpen(false);
                      }}
                      className="font-medium text-counterlime-dark hover:underline"
                    >
                      Tahun Ini ({new Date().getFullYear()})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(false)}
                      className="text-ink/50 hover:text-ink font-medium"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextPeriod}
              aria-label="Periode selanjutnya"
              className="pressable flex h-8 w-8 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink"
              title="Periode selanjutnya"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={handleResetToToday}
              className="pressable rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-semibold text-ink/70 hover:bg-ink/10 hover:text-ink ml-1"
              title="Kembali ke hari ini"
            >
              Sekarang
            </button>
          </div>
        </div>

        {/* 4 Metric KPI Cards Grid */}
        <section
          aria-label="Kartu indikator performa"
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {tab === "harian" && (
            <>
              {/* Card 1: Total Penjualan */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.netSales}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {formatIDR(dailyReport.totalSales)}
                </p>
                {dailyReport.salesDeltaPct !== null ? (
                  <p
                    className={cn(
                      "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                      dailyReport.salesDeltaPct >= 0
                        ? "text-emerald-700"
                        : "text-coral",
                    )}
                  >
                    {dailyReport.salesDeltaPct >= 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    <span>
                      {Math.abs(dailyReport.salesDeltaPct)}% dari kemarin
                    </span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-ink/40">Hari pertama dicatat</p>
                )}
              </article>

              {/* Card 2: Jumlah Transaksi */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.completedOrders}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {dailyReport.orderCount}
                </p>
                {dailyReport.orderCountDelta !== null ? (
                  <p
                    className={cn(
                      "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                      dailyReport.orderCountDelta >= 0
                        ? "text-emerald-700"
                        : "text-coral",
                    )}
                  >
                    {dailyReport.orderCountDelta >= 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    <span>
                      {Math.abs(dailyReport.orderCountDelta)} transaksi
                    </span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-ink/40">Total hari ini</p>
                )}
              </article>

              {/* Card 3: Rata-rata / Transaksi */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.avgTicket}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {formatIDR(dailyReport.avgOrderSales)}
                </p>
                {dailyReport.avgOrderDelta !== null ? (
                  <p
                    className={cn(
                      "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                      dailyReport.avgOrderDelta >= 0
                        ? "text-emerald-700"
                        : "text-coral",
                    )}
                  >
                    {dailyReport.avgOrderDelta >= 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    <span>{formatIDR(Math.abs(dailyReport.avgOrderDelta))}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-ink/40">Rata-rata tiket</p>
                )}
              </article>

              {/* Card 4: Tunai vs QRIS */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.cashVsQris}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {dailyReport.cashPct}% / {dailyReport.qrisPct}%
                </p>
                <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="bg-ink transition-all"
                    style={{ width: `${dailyReport.cashPct}%` }}
                    title={`Tunai: ${dailyReport.cashPct}%`}
                  />
                  <div
                    className="bg-counterlime transition-all"
                    style={{ width: `${dailyReport.qrisPct}%` }}
                    title={`QRIS/Non-tunai: ${dailyReport.qrisPct}%` }
                  />
                </div>
              </article>
            </>
          )}

          {tab === "bulanan" && (
            <>
              {/* Card 1: Total Penjualan */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.netSales}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {formatIDR(monthlyReport.totalSales)}
                </p>
                {monthlyReport.salesDeltaPct !== null ? (
                  <p
                    className={cn(
                      "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                      monthlyReport.salesDeltaPct >= 0
                        ? "text-emerald-700"
                        : "text-coral",
                    )}
                  >
                    {monthlyReport.salesDeltaPct >= 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    <span>
                      {Math.abs(monthlyReport.salesDeltaPct)}% dari bulan lalu
                    </span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-ink/40">Bulan berjalan</p>
                )}
              </article>

              {/* Card 2: Jumlah Transaksi */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.completedOrders}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {monthlyReport.orderCount.toLocaleString("id-ID")}
                </p>
                <p className="mt-1.5 text-xs text-ink/40">Total transaksi bulan ini</p>
              </article>

              {/* Card 3: Hari Terbaik */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.bestDay}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {monthlyReport.bestDay}
                </p>
                <p className="mt-1.5 text-xs text-ink/40">Penjualan tertinggi</p>
              </article>

              {/* Card 4: Tunai vs QRIS */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.cashVsQris}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {monthlyReport.cashPct}% / {monthlyReport.qrisPct}%
                </p>
                <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="bg-ink transition-all"
                    style={{ width: `${monthlyReport.cashPct}%` }}
                    title={`Tunai: ${monthlyReport.cashPct}%`}
                  />
                  <div
                    className="bg-counterlime transition-all"
                    style={{ width: `${monthlyReport.qrisPct}%` }}
                    title={`QRIS/Non-tunai: ${monthlyReport.qrisPct}%`}
                  />
                </div>
              </article>
            </>
          )}

          {tab === "tahunan" && (
            <>
              {/* Card 1: Total Penjualan */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.netSales}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {formatIDR(yearlyReport.totalSales)}
                </p>
                {yearlyReport.salesDeltaPct !== null ? (
                  <p
                    className={cn(
                      "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                      yearlyReport.salesDeltaPct >= 0
                        ? "text-emerald-700"
                        : "text-coral",
                    )}
                  >
                    {yearlyReport.salesDeltaPct >= 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    <span>
                      {Math.abs(yearlyReport.salesDeltaPct)}% dari {currentYear - 1}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-ink/40">Tahun {currentYear}</p>
                )}
              </article>

              {/* Card 2: Jumlah Transaksi */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.completedOrders}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {yearlyReport.orderCount.toLocaleString("id-ID")}
                </p>
                <p className="mt-1.5 text-xs text-ink/40">Total transaksi tahun ini</p>
              </article>

              {/* Card 3: Bulan Terbaik */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.bestMonth}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {yearlyReport.bestMonth}
                </p>
                <p className="mt-1.5 text-xs text-ink/40">Omzet bulanan tertinggi</p>
              </article>

              {/* Card 4: Tunai vs QRIS */}
              <article className="card-hover rounded-2xl border border-ink/8 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-ink/55">
                  {t.reportsPage.cashVsQris}
                </p>
                <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {yearlyReport.cashPct}% / {yearlyReport.qrisPct}%
                </p>
                <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="bg-ink transition-all"
                    style={{ width: `${yearlyReport.cashPct}%` }}
                    title={`Tunai: ${yearlyReport.cashPct}%`}
                  />
                  <div
                    className="bg-counterlime transition-all"
                    style={{ width: `${yearlyReport.qrisPct}%` }}
                    title={`QRIS/Non-tunai: ${yearlyReport.qrisPct}%`}
                  />
                </div>
              </article>
            </>
          )}
        </section>

        {/* Bar Chart Section */}
        <section aria-label="Visual grafik penjualan">
          <ReportBarChart
            title={chartTitle}
            items={chartItems}
            emptyLabel="Belum ada transaksi pada periode yang dipilih"
          />
        </section>

        {/* Breakdown Table Section */}
        <section
          aria-label="Tabel rincian penjualan"
          className="rounded-2xl border border-ink/8 bg-white shadow-2xs overflow-hidden"
        >
          {tab === "harian" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-ink/8 bg-mineral/30 text-ink/55">
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Waktu
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Item Terlaris
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Terjual
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Omzet
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/6">
                  {dailyReport.timeWindows.map((tw) => (
                    <tr
                      key={tw.window}
                      className="hover:bg-mineral/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {tw.window}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {tw.topItem}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink/70 tabular-nums">
                        {tw.soldQty > 0 ? tw.soldQty : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-display font-bold text-ink tabular-nums">
                        {formatIDR(tw.sales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "bulanan" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-ink/8 bg-mineral/30 text-ink/55">
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Minggu
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Transaksi
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Rata-rata Harian
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/6">
                  {monthlyReport.weeklyBuckets.map((w) => (
                    <tr
                      key={w.weekLabel}
                      className="hover:bg-mineral/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {w.weekLabel}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink/70 tabular-nums">
                        {w.orders}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink/70 tabular-nums">
                        {formatIDR(w.dailyAverage)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-display font-bold text-ink tabular-nums">
                        {formatIDR(w.totalSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "tahunan" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-ink/8 bg-mineral/30 text-ink/55">
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Bulan
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Transaksi
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Rata-rata / Transaksi
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right font-semibold"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/6">
                  {yearlyReport.monthlyBuckets.map((m) => (
                    <tr
                      key={m.monthName}
                      className="hover:bg-mineral/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {m.monthName}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink/70 tabular-nums">
                        {m.orders > 0 ? m.orders.toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink/70 tabular-nums">
                        {m.orders > 0 ? formatIDR(m.avgPerOrder) : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-display font-bold text-ink tabular-nums">
                        {formatIDR(m.totalSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

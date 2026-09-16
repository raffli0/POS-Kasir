import type { OrderRow } from "./db";

// ==================== TYPES ====================

export type DailyTimeWindow = {
  window: string; // e.g. "08:00–11:00"
  topItem: string; // e.g. "Es Teh Manis"
  soldQty: number; // e.g. 24
  sales: number; // e.g. 120000
};

export type HourlyBucket = {
  hour: string; // e.g. "08", "09", ...
  hourNumber: number;
  sales: number;
  orders: number;
  isPeak: boolean;
};

export type DailyReportData = {
  date: Date;
  dateString: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "11 Sep 2026"
  totalSales: number;
  salesDeltaPct: number | null; // e.g. +12%
  orderCount: number;
  orderCountDelta: number | null; // e.g. +4 transaksi
  avgOrderSales: number;
  avgOrderDelta: number | null; // e.g. -1200
  cashSales: number;
  qrisSales: number;
  cashPct: number; // e.g. 62
  qrisPct: number; // e.g. 38
  hourlyBuckets: HourlyBucket[];
  timeWindows: DailyTimeWindow[];
};

export type WeeklyBucket = {
  weekLabel: string; // e.g. "Minggu 1"
  weekNumber: number;
  orders: number;
  dailyAverage: number;
  totalSales: number;
  isPeak: boolean;
};

export type MonthlyReportData = {
  year: number;
  month: number; // 1-12
  monthLabel: string; // e.g. "September 2026"
  totalSales: number;
  salesDeltaPct: number | null; // e.g. +8%
  orderCount: number;
  bestDay: string; // e.g. "Sabtu"
  cashPct: number; // e.g. 55
  qrisPct: number; // e.g. 45
  weeklyBuckets: WeeklyBucket[];
};

export type MonthlyBucket = {
  monthName: string; // e.g. "Januari"
  monthShort: string; // e.g. "Jan"
  monthIndex: number; // 0-11
  orders: number;
  avgPerOrder: number;
  totalSales: number;
  isPeak: boolean;
};

export type YearlyReportData = {
  year: number;
  yearLabel: string; // e.g. "Tahun 2026"
  totalSales: number;
  salesDeltaPct: number | null; // e.g. +15%
  orderCount: number;
  bestMonth: string; // e.g. "Juli"
  cashPct: number; // e.g. 48
  qrisPct: number; // e.g. 52
  monthlyBuckets: MonthlyBucket[];
};

// ==================== HELPER FORMATTERS ====================

const DAYS_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTHS_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ags",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function formatDateIndo(d: Date): string {
  const day = d.getDate();
  const month = MONTHS_SHORT_ID[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatMonthIndo(year: number, month1Indexed: number): string {
  return `${MONTHS_ID[month1Indexed - 1]} ${year}`;
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ==================== DAILY REPORT COMPUTATION ====================

export function computeDailyReport(
  orders: OrderRow[],
  targetDate: Date,
): DailyReportData {
  const targetDateStr = toDateString(targetDate);

  // Previous date (yesterday)
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = toDateString(prevDate);

  const targetOrders = orders.filter((o) => {
    if (o.status !== "sudah-dibayar" || !o.paidAt) return false;
    return toDateString(new Date(o.paidAt)) === targetDateStr;
  });

  const prevOrders = orders.filter((o) => {
    if (o.status !== "sudah-dibayar" || !o.paidAt) return false;
    return toDateString(new Date(o.paidAt)) === prevDateStr;
  });

  // Today Totals
  const totalSales = targetOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const orderCount = targetOrders.length;
  const avgOrderSales = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

  // Yesterday Totals
  const prevSales = prevOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const prevCount = prevOrders.length;
  const prevAvg = prevCount > 0 ? Math.round(prevSales / prevCount) : 0;

  // Deltas
  const salesDeltaPct =
    prevSales > 0 ? Math.round(((totalSales - prevSales) / prevSales) * 100) : null;
  const orderCountDelta = prevCount > 0 ? orderCount - prevCount : null;
  const avgOrderDelta = prevAvg > 0 ? avgOrderSales - prevAvg : null;

  // Payment Breakdown
  let cashSales = 0;
  let qrisSales = 0;
  for (const o of targetOrders) {
    if (o.method === "tunai") {
      cashSales += o.total;
    } else {
      qrisSales += o.total;
    }
  }

  const combinedMethodSales = cashSales + qrisSales;
  const cashPct =
    combinedMethodSales > 0
      ? Math.round((cashSales / combinedMethodSales) * 100)
      : 50;
  const qrisPct = combinedMethodSales > 0 ? 100 - cashPct : 50;

  // Hourly Buckets: 08:00 to 19:00 (12 standard slots as shown in mockup)
  const hourlyMap = new Map<number, { sales: number; orders: number }>();
  for (let h = 8; h <= 19; h++) {
    hourlyMap.set(h, { sales: 0, orders: 0 });
  }

  for (const o of targetOrders) {
    if (!o.paidAt) continue;
    const hour = new Date(o.paidAt).getHours();
    const current = hourlyMap.get(hour) ?? { sales: 0, orders: 0 };
    current.sales += o.total;
    current.orders += 1;
    hourlyMap.set(hour, current);
  }

  let maxHourlySales = 0;
  hourlyMap.forEach((v) => {
    if (v.sales > maxHourlySales) maxHourlySales = v.sales;
  });

  const hourlyBuckets: HourlyBucket[] = Array.from(hourlyMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hourNumber, data]) => ({
      hour: String(hourNumber).padStart(2, "0"),
      hourNumber,
      sales: data.sales,
      orders: data.orders,
      isPeak: maxHourlySales > 0 && data.sales === maxHourlySales,
    }));

  // Time Windows:
  // 08:00–11:00, 11:00–14:00, 14:00–17:00, 17:00–20:00
  const windowsConfig = [
    { label: "08:00–11:00", startHour: 8, endHour: 11 },
    { label: "11:00–14:00", startHour: 11, endHour: 14 },
    { label: "14:00–17:00", startHour: 14, endHour: 17 },
    { label: "17:00–20:00", startHour: 17, endHour: 20 },
  ];

  const timeWindows: DailyTimeWindow[] = windowsConfig.map((w) => {
    const ordersInWindow = targetOrders.filter((o) => {
      if (!o.paidAt) return false;
      const h = new Date(o.paidAt).getHours();
      return h >= w.startHour && h < w.endHour;
    });

    const windowSales = ordersInWindow.reduce((sum, o) => sum + (o.total || 0), 0);

    // Aggregate items
    const itemQtyMap = new Map<string, number>();
    for (const o of ordersInWindow) {
      if (o.items && Array.isArray(o.items)) {
        for (const it of o.items) {
          const count = itemQtyMap.get(it.name) ?? 0;
          itemQtyMap.set(it.name, count + (it.qty || 1));
        }
      }
    }

    let topItem = "-";
    let topQty = 0;
    itemQtyMap.forEach((qty, name) => {
      if (qty > topQty) {
        topQty = qty;
        topItem = name;
      }
    });

    return {
      window: w.label,
      topItem: topItem,
      soldQty: topQty,
      sales: windowSales,
    };
  });

  return {
    date: targetDate,
    dateString: targetDateStr,
    formattedDate: formatDateIndo(targetDate),
    totalSales,
    salesDeltaPct,
    orderCount,
    orderCountDelta,
    avgOrderSales,
    avgOrderDelta,
    cashSales,
    qrisSales,
    cashPct,
    qrisPct,
    hourlyBuckets,
    timeWindows,
  };
}

// ==================== MONTHLY REPORT COMPUTATION ====================

export function computeMonthlyReport(
  orders: OrderRow[],
  year: number,
  month1Indexed: number,
): MonthlyReportData {
  // Target Month orders
  const targetOrders = orders.filter((o) => {
    if (o.status !== "sudah-dibayar" || !o.paidAt) return false;
    const d = new Date(o.paidAt);
    return d.getFullYear() === year && d.getMonth() + 1 === month1Indexed;
  });

  // Previous Month orders
  const prevMonth = month1Indexed === 1 ? 12 : month1Indexed - 1;
  const prevYear = month1Indexed === 1 ? year - 1 : year;
  const prevOrders = orders.filter((o) => {
    if (o.status !== "sudah-dibayar" || !o.paidAt) return false;
    const d = new Date(o.paidAt);
    return d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth;
  });

  const totalSales = targetOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const orderCount = targetOrders.length;

  const prevSales = prevOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const salesDeltaPct =
    prevSales > 0 ? Math.round(((totalSales - prevSales) / prevSales) * 100) : null;

  // Best day of week
  const daySalesMap = new Map<number, number>();
  for (let i = 0; i < 7; i++) daySalesMap.set(i, 0);

  for (const o of targetOrders) {
    if (!o.paidAt) continue;
    const day = new Date(o.paidAt).getDay(); // 0 = Minggu
    daySalesMap.set(day, (daySalesMap.get(day) ?? 0) + o.total);
  }

  let bestDayIndex = 6; // default Sabtu if empty
  let maxDaySales = -1;
  daySalesMap.forEach((sales, day) => {
    if (sales > maxDaySales) {
      maxDaySales = sales;
      bestDayIndex = day;
    }
  });
  const bestDay = DAYS_ID[bestDayIndex];

  // Cash vs QRIS
  let cashSales = 0;
  let qrisSales = 0;
  for (const o of targetOrders) {
    if (o.method === "tunai") cashSales += o.total;
    else qrisSales += o.total;
  }
  const comb = cashSales + qrisSales;
  const cashPct = comb > 0 ? Math.round((cashSales / comb) * 100) : 50;
  const qrisPct = comb > 0 ? 100 - cashPct : 50;

  // Weeks breakdown:
  // Days in month
  const daysInMonth = new Date(year, month1Indexed, 0).getDate();
  const weekRanges = [
    { label: "Minggu 1", start: 1, end: 7 },
    { label: "Minggu 2", start: 8, end: 14 },
    { label: "Minggu 3", start: 15, end: 21 },
    { label: "Minggu 4", start: 22, end: Math.min(28, daysInMonth) },
  ];
  if (daysInMonth > 28) {
    weekRanges.push({
      label: "Minggu 5",
      start: 29,
      end: daysInMonth,
    });
  }

  let maxWeekSales = 0;
  const rawWeekly = weekRanges.map((w, index) => {
    const ordersInWeek = targetOrders.filter((o) => {
      if (!o.paidAt) return false;
      const dateNum = new Date(o.paidAt).getDate();
      return dateNum >= w.start && dateNum <= w.end;
    });

    const wSales = ordersInWeek.reduce((sum, o) => sum + (o.total || 0), 0);
    const dayCount = w.end - w.start + 1;
    const dailyAvg = dayCount > 0 ? Math.round(wSales / dayCount) : 0;

    if (wSales > maxWeekSales) maxWeekSales = wSales;

    return {
      weekLabel: w.label,
      weekNumber: index + 1,
      orders: ordersInWeek.length,
      dailyAverage: dailyAvg,
      totalSales: wSales,
    };
  });

  const weeklyBuckets: WeeklyBucket[] = rawWeekly.map((w) => ({
    ...w,
    isPeak: maxWeekSales > 0 && w.totalSales === maxWeekSales,
  }));

  return {
    year,
    month: month1Indexed,
    monthLabel: formatMonthIndo(year, month1Indexed),
    totalSales,
    salesDeltaPct,
    orderCount,
    bestDay,
    cashPct,
    qrisPct,
    weeklyBuckets,
  };
}

// ==================== YEARLY REPORT COMPUTATION ====================

export function computeYearlyReport(
  orders: OrderRow[],
  year: number,
): YearlyReportData {
  const targetOrders = orders.filter((o) => {
    if (o.status !== "sudah-dibayar" || !o.paidAt) return false;
    return new Date(o.paidAt).getFullYear() === year;
  });

  const prevOrders = orders.filter((o) => {
    if (o.status !== "sudah-dibayar" || !o.paidAt) return false;
    return new Date(o.paidAt).getFullYear() === year - 1;
  });

  const totalSales = targetOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const orderCount = targetOrders.length;

  const prevSales = prevOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const salesDeltaPct =
    prevSales > 0 ? Math.round(((totalSales - prevSales) / prevSales) * 100) : null;

  // Monthly buckets: 12 months
  const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
    monthIndex: i,
    monthName: MONTHS_ID[i],
    monthShort: MONTHS_SHORT_ID[i],
    sales: 0,
    orders: 0,
  }));

  for (const o of targetOrders) {
    if (!o.paidAt) continue;
    const m = new Date(o.paidAt).getMonth();
    monthlyStats[m].sales += o.total;
    monthlyStats[m].orders += 1;
  }

  let maxMonthSales = 0;
  let bestMonthIndex = 6; // default Juli as in mockup
  monthlyStats.forEach((m) => {
    if (m.sales > maxMonthSales) {
      maxMonthSales = m.sales;
      bestMonthIndex = m.monthIndex;
    }
  });
  const bestMonth = MONTHS_ID[bestMonthIndex];

  // Cash vs QRIS
  let cashSales = 0;
  let qrisSales = 0;
  for (const o of targetOrders) {
    if (o.method === "tunai") cashSales += o.total;
    else qrisSales += o.total;
  }
  const comb = cashSales + qrisSales;
  const cashPct = comb > 0 ? Math.round((cashSales / comb) * 100) : 50;
  const qrisPct = comb > 0 ? 100 - cashPct : 50;

  const monthlyBuckets: MonthlyBucket[] = monthlyStats.map((m) => ({
    monthName: m.monthName,
    monthShort: m.monthShort,
    monthIndex: m.monthIndex,
    orders: m.orders,
    avgPerOrder: m.orders > 0 ? Math.round(m.sales / m.orders) : 0,
    totalSales: m.sales,
    isPeak: maxMonthSales > 0 && m.sales === maxMonthSales,
  }));

  return {
    year,
    yearLabel: `Tahun ${year}`,
    totalSales,
    salesDeltaPct,
    orderCount,
    bestMonth,
    cashPct,
    qrisPct,
    monthlyBuckets,
  };
}

// ==================== SIMULATION DEMO SEED GENERATOR ====================

/**
 * Generates realistic historical order data matching the numbers and patterns
 * in the screenshots for demo/preview purposes if the store database is fresh.
 */
export function generateSampleHistoricalOrders(): OrderRow[] {
  const sampleOrders: OrderRow[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  const menuItems = [
    { name: "Es Teh Manis", price: 5000 },
    { name: "Nasi Goreng Kampung", price: 18000 },
    { name: "Ayam Geprek", price: 20000 },
    { name: "Mie Ayam Bakso", price: 16000 },
    { name: "Kopi Susu Gula Aren", price: 15000 },
    { name: "Tahu Tempe Goreng", price: 10000 },
    { name: "Pisang Goreng Keju", price: 14000 },
  ];

  let orderNo = 5000;

  const addOrder = (
    d: Date,
    hour: number,
    itemIndex: number,
    qty: number,
    method: "tunai" | "qris",
  ) => {
    const item = menuItems[itemIndex % menuItems.length];
    const total = item.price * qty;
    const orderDate = new Date(d);
    orderDate.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);

    sampleOrders.push({
      no: orderNo++,
      status: "sudah-dibayar",
      total,
      subtotal: total,
      itemCount: qty,
      method,
      items: [
        {
          itemId: `item-${itemIndex}`,
          name: item.name,
          qty,
          price: item.price,
        },
      ],
      paidAt: orderDate.getTime(),
      createdAt: orderDate.getTime() - 600_000,
    });
  };

  // 1. Generate for Today & Yesterday (Hourly curve: peak at 13:00)
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);

    const hourlyCounts: Record<number, number> = {
      8: 3,
      9: 4,
      10: 5,
      11: 8,
      12: 12,
      13: 16, // peak
      14: 13,
      15: 9,
      16: 7,
      17: 10,
      18: 14,
      19: 8,
    };

    Object.entries(hourlyCounts).forEach(([hStr, count]) => {
      const h = parseInt(hStr, 10);
      for (let i = 0; i < count; i++) {
        const itemIdx = h < 11 ? 0 : h < 14 ? 1 : h < 17 ? 2 : 3;
        const qty = (i % 3) + 1;
        const method = Math.random() > 0.4 ? "tunai" : "qris";
        addOrder(day, h, itemIdx, qty, method);
      }
    });
  }

  // 2. Generate for each month of the current year (peak month July / index 6)
  for (let m = 0; m <= now.getMonth(); m++) {
    const multiplier = m === 6 ? 1.5 : 1 + m * 0.05;
    const ordersPerMonth = Math.floor(35 * multiplier);

    for (let i = 0; i < ordersPerMonth; i++) {
      const d = new Date(currentYear, m, (i % 27) + 1);
      const h = 10 + (i % 9);
      const itemIdx = i % menuItems.length;
      const qty = (i % 4) + 1;
      const method = i % 2 === 0 ? "tunai" : "qris";
      addOrder(d, h, itemIdx, qty, method);
    }
  }

  return sampleOrders;
}

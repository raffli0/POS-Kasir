import * as XLSX from "xlsx";
import { db, type OrderRow } from "./db";
import { MENU_SEED, type MenuItem } from "../data/menu";

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number | undefined): string {
  const s = String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(headers: string[], rows: Array<Array<string | number | undefined>>): string {
  return [headers.map(csvEscape).join(";"), ...rows.map((r) => r.map(csvEscape).join(";"))].join(
    "\r\n",
  );
}

export async function exportBackupJson(): Promise<void> {
  const [products, orders, shifts] = await Promise.all([
    db.products.toArray(),
    db.orders.toArray(),
    db.shifts.toArray(),
  ]);

  const payload = {
    app: "KASA Sistem Kasir",
    version: 4,
    exportedAt: new Date().toISOString(),
    products,
    orders,
    shifts,
  };

  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `kasa-cadangan-lengkap-${dateStamp()}.json`,
  );
}

export async function exportProductsCsv(products: MenuItem[]): Promise<void> {
  const csv = toCsv(
    ["id", "nama", "deskripsi", "harga", "kategori", "jenis", "menit"],
    products.map((p) => [
      p.id,
      p.name,
      p.description,
      p.price,
      p.category,
      p.kind,
      p.prepMinutes,
    ]),
  );
  download(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    `kasa-produk-${dateStamp()}.csv`,
  );
}

export type DailyRow = { key: string; date: string; orders: number; items: number; sales: number };
export type MonthlyRow = { key: string; month: string; orders: number; items: number; sales: number };

export type ComprehensiveReportExport = {
  dailyRows?: Array<{ Waktu: string; "Item Terlaris": string; Terjual: number; Omzet: number }>;
  hourlyRows?: Array<{ Jam: string; Transaksi: number; Omzet: number }>;
  weeklyRows?: Array<{ Minggu: string; Transaksi: number; "Rata-rata Harian": number; Total: number }>;
  yearlyRows?: Array<{ Bulan: string; Transaksi: number; "Rata-rata / Transaksi": number; Total: number }>;
  summaryRows?: Array<{ Kategori: string; Metrik: string; Nilai: string | number }>;
};

export async function exportReportExcel(
  daily: DailyRow[],
  monthly: MonthlyRow[],
  comprehensive?: ComprehensiveReportExport,
): Promise<void> {
  const wb = XLSX.utils.book_new();

  if (comprehensive?.summaryRows && comprehensive.summaryRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(comprehensive.summaryRows),
      "Ringkasan",
    );
  }

  if (comprehensive?.dailyRows && comprehensive.dailyRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(comprehensive.dailyRows),
      "Harian - Rincian Waktu",
    );
  }

  if (comprehensive?.hourlyRows && comprehensive.hourlyRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(comprehensive.hourlyRows),
      "Harian - Per Jam",
    );
  }

  if (comprehensive?.weeklyRows && comprehensive.weeklyRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(comprehensive.weeklyRows),
      "Bulanan - Mingguan",
    );
  }

  if (comprehensive?.yearlyRows && comprehensive.yearlyRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(comprehensive.yearlyRows),
      "Tahunan - Bulanan",
    );
  }

  // Fallback / historical sheets
  if (!comprehensive?.dailyRows && daily.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(daily.map(({ key: _k, ...rest }) => rest)),
      "Harian",
    );
  }
  if (!comprehensive?.weeklyRows && monthly.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(monthly.map(({ key: _k, ...rest }) => rest)),
      "Bulanan",
    );
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `kasa-laporan-lengkap-${dateStamp()}.xlsx`,
  );
}

export type ImportResult = {
  products: number;
  orders: number;
};

export async function importBackupFile(file: File): Promise<ImportResult> {
  const isJson = file.name.endsWith(".json");
  const isCsv = file.name.endsWith(".csv");

  if (!isJson && !isCsv) {
    throw new Error("Format berkas tidak didukung. Harap unggah file .json atau .csv.");
  }

  const text = await file.text();

  if (isJson) {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gagal membaca file JSON. Berkas mungkin rusak atau tidak valid.");
    }

    let productsToInsert: MenuItem[] = [];
    let ordersToInsert: OrderRow[] = [];

    // Case 1: Full KASA backup object
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.products)) {
        productsToInsert = parsed.products;
      }
      if (Array.isArray(parsed.orders)) {
        ordersToInsert = parsed.orders;
      }
    }
    // Case 2: Array of products directly
    else if (Array.isArray(parsed)) {
      productsToInsert = parsed;
    }

    const validProducts = productsToInsert.filter(
      (p) => p && typeof p.id === "string" && typeof p.name === "string" && typeof p.price === "number",
    );

    const validOrders = ordersToInsert.filter(
      (o) => o && typeof o.no === "number" && typeof o.total === "number",
    );

    if (validProducts.length === 0 && validOrders.length === 0) {
      throw new Error("Tidak ada data produk atau pesanan yang valid dalam berkas ini.");
    }

    if (validProducts.length > 0) {
      await db.products.bulkPut(validProducts);
    }
    if (validOrders.length > 0) {
      await db.orders.bulkPut(validOrders);
    }

    return {
      products: validProducts.length,
      orders: validOrders.length,
    };
  }

  // Handle CSV Products Import
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error("File CSV kosong atau tidak memiliki baris data produk.");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.slice(1).map((line) => line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim()));

  const importedProducts: MenuItem[] = rows
    .filter((r) => r.length >= 3 && r[1])
    .map((r, index) => {
      const id = r[0] || `item-csv-${Date.now()}-${index}`;
      const hasBarcodeCol = r.length >= 8;
      const name = (hasBarcodeCol ? r[2] : r[1]) || "Produk Impor";
      const description = (hasBarcodeCol ? r[3] : r[2]) || "Deskripsi produk";
      const price = Number.parseInt(((hasBarcodeCol ? r[4] : r[3]) || "0").replace(/\D/g, ""), 10) || 10000;
      const category = ((hasBarcodeCol ? r[5] : r[4]) as any) || "Makanan";
      const kind = ((hasBarcodeCol ? r[6] : r[5]) as any) || "Makanan";
      const prepMinutes = Number.parseInt((hasBarcodeCol ? r[7] : r[6]) || "5", 10) || 5;

      return {
        id,
        name,
        description,
        price,
        category,
        kind,
        prepMinutes,
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=70",
      };
    });

  if (importedProducts.length === 0) {
    throw new Error("Tidak ada baris data produk yang valid dalam file CSV.");
  }

  await db.products.bulkPut(importedProducts);
  return {
    products: importedProducts.length,
    orders: 0,
  };
}

export async function resetToDemoSeed(): Promise<{ products: number }> {
  await db.products.clear();
  await db.products.bulkPut(MENU_SEED);
  return {
    products: MENU_SEED.length,
  };
}

export function groupDaily(orders: OrderRow[]): DailyRow[] {
  const map = new Map<string, DailyRow>();
  for (const o of orders) {
    if (o.status !== "sudah-dibayar" || !o.paidAt) continue;
    const date = new Date(o.paidAt).toISOString().slice(0, 10);
    const row = map.get(date) ?? { key: date, date, orders: 0, items: 0, sales: 0 };
    row.orders += 1;
    row.items += o.itemCount;
    row.sales += o.total;
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function groupMonthly(orders: OrderRow[]): MonthlyRow[] {
  const map = new Map<string, MonthlyRow>();
  for (const o of orders) {
    if (o.status !== "sudah-dibayar" || !o.paidAt) continue;
    const month = new Date(o.paidAt).toISOString().slice(0, 7);
    const row = map.get(month) ?? { key: month, month, orders: 0, items: 0, sales: 0 };
    row.orders += 1;
    row.items += o.itemCount;
    row.sales += o.total;
    map.set(month, row);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

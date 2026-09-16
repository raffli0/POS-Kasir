import Dexie, { type EntityTable } from "dexie";
import { MENU_SEED, type MenuItem } from "../data/menu";

export type PayMethod = "kartu-qr" | "tunai" | "qris";
export type OrderStatus = "disimpan" | "sudah-dibayar";


export type OrderItemLine = {
  itemId: string;
  name: string;
  qty: number;
  price: number;
  note?: string;
};

export type OrderRow = {
  no: number;
  status: OrderStatus;
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  serviceCharge?: number;
  itemCount: number;
  items?: OrderItemLine[];
  method?: PayMethod;
  customerName?: string;
  cashierId?: string;
  cashierName?: string;
  paidAt?: number;
  createdAt: number;
};

export type CashMovementType = "CASH_IN" | "CASH_OUT";
export type CashMovementCategory =
  | "modal_awal"
  | "operasional"
  | "bahan_baku"
  | "setoran"
  | "tips"
  | "lainnya";

export type CashMovementRow = {
  id: string;
  shiftId?: string;
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  description: string;
  cashierName: string;
  createdAt: number;
};

export type ShiftRecord = {
  id: string;
  openedAt: number;
  closedAt?: number;
  cashierName: string;
  startingCash: number;
  actualCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  cashSalesTotal?: number;
  cashInTotal?: number;
  cashOutTotal?: number;
  denominations?: Record<string, number>;
  status: "OPEN" | "CLOSED";
  notes?: string;
};

export interface CategoryRow {
  id: string;
  name: string;
  kind: "Makanan" | "Minuman" | "Camilan";
  color?: string;
  sortOrder: number;
  isDefault?: boolean;
  createdAt: number;
}

export const DEFAULT_CATEGORIES: CategoryRow[] = [
  { id: "cat-favorit", name: "Favorit", kind: "Makanan", color: "counterlime", sortOrder: 1, isDefault: true, createdAt: 1700000000000 },
  { id: "cat-sarapan", name: "Sarapan", kind: "Makanan", color: "amber", sortOrder: 2, isDefault: true, createdAt: 1700000001000 },
  { id: "cat-makanan", name: "Makanan", kind: "Makanan", color: "rose", sortOrder: 3, isDefault: true, createdAt: 1700000002000 },
  { id: "cat-minuman", name: "Minuman", kind: "Minuman", color: "blue", sortOrder: 4, isDefault: true, createdAt: 1700000003000 },
  { id: "cat-camilan", name: "Camilan", kind: "Camilan", color: "emerald", sortOrder: 5, isDefault: true, createdAt: 1700000004000 },
];

export const db = new Dexie("kasa-kasir") as Dexie & {
  products: EntityTable<MenuItem, "id">;
  orders: EntityTable<OrderRow, "no">;
  shifts: EntityTable<ShiftRecord, "id">;
  cash_movements: EntityTable<CashMovementRow, "id">;
  categories: EntityTable<CategoryRow, "id">;
};

db.version(1).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
});

db.version(2).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
});

db.version(3).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
  shifts: "id, openedAt, status",
});

db.version(4).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
  shifts: "id, openedAt, status",
  cash_movements: "id, shiftId, type, category, createdAt",
});

db.version(5).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
  shifts: "id, openedAt, status",
  cash_movements: "id, shiftId, type, category, createdAt",
  categories: "id, name, kind, sortOrder, createdAt",
});

db.version(6).upgrade(async (tx) => {
  await tx.table("orders").toCollection().modify((o: Record<string, unknown>) => {
    delete o.orderType;
    delete o.tableNumber;
    delete o.tableName;
    delete o.guests;
  });
});

// Clean initial orders & movements for real operational usage
const SEED_ORDERS: OrderRow[] = [];

export const cashMovementsTable = db.table<CashMovementRow, string>("cash_movements");
export const categoriesTable = db.table<CategoryRow, string>("categories");

const SEED_MOVEMENTS: CashMovementRow[] = [];

db.on("populate", (tx) => {
  void tx.table("products").bulkPut(MENU_SEED);
  if (SEED_ORDERS.length > 0) void tx.table("orders").bulkAdd(SEED_ORDERS);
  if (SEED_MOVEMENTS.length > 0) void tx.table("cash_movements").bulkPut(SEED_MOVEMENTS);
  void tx.table("categories").bulkPut(DEFAULT_CATEGORIES);
});

export async function ensureSeeded(): Promise<void> {
  await db.open();
  // Sanitize any legacy statuses ('memasak' / 'siap' -> 'disimpan')
  await db.orders.toCollection().modify((o: Record<string, unknown>) => {
    if (o.status === "memasak" || o.status === "siap") {
      o.status = "disimpan";
    }
  });
  const productCount = await db.products.count();
  const orderCount = await db.orders.count();
  const movementCount = await cashMovementsTable.count();
  const categoryCount = await categoriesTable.count();
  if (productCount === 0) await db.products.bulkPut(MENU_SEED);
  if (orderCount === 0 && SEED_ORDERS.length > 0) await db.orders.bulkAdd(SEED_ORDERS);
  if (movementCount === 0 && SEED_MOVEMENTS.length > 0) await cashMovementsTable.bulkPut(SEED_MOVEMENTS);
  if (categoryCount === 0) await categoriesTable.bulkPut(DEFAULT_CATEGORIES);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MENU_SEED, type MenuItem } from "../data/menu";
import { resetToDemoSeed } from "../lib/exporters";
import { broadcastSync, subscribeSync } from "../lib/syncBus";
import { useAuth } from "./AuthContext";
import {
  db,
  ensureSeeded,
  DEFAULT_CATEGORIES,
  type OrderItemLine,
  type OrderRow,
  type OrderStatus,
  type PayMethod,
  type ShiftRecord,
  type CashMovementRow,
  type CashMovementType,
  type CashMovementCategory,
  type CategoryRow,
} from "../lib/db";
import {
  deleteProduct as repoDeleteProduct,
  loadActiveShift,
  loadOrders,
  loadProducts,
  loadCashMovements,
  loadCategories,
  saveCashMovement as repoSaveCashMovement,
  deleteCashMovement as repoDeleteCashMovement,
  saveCategory as repoSaveCategory,
  updateCategory as repoUpdateCategory,
  deleteCategory as repoDeleteCategory,
  saveOrder,
  saveProduct as repoSaveProduct,
  saveShift as repoSaveShift,
  updateOrderStatus as repoUpdateOrderStatus,
} from "../lib/repo";

export type {
  PayMethod,
  OrderStatus,
  ShiftRecord,
  OrderRow,
  CashMovementRow,
  CashMovementType,
  CashMovementCategory,
  CategoryRow,
};
export type CartLine = { itemId: string; qty: number; note?: string };

export type OrderTotals = {
  rawSubtotal: number;
  discountAmount: number;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  count: number;
};

type PayResult = {
  orderNo: number;
  total: number;
  change: number | null;
  order: OrderRow;
};

type PosContextValue = {
  ready: boolean;
  products: MenuItem[];
  categories: CategoryRow[];
  orderNo: number;
  lines: CartLine[];
  totals: OrderTotals;
  orders: OrderRow[];
  lastReceipt: OrderRow | null;
  setLastReceipt: (order: OrderRow | null) => void;
  cashMovements: CashMovementRow[];
  discountType: "percent" | "fixed";
  discountValue: number;
  taxRate: number;
  serviceChargeRate: number;
  taxEnabled: boolean;
  serviceChargeEnabled: boolean;
  activeShift: ShiftRecord | null;
  setDiscount: (type: "percent" | "fixed", value: number) => void;
  setTaxConfig: (enabled: boolean, rate: number) => void;
  setServiceChargeConfig: (enabled: boolean, rate: number) => void;
  addItem: (itemId: string) => void;
  setItemNote: (itemId: string, note: string) => void;
  increaseLine: (itemId: string) => void;
  decreaseLine: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearOrder: () => void;
  saveDraft: () => number;
  payOrder: (method: PayMethod, cashReceived?: number) => PayResult;
  addCashMovement: (input: {
    type: CashMovementType;
    category: CashMovementCategory;
    amount: number;
    description: string;
    cashierName?: string;
  }) => Promise<CashMovementRow>;
  deleteCashMovement: (id: string) => Promise<void>;
  reloadCashMovements: () => Promise<void>;
  reloadProducts: () => Promise<void>;
  reloadOrders: () => Promise<void>;
  reloadCategories: () => Promise<void>;
  addProduct: (item: MenuItem) => Promise<void>;
  updateProduct: (item: MenuItem) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCategory: (category: Partial<CategoryRow>) => Promise<CategoryRow>;
  updateCategory: (id: string, updates: Partial<CategoryRow>, oldName?: string) => Promise<void>;
  deleteCategory: (id: string, categoryName: string, reassignToCategoryName?: string) => Promise<void>;
  updateOrderStatus: (no: number, status: OrderStatus) => Promise<void>;
  openShift: (cashierName: string, startingCash: number) => Promise<void>;
  closeShift: (
    actualCash: number,
    notes?: string,
    denominations?: Record<string, number>,
  ) => Promise<ShiftRecord>;
  resetSeed: () => Promise<void>;
};

const PosContext = createContext<PosContextValue | null>(null);

function computeTotals(
  lines: CartLine[],
  products: MenuItem[],
  discountType: "percent" | "fixed",
  discountValue: number,
  taxEnabled: boolean,
  taxRate: number,
  serviceChargeEnabled: boolean,
  serviceChargeRate: number,
): OrderTotals {
  let rawSubtotal = 0;
  let count = 0;
  for (const line of lines) {
    const item = products.find((p) => p.id === line.itemId);
    if (!item) continue;
    rawSubtotal += item.price * line.qty;
    count += line.qty;
  }

  let discountAmount = 0;
  if (discountValue > 0) {
    if (discountType === "percent") {
      discountAmount = Math.round(rawSubtotal * (Math.min(100, discountValue) / 100));
    } else {
      discountAmount = Math.min(rawSubtotal, discountValue);
    }
  }

  const subtotal = Math.max(0, rawSubtotal - discountAmount);
  const serviceCharge = serviceChargeEnabled
    ? Math.round(subtotal * (serviceChargeRate / 100))
    : 0;
  const taxableBase = subtotal + serviceCharge;
  const tax = taxEnabled ? Math.round(taxableBase * (taxRate / 100)) : 0;
  const total = subtotal + serviceCharge + tax;

  return { rawSubtotal, discountAmount, subtotal, tax, serviceCharge, total, count };
}

function isToday(ts?: number): boolean {
  if (!ts) return false;
  return new Date(ts).toDateString() === new Date().toDateString();
}

export function PosProvider({ children }: { children: ReactNode }) {
  const { currentStaff } = useAuth();
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<MenuItem[]>(MENU_SEED);
  const [categories, setCategories] = useState<CategoryRow[]>(DEFAULT_CATEGORIES);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);

  const [orderNo, setOrderNo] = useState(1049);
  const [lastReceipt, setLastReceipt] = useState<OrderRow | null>(null);

  // Cart lines (starts empty for fresh cashier sessions)
  const [tableDrafts, setTableDrafts] = useState<Record<string, CartLine[]>>({
    default: [],
  });

  // Discounts & Tax Configs
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("kasa_tax_enabled");
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  });
  const [taxRate, setTaxRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("kasa_tax_rate");
      return saved ? Number.parseInt(saved, 10) : 11;
    } catch {
      return 11;
    }
  });
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kasa_service_charge_enabled") === "1";
    } catch {
      return false;
    }
  });
  const [serviceChargeRate, setServiceChargeRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("kasa_service_charge_rate");
      return saved ? Number.parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });

  const [cashMovements, setCashMovements] = useState<CashMovementRow[]>([]);

  const activeCartKey = "default";
  const lines = tableDrafts[activeCartKey] || [];

  const setLinesForActiveCart = useCallback(
    (updater: (prev: CartLine[]) => CartLine[]) => {
      setTableDrafts((prev) => {
        const current = prev[activeCartKey] || [];
        return {
          ...prev,
          [activeCartKey]: updater(current),
        };
      });
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await ensureSeeded();
        let [loadedProducts, loadedOrders, shift, loadedMovements, loadedCats] = await Promise.all([
          loadProducts(),
          loadOrders(),
          loadActiveShift(),
          loadCashMovements(),
          loadCategories(),
        ]);
        if (loadedProducts.length === 0) {
          await db.products.bulkPut(MENU_SEED);
          loadedProducts = await loadProducts();
        }
        if (!alive) return;
        setProducts(loadedProducts);
        setCategories(loadedCats);
        setOrders(loadedOrders);
        setCashMovements(loadedMovements);
        setActiveShift(shift || null);
        const last = loadedOrders[0]?.no ?? 1048;
        setOrderNo(last + 1);
      } finally {
        if (alive) setReady(true);
      }
    })();

    const unsubscribe = subscribeSync(async (msg) => {
      if (!alive) return;
      if (msg.type === "ORDER_CREATED" || msg.type === "ORDER_STATUS_CHANGED") {
        const loadedOrders = await loadOrders();
        if (alive) {
          setOrders(loadedOrders);
          const maxNo = loadedOrders.reduce((max, o) => Math.max(max, o.no), 1048);
          setOrderNo((prev) => Math.max(prev, maxNo + 1));
        }
      } else if (msg.type === "PRODUCTS_UPDATED") {
        const loadedProducts = await loadProducts();
        if (alive) setProducts(loadedProducts);
      } else if (msg.type === "CATEGORY_CREATED" || msg.type === "CATEGORY_UPDATED" || msg.type === "CATEGORY_DELETED") {
        const [loadedCats, loadedProducts] = await Promise.all([loadCategories(), loadProducts()]);
        if (alive) {
          setCategories(loadedCats);
          setProducts(loadedProducts);
        }
      } else if (msg.type === "SHIFT_CHANGED") {
        const shift = await loadActiveShift();
        if (alive) setActiveShift(shift || null);
      } else if (msg.type === "CASH_MOVEMENT_CREATED" || msg.type === "CASH_MOVEMENT_DELETED") {
        const loadedMovements = await loadCashMovements();
        if (alive) setCashMovements(loadedMovements);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const totals = useMemo(
    () =>
      computeTotals(
        lines,
        products,
        discountType,
        discountValue,
        taxEnabled,
        taxRate,
        serviceChargeEnabled,
        serviceChargeRate,
      ),
    [
      lines,
      products,
      discountType,
      discountValue,
      taxEnabled,
      taxRate,
      serviceChargeEnabled,
      serviceChargeRate,
    ],
  );

  const addItem = useCallback(
    (itemId: string) => {
      setLinesForActiveCart((prev) => {
        const idx = prev.findIndex((l) => l.itemId === itemId);
        if (idx >= 0) {
          return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
        }
        return [...prev, { itemId, qty: 1 }];
      });
    },
    [setLinesForActiveCart],
  );

  const setItemNote = useCallback(
    (itemId: string, note: string) => {
      setLinesForActiveCart((prev) =>
        prev.map((l) => (l.itemId === itemId ? { ...l, note } : l)),
      );
    },
    [setLinesForActiveCart],
  );

  const increaseLine = useCallback(
    (itemId: string) => {
      setLinesForActiveCart((prev) =>
        prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l)),
      );
    },
    [setLinesForActiveCart],
  );

  const decreaseLine = useCallback(
    (itemId: string) => {
      setLinesForActiveCart((prev) =>
        prev
          .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0),
      );
    },
    [setLinesForActiveCart],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setLinesForActiveCart((prev) => prev.filter((l) => l.itemId !== itemId));
    },
    [setLinesForActiveCart],
  );

  const clearOrder = useCallback(() => {
    setLinesForActiveCart(() => []);
    setDiscountValue(0);
  }, [setLinesForActiveCart]);

  const setDiscount = useCallback((type: "percent" | "fixed", value: number) => {
    setDiscountType(type);
    setDiscountValue(value);
  }, []);

  const setTaxConfig = useCallback((enabled: boolean, rate: number) => {
    setTaxEnabled(enabled);
    setTaxRate(rate);
    try {
      localStorage.setItem("kasa_tax_enabled", enabled ? "1" : "0");
      localStorage.setItem("kasa_tax_rate", String(rate));
    } catch {}
  }, []);

  const setServiceChargeConfig = useCallback((enabled: boolean, rate: number) => {
    setServiceChargeEnabled(enabled);
    setServiceChargeRate(rate);
    try {
      localStorage.setItem("kasa_service_charge_enabled", enabled ? "1" : "0");
      localStorage.setItem("kasa_service_charge_rate", String(rate));
    } catch {}
  }, []);

  const recordOrder = useCallback(
    (status: OrderStatus, recordedTotals: OrderTotals, method?: PayMethod) => {
      const orderItems: OrderItemLine[] = lines.map((l) => {
        const prod = products.find((p) => p.id === l.itemId);
        return {
          itemId: l.itemId,
          name: prod?.name || "Produk",
          qty: l.qty,
          price: prod?.price || 0,
          note: l.note,
        };
      });

      const row: OrderRow = {
        no: orderNo,
        status,
        total: recordedTotals.total,
        subtotal: recordedTotals.subtotal,
        tax: recordedTotals.tax,
        discount: recordedTotals.discountAmount,
        serviceCharge: recordedTotals.serviceCharge,
        itemCount: recordedTotals.count,
        items: orderItems,
        method,
        cashierId: currentStaff?.id,
        cashierName: currentStaff?.name,
        paidAt: status === "sudah-dibayar" ? Date.now() : undefined,
        createdAt: Date.now(),
      };

      setOrders((prev) => [row, ...prev]);
      if (status === "sudah-dibayar") {
        setLastReceipt(row);
      }
      setLinesForActiveCart(() => []);
      setDiscountValue(0);
      setOrderNo((n) => n + 1);
      void saveOrder(row).then(() => {
        broadcastSync("ORDER_CREATED", { order: row });
      });
      return row;
    },
    [currentStaff, lines, orderNo, products, setLinesForActiveCart],
  );

  const saveDraft = useCallback(() => {
    const no = orderNo;
    recordOrder("disimpan", totals);
    return no;
  }, [orderNo, recordOrder, totals]);

  const payOrder = useCallback(
    (method: PayMethod, cashReceived?: number): PayResult => {
      const no = orderNo;
      const paidTotal = totals.total;
      const change =
        method === "tunai" && cashReceived !== undefined
          ? Math.max(0, cashReceived - paidTotal)
          : null;
      const row = recordOrder("sudah-dibayar", totals, method);
      return { orderNo: no, total: paidTotal, change, order: row };
    },
    [orderNo, recordOrder, totals],
  );

  const updateOrderStatus = useCallback(async (no: number, status: OrderStatus) => {
    await repoUpdateOrderStatus(no, status);
    setOrders((prev) =>
      prev.map((o) => (o.no === no ? { ...o, status } : o)),
    );
    broadcastSync("ORDER_STATUS_CHANGED", { no, status });
  }, []);

  const openShift = useCallback(async (cashierName: string, startingCash: number) => {
    const shift: ShiftRecord = {
      id: `shift-${Date.now()}`,
      openedAt: Date.now(),
      cashierName,
      startingCash,
      status: "OPEN",
    };
    await repoSaveShift(shift);
    setActiveShift(shift);
    broadcastSync("SHIFT_CHANGED", { shift });
  }, []);

  const closeShift = useCallback(
    async (
      actualCash: number,
      notes?: string,
      denominations?: Record<string, number>,
    ): Promise<ShiftRecord> => {
      if (!activeShift) {
        throw new Error("Tidak ada shift yang sedang aktif.");
      }
      const paidCashTotal = orders
        .filter(
          (o) =>
            o.status === "sudah-dibayar" &&
            o.method === "tunai" &&
            (o.paidAt ?? 0) >= activeShift.openedAt,
        )
        .reduce((sum, o) => sum + o.total, 0);

      const shiftMovements = cashMovements.filter((m) => (m.createdAt ?? 0) >= activeShift.openedAt);
      const cashInTotal = shiftMovements
        .filter((m) => m.type === "CASH_IN" && m.category !== "modal_awal")
        .reduce((sum, m) => sum + m.amount, 0);
      const cashOutTotal = shiftMovements
        .filter((m) => m.type === "CASH_OUT")
        .reduce((sum, m) => sum + m.amount, 0);

      const expectedCash = activeShift.startingCash + paidCashTotal + cashInTotal - cashOutTotal;
      const cashDifference = actualCash - expectedCash;

      const closed: ShiftRecord = {
        ...activeShift,
        closedAt: Date.now(),
        actualCash,
        expectedCash,
        cashDifference,
        cashSalesTotal: paidCashTotal,
        cashInTotal,
        cashOutTotal,
        denominations,
        status: "CLOSED",
        notes,
      };

      await repoSaveShift(closed);
      setActiveShift(null);
      broadcastSync("SHIFT_CHANGED", { shift: closed });
      return closed;
    },
    [activeShift, cashMovements, orders],
  );

  const addCashMovement = useCallback(
    async (input: {
      type: CashMovementType;
      category: CashMovementCategory;
      amount: number;
      description: string;
      cashierName?: string;
    }): Promise<CashMovementRow> => {
      const row: CashMovementRow = {
        id: `mov-${Date.now()}`,
        shiftId: activeShift?.id,
        type: input.type,
        category: input.category,
        amount: input.amount,
        description: input.description,
        cashierName: input.cashierName || activeShift?.cashierName || "Kasir",
        createdAt: Date.now(),
      };
      await repoSaveCashMovement(row);
      setCashMovements((prev) => [row, ...prev]);
      broadcastSync("CASH_MOVEMENT_CREATED", { movement: row });
      return row;
    },
    [activeShift],
  );

  const deleteCashMovement = useCallback(
    async (id: string) => {
      await repoDeleteCashMovement(id);
      setCashMovements((prev) => prev.filter((m) => m.id !== id));
      broadcastSync("CASH_MOVEMENT_DELETED", { id });
    },
    [],
  );

  const reloadCashMovements = useCallback(async () => {
    const list = await loadCashMovements();
    setCashMovements(list);
    broadcastSync("CASH_MOVEMENT_CREATED");
  }, []);


  const reloadProducts = useCallback(async () => {
    const p = await loadProducts();
    setProducts(p);
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const reloadOrders = useCallback(async () => {
    const o = await loadOrders();
    setOrders(o);
  }, []);

  const reloadCategories = useCallback(async () => {
    const cats = await loadCategories();
    setCategories(cats);
  }, []);

  const addCategory = useCallback(async (input: Partial<CategoryRow>) => {
    const id = input.id || `cat-${Date.now()}`;
    const newCat: CategoryRow = {
      id,
      name: input.name?.trim() || "Kategori Baru",
      kind: input.kind || "Makanan",
      color: input.color || "counterlime",
      sortOrder: input.sortOrder ?? (categories.length + 1),
      createdAt: Date.now(),
      isDefault: false,
    };
    await repoSaveCategory(newCat);
    const updatedCats = await loadCategories();
    setCategories(updatedCats);
    broadcastSync("CATEGORY_CREATED", newCat);
    return newCat;
  }, [categories.length]);

  const updateCategory = useCallback(async (id: string, updates: Partial<CategoryRow>, oldName?: string) => {
    await repoUpdateCategory(id, updates, oldName);
    const [updatedCats, updatedProds] = await Promise.all([loadCategories(), loadProducts()]);
    setCategories(updatedCats);
    setProducts(updatedProds);
    broadcastSync("CATEGORY_UPDATED", { id, updates });
    if (updates.name && oldName && updates.name !== oldName) {
      broadcastSync("PRODUCTS_UPDATED");
    }
  }, []);

  const deleteCategory = useCallback(async (id: string, categoryName: string, reassignToCategoryName?: string) => {
    await repoDeleteCategory(id, categoryName, reassignToCategoryName);
    const [updatedCats, updatedProds] = await Promise.all([loadCategories(), loadProducts()]);
    setCategories(updatedCats);
    setProducts(updatedProds);
    broadcastSync("CATEGORY_DELETED", { id, categoryName, reassignToCategoryName });
    if (reassignToCategoryName) {
      broadcastSync("PRODUCTS_UPDATED");
    }
  }, []);

  const addProduct = useCallback(async (item: MenuItem) => {
    await repoSaveProduct(item);
    setProducts(await loadProducts());
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const updateProduct = useCallback(async (item: MenuItem) => {
    await repoSaveProduct(item);
    setProducts(await loadProducts());
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await repoDeleteProduct(id);
    setProducts(await loadProducts());
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const resetSeed = useCallback(async () => {
    await resetToDemoSeed();
    const [prods, movs, cats] = await Promise.all([
      loadProducts(),
      loadCashMovements(),
      loadCategories(),
    ]);
    setProducts(prods);
    setCashMovements(movs);
    setCategories(cats);
    broadcastSync("PRODUCTS_UPDATED");
    broadcastSync("CATEGORY_UPDATED");
  }, []);

  const value = useMemo<PosContextValue>(
    () => ({
      ready,
      products,
      categories,
      orderNo,
      lines,
      totals,
      orders,
      lastReceipt,
      setLastReceipt,
      cashMovements,
      discountType,
      discountValue,
      taxRate,
      serviceChargeRate,
      taxEnabled,
      serviceChargeEnabled,
      activeShift,
      setDiscount,
      setTaxConfig,
      setServiceChargeConfig,
      addItem,
      setItemNote,
      increaseLine,
      decreaseLine,
      removeItem,
      clearOrder,
      saveDraft,
      payOrder,
      addCashMovement,
      deleteCashMovement,
      reloadCashMovements,
      reloadProducts,
      reloadOrders,
      reloadCategories,
      addProduct,
      updateProduct,
      deleteProduct,
      addCategory,
      updateCategory,
      deleteCategory,
      updateOrderStatus,
      openShift,
      closeShift,
      resetSeed,
    }),
    [
      ready,
      products,
      categories,
      orderNo,
      lines,
      totals,
      orders,
      lastReceipt,
      setLastReceipt,
      cashMovements,
      discountType,
      discountValue,
      taxRate,
      serviceChargeRate,
      taxEnabled,
      serviceChargeEnabled,
      activeShift,
      setDiscount,
      setTaxConfig,
      setServiceChargeConfig,
      addItem,
      setItemNote,
      increaseLine,
      decreaseLine,
      removeItem,
      clearOrder,
      saveDraft,
      payOrder,
      addCashMovement,
      deleteCashMovement,
      reloadCashMovements,
      reloadProducts,
      reloadOrders,
      reloadCategories,
      addProduct,
      updateProduct,
      deleteProduct,
      addCategory,
      updateCategory,
      deleteCategory,
      updateOrderStatus,
      openShift,
      closeShift,
      resetSeed,
    ],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos harus dipakai di dalam PosProvider");
  return ctx;
}

export function runningOrdersCount(orders: OrderRow[]): number {
  return orders.filter((o) => o.status !== "sudah-dibayar").length;
}

export function salesToday(orders: OrderRow[]): number {
  return orders
    .filter((o) => o.status === "sudah-dibayar" && isToday(o.paidAt || o.createdAt))
    .reduce((sum, o) => sum + o.total, 0);
}

export { db };

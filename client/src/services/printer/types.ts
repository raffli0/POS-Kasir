export type ReceiptPayload = {
  orderNo: number;
  total: string;
  cashierName?: string;
  timestamp?: number;
  lines: Array<{ qty: number; name: string; amount: string }>;
};

export interface PrinterDriver {
  readonly id: "browser" | "escpos-bluetooth";
  readonly label: string;
  printReceipt(payload: ReceiptPayload): Promise<void>;
}

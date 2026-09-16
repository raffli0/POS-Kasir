import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { usePos } from "./PosContext";
import { usePrint } from "./PrintContext";
import { useAuth } from "./AuthContext";
import { getStoreInfo } from "../lib/storeInfo";

export function PrintLayer() {
  const print = usePrint();

  if (print.mode === "report" && print.report) {
    const r = print.report;
    return (
      <div id="print-root" aria-hidden="true">
        <div className="report-print">
          <h1>{r.title}</h1>
          <p className="rp-sub">{r.period}</p>
          <table>
            <thead>
              <tr>
                <th>{t.reportsPage.colDate}</th>
                <th className="num">{t.reportsPage.colOrders}</th>
                <th className="num">{t.reportsPage.colItems}</th>
                <th className="num">{t.reportsPage.colSales}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{row.orders}</td>
                  <td className="num">{row.items}</td>
                  <td className="num">{row.sales}</td>
                </tr>
              ))}
              <tr className="report-total">
                <td>{t.reportsPage.totalRow}</td>
                <td className="num">{r.totalOrders}</td>
                <td className="num" />
                <td className="num">{r.totalSales}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return <ReceiptPrint />;
}

function ReceiptPrint() {
  const pos = usePos();
  const { currentStaff } = useAuth();
  const { lastReceipt, lines, totals, orderNo } = pos;

  // Use lastReceipt if available; fallback to active cart lines
  const hasReceipt = Boolean(lastReceipt && lastReceipt.items && lastReceipt.items.length > 0);
  const hasCart = lines.length > 0;
  const hasItems = hasReceipt || hasCart;

  const currentOrderNo = lastReceipt ? lastReceipt.no : orderNo;
  const currentSubtotal = lastReceipt ? (lastReceipt.subtotal ?? lastReceipt.total) : totals.subtotal;
  const currentTax = lastReceipt ? (lastReceipt.tax ?? 0) : totals.tax;
  const currentDiscount = lastReceipt ? (lastReceipt.discount ?? 0) : totals.discountAmount;
  const currentServiceCharge = lastReceipt ? (lastReceipt.serviceCharge ?? 0) : totals.serviceCharge;
  const currentTotal = lastReceipt ? lastReceipt.total : totals.total;
  const receiptTimestamp = lastReceipt?.paidAt || lastReceipt?.createdAt || Date.now();
  const receiptDate = new Date(receiptTimestamp);
  const hours = String(receiptDate.getHours()).padStart(2, "0");
  const minutes = String(receiptDate.getMinutes()).padStart(2, "0");
  const formattedTime = `${hours}:${minutes}`;
  const formattedDate = receiptDate.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const cashierName = lastReceipt?.cashierName || (currentStaff?.id !== "unassigned" && currentStaff?.name ? currentStaff.name : "Kasir");

  const itemsToPrint = hasReceipt && lastReceipt?.items
    ? lastReceipt.items.map((it) => ({
      key: it.itemId || it.name,
      qty: it.qty,
      name: it.name,
      price: it.price,
      note: it.note,
      amount: it.price * it.qty,
    }))
    : lines.map((line) => {
      const item = pos.products.find((p) => p.id === line.itemId);
      const price = item?.price || 0;
      return {
        key: line.itemId,
        qty: line.qty,
        name: item?.name || "Produk",
        price,
        note: line.note,
        amount: price * line.qty,
      };
    });

  const storeInfo = getStoreInfo();

  return (
    <div id="print-root" aria-hidden="true">
      <div className="receipt-print">
        <div className="rp-head">
          <p className="rp-logo">{storeInfo.name.toUpperCase()}</p>
          {/* {storeInfo.tagline && <p className="rp-tagline">{storeInfo.tagline}</p>} */}
          {storeInfo.address && <p className="rp-tagline">{storeInfo.address}</p>}
          {storeInfo.phone && <p className="rp-tagline">Telp: {storeInfo.phone}</p>}
        </div>

        <div className="rp-sep" />

        <div className="rp-meta">
          <div className="rp-row">
            <span>Pesanan #{currentOrderNo}</span>
            <span className="rp-time">{formattedTime}</span>
          </div>
          <div>{formattedDate}</div>
          <div>{t.receipt.cashierLine(cashierName)}</div>
        </div>

        <div className="rp-sep" />

        {hasItems ? (
          <>
            <table className="rp-items">
              <tbody>
                {itemsToPrint.map((item) => (
                  <tr key={item.key}>
                    <td className="rp-qty">{item.qty}×</td>
                    <td className="rp-name">
                      {item.name}
                      {item.note && <span className="rp-unit">({item.note})</span>}
                      <span className="rp-unit">
                        {" "}
                        {t.receipt.unitPrice(formatIDR(item.price))}
                      </span>
                    </td>
                    <td className="rp-amt">{formatIDR(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="rp-sep" />

            <table className="rp-summary">
              <tbody>
                <tr>
                  <td>{t.receipt.productSubtotal}</td>
                  <td className="rp-amt">{formatIDR(currentSubtotal)}</td>
                </tr>
                {currentDiscount > 0 && (
                  <tr>
                    <td>Diskon</td>
                    <td className="rp-amt">-{formatIDR(currentDiscount)}</td>
                  </tr>
                )}
                {currentServiceCharge > 0 && (
                  <tr>
                    <td>Biaya Layanan ({pos.serviceChargeRate}%)</td>
                    <td className="rp-amt">{formatIDR(currentServiceCharge)}</td>
                  </tr>
                )}
                {currentTax > 0 && (
                  <tr>
                    <td>Pajak ({pos.taxRate}%)</td>
                    <td className="rp-amt">{formatIDR(currentTax)}</td>
                  </tr>
                )}
                <tr className="rp-total-row">
                  <td>{t.receipt.totalLabel}</td>
                  <td className="rp-amt">{formatIDR(currentTotal)}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="rp-muted rp-center">{t.receipt.sampleNote}</p>
        )}

        <div className="rp-sep" />

        <p className="rp-center rp-muted">{t.receipt.thanks}</p>
        <p className="rp-center rp-muted">
          {t.receipt.returnPolicy.split(/<br\s*\/?>/i).map((part, idx, arr) => (
            <span key={idx}>
              {part.trim()}
              {idx < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

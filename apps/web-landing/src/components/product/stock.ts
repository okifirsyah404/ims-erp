import type { StockStatus } from "../../types/catalog";

/** Stock badge copy and colours shared by the full and compact product cards. */
export const stockBadges: Record<StockStatus, { label: string; shortLabel: string; text: string; dot: string }> = {
  ready: { label: "Ready Stock", shortLabel: "Ready", text: "text-success", dot: "bg-success" },
  preorder: { label: "Pre-Order", shortLabel: "Pre-order", text: "text-warning", dot: "bg-warning" },
  request: { label: "Request Price", shortLabel: "Quote", text: "text-blue-600", dot: "bg-blue-600" },
  out: { label: "Out of Stock", shortLabel: "Out of stock", text: "text-danger", dot: "bg-danger" },
};

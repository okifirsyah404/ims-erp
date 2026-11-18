/**
 * Indicative pricing rules shown on the RFQ page (03.02 · Indicative pricing).
 * These are estimates only — final prices come from the ERP quotation.
 * TODO(sales): confirm tiers; the design states "5–12% volume discount from 10 units"
 * and shows an 8% estimate for a 12-unit order.
 */
export const volumeDiscountTiers: { minUnits: number; rate: number }[] = [{ minUnits: 10, rate: 0.08 }];

export const pricingNotes = [
  { icon: "tag", title: "List price", description: "Published on every product page" },
  { icon: "layers", title: "Project pricing", description: "5–12% volume discount from 10 units" },
  { icon: "landmark", title: "Government & BUMN", description: "LKPP e-catalog pricing available" },
  { icon: "calendar-check", title: "Payment terms", description: "30% DP · 60% delivery · 10% handover" },
] as const;

export type PricedLine = { unitPrice: number | null; quantity: number };

export type IndicativeQuote = {
  units: number;
  listTotal: number;
  discountRate: number;
  discount: number;
  subtotal: number;
  /** Lines without a list price (project pricing) are excluded from the totals. */
  unpricedLines: number;
};

export function indicativeQuote(lines: PricedLine[]): IndicativeQuote {
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const listTotal = lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.quantity, 0);
  const tier = [...volumeDiscountTiers].sort((a, b) => b.minUnits - a.minUnits).find((t) => units >= t.minUnits);
  const discountRate = tier?.rate ?? 0;
  const discount = Math.round(listTotal * discountRate);
  return {
    units,
    listTotal,
    discountRate,
    discount,
    subtotal: listTotal - discount,
    unpricedLines: lines.filter((line) => line.unitPrice === null).length,
  };
}

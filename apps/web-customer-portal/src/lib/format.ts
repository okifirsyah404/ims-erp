const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** "Rp 38.500.000" — matches the design's price formatting. */
export function formatRupiah(value: number): string {
  return `Rp ${rupiah.format(Math.round(value))}`;
}

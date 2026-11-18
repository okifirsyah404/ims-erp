/** Products queued for a quotation, persisted across catalog visits (browser only). */
export type RfqLine = { slug: string; qty: number; options?: Record<string, string> };

const KEY = "entragate:rfq-items:v1";

export function readRfqItems(): RfqLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((l) => typeof l?.slug === "string" && l.qty > 0) : [];
  } catch {
    return [];
  }
}

export function writeRfqItems(lines: RfqLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
}

export function clearRfqItems() {
  localStorage.removeItem(KEY);
}

/**
 * Guest cart kept in localStorage until checkout/ERP order endpoints exist.
 * Browser-only module: import it from `<script>` tags, never from frontmatter.
 */
export type CartLine = { slug: string; qty: number; options?: Record<string, string> };

const KEY = "entragate:cart:v1";
export const CART_EVENT = "entragate:cart-change";

function read(): CartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((l) => typeof l?.slug === "string" && l.qty > 0) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: lines }));
}

const sameOptions = (a?: Record<string, string>, b?: Record<string, string>) =>
  JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

export function getCart(): CartLine[] {
  return read();
}

export function cartCount(): number {
  return read().reduce((sum, line) => sum + line.qty, 0);
}

export function addToCart(slug: string, qty = 1, options?: Record<string, string>) {
  const lines = read();
  const existing = lines.find((l) => l.slug === slug && sameOptions(l.options, options));
  if (existing) existing.qty += qty;
  else lines.push({ slug, qty, options });
  write(lines);
}

/** Sets the quantity of the line at `index` (0 removes it). */
export function setCartQty(index: number, qty: number) {
  const lines = read();
  if (!lines[index]) return;
  if (qty <= 0) lines.splice(index, 1);
  else lines[index].qty = Math.min(999, Math.floor(qty));
  write(lines);
}

export function removeFromCart(index: number) {
  setCartQty(index, 0);
}

export function clearCart() {
  write([]);
}

/** Replaces the device cart (after it was merged with the signed-in customer's account cart). */
export function replaceCart(lines: CartLine[]) {
  write(lines.filter((l) => typeof l.slug === "string" && l.qty > 0).map((l) => ({ slug: l.slug, qty: Math.min(999, Math.floor(l.qty)), options: l.options })));
}

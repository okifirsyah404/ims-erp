/** Saved products (heart buttons), kept in localStorage until accounts hold wishlists. Browser-only. */
const KEY = "entragate:wishlist:v1";

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function isWishlisted(slug: string): boolean {
  return read().includes(slug);
}

/** Toggles a product and returns whether it is now saved. */
export function toggleWishlist(slug: string): boolean {
  const list = read();
  const saved = !list.includes(slug);
  localStorage.setItem(KEY, JSON.stringify(saved ? [...list, slug] : list.filter((s) => s !== slug)));
  return saved;
}

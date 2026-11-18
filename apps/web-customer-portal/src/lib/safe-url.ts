/**
 * Guards for URLs that come from ERP data before they reach `href`/`src`. Astro escapes
 * attribute values but would still render `javascript:` or `data:` URLs verbatim.
 */

/** Same-origin path ("/orders/1"), never protocol-relative ("//evil") or backslash tricks. */
export function safePath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}

/** A same-origin path or an absolute https URL (downloads, images hosted by the ERP/CDN). */
export function safeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/")) return safePath(value);
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

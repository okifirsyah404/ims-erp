/**
 * Indonesian phone numbers (shared by the browser validator and the server actions).
 * Accepts `08xx…`, `+628xx…`, `628xx…` and landlines such as `021…`, with spaces,
 * dots, dashes or brackets. Normalised to E.164 (`+62…`) before it is sent to the ERP.
 */

const MOBILE = /^\+628[1-9]\d{6,10}$/;
const LANDLINE = /^\+62[2-79]\d{6,10}$/;

export const PHONE_PLACEHOLDER = "0812 3456 7890";
export const PHONE_HINT = "Format 08xx or +62 8xx";

export function normalizeIndonesianPhone(raw: string): string {
  const compact = raw.trim().replace(/[\s.\-()]/g, "");
  if (compact.startsWith("+62")) return compact;
  if (compact.startsWith("62")) return `+${compact}`;
  if (compact.startsWith("0")) return `+62${compact.slice(1)}`;
  return compact;
}

/** `mobile` requires a mobile number (WhatsApp); otherwise landlines are accepted too. */
export function isIndonesianPhone(raw: string, { mobile = false } = {}): boolean {
  const normalized = normalizeIndonesianPhone(raw);
  return MOBILE.test(normalized) || (!mobile && LANDLINE.test(normalized));
}

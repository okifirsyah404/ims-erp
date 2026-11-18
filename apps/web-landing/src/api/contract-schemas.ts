import { z } from "zod";

/**
 * Runtime validation for the ERP responses that affect security: URLs the browser
 * is redirected to. The portal carries the full set (`api/portal-schemas.ts`,
 * identities and tokens too); the website only needs these helpers.
 */

/** https URL (http allowed only for localhost during development). */
export const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
}, "Expected an https URL");

/** Thrown when an ERP response doesn't match the expected contract. */
export class ErpContractError extends Error {
  constructor(operation: string, readonly issues: string[]) {
    super(`ERP response for "${operation}" did not match the contract.`);
    this.name = "ErpContractError";
  }
}

export function parseOrThrow<T>(operation: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ErpContractError(operation, result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return result.data;
}

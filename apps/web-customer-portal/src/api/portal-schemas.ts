import { z } from "zod";
import type { AuthTokens, LoginResult, PaymentIntent, PortalUser } from "./portal";

/**
 * Runtime validation for ERP responses that affect security: identities, tokens and
 * URLs the browser is sent to. Other responses are trusted structurally (TypeScript only)
 * and rendered through Astro's escaping; any URL they carry is re-checked at render time.
 */

/** https URL (http allowed only for localhost during development). */
export const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
}, "Expected an https URL");

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO date");

export const authTokensSchema = z.object({
  sessionCookie: z.string().min(16).max(8192),
  refreshToken: z.string().min(16).max(8192).optional(),
  expiresAt: isoDate,
}) satisfies z.ZodType<AuthTokens>;

/** The session part of a sign-in body; the session itself arrives as `Set-Cookie` (ADR-0024). */
const sessionInfoSchema = z.object({ expiresAt: isoDate });

export const portalUserSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  initials: z.string().min(1).max(4),
  email: z.email(),
  phone: z.string().max(40).optional(),
  jobTitle: z.string().max(120).optional(),
  accountType: z.enum(["individual", "business"]),
  verified: z.boolean(),
  company: z
    .object({ id: z.string().max(128), name: z.string().max(200), npwp: z.string().max(40).optional(), shortName: z.string().max(8) })
    .optional(),
}) satisfies z.ZodType<PortalUser>;

export const sessionSchema = z.object({ user: portalUserSchema, session: sessionInfoSchema });

export const loginSuccessSchema = z.object({ ok: z.literal(true), user: portalUserSchema, session: sessionInfoSchema });

/**
 * Login failures arrive as NestJS error bodies. Accept our documented shape when the ERP
 * sends it, otherwise derive it from the status code.
 */
export function loginFailureFrom(status: number, body: unknown): LoginResult | null {
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const reason = record.reason;
  if (status === 423 || reason === "locked") {
    const lockedUntil = typeof record.lockedUntil === "string" && !Number.isNaN(Date.parse(record.lockedUntil))
      ? record.lockedUntil
      : new Date(Date.now() + 15 * 60_000).toISOString();
    return { ok: false, reason: "locked", lockedUntil };
  }
  if (reason === "unverified" && typeof record.email === "string") {
    return { ok: false, reason: "unverified", email: record.email };
  }
  if (status === 401 || reason === "invalid_credentials") {
    const attemptsLeft = typeof record.attemptsLeft === "number" && record.attemptsLeft >= 0 ? Math.floor(record.attemptsLeft) : undefined;
    return { ok: false, reason: "invalid_credentials", attemptsLeft };
  }
  return null;
}

export const paymentIntentSchema = z.object({
  invoiceId: z.string().max(128),
  methodId: z.string().max(128),
  // The browser is redirected here, so it must be a real https page.
  instructionsUrl: httpsUrl.optional(),
  reference: z.string().max(128),
}) satisfies z.ZodType<PaymentIntent>;

/** Thrown when an ERP response doesn't match the expected contract. */
export class ErpContractError extends Error {
  constructor(operation: string, readonly issues: string[]) {
    super(`ERP response for "${operation}" did not match the portal contract.`);
    this.name = "ErpContractError";
  }
}

export function parseOrThrow<T>(operation: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ErpContractError(operation, result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return result.data;
}

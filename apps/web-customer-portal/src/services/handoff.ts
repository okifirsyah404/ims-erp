import { type AuthTokens, type PortalUser } from "@/api/portal";
import { WEB_HANDOFF_SECRET } from "astro:env/server";

/**
 * Website sign-in hand-off (checkout / RFQ on entragate.com).
 *
 * `/connect/web?state=…` (signed-in portal page) mints a random single-use code bound to
 * the customer and the website's `state`, then redirects to the configured website origin
 * only. The website exchanges the code server-to-server at `/api/connect/token` with the
 * shared secret. Codes live 60 seconds and are deleted on first use.
 *
 * The store is in-memory: run one portal instance, or replace it with a shared store
 * (e.g. Redis) before scaling horizontally.
 */

const CODE_TTL_MS = 60_000;
const DEV_SECRET = "entragate-dev-handoff-secret";

type Grant = { user: PortalUser; tokens: AuthTokens; state: string; expires: number };
const store: Map<string, Grant> = ((globalThis as { __egHandoff?: Map<string, Grant> }).__egHandoff ??= new Map());

export function handoffSecret(): string | undefined {
  return WEB_HANDOFF_SECRET || (import.meta.env.MODE === "development" ? DEV_SECRET : undefined);
}

export const isValidState = (state: string | null): state is string => Boolean(state && /^[A-Za-z0-9_-]{16,128}$/.test(state));

export function issueCode(user: PortalUser, tokens: AuthTokens, state: string): string {
  const now = Date.now();
  for (const [code, grant] of store) if (grant.expires < now) store.delete(code);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  store.set(code, { user, tokens, state, expires: now + CODE_TTL_MS });
  return code;
}

/** Single use: the grant is removed whether or not it matches. */
export function redeemCode(code: string, state: string): Grant | "expired" | null {
  const grant = store.get(code);
  store.delete(code);
  if (!grant || grant.state !== state) return null;
  return grant.expires < Date.now() ? "expired" : grant;
}

/** Constant-time comparison for the shared secret. */
export function secretMatches(header: string | null): boolean {
  const secret = handoffSecret();
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

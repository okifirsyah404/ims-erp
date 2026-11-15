import type { CustomerAuth } from "@entragate/api-client";
import { CUSTOMER_INTERNAL_URL, WEB_HANDOFF_SECRET } from "astro:env/server";
import { customerUrl, safeReturnPath } from "../urls";

/**
 * Website sign-in via the Customer Portal (which owns ERP authentication).
 *
 * 1. `/auth/login?next=/checkout` stores a random `state` + `next` in the website session
 *    and sends the visitor to the portal's `/connect/web?state=…`.
 * 2. The portal requires its own login (or registration), then redirects back to
 *    `/auth/callback?code=…&state=…` with a single-use, 60-second code.
 * 3. The callback checks `state`, exchanges the code server-to-server (shared secret),
 *    stores the customer + ERP access token in the server-side session and returns to `next`.
 *
 * Tokens never reach the browser or localStorage; redirects only go to allow-listed paths.
 */

type SessionLike = NonNullable<import("astro").APIContext["session"]>;
export type WebCustomer = App.SessionData["customer"];

const DEV_SECRET = "entragate-dev-handoff-secret";
const isDevelopment = import.meta.env.MODE === "development";
const STATE_TTL_MS = 10 * 60 * 1000;

export function handoffSecret(): string | undefined {
  return WEB_HANDOFF_SECRET || (isDevelopment ? DEV_SECRET : undefined);
}

function randomToken(bytes = 24) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signed-in customer, or undefined (expired tokens end the website session). */
export async function getCustomer(session: SessionLike | undefined): Promise<WebCustomer | undefined> {
  const customer = await session?.get("customer");
  if (!customer) return undefined;
  if (Date.parse(customer.expiresAt) <= Date.now()) {
    session?.delete("customer");
    return undefined;
  }
  return customer;
}

export const toAuth = (customer: WebCustomer): CustomerAuth => ({ accessToken: customer.accessToken, customerId: customer.id });

/** Step 1: remember where to return and build the portal URL. */
export function beginSignIn(session: SessionLike, rawNext: string | null, mode: "login" | "register") {
  const state = randomToken();
  const next = safeReturnPath(rawNext);
  session.set("authState", { state, next, createdAt: Date.now() });
  const connect = `/connect/web?state=${encodeURIComponent(state)}`;
  return mode === "register"
    ? `${customerUrl}/register?next=${encodeURIComponent(connect)}`
    : `${customerUrl}${connect}`;
}

export class SignInError extends Error {
  constructor(public reason: "state" | "expired" | "exchange" | "config") {
    super(`Sign-in failed (${reason})`);
  }
}

/** Steps 2–3: validate state, exchange the code and start the customer session. */
export async function completeSignIn(session: SessionLike, code: string | null, state: string | null): Promise<string> {
  const pending = await session.get("authState");
  session.delete("authState");
  if (!pending || !state || !code || pending.state !== state) throw new SignInError("state");
  if (Date.now() - pending.createdAt > STATE_TTL_MS) throw new SignInError("expired");
  const secret = handoffSecret();
  if (!secret) throw new SignInError("config");

  const base = (CUSTOMER_INTERNAL_URL || customerUrl).replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/api/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}`, Accept: "application/json" },
      body: JSON.stringify({ code, state }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[auth] hand-off exchange failed", error);
    throw new SignInError("exchange");
  }
  if (!response.ok) throw new SignInError(response.status === 410 ? "expired" : "exchange");
  const body = (await response.json()) as Partial<WebCustomer> & { accessToken?: string };
  if (!body.id || !body.email || !body.accessToken || !body.expiresAt) throw new SignInError("exchange");

  await session.regenerate(); // new session id after sign-in (fixation)
  session.set("customer", {
    id: String(body.id),
    name: String(body.name ?? body.email),
    email: String(body.email),
    phone: body.phone ? String(body.phone) : undefined,
    company: body.company ? String(body.company) : undefined,
    accessToken: String(body.accessToken),
    expiresAt: String(body.expiresAt),
  });
  return pending.next;
}

export function signOut(session: SessionLike | undefined) {
  session?.destroy();
}

import type { APIContext } from "astro";
import type { AuthTokens, PortalUser } from "@entragate/api-client";
import { portal } from "../services/portal";
import { logUpstreamError } from "./errors";

type SessionLike = NonNullable<APIContext["session"]>;

/** Session lifetime when "Keep me signed in" is off (sliding is not applied). */
const SHORT_SESSION_SECONDS = 60 * 60 * 12;
const LONG_SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Starts an authenticated session. The session id is regenerated to prevent fixation;
 * only the opaque id is stored in the (httpOnly) cookie.
 */
export async function signIn(session: SessionLike, user: PortalUser, tokens: AuthTokens, remember: boolean) {
  await session.regenerate();
  session.set(
    "auth",
    { user, tokens, remember, signedInAt: new Date().toISOString() },
    { ttl: remember ? LONG_SESSION_SECONDS : SHORT_SESSION_SECONDS },
  );
}

export function signOut(session: SessionLike) {
  session.destroy();
}

export function isExpired(tokens: AuthTokens, skewMs = 0) {
  return Date.parse(tokens.expiresAt) - skewMs <= Date.now();
}

type AuthData = App.SessionData["auth"];
/** Refresh slightly before expiry so a request never starts with a token about to lapse. */
const REFRESH_SKEW_MS = 60_000;
/** One refresh per refresh token at a time (parallel requests share it; rotation-safe). */
const inflight = new Map<string, Promise<AuthTokens | null>>();

/**
 * Returns a usable session, refreshing the ERP access token when it is (nearly) expired.
 * Returns `null` when the user must sign in again. Upstream outages keep the current
 * session while the token is still valid.
 */
export async function ensureFreshAuth(session: SessionLike, auth: AuthData): Promise<AuthData | null> {
  if (!isExpired(auth.tokens, REFRESH_SKEW_MS)) return auth;
  const refreshToken = auth.tokens.refreshToken;
  if (!refreshToken) return isExpired(auth.tokens) ? null : auth;

  let pending = inflight.get(refreshToken);
  if (!pending) {
    pending = portal.refreshSession(refreshToken).finally(() => inflight.delete(refreshToken));
    inflight.set(refreshToken, pending);
  }
  try {
    const tokens = await pending;
    if (!tokens) return null;
    const next = { ...auth, tokens };
    const started = Date.parse(auth.signedInAt);
    const lifetime = (auth.remember ? LONG_SESSION_SECONDS : SHORT_SESSION_SECONDS) * 1000;
    const ttl = Math.max(60, Math.floor((started + lifetime - Date.now()) / 1000));
    session.set("auth", next, { ttl });
    return next;
  } catch (error) {
    logUpstreamError("auth.refresh", error);
    return isExpired(auth.tokens) ? null : auth;
  }
}

/** Only allow same-origin, path-relative redirect targets. */
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

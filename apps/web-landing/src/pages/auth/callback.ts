import type { APIRoute } from "astro";
import { SignInError, completeSignIn } from "../../lib/server/auth";

/**
 * `GET /auth/callback?code=…&state=…` — the portal returns here after sign-in. Failures go
 * to `/checkout?auth=<reason>` (which shows a message and a manual retry), never back to
 * the portal automatically, so a broken hand-off can't loop.
 */
export const prerender = false;

export const GET: APIRoute = async ({ url, session, redirect }) => {
  if (!session) return redirect("/checkout?auth=config", 303);
  try {
    const next = await completeSignIn(session, url.searchParams.get("code"), url.searchParams.get("state"));
    const target = new URL(next, url);
    target.searchParams.set("signed_in", "1");
    return redirect(`${target.pathname}${target.search}`, 303);
  } catch (error) {
    const reason = error instanceof SignInError ? error.reason : "exchange";
    if (!(error instanceof SignInError)) console.error("[auth] callback failed", error);
    return redirect(`/checkout?auth=${reason}`, 303);
  }
};

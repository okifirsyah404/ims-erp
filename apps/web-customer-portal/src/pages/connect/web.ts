import type { APIRoute } from "astro";
import { webUrl } from "../../lib/urls";
import { isValidState, issueCode } from "../../services/handoff";

/**
 * `GET /connect/web?state=…` — return a signed-in customer to the public website
 * (checkout, RFQ). Not a public route: the middleware sends guests to `/login?next=…`
 * (or registration keeps `next`), so this runs only after the portal sign-in. The
 * redirect target is always the configured website origin — never a URL from the query.
 */
export const prerender = false;

export const GET: APIRoute = ({ url, locals }) => {
  const state = url.searchParams.get("state");
  if (!isValidState(state) || !locals.user || !locals.tokens) {
    return new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
  }
  const code = issueCode(locals.user, locals.tokens, state);
  const target = new URL("/auth/callback", webUrl);
  target.searchParams.set("code", code);
  target.searchParams.set("state", state);
  return new Response(null, { status: 303, headers: { Location: target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
};

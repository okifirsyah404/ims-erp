import type { APIRoute } from "astro";
import { beginSignIn, getCustomer } from "../../lib/server/auth";
import { safeReturnPath } from "../../lib/urls";

/**
 * `GET /auth/login?next=/checkout[&mode=register]` — starts the Customer Portal sign-in
 * hand-off. Already signed-in customers go straight to `next` (no redirect loop).
 */
export const prerender = false;

export const GET: APIRoute = async ({ url, session, redirect }) => {
  const next = safeReturnPath(url.searchParams.get("next"));
  if (!session) return redirect(next, 303);
  if (await getCustomer(session)) return redirect(next, 303);
  const mode = url.searchParams.get("mode") === "register" ? "register" : "login";
  return new Response(null, {
    status: 303,
    headers: { Location: beginSignIn(session, next, mode), "Cache-Control": "no-store" },
  });
};

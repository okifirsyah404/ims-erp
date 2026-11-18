import type { APIRoute } from "astro";
import { portal } from "../services/portal";
import { signOut } from "../services/auth";

/**
 * Sign out (05.09). A plain POST endpoint rather than a form action so it can redirect to
 * the guest-only /welcome page; `security.checkOrigin` rejects cross-site posts.
 * Clear-Site-Data "cache" drops the browser's HTTP cache so nothing personal outlives the
 * session on a shared device. The service worker only stores the static app shell and the
 * offline page (never personalised responses), so it is left registered.
 */
export const POST: APIRoute = async ({ locals, session }) => {
  if (locals.tokens) await portal.logout(locals.tokens).catch(() => undefined);
  if (session) signOut(session);
  return new Response(null, {
    status: 303,
    headers: { Location: "/welcome", "Clear-Site-Data": '"cache"', "Cache-Control": "no-store" },
  });
};

import type { APIRoute } from "astro";
import { signOut } from "../../lib/server/auth";
import { safeReturnPath } from "../../lib/urls";

/**
 * `POST /auth/logout` — ends the website checkout session (the guest cart in the browser is
 * kept). The Customer Portal session is separate; sign out there from the portal itself.
 */
export const prerender = false;

export const POST: APIRoute = async ({ session, request, redirect }) => {
  signOut(session);
  // Back to the page the visitor signed out from (a hidden `next` field), else the cart.
  const form = await request.formData().catch(() => null);
  const next = safeReturnPath(typeof form?.get("next") === "string" ? (form.get("next") as string) : null, "/cart");
  return redirect(`${next}${next.includes("?") ? "&" : "?"}signed_out=1`, 303);
};

import type { APIRoute } from "astro";
import { signOut } from "../../lib/server/auth";

/**
 * `POST /auth/logout` — ends the website checkout session (the guest cart in the browser is
 * kept). The Customer Portal session is separate; sign out there from the portal itself.
 */
export const prerender = false;

export const POST: APIRoute = async ({ session, redirect }) => {
  signOut(session);
  return redirect("/cart?signed_out=1", 303);
};

import type { APIRoute } from "astro";
import { redeemCode, secretMatches } from "../../../services/handoff";

/**
 * `POST /api/connect/token` — server-to-server exchange for the website hand-off. Requires
 * the shared secret; returns the customer profile and the ERP access token (not the
 * refresh token) for the website's server-side session. Never called from a browser.
 */
export const prerender = false;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const POST: APIRoute = async ({ request }) => {
  if (!secretMatches(request.headers.get("authorization"))) return json(401, { error: "unauthorized" });
  let body: { code?: unknown; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "bad_request" });
  }
  if (typeof body.code !== "string" || typeof body.state !== "string" || body.code.length > 100 || body.state.length > 128) {
    return json(400, { error: "bad_request" });
  }
  const grant = redeemCode(body.code, body.state);
  if (grant === "expired") return json(410, { error: "expired" });
  if (!grant) return json(400, { error: "invalid_code" });
  const { user, tokens } = grant;
  return json(200, {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    company: user.company?.name,
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  });
};

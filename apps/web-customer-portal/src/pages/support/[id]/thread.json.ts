import type { APIRoute } from "astro";
import { supportService } from "../../../services";

/**
 * `GET /support/:id/thread.json` — what the open ticket page polls (ERP-0092): the
 * message count and state, so the page can offer the new replies without a socket.
 */
export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const GET: APIRoute = async ({ params, locals }) => {
  const tokens = locals.tokens;
  if (!tokens) return json({ error: "unauthorized" }, 401);
  const ticket = await supportService.get(tokens, params.id ?? "").catch(() => null);
  if (!ticket) return json({ error: "not_found" }, 404);
  return json({ messages: ticket.messages.length, status: ticket.status, canConfirm: Boolean(ticket.canConfirm) });
};

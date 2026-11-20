import type { APIRoute } from "astro";
import { ERP_API_BASE_URL } from "astro:env/server";
import { portalMode } from "../../../../services/portal";

/**
 * `GET /documents/file/:kind/:id` — downloads a document (ERP-0079): an SPH, invoice or
 * warranty certificate PDF (rendered by the ERP on request) or a project file. The browser
 * only holds the portal session, so this server streams the file from the ERP with the
 * customer's ERP session; the ERP checks that the document belongs to this customer.
 */
export const prerender = false;

const KINDS = new Set(["quotation", "invoice", "warranty", "file"]);
const ID = /^[0-9a-f-]{36}$/i;

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export const GET: APIRoute = async ({ params, locals }) => {
  const kind = params.kind ?? "";
  const id = params.id ?? "";
  if (!KINDS.has(kind) || !ID.test(id)) return notFound();
  const tokens = locals.tokens;
  if (portalMode === "demo" || !tokens || !ERP_API_BASE_URL) return notFound();

  let upstream: Response;
  try {
    upstream = await fetch(`${ERP_API_BASE_URL.replace(/\/+$/, "")}/portal/v1/documents/${kind}/${id}/file`, {
      headers: { Cookie: tokens.sessionCookie, "X-Client": "entragate-customer-portal" },
      // Project files answer with a redirect to object storage: follow it here.
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return new Response("The document could not be downloaded. Please try again.", { status: 502 });
  }
  if (upstream.status === 404 || upstream.status === 401 || upstream.status === 403) return notFound();
  if (!upstream.ok || !upstream.body) {
    return new Response("The document could not be downloaded right now. Please try again later.", { status: upstream.status === 503 ? 503 : 502 });
  }
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  headers.set("Content-Disposition", upstream.headers.get("content-disposition") ?? `attachment; filename="${kind}-${id}"`);
  return new Response(upstream.body, { status: 200, headers });
};

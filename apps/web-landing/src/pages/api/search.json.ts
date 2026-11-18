import type { APIRoute } from "astro";
import { searchSite } from "../../lib/search";

/** Command palette search (`GET /api/search.json?q=`): grouped results, 5 per group. */
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get("q") ?? "";
  const result = await searchSite(q, 5);
  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Robots-Tag": "noindex",
    },
  });
};

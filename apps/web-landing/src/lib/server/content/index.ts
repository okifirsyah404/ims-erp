import { ApiError, createApiClient } from "@/api/client";
import { ERP_API_BASE_URL, ERP_API_TIMEOUT_MS, ERP_API_TOKEN, ERP_RESPONSE_ENVELOPE } from "astro:env/server";
import { websiteMode } from "../website";

/**
 * Website content written in the ERP (ERP-0071 stages 2-4): pages and collections from
 * `GET /public/v1/site/pages/:type[/:slug]` (website API key), published entries only,
 * images already turned into URLs.
 *
 * Every read is cached for a minute. `null` means "the ERP has nothing for this", and the
 * caller keeps the website's built-in content: demo mode, ERP not configured, nothing
 * published (404 / empty list), or an ERP outage with no earlier copy (an outage serves
 * the last good copy when there is one).
 */
export type ContentEntry<T> = {
  slug: string;
  title: string;
  position: number;
  seoTitle: string | null;
  seoDescription: string | null;
  content: Partial<T>;
  updatedAt: string;
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

const client =
  ERP_API_BASE_URL && ERP_API_TOKEN
    ? createApiClient({
        baseUrl: ERP_API_BASE_URL,
        token: ERP_API_TOKEN,
        timeoutMs: Math.min(ERP_API_TIMEOUT_MS ?? 5_000, 5_000),
        unwrap: ERP_RESPONSE_ENVELOPE === "data" ? (body) => (body as { data?: unknown } | undefined)?.data : undefined,
        defaultHeaders: { "X-Client": "entragate-website" },
      })
    : null;

function cached<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  if (websiteMode === "demo" || !client) return Promise.resolve(null);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value as T | null);
  const pending =
    (inflight.get(key) as Promise<T | null> | undefined) ??
    load()
      .then((value) => {
        cache.set(key, { at: Date.now(), value });
        return value;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          cache.set(key, { at: Date.now(), value: null });
          return null;
        }
        console.error(`[content] ERP content ${key} unavailable; serving the last good copy`, error);
        return (cache.get(key)?.value as T | null | undefined) ?? null;
      })
      .finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
}

/** One published entry (single pages use slug `home`), or `null`. */
export function getContentEntry<T>(type: string, slug = "home"): Promise<ContentEntry<T> | null> {
  return cached(`${type}/${slug}`, () => client!.get<ContentEntry<T>>(`/public/v1/site/pages/${type}/${encodeURIComponent(slug)}`));
}

/** Published entries of a collection in website order, or `null` when none are published. */
export function getContentList<T>(type: string): Promise<ContentEntry<T>[] | null> {
  return cached(`${type}`, async () => {
    const list = await client!.get<ContentEntry<T>[]>(`/public/v1/site/pages/${type}`);
    return list && list.length > 0 ? list : null;
  });
}

/** The value, unless it is missing or empty (then the built-in default). */
export function pick<T>(value: T | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value) && value.length === 0) return fallback;
  return value;
}

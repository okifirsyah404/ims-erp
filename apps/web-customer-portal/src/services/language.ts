import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_LANGUAGE, type PortalLanguage } from "@/lib/language";

/**
 * The language of the request being served. The middleware runs each request inside
 * {@link runWithLanguage}; the ERP adapter reads {@link currentLanguage} for every call, so
 * pages and actions never pass the language around.
 */
const store = new AsyncLocalStorage<PortalLanguage>();

export function runWithLanguage<T>(language: PortalLanguage, fn: () => T): T {
  return store.run(language, fn);
}

export function currentLanguage(): PortalLanguage {
  return store.getStore() ?? DEFAULT_LANGUAGE;
}

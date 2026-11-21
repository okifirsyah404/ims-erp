import { type PortalSource } from "@/api/portal";
import type { APIContext, MiddlewareNext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { ERP_API_BASE_URL, ERP_ASSET_ORIGINS } from "astro:env/server";
import { LANGUAGE_COOKIE, resolveLanguage } from "@/lib/language";
import { isPortalCustomer } from "@/lib/portal-role";
import { runWithLanguage } from "./services/language";
import { ensureFreshAuth, safeNext, signOut } from "./services/auth";
import { SessionExpiredError } from "./services/errors";
import { isConnected } from "./services/portal";

/** Routes reachable without a session (04 Authentication + PWA assets). */
const PUBLIC_PATHS = [
  "/welcome",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/offline",
  // 07.05 sign-in-free order lookup (minimal status only).
  "/track",
];
// `/api/connect/` = website sign-in hand-off (shared-secret, server-to-server).
const PUBLIC_PREFIXES = ["/api/connect/", "/_actions/", "/_astro/", "/icons/", "/_image", "/workbox-", "/sw.js", "/manifest.webmanifest", "/registerSW.js"];
/** Auth pages that signed-in users should not see again. */
const GUEST_ONLY = ["/welcome", "/login", "/register", "/forgot-password"];

const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

const isDevelopment = import.meta.env.MODE === "development";

/** Image origins besides our own: the ERP host plus any configured file/CDN origins. */
const imageOrigins = [ERP_API_BASE_URL, ...(ERP_ASSET_ORIGINS ?? "").split(",")]
  .map((value) => value?.trim())
  .filter(Boolean)
  .flatMap((value) => {
    try {
      const url = new URL(value!);
      return url.protocol === "https:" ? [url.origin] : [];
    } catch {
      return [];
    }
  });

/**
 * The browser only ever talks to this origin (all ERP traffic is server-side), so
 * connect-src is locked to 'self'. Inline scripts remain allowed for Astro island
 * hydration; everything else is same-origin.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${imageOrigins.join(" ")}`.trim(),
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(self), payment=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
  ...(isDevelopment
    ? {}
    : {
        // Vite's dev client needs inline/eval and websockets, so these apply to builds only.
        "Content-Security-Policy": CONTENT_SECURITY_POLICY,
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      }),
};

/**
 * Screens whose data comes entirely from ERP operations that may not be connected yet
 * (staged rollout). When one is missing the visitor sees /coming-soon instead of an error
 * page. Screens that mix connected and missing data handle it themselves
 * (`unlessNotConnected`); actions already answer "This feature isn't connected yet".
 */
const SCREEN_OPERATIONS: [RegExp, (keyof PortalSource)[]][] = [
  [/^\/orders\/?$/, ["listOrders"]],
  [/^\/orders\/[^/]+\/?$/, ["getOrder"]],
  [/^\/tracking\/?$/, ["listOrders", "getOrder"]],
  [/^\/payments\/?$/, ["listInvoices", "listPaymentMethods"]],
  [/^\/payments\/[^/]+\/?$/, ["getInvoice", "listOrders", "listPaymentMethods"]],
  [/^\/quotations\/?$/, ["listQuotations", "listRfqs"]],
  [/^\/quotations\/(?!claim\/?$)[^/]+\/?$/, ["getQuotation"]],
  [/^\/support\/book\/?$/, ["getBookingOptions"]],
  [/^\/documents\/?$/, ["listDocuments"]],
  [/^\/notifications\/?$/, ["listNotifications"]],
  [/^\/wishlist\/?$/, ["listWishlist"]],
];

function screenNotConnected(pathname: string): boolean {
  return SCREEN_OPERATIONS.some(([pattern, operations]) => pattern.test(pathname) && operations.some((operation) => !isConnected(operation)));
}

function withSecurityHeaders(response: Response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered pages (the offline fallback) are built once with no request or session.
  if (context.isPrerendered) return next();
  // The language lives in the portal's own cookie and reaches the ERP as Accept-Language.
  const language = resolveLanguage(context.cookies.get(LANGUAGE_COOKIE)?.value);
  context.locals.language = language;
  return runWithLanguage(language, () => handle(context, next));
});

async function handle(context: APIContext, next: MiddlewareNext): Promise<Response> {

  const { pathname, search } = context.url;
  const session = context.session;

  const stored = session ? await session.get("auth") : undefined;
  // Only the global `customer` role holds a portal session (ADR-0027): the ERP leaves that
  // decision to the client, so a stored session without it is dropped here.
  const auth = stored && session && isPortalCustomer(stored.user) ? await ensureFreshAuth(session, stored) : undefined;
  if (stored && !auth) {
    signOut(session!);
  } else if (auth) {
    context.locals.user = auth.user;
    context.locals.tokens = auth.tokens;
  }

  const signedIn = Boolean(context.locals.user);
  const loginRedirect = (reason?: string) =>
    context.redirect(`/login?next=${encodeURIComponent(pathname + search)}${reason ? `&reason=${reason}` : ""}`, 303);

  if (!signedIn && !isPublic(pathname)) {
    return pathname === "/" ? context.redirect("/welcome", 303) : loginRedirect(stored ? "expired" : undefined);
  }
  if (signedIn && GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Already signed in: honour `next` (e.g. the website hand-off) instead of looping.
    return context.redirect(safeNext(context.url.searchParams.get("next")), 303);
  }

  if (signedIn && screenNotConnected(pathname)) {
    return withSecurityHeaders(await context.rewrite("/coming-soon"));
  }

  let response: Response;
  try {
    response = await next();
  } catch (error) {
    // The ERP rejected the access token mid-request (revoked, password changed, …).
    if (error instanceof SessionExpiredError && session) {
      signOut(session);
      return withSecurityHeaders(loginRedirect("expired"));
    }
    throw error;
  }

  withSecurityHeaders(response);
  // Personalised pages must never be cached by shared caches, the SW or the bfcache.
  if (signedIn && response.headers.get("content-type")?.includes("text/html")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

import { z } from "zod";
import { ApiError, createApiClient, type ApiClientOptions } from "./client";
import type { RfqReceipt, RfqSubmission } from "./rfq";
import type { Money } from "./money";
import { httpsUrl, parseOrThrow } from "./contract-schemas";

/**
 * Public-website contract (apps/web-landing). Every operation the marketing site sends to or
 * reads from the ERP. Paths are supplied through `WebsiteRoutes` once the ERP team
 * publishes them; nothing is hard-coded here.
 */

// ── Contact & demo ────────────────────────────────────────────────────────
export type ContactTopic = "sales" | "support" | "partnership" | "careers";

export type ContactMessage = {
  topic: ContactTopic;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  message: string;
  source: "web";
};

export type DemoFormat = "online" | "onsite" | "showroom";

export type DemoRequest = {
  name: string;
  jobTitle?: string;
  email: string;
  whatsapp: string;
  organisation: string;
  industry?: string;
  interests: string[];
  sites?: string;
  dailyEntries?: string;
  format: DemoFormat;
  /** ISO date (YYYY-MM-DD) and 24h time in WIB. */
  date: string;
  time: string;
  source: "web";
};

export type Reference = { reference: string };

// ── Checkout ──────────────────────────────────────────────────────────────
export type DeliveryMethod = "standard" | "express" | "pickup";
export type CheckoutPaymentMethod = "va-bca" | "va-mandiri" | "qris" | "card" | "invoice";

export type CheckoutOrder = {
  items: { productSlug: string; quantity: number; options?: Record<string, string> }[];
  customer: { company?: string; name: string; email: string; phone: string; npwp?: string };
  shipping: { recipient: string; phone: string; address: string; city: string; postalCode: string; notes?: string };
  delivery: DeliveryMethod;
  installation: boolean;
  payment: CheckoutPaymentMethod;
  issueTaxInvoice: boolean;
  promoCode?: string;
  source: "web";
};

export type OrderConfirmation = {
  orderNumber: string;
  total: Money;
  paymentStatus: "awaiting_payment" | "pending_approval";
  /** Hosted payment page (VA instructions, QRIS, card form). Validated as https. */
  paymentUrl?: string;
  /** Virtual-account number or similar instruction shown on the confirmation step. */
  paymentInstruction?: { label: string; value: string; expiresAt?: string };
};

export type PromoQuote = { code: string; discount: Money; label: string } | null;

// ── Public order tracking (07.04) ─────────────────────────────────────────
export type TrackingStage = "received" | "paid" | "production" | "qc" | "shipped" | "installation" | "completed";

export type PublicTracking = {
  orderNumber: string;
  status: TrackingStage;
  statusLabel: string;
  placedLabel: string;
  customerName: string;
  itemCount: number;
  estimatedCompletionLabel: string;
  progress: number; // 0..1
  daysToCompletion: number;
  siteLabel: string;
  delivery: { windowLabel: string; installationLabel: string; onSchedule: boolean; daysToShip: number; daysToFinish: number };
  timeline: {
    stage: TrackingStage;
    title: string;
    description: string;
    state: "done" | "current" | "upcoming";
    dateLabel: string;
    progress?: { value: number; tasks: { label: string; state: "done" | "current" | "pending" }[] };
  }[];
  lastUpdatedLabel: string;
  items: { name: string; quantity: number; amount: Money; image?: string }[];
  totals: { subtotal: Money; installation: Money; tax: Money; total: Money; paymentNote: string };
  shipping: { address: string; courier: string; siteContact: string; installationTeam: string };
  documents: { name: string; meta: string; kind: "pdf" | "image" | "dwg" }[];
  projectManager: { name: string; whatsapp?: string; phone?: string };
};

// ── Customer-scoped checkout (login-gated, 03.03) ─────────────────────────
/**
 * Customer identity for checkout calls: the ERP session cookie (`name=value`, ADR-0024)
 * obtained through the Customer Portal sign-in hand-off. Held server-side in the website
 * session only and sent as the `Cookie` header.
 */
export type CustomerAuth = { sessionCookie: string; customerId: string };

export type CartLine = { productSlug: string; quantity: number; options?: Record<string, string> };

/** Authoritative order quote from the ERP: live prices, stock, tax, shipping and discounts. */
export type OrderQuote = {
  lines: {
    productSlug: string;
    quantity: number;
    unitPrice: Money;
    lineTotal: Money;
    /** `false` when the product is out of stock or can't be bought online. */
    available: boolean;
    note?: string;
  }[];
  subtotal: Money;
  discount: Money;
  discountLabel?: string;
  shipping: Money;
  installation: Money;
  tax: Money;
  total: Money;
  /** Opaque ERP quote id (or a website fingerprint) that placeOrder must match. */
  quoteId: string;
  expiresAt: string;
};

export type PaymentStatus = {
  orderNumber: string;
  status: "awaiting_payment" | "pending_approval" | "paid" | "expired" | "failed" | "cancelled";
  statusLabel: string;
  total: Money;
  paymentUrl?: string;
  paymentInstruction?: { label: string; value: string; expiresAt?: string };
  updatedAt: string;
};

// ── Source contract ───────────────────────────────────────────────────────
export interface WebsiteSource {
  /** `auth` links the RFQ to the signed-in customer; guests submit without it. */
  submitRfq(submission: RfqSubmission, attachments: File[], auth?: CustomerAuth): Promise<RfqReceipt>;
  sendContactMessage(message: ContactMessage): Promise<Reference>;
  requestDemo(request: DemoRequest): Promise<Reference>;
  applyPromo(code: string, subtotal: Money): Promise<PromoQuote>;
  /** The customer's server-side cart. */
  getCart(auth: CustomerAuth): Promise<CartLine[]>;
  /**
   * `merge` folds a guest cart in without duplicating lines (same product + options keep
   * the larger quantity, so repeating a merge is harmless); `replace` overwrites it.
   */
  syncCart(auth: CustomerAuth, lines: CartLine[], mode: "merge" | "replace"): Promise<CartLine[]>;
  /** Validates prices, stock, tax, shipping and discounts before an order is created. */
  quoteOrder(order: CheckoutOrder, auth: CustomerAuth): Promise<OrderQuote>;
  /** Creates the order and payment. `idempotencyKey` makes retries return the same order. */
  placeOrder(order: CheckoutOrder & { quoteId: string }, auth: CustomerAuth, idempotencyKey: string): Promise<OrderConfirmation>;
  getPaymentStatus(orderNumber: string, auth: CustomerAuth): Promise<PaymentStatus | null>;
  /** `contact` is the phone number or email on the order; both must match. */
  trackOrder(input: { orderNumber: string; contact: string }): Promise<PublicTracking | null>;
}

export type WebsiteRoutes = Partial<Record<keyof WebsiteSource, string>>;

export class WebsiteNotConfiguredError extends Error {
  constructor(operation: string) {
    super(`ERP route for "${operation}" is not configured.`);
    this.name = "WebsiteNotConfiguredError";
  }
}

const orderConfirmationSchema = z.object({
  orderNumber: z.string().min(1).max(64),
  total: z.number().nonnegative(),
  paymentStatus: z.enum(["awaiting_payment", "pending_approval"]),
  // The browser is sent here after placing the order.
  paymentUrl: httpsUrl.optional(),
  paymentInstruction: z.object({ label: z.string().max(80), value: z.string().max(80), expiresAt: z.string().max(40).optional() }).optional(),
}) satisfies z.ZodType<OrderConfirmation>;

const orderQuoteSchema = z.object({
  lines: z.array(
    z.object({
      productSlug: z.string().max(120),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      lineTotal: z.number().nonnegative(),
      available: z.boolean(),
      note: z.string().max(200).optional(),
    }),
  ),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  discountLabel: z.string().max(120).optional(),
  shipping: z.number().nonnegative(),
  installation: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  quoteId: z.string().min(1).max(128),
  expiresAt: z.string().max(40),
}) satisfies z.ZodType<OrderQuote>;

const paymentStatusSchema = z.object({
  orderNumber: z.string().min(1).max(64),
  status: z.enum(["awaiting_payment", "pending_approval", "paid", "expired", "failed", "cancelled"]),
  statusLabel: z.string().max(80),
  total: z.number().nonnegative(),
  paymentUrl: httpsUrl.optional(),
  paymentInstruction: z.object({ label: z.string().max(80), value: z.string().max(80), expiresAt: z.string().max(40).optional() }).optional(),
  updatedAt: z.string().max(40),
}) satisfies z.ZodType<PaymentStatus>;

export type ErpWebsiteConfig = {
  baseUrl: string;
  routes: WebsiteRoutes;
  /** Service token for server-to-server calls (the public site has no user session). */
  token?: string;
  fetcher?: typeof fetch;
} & Pick<ApiClientOptions, "timeoutMs" | "retries" | "unwrap" | "defaultHeaders">;

export function createErpWebsiteSource(config: ErpWebsiteConfig): WebsiteSource {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
    throw new Error("ERP base URL must use https.");
  }
  for (const [op, template] of Object.entries(config.routes)) {
    if (template && (!template.startsWith("/") || template.startsWith("//") || template.includes("://") || template.includes(".."))) {
      throw new Error(`ERP route "${op}" must be a relative path starting with "/".`);
    }
  }
  const client = createApiClient({
    baseUrl: config.baseUrl,
    token: config.token,
    fetcher: config.fetcher,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    unwrap: config.unwrap,
    defaultHeaders: config.defaultHeaders,
  });
  const path = (op: keyof WebsiteSource) => {
    const template = config.routes[op];
    if (!template) throw new WebsiteNotConfiguredError(op);
    return template;
  };
  const withFiles = (payload: unknown, files: File[], field: string) => {
    if (files.length === 0) return payload;
    const form = new FormData();
    form.set("payload", JSON.stringify(payload));
    files.forEach((file) => form.append(field, file, file.name));
    return form;
  };

  /**
   * The website key and the customer's session together: the ERP authorises the website and
   * attributes the request to the customer (a signed-in RFQ joins their account, ERP-0072).
   */
  const websiteForCustomer = (auth: CustomerAuth) =>
    createApiClient({
      baseUrl: config.baseUrl,
      token: config.token,
      sessionCookie: auth.sessionCookie,
      fetcher: config.fetcher,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      unwrap: config.unwrap,
      defaultHeaders: config.defaultHeaders,
    });

  /** Same base URL and transport, but authenticated as the customer instead of the service. */
  const customerClient = (auth: CustomerAuth) =>
    createApiClient({
      baseUrl: config.baseUrl,
      sessionCookie: auth.sessionCookie,
      fetcher: config.fetcher,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      unwrap: config.unwrap,
      defaultHeaders: config.defaultHeaders,
    });

  return {
    submitRfq: (submission, attachments, auth) =>
      (auth ? websiteForCustomer(auth) : client).post(path("submitRfq"), withFiles(submission, attachments, "attachments"), { idempotencyKey: crypto.randomUUID() }),
    sendContactMessage: (message) => client.post(path("sendContactMessage"), message),
    requestDemo: (request) => client.post(path("requestDemo"), request, { idempotencyKey: crypto.randomUUID() }),
    async applyPromo(code, subtotal) {
      try {
        return await client.post(path("applyPromo"), { code, subtotal });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 422)) return null;
        throw error;
      }
    },
    getCart: (auth) => customerClient(auth).get(path("getCart")),
    syncCart: (auth, lines, mode) => customerClient(auth).post(path("syncCart"), { lines, mode }),
    async quoteOrder(order, auth) {
      return parseOrThrow("quoteOrder", orderQuoteSchema, await customerClient(auth).post(path("quoteOrder"), order));
    },
    async placeOrder(order, auth, idempotencyKey) {
      const confirmation = await customerClient(auth).post(path("placeOrder"), order, { idempotencyKey });
      return parseOrThrow("placeOrder", orderConfirmationSchema, confirmation);
    },
    async getPaymentStatus(orderNumber, auth) {
      try {
        const body = await customerClient(auth).get(path("getPaymentStatus").replace(":orderNumber", encodeURIComponent(orderNumber)));
        return parseOrThrow("getPaymentStatus", paymentStatusSchema, body);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
        throw error;
      }
    },
    async trackOrder(input) {
      try {
        return await client.post(path("trackOrder"), input);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
        throw error;
      }
    },
  };
}

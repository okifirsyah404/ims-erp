import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
import { z } from "astro/zod";
import { ApiError } from "@/api/client";
import { ErpContractError } from "@/api/contract-schemas";
import { WebsiteNotConfiguredError, type CheckoutOrder, type OrderConfirmation } from "@/api/website";
import { type RfqSubmission } from "@/api/rfq";
import { getCustomer, toAuth } from "../lib/server/auth";
import { getSolutions } from "../lib/server/content/solutions";
import { getProductsBySlugs } from "../lib/catalog";
import { website, websiteMode } from "../lib/server/website";
import { isIndonesianPhone, normalizeIndonesianPhone } from "../lib/phone";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = /\.(pdf|dwg|jpe?g|png)$/i;
/** Indonesian phone (08… / +628… / landline), normalised to +62… for the ERP. */
const phone = z
  .string()
  .trim()
  .max(24)
  .refine((value) => isIndonesianPhone(value), "Enter a valid Indonesian number, e.g. 0812 3456 7890 or +62 812 3456 7890")
  .transform(normalizeIndonesianPhone);
/** WhatsApp must be a mobile number. */
const whatsapp = z
  .string()
  .trim()
  .max(24)
  .refine((value) => isIndonesianPhone(value, { mobile: true }), "Enter a WhatsApp mobile number, e.g. 0812 3456 7890")
  .transform(normalizeIndonesianPhone);

/** Fields shared by checkout review and place order (03.03 wizard steps 1–4). */
const orderInput = z.object({
  item: z.array(z.string().max(120)).min(1, "Your cart is empty").max(50),
  qty: z.array(z.coerce.number().int().min(1).max(999)),
  item_options: z.array(z.string().max(500)).optional(),
  company: z.string().trim().max(160).optional(),
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email address").max(160),
  phone,
  npwp: z
    .string()
    .trim()
    .regex(/^[0-9.\-]{15,20}$/, "Enter a valid NPWP")
    .optional(),
  recipient: z.string().trim().min(2, "Enter the recipient").max(120),
  ship_phone: phone,
  address: z.string().trim().min(8, "Enter the full street address").max(300),
  city: z.string().trim().min(2, "Enter the city").max(80),
  postal_code: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit postal code"),
  ship_notes: z.string().trim().max(300).optional(),
  delivery: z.enum(["standard", "express", "pickup"]),
  installation: z.boolean().default(false),
  payment: z.enum(["va-bca", "va-mandiri", "qris", "card", "invoice"]),
  tax_invoice: z.boolean().default(false),
  promo: z.string().trim().max(40).optional(),
});

type OrderInput = z.infer<typeof orderInput>;

function buildOrder(input: OrderInput): CheckoutOrder {
  if (input.qty.length !== input.item.length) {
    throw new ActionError({ code: "BAD_REQUEST", message: "Each product needs a quantity." });
  }
  if (input.tax_invoice && !input.npwp) {
    throw new ActionError({ code: "BAD_REQUEST", message: "Enter your company NPWP to receive a Faktur Pajak." });
  }
  return {
    items: input.item.map((slug, index) => ({ productSlug: slug, quantity: input.qty[index]!, options: parseOptions(input.item_options?.[index]) })),
    customer: { company: input.company, name: input.name, email: input.email, phone: input.phone, npwp: input.npwp },
    shipping: { recipient: input.recipient, phone: input.ship_phone, address: input.address, city: input.city, postalCode: input.postal_code, notes: input.ship_notes },
    delivery: input.delivery,
    installation: input.installation,
    payment: input.payment,
    issueTaxInvoice: input.tax_invoice,
    promoCode: input.promo || undefined,
    source: "web",
  };
}

/** What the price depends on — placeOrder must match the reviewed quote exactly. */
const fingerprintOrder = (order: CheckoutOrder) =>
  JSON.stringify({ items: order.items, delivery: order.delivery, installation: order.installation, promo: order.promoCode ?? null, payment: order.payment });

/** Orders being placed right now, so concurrent submits of the same key share one call. */
const inflightOrders: Map<string, Promise<OrderConfirmation>> = ((globalThis as { __egInflightOrders?: Map<string, Promise<OrderConfirmation>> }).__egInflightOrders ??= new Map());

/** Checkout requires the customer signed in through the portal hand-off (server-checked). */
async function requireCustomer(context: ActionAPIContext) {
  const customer = await getCustomer(context.session);
  if (!customer) throw new ActionError({ code: "UNAUTHORIZED", message: "Please sign in to your Entragate account to continue checkout." });
  return customer;
}

/**
 * Public-website mutations. Each forwards to the ERP through `website` (a demo source in
 * development). Optional fields stay top-level `.optional()` so Astro's form parser maps
 * absent/empty values to `undefined`.
 */
export const server = {
  rfq: {
    /**
     * 03.02 RFQ & Pricing — open to guests (no login). When the visitor is signed in through
     * the portal hand-off, the RFQ is linked to their account; guest RFQs are linked later
     * only after the owner verifies the RFQ's email in the Customer Portal.
     */
    submit: defineAction({
      accept: "form",
      input: z.object({
        company_name: z.string().trim().max(160).optional(),
        contact_name: z.string().trim().min(2, "Enter your name").max(120),
        email: z.email("Enter a valid email address").max(160),
        phone: whatsapp,
        site_name: z.string().trim().max(160).optional(),
        site_location: z.string().trim().min(2, "Enter the project location").max(160),
        target_installation: z.string().trim().max(80).optional(),
        budget_range: z.string().trim().max(120).optional(),
        project_type: z.enum(["new-installation", "upgrade", "multi-site", "government"]),
        item: z.array(z.string().max(120)).max(50).default([]),
        qty: z.array(z.coerce.number().int().min(1).max(999)).default([]),
        item_options: z.array(z.string().max(500)).optional(),
        solutions: z.array(z.string().max(60)).max(6).default([]),
        notes: z.string().trim().min(10, "Describe your requirements (at least 10 characters)").max(2000),
        send_copy: z.boolean().default(false),
        attachments: z
          .array(z.instanceof(File))
          .transform((files) => files.filter((file) => file.size > 0))
          .refine((files) => files.length <= 10, "Attach up to 10 files")
          .refine((files) => files.every((file) => file.size <= MAX_FILE_BYTES), "Each file must be 25 MB or smaller")
          .refine((files) => files.every((file) => ALLOWED_TYPES.test(file.name)), "Use PDF, DWG, JPG or PNG files"),
      }),
      handler: async (input, context) => {
        if (input.qty.length !== input.item.length) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Each product needs a quantity." });
        }
        if (input.item.length === 0 && input.solutions.length === 0) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Add at least one product or software solution to quote." });
        }
        const solutionSlugs = new Set((await getSolutions()).platforms.map((p) => p.slug));
        if (input.solutions.some((slug) => !solutionSlugs.has(slug))) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Some software solutions are no longer available." });
        }
        const customer = await getCustomer(context.session);
        const known = new Set((await getProductsBySlugs(input.item)).map((p) => p.slug));
        if (input.item.some((slug) => !known.has(slug))) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Some products are no longer available." });
        }

        const submission: RfqSubmission = {
          company: { name: input.company_name || undefined, contactName: input.contact_name, email: input.email, phone: input.phone },
          project: {
            siteName: input.site_name || undefined,
            siteLocation: input.site_location,
            targetInstallation: input.target_installation || undefined,
            budgetRange: input.budget_range || undefined,
            type: input.project_type,
          },
          items: input.item.map((slug, index) => ({
            productSlug: slug,
            quantity: input.qty[index],
            options: parseOptions(input.item_options?.[index]),
          })),
          solutions: input.solutions.length ? input.solutions : undefined,
          notes: input.notes,
          sendCopyToPortal: input.send_copy,
          source: "web",
        };

        return call("rfq", () => website.submitRfq(submission, input.attachments, customer ? toAuth(customer) : undefined), {
          notConnected: "Online quotation requests are not connected yet. Please contact sales by phone or WhatsApp.",
          failed: "We couldn't send your request right now. Please try again or contact sales.",
        });
      },
    }),
  },

  contact: {
    /** 09.02 Contact · Send us a message. */
    send: defineAction({
      accept: "form",
      input: z.object({
        topic: z.enum(["sales", "support", "partnership", "careers"]).default("sales"),
        name: z.string().trim().min(2, "Enter your name").max(120),
        company: z.string().trim().max(160).optional(),
        email: z.email("Enter a valid email address").max(160),
        phone: phone.optional(),
        message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(3000),
      }),
      handler: async (input) =>
        call("contact", () => website.sendContactMessage({ ...input, source: "web" }), {
          notConnected: "Online messages are not connected yet. Please call or WhatsApp our sales team.",
          failed: "We couldn't send your message right now. Please try again or reach us on WhatsApp.",
        }),
    }),
  },

  demo: {
    /** 02.05 Request Software Demo. */
    request: defineAction({
      accept: "form",
      input: z.object({
        name: z.string().trim().min(2, "Enter your name").max(120),
        job_title: z.string().trim().max(120).optional(),
        email: z.email("Enter a valid work email").max(160),
        whatsapp,
        organisation: z.string().trim().min(2, "Enter your organisation").max(160),
        industry: z.string().trim().max(80).optional(),
        interests: z.array(z.string().max(60)).max(12).default([]),
        sites: z.string().trim().max(60).optional(),
        daily_entries: z.string().trim().max(60).optional(),
        format: z.enum(["online", "onsite", "showroom"]).default("online"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
        time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
        consent: z.boolean().refine((value) => value, "Please agree to be contacted about this request"),
      }),
      handler: async (input) => {
        if (Date.parse(`${input.date}T23:59:59+07:00`) < Date.now()) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Please pick a date in the future." });
        }
        return call(
          "demo",
          () =>
            website.requestDemo({
              name: input.name,
              jobTitle: input.job_title,
              email: input.email,
              whatsapp: input.whatsapp,
              organisation: input.organisation,
              industry: input.industry,
              interests: input.interests,
              sites: input.sites,
              dailyEntries: input.daily_entries,
              format: input.format,
              date: input.date,
              time: input.time,
              source: "web",
            }),
          {
            notConnected: "Online demo booking is not connected yet. Please WhatsApp us to book a slot.",
            failed: "We couldn't book your demo right now. Please try again or WhatsApp us.",
          },
        );
      },
    }),
  },

  checkout: {
    /** 03.03 Checkout · promo code check (null when the code is not valid). */
    applyPromo: defineAction({
      accept: "json",
      input: z.object({ code: z.string().trim().min(2).max(40), subtotal: z.number().int().min(0).max(100_000_000_000) }),
      handler: async (input) =>
        call("promo", () => website.applyPromo(input.code, input.subtotal), {
          notConnected: "Promo codes can't be checked online yet.",
          failed: "We couldn't check that code right now.",
        }),
    }),

    /** 03.03 Checkout · step 5 Review: server-validated quote (ERP prices, stock, tax, shipping, discounts). */
    review: defineAction({
      accept: "form",
      input: orderInput,
      handler: async (input, context) => {
        const customer = await requireCustomer(context);
        const order = buildOrder(input);
        const quote = await call("checkout.review", () => website.quoteOrder(order, toAuth(customer)), {
          notConnected: "Online checkout is not connected yet. Request a quotation and our sales team will invoice you.",
          failed: "We couldn't confirm prices and stock right now. Please try again.",
        });
        context.session?.set("checkoutQuote", { quote, fingerprint: fingerprintOrder(order) });
        return quote;
      },
    }),

    /**
     * 03.03 Checkout · place order. Requires the signed-in customer, a quote from `review`
     * that still matches live ERP pricing, and an idempotency key — retries and double
     * clicks return the first order instead of creating another one.
     */
    placeOrder: defineAction({
      accept: "form",
      input: orderInput.extend({
        terms: z.boolean().refine((value) => value, "Please accept the terms of sale"),
        quote_id: z.string().min(1).max(128),
        idempotency_key: z.string().regex(/^[0-9a-f-]{36}$/i, "Reload the checkout and try again"),
      }),
      handler: async (input, context) => {
        const customer = await requireCustomer(context);
        const session = context.session!;
        const key = `${customer.id}:${input.idempotency_key}`;

        // Claim the key synchronously (before any await) so concurrent submits share one call.
        const running = inflightOrders.get(key);
        if (running) return { ...(await running), duplicate: true };
        let release!: (value: OrderConfirmation | PromiseLike<OrderConfirmation>) => void;
        let fail!: (reason: unknown) => void;
        const claim = new Promise<OrderConfirmation>((resolve, reject) => ((release = resolve), (fail = reject)));
        claim.catch(() => undefined);
        inflightOrders.set(key, claim);

        const work = (async () => {
          const placed = (await session.get("placedOrders")) ?? {};
          if (placed[input.idempotency_key]) return { ...placed[input.idempotency_key]!, duplicate: true };
          const order = buildOrder(input);
          const stored = await session.get("checkoutQuote");
          if (!stored || stored.quote.quoteId !== input.quote_id || stored.fingerprint !== fingerprintOrder(order)) {
            throw new ActionError({ code: "CONFLICT", message: "Your order changed since the review. Please review it again before paying." });
          }
          if (Date.parse(stored.quote.expiresAt) < Date.now()) {
            throw new ActionError({ code: "CONFLICT", message: "This review expired. Please review your order again to refresh prices and stock." });
          }
          // Re-check live pricing and stock right before creating the order.
          const fresh = await call("checkout.requote", () => website.quoteOrder(order, toAuth(customer)), {
            notConnected: "Online checkout is not connected yet. Request a quotation and our sales team will invoice you.",
            failed: "We couldn't confirm prices and stock right now. Nothing was charged — please try again.",
          });
          if (fresh.lines.some((l) => !l.available)) {
            session.set("checkoutQuote", { quote: fresh, fingerprint: fingerprintOrder(order) });
            throw new ActionError({ code: "CONFLICT", message: "Some items are no longer available. Please review your order again." });
          }
          if (fresh.total !== stored.quote.total) {
            session.set("checkoutQuote", { quote: fresh, fingerprint: fingerprintOrder(order) });
            throw new ActionError({ code: "CONFLICT", message: "Prices changed since your review. Please check the new total and confirm again." });
          }
          const confirmation = await call(
            "checkout",
            () => website.placeOrder({ ...order, quoteId: fresh.quoteId }, toAuth(customer), input.idempotency_key),
            {
              notConnected: "Online checkout is not connected yet. Request a quotation and our sales team will invoice you.",
              failed: "We couldn't place your order right now. Nothing was charged — please try again.",
            },
          );
          const result = { ...confirmation, total: confirmation.total || fresh.total };
          session.set("placedOrders", { ...((await session.get("placedOrders")) ?? {}), [input.idempotency_key]: result });
          session.delete("checkoutQuote");
          // Purchased lines leave the account cart; quote-only items stay for an RFQ.
          const remaining = (await website.getCart(toAuth(customer)).catch(() => [])).filter(
            (line) => !order.items.some((i) => i.productSlug === line.productSlug && JSON.stringify(i.options ?? {}) === JSON.stringify(line.options ?? {})),
          );
          await website.syncCart(toAuth(customer), remaining, "replace").catch(() => undefined);
          return result;
        })();
        // Success: keep the result briefly for late duplicates. Failure: free the key for a retry.
        work.then(
          (value) => (release(value), setTimeout(() => inflightOrders.delete(key), 60_000)),
          (error) => (fail(error), inflightOrders.delete(key)),
        );
        return await work;
      },
    }),

    /** 03.03 Checkout · step 6 Payment status (only for the customer's own orders). */
    paymentStatus: defineAction({
      accept: "json",
      input: z.object({ orderNumber: z.string().trim().min(3).max(64) }),
      handler: async (input, context) => {
        const customer = await requireCustomer(context);
        const status = await call("checkout.status", () => website.getPaymentStatus(input.orderNumber, toAuth(customer)), {
          notConnected: "Payment status isn't available online yet. Check the Customer Portal or contact us.",
          failed: "We couldn't load the payment status. Please try again.",
        });
        if (!status) throw new ActionError({ code: "NOT_FOUND", message: "We couldn't find that order on your account." });
        return status;
      },
    }),
  },

  cart: {
    /**
     * Copies the browser cart to the signed-in customer's account cart. `merge` right after
     * sign-in (no duplicates), `replace` afterwards. Prices are never taken from the browser.
     */
    sync: defineAction({
      accept: "json",
      input: z.object({
        mode: z.enum(["merge", "replace"]),
        lines: z
          .array(
            z.object({
              slug: z.string().min(1).max(120),
              qty: z.number().int().min(1).max(999),
              options: z.record(z.string().max(60), z.string().max(120)).optional(),
            }),
          )
          .max(50),
      }),
      handler: async (input, context) => {
        const customer = await requireCustomer(context);
        const known = new Set((await getProductsBySlugs(input.lines.map((l) => l.slug))).map((p) => p.slug));
        const lines = input.lines
          .filter((l) => known.has(l.slug))
          .map((l) => ({ productSlug: l.slug, quantity: l.qty, options: l.options }));
        const merged = await call("cart.sync", () => website.syncCart(toAuth(customer), lines, input.mode), {
          notConnected: "Your account cart isn't connected yet.",
          failed: "We couldn't save your cart to your account. Your cart is still on this device.",
        });
        return merged.map((l) => ({ slug: l.productSlug, qty: l.quantity, options: l.options }));
      },
    }),
  },

  tracking: {
    /** 07.04 Public Tracking Entry. POST keeps the phone/email out of URLs and logs. */
    lookup: defineAction({
      accept: "form",
      input: z.object({
        order_number: z.string().trim().min(6, "Enter your order number").max(40),
        contact: z.string().trim().min(4, "Enter the phone or email on the order").max(160),
      }),
      handler: async (input) => {
        const result = await call("tracking", () => website.trackOrder({ orderNumber: input.order_number, contact: input.contact }), {
          notConnected: "Online tracking is not connected yet. Please log in to the Customer Portal or contact us.",
          failed: "We couldn't look up that order right now. Please try again.",
        });
        if (!result) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "We couldn't find an order with those details. Check the order number and the phone or email used at checkout.",
          });
        }
        return result;
      },
    }),
  },
};

/** Maps upstream failures to user-facing action errors; details stay in the server log. */
async function call<T>(scope: string, fn: () => Promise<T>, messages: { notConnected: string; failed: string }): Promise<T> {
  try {
    const result = await fn();
    // Demo mode accepts submissions locally; the UI must not present them as sent.
    return result && typeof result === "object" && !Array.isArray(result) && websiteMode === "demo" ? ({ ...result, demo: true } as T) : result;
  } catch (error) {
    if (error instanceof ActionError) throw error;
    if (error instanceof WebsiteNotConfiguredError) {
      throw new ActionError({ code: "SERVICE_UNAVAILABLE", message: messages.notConnected });
    }
    if (error instanceof ApiError && error.status === 401) {
      // Customer token revoked or expired at the ERP (e.g. signed out in the portal).
      throw new ActionError({ code: "UNAUTHORIZED", message: "Your session has ended. Please sign in again." });
    }
    if (error instanceof ApiError) {
      console.error(`[${scope}] ERP ${error.status || "network"} error`, { requestId: error.requestId, messages: error.messages });
      if ([400, 409, 422].includes(error.status) && error.messages[0]) {
        throw new ActionError({ code: "BAD_REQUEST", message: error.messages[0].slice(0, 200) });
      }
    } else if (error instanceof ErpContractError) {
      console.error(`[${scope}] ERP contract mismatch`, error.issues.slice(0, 10));
    } else {
      console.error(`[${scope}] unexpected error`, error);
    }
    throw new ActionError({ code: "BAD_GATEWAY", message: messages.failed });
  }
}

function parseOptions(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [String(k), String(v)]));
    }
  } catch {
    // Ignore malformed option payloads; the product itself is still listed.
  }
  return undefined;
}

import { type CartLine, type OrderConfirmation, type PublicTracking, type WebsiteSource } from "@/api/website";
import { computeTotals } from "../../../data/checkout";
import { demoCatalogSource } from "../catalog/demo";
import { images } from "../../images";

/**
 * DEMO DATA SOURCE — used when WEB_DATA_SOURCE=demo (the default in development).
 * Accepts submissions without contacting anyone and returns sample references, so every
 * form on the site can be exercised end to end before the ERP endpoints exist.
 */

export const DEMO_TRACKING = { orderNumber: "ENT-2026-10-04817", contact: "8821" } as const;
export const DEMO_PROMO = { code: "ENTRA-Q4", discount: 2_000_000 } as const;

const reference = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90_000) + 10_000)}`;

/** Sample order from the approved 07.04 frame. */
const sampleTracking: PublicTracking = {
  orderNumber: DEMO_TRACKING.orderNumber,
  status: "production",
  statusLabel: "In Production",
  placedLabel: "Placed 02 Oct 2026",
  customerName: "PT Graha Sentosa Fitness",
  itemCount: 3,
  estimatedCompletionLabel: "14 Nov 2026",
  progress: 0.38,
  daysToCompletion: 26,
  siteLabel: "Jakarta Selatan",
  delivery: { windowLabel: "03 – 05 Nov 2026", installationLabel: "Installation scheduled 10 – 12 Nov", onSchedule: true, daysToShip: 15, daysToFinish: 26 },
  timeline: [
    { stage: "received", title: "Order Received", description: "Order confirmed by our sales team and project ID assigned.", state: "done", dateLabel: "02 Oct 2026 · 09:14" },
    { stage: "paid", title: "Payment Confirmed", description: "Down payment of 50% received via BCA Virtual Account.", state: "done", dateLabel: "03 Oct 2026 · 15:40" },
    {
      stage: "production",
      title: "In Production",
      description: "Flap barrier cabinets are being fabricated and wired at our Bekasi workshop.",
      state: "current",
      dateLabel: "Started 06 Oct 2026",
      progress: {
        value: 0.65,
        tasks: [
          { label: "Cabinet fabrication", state: "done" },
          { label: "Motor & sensor wiring", state: "done" },
          { label: "Terminal mounting", state: "current" },
          { label: "Firmware flashing", state: "pending" },
        ],
      },
    },
    { stage: "qc", title: "Quality Control", description: "72-hour burn-in test, face recognition calibration and safety checks.", state: "upcoming", dateLabel: "Est. 28 Oct 2026" },
    { stage: "shipped", title: "Shipped", description: "Dispatched by Entragate Logistics with full insurance and tracking.", state: "upcoming", dateLabel: "Est. 03 Nov 2026" },
    { stage: "installation", title: "Installation", description: "Certified technicians install, configure and integrate with your software.", state: "upcoming", dateLabel: "Est. 10–12 Nov 2026" },
    { stage: "completed", title: "Completed", description: "Handover, admin training and 2-year warranty activation.", state: "upcoming", dateLabel: "Est. 14 Nov 2026" },
  ],
  lastUpdatedLabel: "Last updated 19 Oct 2026, 10:24 WIB",
  items: [
    { name: "Flap Barrier FB-300 Dual Lane", quantity: 4, amount: 186_000_000, image: images.flapBarrier },
    { name: "Face Recognition Terminal FR-8", quantity: 4, amount: 54_000_000, image: images.faceTerminal },
    { name: "Access Controller AC-4 Door", quantity: 1, amount: 8_500_000, image: images.accessController },
  ],
  totals: { subtotal: 248_500_000, installation: 12_000_000, tax: 28_655_000, total: 289_155_000, paymentNote: "50% paid · balance due before shipping" },
  shipping: {
    address: "Graha Sentosa Fitness, Jl. TB Simatupang Kav. 18, Cilandak, Jakarta Selatan 12430",
    courier: "Entragate Logistics · Insured freight",
    siteContact: "Bpk. Hendra Wijaya · +62 812-xxxx-8821",
    installationTeam: "Team Jakarta 2 · 3 certified technicians",
  },
  documents: [
    { name: "Quotation", meta: "QTN-0917 · PDF", kind: "pdf" },
    { name: "Invoice (DP 50%)", meta: "INV-2210 · PDF", kind: "pdf" },
    { name: "Production photos", meta: "12 images", kind: "image" },
    { name: "Technical drawing", meta: "DWG · 2.4 MB", kind: "dwg" },
  ],
  projectManager: { name: "Rina Kusuma", whatsapp: "6281280002020", phone: "+622188992020" },
};

const normalize = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();

/** In-memory demo state, on globalThis so actions and pages share it in `astro dev`. */
type DemoState = {
  carts: Map<string, CartLine[]>;
  orders: Map<string, { customerId: string; confirmation: OrderConfirmation }>;
  byKey: Map<string, OrderConfirmation>;
};
const globalDemo = globalThis as typeof globalThis & { __entragateWebDemo?: DemoState };
const demoState: DemoState = (globalDemo.__entragateWebDemo ??= { carts: new Map(), orders: new Map(), byKey: new Map() });
demoState.byKey ??= new Map();

const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).toUpperCase();
};

export const demoWebsiteSource: WebsiteSource = {
  async submitRfq(_submission, _attachments, auth) {
    return { reference: reference("RFQ"), linkedToAccount: Boolean(auth) };
  },
  async sendContactMessage() {
    return { reference: reference("MSG") };
  },
  async requestDemo() {
    return { reference: reference("DMO") };
  },
  async applyPromo(code) {
    return normalize(code) === normalize(DEMO_PROMO.code) ? { code: DEMO_PROMO.code, discount: DEMO_PROMO.discount, label: `Promo ${DEMO_PROMO.code}` } : null;
  },
  async getCart(auth) {
    return structuredClone(demoState.carts.get(auth.customerId) ?? []);
  },
  async syncCart(auth, lines, mode) {
    const key = (l: CartLine) => `${l.productSlug}|${JSON.stringify(l.options ?? {})}`;
    const current = mode === "merge" ? (demoState.carts.get(auth.customerId) ?? []) : [];
    const merged = new Map(current.map((l) => [key(l), { ...l }]));
    for (const line of lines) {
      const existing = merged.get(key(line));
      // Same product + options → one line with the larger quantity (idempotent merge).
      if (existing) existing.quantity = Math.max(existing.quantity, line.quantity);
      else merged.set(key(line), { ...line });
    }
    const next = [...merged.values()].filter((l) => l.quantity > 0).slice(0, 50);
    demoState.carts.set(auth.customerId, next);
    return structuredClone(next);
  },
  async quoteOrder(order) {
    // Sample catalog prices + the published checkout rules (no live ERP pricing in demo).
    const priced = await demoCatalogSource.priceCart(order.items.map((i) => ({ productSlug: i.productSlug, quantity: i.quantity, options: i.options })));
    const promo = order.promoCode ? await demoWebsiteSource.applyPromo(order.promoCode, priced.subtotal) : null;
    const totals = computeTotals({ subtotal: priced.subtotal, discount: promo?.discount ?? 0, delivery: order.delivery, installation: order.installation });
    const lines = priced.lines.map((l) => ({
      productSlug: l.productSlug,
      quantity: l.quantity,
      unitPrice: l.unitPrice ?? 0,
      lineTotal: l.lineTotal,
      available: l.available && l.unitPrice !== null,
      note: l.unitPrice === null ? "Project pricing — request a quotation" : l.available ? undefined : "Out of stock",
    }));
    const fingerprint = JSON.stringify({ lines, totals, delivery: order.delivery, installation: order.installation, promo: promo?.code });
    return {
      lines,
      ...totals,
      discountLabel: promo?.label,
      quoteId: `DEMO-Q-${hash(fingerprint)}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  },
  async placeOrder(order, auth, idempotencyKey) {
    // Like the ERP's Idempotency-Key handling: the same key always returns the same order.
    const replay = demoState.byKey.get(`${auth.customerId}:${idempotencyKey}`);
    if (replay) return replay;
    const orderNumber = reference("ENT");
    const invoice = order.payment === "invoice";
    const quote = await demoWebsiteSource.quoteOrder(order, auth);
    const confirmation = {
      orderNumber,
      total: quote.total,
      paymentStatus: invoice ? ("pending_approval" as const) : ("awaiting_payment" as const),
      // Sample instruction only — no virtual account or payment is created in demo mode.
      paymentInstruction: order.payment.startsWith("va-")
        ? { label: `${order.payment === "va-bca" ? "BCA" : "Mandiri"} Virtual Account (sample)`, value: `8808 ${orderNumber.replace(/\D/g, "").slice(-8)}` }
        : undefined,
    };
    demoState.orders.set(orderNumber, { customerId: auth.customerId, confirmation });
    demoState.byKey.set(`${auth.customerId}:${idempotencyKey}`, confirmation);
    return confirmation;
  },
  async getPaymentStatus(orderNumber, auth) {
    const entry = demoState.orders.get(orderNumber);
    if (!entry || entry.customerId !== auth.customerId) return null;
    const { confirmation } = entry;
    return {
      orderNumber,
      status: confirmation.paymentStatus,
      // Demo never marks an order as paid: there is no payment gateway behind it.
      statusLabel: confirmation.paymentStatus === "pending_approval" ? "Awaiting credit approval" : "Awaiting payment",
      total: confirmation.total,
      paymentInstruction: confirmation.paymentInstruction,
      updatedAt: new Date().toISOString(),
    };
  },
  async trackOrder({ orderNumber, contact }) {
    const matchesOrder = normalize(orderNumber) === normalize(DEMO_TRACKING.orderNumber);
    const matchesContact = normalize(contact).endsWith(DEMO_TRACKING.contact);
    return matchesOrder && matchesContact ? sampleTracking : null;
  },
};

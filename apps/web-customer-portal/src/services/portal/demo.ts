import { type AccountSettings, type AuthTokens, type OrderDetail, type PortalSource, type ProjectDetail, type TicketDetail, type TicketMessage, type WishlistItem, type RfqSummary, type SignedInDevice } from "@/api/portal";
import * as data from "./demo-data";
import * as accountData from "./demo-account";

/**
 * In-memory demo implementation of `PortalSource`, backed by the design fixtures.
 * Mutations live for the process lifetime only. Enabled by default in development;
 * see `./index.ts` for how the source is selected.
 */

export const DEMO_CREDENTIALS = { email: data.demoUser.email, password: "entragate-demo" };
const DEMO_OTP = "482913";
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type DemoState = {
  attempts: Map<string, { count: number; lockedUntil?: number }>;
  quotationStatus: Map<string, "accepted" | "revised">;
  messages: Map<string, TicketMessage[]>;
  createdTickets: TicketDetail[];
  registered: Set<string>;
  paidInvoices: Set<string>;
  account: AccountSettings;
  wishlist: WishlistItem[];
  claimedRfqs: RfqSummary[];
  rfqClaims: Map<string, { expires: number }>;
  devices: SignedInDevice[];
};

/**
 * Kept on globalThis: in `astro dev`, actions and pages can load separate module
 * instances, and the demo must behave like one shared backend across both.
 */
const globalDemo = globalThis as typeof globalThis & { __entragateDemoState?: DemoState };
const state: DemoState = (globalDemo.__entragateDemoState ??= {
  attempts: new Map(),
  quotationStatus: new Map(),
  messages: new Map(),
  createdTickets: [],
  registered: new Set(),
  paidInvoices: new Set(),
  account: structuredClone(accountData.account),
  wishlist: [...accountData.wishlist],
  claimedRfqs: [],
  rfqClaims: new Map(),
  devices: [
    { id: "demo-this", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0", ipAddress: "127.0.0.1", createdAt: "2026-11-20T01:00:00.000Z", updatedAt: "2026-11-20T03:00:00.000Z", current: true },
    { id: "demo-phone", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1", ipAddress: "10.0.0.8", createdAt: "2026-11-12T08:00:00.000Z", updatedAt: "2026-11-18T09:30:00.000Z", current: false },
  ],
});

// Short-lived access token + refresh token, mirroring the ERP flow so refresh is exercised in demo mode.
const tokens = (): AuthTokens => ({
  sessionCookie: `demo_session=demo.${crypto.randomUUID()}`,
  refreshToken: `demo-refresh.${crypto.randomUUID()}`,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
});

const time = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function quotationList() {
  return data.quotations.map((q) => {
    const override = state.quotationStatus.get(q.id);
    if (override === "accepted") return { ...q, status: "accepted" as const, meta: "Accepted just now", expiresInDays: undefined };
    if (override === "revised") return { ...q, status: "revised" as const, meta: "Revision requested", version: q.version };
    return q;
  });
}

function ticketList() {
  return [...state.createdTickets, ...data.tickets];
}

function genericOrderDetail(id: string): OrderDetail | null {
  const summary = data.orders.find((o) => o.id === id);
  if (!summary) return null;
  const known = data.orderDetails[id];
  if (known) return { ...summary, ...known };
  const steps = ["Order confirmed", "Payment verified", "Production & quality check", "Shipped", "Delivery & installation"];
  return {
    ...summary,
    arrivalLabel: summary.status === "delivered" ? "Delivered 18 Oct" : `Expected ${summary.etaLabel.replace("ETA ", "")}`,
    arrivalWindow: summary.stepLabel,
    lines: [{ name: summary.title, detail: "See quotation for itemised scope", quantity: 1, amount: summary.total }],
    delivery: { site: "Grand Indonesia Tower B", address: "Jl. M.H. Thamrin No.1, Jakarta Pusat", courier: "Entragate Logistics", awb: "—" },
    payment: { subtotal: summary.total, tax: Math.round(summary.total * 0.11), total: Math.round(summary.total * 1.11) },
    documents: [],
    timeline: steps.map((title, index) => ({
      title,
      dateLabel: index + 1 < summary.step ? "Done" : index + 1 === summary.step ? "Now" : "—",
      state: index + 1 < summary.step ? "done" : index + 1 === summary.step ? (summary.progress >= 1 ? "done" : "current") : "upcoming",
    })),
  };
}

export const demoSource: PortalSource = {
  async login({ email, password }) {
    const key = email.trim().toLowerCase();
    const entry = state.attempts.get(key) ?? { count: 0 };
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
      return { ok: false, reason: "locked", lockedUntil: new Date(entry.lockedUntil).toISOString() };
    }
    if (key === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
      state.attempts.delete(key);
      return { ok: true, user: data.demoUser, tokens: tokens() };
    }
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCK_MINUTES * 60_000;
    state.attempts.set(key, entry);
    if (entry.lockedUntil) return { ok: false, reason: "locked", lockedUntil: new Date(entry.lockedUntil).toISOString() };
    return { ok: false, reason: "invalid_credentials", attemptsLeft: MAX_ATTEMPTS - entry.count };
  },
  async register(input) {
    return { email: input.email };
  },
  async verifyEmail({ code }) {
    return code === DEMO_OTP ? { user: data.demoUser, tokens: tokens() } : null;
  },
  async resendVerification() {},
  async requestPasswordReset() {},
  async resetPassword({ password }) {
    return password.length >= 12;
  },
  async logout() {},
  async refreshSession(refreshToken) {
    return refreshToken.startsWith("demo-refresh.") ? tokens() : null;
  },
  async completeOnboarding() {},

  async getHome() {
    const quotations = quotationList().filter((q) => q.status === "needs_approval" || q.status === "revised");
    const openTickets = ticketList().filter((t) => t.status !== "resolved");
    return {
      ...data.home,
      quotations,
      openTickets,
      unreadNotifications: data.notifications.filter((n) => n.unread).length,
    };
  },
  async listNotifications() {
    return data.notifications;
  },
  async listOrders() {
    return data.orders;
  },
  async getOrder(_s, id) {
    return genericOrderDetail(id);
  },
  async listProjects() {
    return data.projects;
  },
  async getProject(_s, id) {
    const summary = data.projects.find((p) => p.id === id);
    if (!summary) return null;
    const detail = data.projectDetails[id] ?? {
      daysLeft: 54,
      openTasks: 1,
      milestones: [
        { title: "Kick-off & requirements", dateLabel: "Done · 30 Sep", state: "done" },
        { title: "Site survey", description: summary.nextLabel, dateLabel: "In review", state: "current" },
        { title: "Procurement", dateLabel: "Est. 20 Nov", state: "upcoming" },
        { title: "Installation", dateLabel: "Est. 8 Dec", state: "upcoming" },
        { title: "Handover", dateLabel: "Est. 20 Dec", state: "upcoming" },
      ],
      documents: [],
      manager: { name: "Dimas Pratama", role: "Project Manager · CV. Inti Multi Solusi", phone: "+622188992020" },
    };
    return { ...summary, ...detail } satisfies ProjectDetail;
  },
  async listQuotations() {
    return quotationList();
  },
  async getQuotation(_s, id) {
    const summary = quotationList().find((q) => q.id === id);
    const detail = data.quotationDetails[id];
    if (!summary) return null;
    if (detail) return { ...summary, ...detail };
    return {
      ...summary,
      heading: summary.title,
      issuedLabel: "—",
      validUntilLabel: summary.meta,
      deliveryLabel: "—",
      lines: [],
      breakdown: [{ label: "Grand total", amount: summary.total }],
      milestones: [],
      accountManager: { name: summary.preparedBy, role: "Account Manager", replyLabel: "replies in ~15 min" },
      downPaymentRate: 0.3,
      downPaymentDue: "Within 7 days of approval",
      approvers: [{ id: data.demoUser.id, label: `${data.demoUser.name} · Procurement` }],
      companyName: data.demoUser.company?.name ?? data.demoUser.name,
    };
  },
  async acceptQuotation(_s, id) {
    state.quotationStatus.set(id, "accepted");
  },
  async requestQuotationRevision(_s, id) {
    state.quotationStatus.set(id, "revised");
  },
  async listInvoices() {
    const invoices = data.invoiceData.invoices.map((inv) =>
      state.paidInvoices.has(inv.id) ? { ...inv, status: "paid" as const, dueLabel: undefined } : inv,
    );
    const outstanding = invoices.filter((i) => i.status !== "paid").reduce((sum, i) => sum + i.amount, 0);
    return { ...data.invoiceData, outstanding, invoices };
  },
  async listPaymentMethods() {
    return data.paymentMethods;
  },
  async payInvoice(_s, invoiceId, methodId) {
    state.paidInvoices.add(invoiceId);
    return { invoiceId, methodId, reference: `PAY-${invoiceId.slice(-4)}-${Date.now().toString().slice(-5)}` };
  },
  async listTickets() {
    return ticketList();
  },
  async getTicket(_s, id) {
    const summary = ticketList().find((t) => t.id === id);
    if (!summary) return null;
    const created = state.createdTickets.find((t) => t.id === id);
    const base: Omit<TicketDetail, keyof typeof summary> = created ??
      data.ticketDetails[id] ?? {
        stage: summary.status === "resolved" ? 4 : 1,
        agent: { name: "Entragate Support", initials: "E", online: true, replyLabel: "Online · usually replies in 10 min" },
        quickReplies: [],
        messages: [{ kind: "date", id: "d", label: "Earlier" }],
      };
    return { ...summary, ...base, messages: [...base.messages, ...(state.messages.get(id) ?? [])] };
  },
  async createTicket(_s, input) {
    const number = 2242 + state.createdTickets.length;
    const ticket: TicketDetail = {
      id: `TCK-${number}`,
      number: `#TCK-${number}`,
      subject: input.subject,
      status: "new",
      priority: input.priority,
      stage: 0,
      agent: { name: "Entragate Support", initials: "E", online: true, replyLabel: "Online · usually replies in 10 min" },
      quickReplies: [],
      messages: [
        { kind: "date", id: "d", label: "Today" },
        { kind: "message", id: "m", from: "customer", text: input.description, time: time(), read: false },
      ],
    };
    state.createdTickets.unshift(ticket);
    return { id: ticket.id, number: ticket.number };
  },
  async postTicketMessage(_s, id, text, files = []) {
    const list = state.messages.get(id) ?? [];
    for (const file of files) {
      const kind = file.type.startsWith("image/") ? "photo" : "attachment";
      list.push(
        kind === "photo"
          ? { kind: "photo", id: crypto.randomUUID(), from: "customer", time: time(), read: false }
          : { kind: "attachment", id: crypto.randomUUID(), from: "customer", fileName: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, time: time() },
      );
    }
    if (text) list.push({ kind: "message", id: crypto.randomUUID(), from: "customer", text, time: time(), read: false });
    state.messages.set(id, list);
  },
  async listProducts() {
    return data.products;
  },
  async getWarranty(_s, productId) {
    if (data.warranties[productId]) return data.warranties[productId];
    // Products without a bespoke fixture get a certificate derived from their summary.
    const product = data.products.find((p) => p.id === productId);
    if (!product) return null;
    const months = product.monthsLeft ?? Math.ceil((product.daysLeft ?? 0) / 30);
    return {
      productId,
      certificate: `WR-${productId.replace(/\W/g, "").slice(0, 6)}`,
      plan: product.warrantyStatus === "expiring" ? "Expiring · Standard 2-year" : "Active · Standard 2-year",
      productName: product.name,
      serial: product.serialLabel,
      installedLabel: "",
      monthsRemaining: months,
      termMonths: 24,
      periodLabel: product.daysLeft !== undefined ? `${product.daysLeft} days left on this warranty` : `${months} months left on this warranty`,
      extendLabel: "Extend to 5 years · ask your account manager",
      coverage: data.warranties["BG5-0418"].coverage,
      history: [{ title: "Installed & warranty activated", detail: `Site: ${product.site}`, dateLabel: "" }],
      certificateFile: { id: `doc_${productId}`, name: "Warranty Certificate.pdf", meta: "PDF", kind: "pdf" },
    };
  },
  async lookupDevice(_s, serial) {
    const normalized = serial.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,4}-\d{4}-\d{2}$/.test(normalized)) return null;
    return {
      productId: normalized.slice(0, 8),
      name: "Barrier Gate BG-500",
      serial: normalized,
      order: "#ENT-0418",
      site: "Grand Indonesia Tower B · Lot P3",
      warrantyMonths: 24,
    };
  },
  async registerDevice(_s, serial) {
    state.registered.add(serial);
  },
  async getBookingOptions() {
    return { types: data.serviceTypes, days: data.serviceDays, site: data.serviceSite };
  },
  async bookService(_s, input) {
    const day = data.serviceDays.find((d) => d.date === input.date);
    return { id: `BK-${Date.now().toString().slice(-6)}`, label: `${day?.weekday ?? ""} ${day?.day ?? ""} · ${input.time}` };
  },
  async getProfile() {
    return data.profile;
  },
  async getInvoice(_s, id) {
    const summary = data.invoiceData.invoices.find((i) => i.id === id);
    const detail = accountData.invoiceDetails[id];
    if (!summary || !detail) return null;
    const paid = summary.status === "paid" || state.paidInvoices.has(id);
    return {
      ...summary,
      ...detail,
      status: paid ? "paid" : summary.status,
      dueLabel: paid ? undefined : summary.dueLabel,
      payments: paid && detail.payments.length === 0 ? [{ label: "Payment received", dateLabel: "Just now", amount: summary.amount, method: "Virtual account" }] : detail.payments,
      milestones: detail.milestones.map((m) => (paid && m.status === "due" ? { ...m, status: "paid" as const, dateLabel: "Paid just now" } : m)),
    };
  },
  async getBadges() {
    const quotations = quotationList().filter((q) => q.status === "needs_approval").length;
    const tickets = ticketList().filter((t) => t.status !== "resolved").length;
    return {
      activeOrders: data.orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length,
      quotationsAwaiting: quotations,
      openTickets: tickets,
      unreadNotifications: data.notifications.filter((n) => n.unread).length,
    };
  },
  async getAccount() {
    return structuredClone(state.account);
  },
  async updatePersonal(_s, input) {
    state.account.personal = { ...state.account.personal, ...input };
  },
  async updateCompany(_s, input) {
    if (state.account.company) state.account.company = { ...state.account.company, ...input };
  },
  async inviteMember(_s, input) {
    const member = {
      id: `m-${crypto.randomUUID().slice(0, 8)}`,
      email: input.email,
      initials: input.email.slice(0, 2).toUpperCase(),
      title: "Invitation sent just now",
      role: input.role,
      approvalLimit: input.approvalLimit,
      status: "invited" as const,
      lastActiveLabel: "Invited",
    };
    state.account.members.push(member);
    return member;
  },
  async removeMember(_s, id) {
    state.account.members = state.account.members.filter((m) => m.id !== id || m.role === "owner");
  },
  async saveSite(_s, site) {
    if (site.primary) state.account.sites.forEach((s) => (s.primary = false));
    const existing = site.id ? state.account.sites.find((s) => s.id === site.id) : undefined;
    if (existing) {
      Object.assign(existing, site);
      return existing;
    }
    const created = { ...site, id: `site-${crypto.randomUUID().slice(0, 8)}` };
    state.account.sites.push(created);
    return created;
  },
  async deleteSite(_s, id) {
    state.account.sites = state.account.sites.filter((s) => s.id !== id || s.primary);
  },
  async changePassword(_s, input) {
    if (input.current !== DEMO_CREDENTIALS.password) return false;
    state.account.security.passwordChangedLabel = "Changed just now";
    return true;
  },
  async listDevices() {
    return state.devices;
  },
  async revokeDevice(_s, id) {
    state.devices = state.devices.filter((device) => device.id !== id || device.current);
    state.account.security.activeDevices = state.devices.length;
  },
  async signOutOtherDevices() {
    state.devices = state.devices.filter((device) => device.current);
    state.account.security.activeDevices = state.devices.length;
  },
  async closeAccount(_s, { password }) {
    return password === DEMO_CREDENTIALS.password ? { ok: true } : { ok: false, reason: "wrong_password" };
  },
  async listWishlist() {
    return state.wishlist;
  },
  async removeWishlistItem(_s, id) {
    state.wishlist = state.wishlist.filter((w) => w.id !== id);
  },
  async lookupPublicOrder(orderNumber) {
    const normalized = orderNumber.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const order = data.orders.find((o) => o.number.replace(/[^a-z0-9]/gi, "").toUpperCase().endsWith(normalized) && normalized.length >= 7);
    if (!order) return null;
    return {
      orderNumber: order.number,
      title: order.title,
      status: order.status,
      statusLabel: order.statusLabel,
      arrivalLabel: order.status === "delivered" ? "Delivered" : (data.orderDetails[order.id]?.arrivalLabel ?? order.etaLabel.replace("ETA ", "Arriving ")),
      step: order.step,
      stepCount: order.stepCount,
      stepLabel: order.stepLabel,
      progress: order.progress,
    };
  },
  async listRfqs() {
    return [...state.claimedRfqs, ...demoRfqs];
  },
  async requestRfqClaim(_s, reference) {
    // Demo: any RFQ-YYYY-NNNNN reference from the website demo can be claimed.
    const ref = reference.trim().toUpperCase();
    if (!/^RFQ-\d{4}-\d{5}$/.test(ref) || demoRfqs.some((r) => r.reference === ref) || state.claimedRfqs.some((r) => r.reference === ref)) return null;
    state.rfqClaims.set(ref, { expires: Date.now() + 10 * 60 * 1000 });
    return { reference: ref, maskedEmail: "h•••••@majulogistik.co.id", expiresInMinutes: 10 };
  },
  async confirmRfqClaim(_s, reference, code) {
    const ref = reference.trim().toUpperCase();
    const claim = state.rfqClaims.get(ref);
    if (!claim || claim.expires < Date.now() || code !== DEMO_OTP) return false;
    state.rfqClaims.delete(ref);
    state.claimedRfqs.unshift({
      reference: ref,
      title: "Request from entragate.com",
      siteLocation: "From your guest request",
      status: "received",
      statusLabel: "Received",
      submittedLabel: "Verified just now",
      itemCount: 1,
      origin: "claimed_guest",
    });
    return true;
  },
  async listDocuments(_s, folder) {
    const library = data.documentLibrary;
    return folder ? { ...library, files: library.files.filter((f) => f.folder === folder) } : library;
  },
};

export const DEMO_OTP_CODE = DEMO_OTP;

/** DEMO RFQs on the sample account (one already quoted → QT-2026-0912). */
const demoRfqs: RfqSummary[] = [
  { reference: "RFQ-2026-04512", title: "Parking guidance · Basement Lot P3", siteLocation: "Jakarta Pusat", status: "quoted", statusLabel: "Quoted", submittedLabel: "Submitted 18 Oct", itemCount: 3, quotationId: "QT-2026-0912", origin: "account" },
  { reference: "RFQ-2026-04677", title: "Visitor kiosks for HQ lobby", siteLocation: "Jakarta Timur", status: "in_review", statusLabel: "In review", submittedLabel: "Submitted 24 Oct", itemCount: 2, origin: "account" },
];

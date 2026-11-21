import { ApiError, createApiClient, type ApiClient, type ApiClientOptions } from "./client";
import { authTokensSchema, ErpContractError, loginFailureFrom, loginSuccessSchema, parseOrThrow, paymentIntentSchema, sessionSchema } from "./portal-schemas";

/**
 * Customer-portal contract (apps/web-customer-portal). Types describe what the portal needs; the
 * ERP adapter maps them onto ERP endpoints whose paths are supplied via `PortalRoutes`.
 * No path is hard-coded here — the routes live in `src/services/portal/erp-routes.ts`.
 */

// ── Shared ────────────────────────────────────────────────────────────────
export type Money = number; // IDR, integer rupiah
export type ISODate = string;
export type Tone = "info" | "success" | "warning" | "danger" | "neutral";

export type AccountType = "individual" | "business";

export type PortalUser = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  accountType: AccountType;
  verified: boolean;
  company?: { id: string; name: string; npwp?: string; shortName: string };
  /**
   * Global (Better Auth) roles of the login. The ERP does not know which client calls it, so
   * it returns them and this portal admits only `customer` (ADR-0027, `isPortalCustomer`).
   */
  roles: string[];
};

/**
 * The signed-in session, kept only in the portal's server-side session (never sent to the
 * browser). `sessionCookie` is the ERP's session cookie as `name=value`, received as
 * `Set-Cookie` on sign-in and sent back as the `Cookie` header (ERP-0094, ADR-0027).
 * `refreshToken` exists only in demo mode: ERP sessions slide and are never refreshed.
 */
export type AuthTokens = { sessionCookie: string; refreshToken?: string; expiresAt: ISODate };

/** The visitor behind a sign-in, forwarded so the ERP can list the device (ERP-0106). */
export type ClientInfo = { userAgent?: string; ip?: string };

export type LoginResult =
  | { ok: true; user: PortalUser; tokens: AuthTokens }
  | { ok: false; reason: "invalid_credentials"; attemptsLeft?: number }
  | { ok: false; reason: "locked"; lockedUntil: ISODate }
  | { ok: false; reason: "unverified"; email: string }
  /** Two-step sign-in (ERP-0106): the password was right, a code went to the (masked) email. */
  | { ok: false; reason: "two_step"; challenge: string; email: string };

export type RegisterInput = {
  accountType: AccountType;
  name: string;
  email: string;
  phone: string;
  password: string;
  company?: { name: string; npwp?: string; industry?: string };
};

// ── Orders & tracking ─────────────────────────────────────────────────────
export type OrderStatus = "confirmed" | "production" | "qc" | "shipped" | "installing" | "delivered" | "cancelled";

export type OrderSummary = {
  id: string;
  number: string;
  title: string;
  status: OrderStatus;
  statusLabel: string;
  step: number;
  stepCount: number;
  stepLabel: string;
  progress: number; // 0..1
  etaLabel: string;
  total: Money;
  placedAt: ISODate;
  image?: string;
};

export type OrderLine = { name: string; detail: string; quantity: number; amount: Money; image?: string };

export type TimelineEvent = {
  title: string;
  description?: string;
  dateLabel: string;
  state: "done" | "current" | "upcoming";
};

export type OrderDetail = OrderSummary & {
  arrivalLabel: string;
  arrivalWindow: string;
  lines: OrderLine[];
  delivery: { site: string; address: string; courier: string; awb: string; pic?: string };
  /** On-site installation plan, when the order includes installation. */
  installation?: { label: string; detail: string };
  payment: { subtotal: Money; discountLabel?: string; discount?: Money; tax: Money; total: Money; paidLabel?: string };
  documents: PortalDocument[];
  timeline: TimelineEvent[];
  courier?: { name: string; vehicle: string; distanceLabel: string; phone?: string; updatedLabel: string };
};

// ── Projects ──────────────────────────────────────────────────────────────
export type ProjectSummary = {
  id: string;
  code: string;
  name: string;
  site: string;
  status: "on_track" | "action_needed" | "handed_over";
  stage: number;
  stageCount: number;
  stageLabel: string;
  progress: number;
  nextLabel: string;
  completionLabel: string;
  /** Project team shown as stacked avatars on cards. */
  team?: { initials: string; name: string }[];
};

export type ProjectMilestone = {
  title: string;
  description?: string;
  dateLabel: string;
  state: "done" | "current" | "upcoming";
  tasks?: { label: string; done: boolean }[];
  tasksDone?: number;
  tasksTotal?: number;
  photos?: { label: string; urls: string[]; total: number };
};

export type ProjectDetail = ProjectSummary & {
  daysLeft: number;
  openTasks: number;
  milestones: ProjectMilestone[];
  documents: PortalDocument[];
  manager: { name: string; role: string; phone?: string };
};

// ── Quotations ────────────────────────────────────────────────────────────
export type QuotationStatus = "needs_approval" | "revised" | "accepted" | "expired" | "rejected";

export type QuotationSummary = {
  id: string;
  number: string;
  title: string;
  /** Compact title for cards (Home carousel). */
  shortTitle?: string;
  status: QuotationStatus;
  total: Money;
  lineCount: number;
  preparedBy: string;
  expiresInDays?: number;
  meta: string;
  version: number;
};

export type QuotationDetail = QuotationSummary & {
  /** Full project heading on the detail screen. */
  heading: string;
  issuedLabel: string;
  validUntilLabel: string;
  deliveryLabel: string;
  /** Commercial terms rows (06.04): warranty cover, delivery lead time, governing terms. */
  terms?: { warranty: string; delivery: string; conditions: string };
  lines: { name: string; detail: string; quantity: number; unitPrice: Money; amount: Money }[];
  breakdown: { label: string; amount: Money; tone?: "success" }[];
  milestones: { label: string; note: string; amount: Money }[];
  accountManager: { name: string; role: string; replyLabel: string };
  downPaymentRate: number;
  /** Down-payment due rule shown in the accept sheet, e.g. "Within 7 days of approval". */
  downPaymentDue: string;
  /** People allowed to approve on behalf of the company. */
  approvers: { id: string; label: string }[];
  /** Legal entity the acceptance is made on behalf of. */
  companyName: string;
};

// ── Invoices & payments ───────────────────────────────────────────────────
export type InvoiceSummary = {
  id: string;
  number: string;
  description: string;
  amount: Money;
  status: "unpaid" | "paid" | "overdue";
  dueLabel?: string;
  dueDate?: ISODate;
};

export type PaymentMethod = {
  id: string;
  kind: "virtual_account" | "qris" | "transfer";
  name: string;
  detail: string;
  /** Present when the method is saved on the account (shown under "Payment methods"). */
  savedLabel?: string;
};

export type PaymentIntent = { invoiceId: string; methodId: string; instructionsUrl?: string; reference: string };

// ── Support ───────────────────────────────────────────────────────────────
export type TicketCategory = "hardware" | "software" | "installation" | "billing" | "warranty" | "other";
export type TicketPriority = "low" | "normal" | "urgent";

export type TicketSummary = {
  id: string;
  number: string;
  subject: string;
  /** Compact subject for summary rows (Home). */
  shortSubject?: string;
  status: "awaiting_you" | "in_progress" | "resolved" | "new";
  priority: TicketPriority;
  lastMessage?: { author: string; role: string; initials: string; text: string; ago: string; unread: number };
  resolvedLabel?: string;
  rating?: number;
};

export type TicketMessage =
  | { kind: "message"; id: string; from: "customer" | "agent"; author?: string; text: string; time: string; read?: boolean }
  | { kind: "attachment"; id: string; from: "customer" | "agent"; author?: string; fileName: string; size: string; time: string }
  | { kind: "photo"; id: string; from: "customer" | "agent"; time: string; read?: boolean }
  | { kind: "event"; id: string; text: string; icon: "assign" | "calendar" }
  | { kind: "date"; id: string; label: string };

export type TicketDetail = TicketSummary & {
  stage: number; // index into Created/Assigned/Diagnosed/Visit/Resolved
  agent: { name: string; initials: string; online: boolean; replyLabel: string };
  messages: TicketMessage[];
  quickReplies: string[];
  createdLabel?: string;
  device?: { name: string; serial: string; image?: string };
  /** Ticket lifecycle shown in the desktop details pane (06.06). */
  activity?: TimelineEvent[];
};

export type CreateTicketInput = {
  category: TicketCategory;
  priority: TicketPriority;
  productId?: string;
  subject: string;
  description: string;
};

// ── Products & warranty ───────────────────────────────────────────────────
export type RegisteredProduct = {
  id: string;
  name: string;
  serialLabel: string;
  site: string;
  siteKey: string;
  warrantyStatus: "active" | "expiring" | "expired";
  monthsLeft?: number;
  daysLeft?: number;
  progress: number;
  image?: string;
};

export type WarrantyDetail = {
  productId: string;
  certificate: string;
  plan: string;
  productName: string;
  serial: string;
  installedLabel: string;
  monthsRemaining: number;
  /** Full warranty term, for the remaining-time ring. */
  termMonths: number;
  periodLabel: string;
  extendLabel?: string;
  coverage: { title: string; detail: string; covered: boolean; icon?: "parts" | "labor" | "firmware" | "damage" }[];
  history: { title: string; detail: string; dateLabel: string }[];
  certificateFile: PortalDocument;
};

/** A scanned/entered serial resolved against delivered orders (08.06). */
export type DeviceLookup = { productId: string; name: string; serial: string; order: string; site: string; warrantyMonths: number };

export type ServiceType = { id: "repair" | "maintenance" | "inspection"; name: string; priceLabel: string };
export type ServiceSlot = { time: string; available: boolean };
export type ServiceDay = { date: ISODate; weekday: string; day: number; available: boolean; slots: ServiceSlot[] };

export type BookingInput = { serviceType: ServiceType["id"]; productId: string; date: ISODate; time: string };

// ── Misc ──────────────────────────────────────────────────────────────────
export type PortalDocument = { id: string; name: string; meta: string; kind: "pdf" | "dwg" | "zip" | "file"; url?: string };

export type DocumentFolder = "invoices" | "quotations" | "warranty" | "drawings";
export type DocumentLibrary = {
  total: number;
  folders: { key: DocumentFolder; label: string; count: number }[];
  /** Most recent first; filtered to one folder when requested. */
  files: (PortalDocument & { folder: DocumentFolder })[];
};

export type PortalNotification = {
  id: string;
  group: "today" | "earlier";
  kind: "support" | "quotation" | "payment" | "order" | "project" | "warranty";
  title: string;
  body: string;
  ago: string;
  unread: boolean;
  href?: string;
};

export type ActivityItem = { kind: "payment" | "shipment" | "quotation"; title: string; detail: string };

export type HomeSummary = {
  activeProject?: ProjectSummary & { index: number; total: number };
  nextDelivery?: OrderSummary & { arrivesLabel: string; stages: string[]; currentStage: number };
  quotations: QuotationSummary[];
  openTickets: TicketSummary[];
  activity: ActivityItem[];
  unreadNotifications: number;
  onboarding?: { done: number; total: number; steps: { label: string; done: boolean; href: string }[] };
  /** Dedicated account manager (business accounts). */
  accountManager?: { name: string; initials: string; statusLabel: string; phone?: string; email?: string };
};

export type ProfileSummary = {
  stats: { orders: number; projects: number; devices: number; tickets: number };
  quotationsAwaiting: number;
  outstanding: Money;
  orderCount: number;
  memberSince: string;
  deviceCount: number;
  siteCount: number;
  warrantyExpiring: number;
  nextBookingLabel?: string;
  documentCount: number;
  memberCount: number;
  approverCount: number;
};


// ── Account, company & settings (05.09–05.11, 06.07) ─────────────────────
export type MemberRole = "owner" | "approver" | "finance" | "viewer";

export type CompanyMember = {
  id: string;
  name?: string;
  email: string;
  initials: string;
  title?: string;
  role: MemberRole;
  admin?: boolean;
  approvalLimit?: Money;
  status: "active" | "invited";
  lastActiveLabel: string;
};

export type CompanySite = { id: string; name: string; address: string; picName: string; picPhone: string; primary?: boolean };

export type NotificationPrefs = { push: boolean; email: boolean; whatsapp: boolean };

export type AccountSettings = {
  personal: { name: string; email: string; phone: string; jobTitle?: string };
  company?: { name: string; shortName: string; npwp?: string; industry?: string; verified: boolean; approvalRule?: string };
  members: CompanyMember[];
  sites: CompanySite[];
  notifications: NotificationPrefs;
  security: { twoStep: boolean; passwordChangedLabel: string; activeDevices: number };
  preferences: { language: "en" | "id"; currency: "IDR" };
};

export type SettingsPatch = Partial<{
  notifications: Partial<NotificationPrefs>;
  security: Partial<Pick<AccountSettings["security"], "twoStep">>;
  preferences: Partial<AccountSettings["preferences"]>;
}>;

/** A browser or app signed in to this login (ERP-0106). */
export type SignedInDevice = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  current: boolean;
};

/** Deleting one's own login: the password is checked; the only owner of a company cannot. */
export type CloseAccountResult = { ok: true } | { ok: false; reason: "wrong_password" | "last_owner"; message?: string };

// ── Wishlist ──────────────────────────────────────────────────────────────
export type WishlistItem = {
  id: string;
  productSlug: string;
  name: string;
  category: string;
  priceLabel: string;
  stock: "ready" | "preorder" | "request";
  image?: string;
  addedLabel: string;
};

// ── Invoice detail ────────────────────────────────────────────────────────
export type InvoiceDetail = InvoiceSummary & {
  issuedLabel: string;
  orderNumber: string;
  lines: { label: string; detail?: string; amount: Money }[];
  subtotal: Money;
  tax: Money;
  total: Money;
  payments: { label: string; dateLabel: string; amount: Money; method: string }[];
  milestones: { label: string; amount: Money; status: "paid" | "due" | "upcoming"; dateLabel: string }[];
  document?: PortalDocument;
};

// ── Navigation badges & public lookup ─────────────────────────────────────
export type NavBadges = { activeOrders: number; quotationsAwaiting: number; openTickets: number; unreadNotifications: number };

/** Minimal order status for the sign-in-free lookup (07.05) — no prices, addresses or contacts. */
export type PublicOrderStatus = {
  orderNumber: string;
  title: string;
  status: OrderStatus;
  statusLabel: string;
  arrivalLabel: string;
  step: number;
  stepCount: number;
  stepLabel: string;
  progress: number;
};

// ── Requests for quotation (RFQ) ──────────────────────────────────────────
export type RfqStatus = "received" | "in_review" | "quoted" | "closed";

export type RfqSummary = {
  reference: string;
  title: string;
  siteLocation: string;
  status: RfqStatus;
  statusLabel: string;
  submittedLabel: string;
  itemCount: number;
  /** Quotation issued for this RFQ, when there is one. */
  quotationId?: string;
  /** How the RFQ became part of this account. */
  origin: "account" | "claimed_guest";
};

/** Result of starting a guest-RFQ claim: a code was sent to the email on the RFQ. */
export type RfqClaimChallenge = { reference: string; maskedEmail: string; expiresInMinutes: number };

// ── Source contract───────────────────────────────────────────────────────
/** Everything the portal reads/writes. Implemented by the ERP adapter (and the app's demo source). */
export interface PortalSource {
  login(input: { email: string; password: string; accountType: AccountType; client?: ClientInfo }): Promise<LoginResult>;
  register(input: RegisterInput): Promise<{ email: string }>;
  verifyEmail(input: { email: string; code: string }): Promise<{ user: PortalUser; tokens: AuthTokens } | null>;
  /** Second step of a two-step sign-in; `null` for a wrong or expired code. */
  verifyLoginCode(input: { challenge: string; code: string; client?: ClientInfo }): Promise<{ user: PortalUser; tokens: AuthTokens } | null>;
  resendLoginCode(input: { challenge: string }): Promise<void>;
  resendVerification(input: { email: string }): Promise<void>;
  requestPasswordReset(input: { email?: string; phone?: string }): Promise<void>;
  resetPassword(input: { token: string; password: string }): Promise<boolean>;
  logout(tokens: AuthTokens): Promise<void>;
  /** Exchanges a refresh token for new tokens; `null` when the refresh token is no longer valid. */
  refreshSession(refreshToken: string): Promise<AuthTokens | null>;
  completeOnboarding(
    session: AuthTokens,
    input: { siteAddress: string; invites: { email: string; role: "approver" | "finance" | "viewer" }[] },
  ): Promise<void>;

  getHome(session: AuthTokens): Promise<HomeSummary>;
  listNotifications(session: AuthTokens): Promise<PortalNotification[]>;
  listOrders(session: AuthTokens): Promise<OrderSummary[]>;
  getOrder(session: AuthTokens, id: string): Promise<OrderDetail | null>;
  listProjects(session: AuthTokens): Promise<ProjectSummary[]>;
  getProject(session: AuthTokens, id: string): Promise<ProjectDetail | null>;
  listQuotations(session: AuthTokens): Promise<QuotationSummary[]>;
  getQuotation(session: AuthTokens, id: string): Promise<QuotationDetail | null>;
  acceptQuotation(session: AuthTokens, id: string, input: { poNumber?: string; approverId: string }): Promise<void>;
  requestQuotationRevision(session: AuthTokens, id: string, input: { topics: string[]; message: string }, attachment?: File): Promise<void>;
  listInvoices(session: AuthTokens): Promise<{ outstanding: Money; paidThisYear: Money; overdue: Money; invoices: InvoiceSummary[] }>;
  listPaymentMethods(session: AuthTokens): Promise<PaymentMethod[]>;
  payInvoice(session: AuthTokens, invoiceId: string, methodId: string): Promise<PaymentIntent>;
  listTickets(session: AuthTokens): Promise<TicketSummary[]>;
  getTicket(session: AuthTokens, id: string): Promise<TicketDetail | null>;
  createTicket(session: AuthTokens, input: CreateTicketInput, photos: File[]): Promise<{ id: string; number: string }>;
  postTicketMessage(session: AuthTokens, id: string, text: string, files?: File[]): Promise<void>;
  listProducts(session: AuthTokens): Promise<RegisteredProduct[]>;
  getWarranty(session: AuthTokens, productId: string): Promise<WarrantyDetail | null>;
  lookupDevice(session: AuthTokens, serial: string): Promise<DeviceLookup | null>;
  registerDevice(session: AuthTokens, serial: string): Promise<void>;
  getBookingOptions(session: AuthTokens): Promise<{ types: ServiceType[]; days: ServiceDay[]; site: { name: string; detail: string } }>;
  bookService(session: AuthTokens, input: BookingInput): Promise<{ id: string; label: string }>;
  getProfile(session: AuthTokens): Promise<ProfileSummary>;
  listDocuments(session: AuthTokens, folder?: DocumentFolder): Promise<DocumentLibrary>;
  getInvoice(session: AuthTokens, id: string): Promise<InvoiceDetail | null>;
  getBadges(session: AuthTokens): Promise<NavBadges>;
  getAccount(session: AuthTokens): Promise<AccountSettings>;
  updatePersonal(session: AuthTokens, input: { name: string; phone: string; jobTitle?: string }): Promise<void>;
  updateCompany(session: AuthTokens, input: { name: string; npwp?: string; industry?: string }): Promise<void>;
  inviteMember(session: AuthTokens, input: { email: string; role: Exclude<MemberRole, "owner">; approvalLimit?: Money }): Promise<CompanyMember>;
  removeMember(session: AuthTokens, id: string): Promise<void>;
  saveSite(session: AuthTokens, site: Omit<CompanySite, "id"> & { id?: string }): Promise<CompanySite>;
  deleteSite(session: AuthTokens, id: string): Promise<void>;
  updateSettings(session: AuthTokens, patch: SettingsPatch): Promise<void>;
  /** `false` when the current password is wrong. */
  changePassword(session: AuthTokens, input: { current: string; next: string }): Promise<boolean>;
  listDevices(session: AuthTokens): Promise<SignedInDevice[]>;
  revokeDevice(session: AuthTokens, id: string): Promise<void>;
  signOutOtherDevices(session: AuthTokens): Promise<void>;
  closeAccount(session: AuthTokens, input: { password: string }): Promise<CloseAccountResult>;
  listWishlist(session: AuthTokens): Promise<WishlistItem[]>;
  removeWishlistItem(session: AuthTokens, id: string): Promise<void>;
  /** Sign-in-free lookup (07.05). Needs the order number only; returns a minimal status. */
  lookupPublicOrder(orderNumber: string): Promise<PublicOrderStatus | null>;
  listRfqs(session: AuthTokens): Promise<RfqSummary[]>;
  /**
   * Guest RFQs join an account only after ownership is proven: the ERP emails a one-time
   * code to the address on the RFQ. `null` when the reference doesn't exist or can't be claimed.
   */
  requestRfqClaim(session: AuthTokens, reference: string): Promise<RfqClaimChallenge | null>;
  /** `false` when the code is wrong or expired. */
  confirmRfqClaim(session: AuthTokens, reference: string, code: string): Promise<boolean>;
}

// ── ERP adapter ───────────────────────────────────────────────────────────
/**
 * Relative ERP paths, provided by configuration once the ERP team publishes them.
 * Placeholders `:id` are substituted at call time. Unset routes throw
 * `PortalNotConfiguredError` instead of guessing.
 */
export type PortalRoutes = Partial<Record<keyof PortalSource, string>>;

/** `User-Agent` / `X-Forwarded-For` of the visitor for the ERP's session record. */
function clientHeaders(client?: ClientInfo): Record<string, string> {
  return {
    ...(client?.userAgent ? { "User-Agent": client.userAgent.slice(0, 512) } : {}),
    ...(client?.ip ? { "X-Forwarded-For": client.ip } : {}),
  };
}

export class PortalNotConfiguredError extends Error {
  constructor(operation: string) {
    super(`ERP route for "${operation}" is not configured.`);
    this.name = "PortalNotConfiguredError";
  }
}

export type ErpPortalConfig = {
  /** ERP API root, e.g. `https://erp.entragate.com/api/v1`. Must be https outside localhost. */
  baseUrl: string;
  routes: PortalRoutes;
  fetcher?: typeof fetch;
} & Pick<ApiClientOptions, "timeoutMs" | "retries" | "unwrap" | "defaultHeaders">;

/** Fails fast on misconfiguration that could leak tokens (plain http, absolute route paths). */
function assertSafeConfig({ baseUrl, routes }: ErpPortalConfig) {
  const base = new URL(baseUrl);
  const local = ["localhost", "127.0.0.1"].includes(base.hostname);
  if (base.protocol !== "https:" && !(local && base.protocol === "http:")) {
    throw new Error(`ERP base URL must use https (got ${base.protocol}//${base.host}).`);
  }
  if (base.username || base.password) throw new Error("ERP base URL must not embed credentials.");
  for (const [op, template] of Object.entries(routes)) {
    if (!template) continue;
    if (!template.startsWith("/") || template.startsWith("//") || template.includes("://") || template.includes("..")) {
      throw new Error(`ERP route "${op}" must be a relative path starting with "/" (got "${template}").`);
    }
  }
}

/**
 * The ERP session cookie (`name=value`) from a sign-in response's `Set-Cookie`, or
 * `null`. Only a non-empty value is taken; attributes (Path, HttpOnly, …) are dropped
 * because the cookie is never handed to a browser.
 */
function sessionCookieFrom(response: Response): string | null {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  for (const value of values) {
    const pair = value.split(";", 1)[0]?.trim() ?? "";
    if (SESSION_COOKIE_PAIR.test(pair)) return pair;
  }
  return null;
}

/** `name=value`: an RFC 6265 token name and a non-empty value without separators. */
const SESSION_COOKIE_PAIR = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+=[^;\s,]{16,8192}$/;

function tokensFrom(operation: string, cookie: string | null, expiresAt: string): AuthTokens {
  if (!cookie) throw new ErpContractError(operation, ["set-cookie: the ERP sent no session cookie"]);
  return { sessionCookie: cookie, expiresAt };
}

export function createErpPortalSource(config: ErpPortalConfig): PortalSource {
  assertSafeConfig(config);
  const clientFor = (session?: AuthTokens): ApiClient =>
    createApiClient({
      baseUrl: config.baseUrl,
      sessionCookie: session?.sessionCookie,
      fetcher: config.fetcher,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      unwrap: config.unwrap,
      defaultHeaders: config.defaultHeaders,
    });

  const path = (op: keyof PortalSource, params: Record<string, string> = {}) => {
    const template = config.routes[op];
    if (!template) throw new PortalNotConfiguredError(op);
    // A device id is `<certificate uuid>:<line>`; ":" is a legal path character, so keep it
    // readable for the ERP's id matcher instead of sending %3A.
    return template.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(params[key] ?? "").replaceAll("%3A", ":"));
  };

  // async: an unmapped operation must reject (PortalNotConfiguredError), never throw synchronously,
  // so callers like `unlessNotConnected(promise, …)` always receive a promise.
  const get = async <T>(op: keyof PortalSource, session: AuthTokens, params?: Record<string, string>) =>
    clientFor(session).get<T>(path(op, params));
  const post = async <T>(op: keyof PortalSource, session: AuthTokens | undefined, body: unknown, params?: Record<string, string>) =>
    clientFor(session).post<T>(path(op, params), body);
  const orNull = async <T>(promise: Promise<T>): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  };

  return {
    async login({ client, ...input }) {
      try {
        let cookie: string | null = null;
        const body = await clientFor().post(path("login"), input, {
          headers: clientHeaders(client),
          onResponse: (response) => (cookie = sessionCookieFrom(response)),
        });
        const twoStep = body as { twoStep?: unknown; challenge?: unknown; email?: unknown } | null;
        if (twoStep?.twoStep === true && typeof twoStep.challenge === "string") {
          return { ok: false, reason: "two_step", challenge: twoStep.challenge, email: typeof twoStep.email === "string" ? twoStep.email : "" };
        }
        const { user, session } = parseOrThrow("login", loginSuccessSchema, body);
        return { ok: true, user, tokens: tokensFrom("login", cookie, session.expiresAt) };
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 423].includes(error.status)) {
          const failure = loginFailureFrom(error.status, error.body);
          if (failure) return failure;
        }
        throw error;
      }
    },
    register: (input) => post("register", undefined, input),
    async verifyEmail(input) {
      // The ERP answers a wrong or expired code with 400 (and 404/410 for an unknown sign-up).
      try {
        let cookie: string | null = null;
        const body = await clientFor().post(path("verifyEmail"), input, { onResponse: (response) => (cookie = sessionCookieFrom(response)) });
        const { user, session } = parseOrThrow("verifyEmail", sessionSchema, body);
        return { user, tokens: tokensFrom("verifyEmail", cookie, session.expiresAt) };
      } catch (error) {
        if (error instanceof ApiError && [400, 404, 410].includes(error.status)) return null;
        throw error;
      }
    },
    async resendVerification(input) {
      await post("resendVerification", undefined, input);
    },
    async requestPasswordReset(input) {
      // The ERP resets by email only; a phone-only request has nowhere to go.
      if (!input.email) throw new PortalNotConfiguredError("requestPasswordReset (phone)");
      await post("requestPasswordReset", undefined, { email: input.email });
    },
    async resetPassword(input) {
      try {
        await post("resetPassword", undefined, input);
        return true;
      } catch (error) {
        // 400: invalid or expired link.
        if (error instanceof ApiError && error.status === 400) return false;
        throw error;
      }
    },
    async logout(session) {
      await post("logout", session, {});
    },
    async verifyLoginCode({ client, ...input }) {
      // 400: wrong, expired or used-up code (ERP-0106).
      try {
        let cookie: string | null = null;
        const body = await clientFor().post(path("verifyLoginCode"), input, {
          headers: clientHeaders(client),
          onResponse: (response) => (cookie = sessionCookieFrom(response)),
        });
        const { user, session } = parseOrThrow("verifyLoginCode", loginSuccessSchema, body);
        return { user, tokens: tokensFrom("verifyLoginCode", cookie, session.expiresAt) };
      } catch (error) {
        if (error instanceof ApiError && (error.status === 400 || error.status === 401)) return null;
        throw error;
      }
    },
    async resendLoginCode(input) {
      await post("resendLoginCode", undefined, input);
    },
    async refreshSession(refreshToken) {
      try {
        return parseOrThrow("refreshSession", authTokensSchema, await post("refreshSession", undefined, { refreshToken }));
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
    completeOnboarding: (s, input) => post("completeOnboarding", s, input),
    getHome: (s) => get("getHome", s),
    listNotifications: (s) => get("listNotifications", s),
    listOrders: (s) => get("listOrders", s),
    getOrder: (s, id) => orNull(get("getOrder", s, { id })),
    listProjects: (s) => get("listProjects", s),
    getProject: (s, id) => orNull(get("getProject", s, { id })),
    listQuotations: (s) => get("listQuotations", s),
    getQuotation: (s, id) => orNull(get("getQuotation", s, { id })),
    acceptQuotation: (s, id, input) => post("acceptQuotation", s, input, { id }),
    async requestQuotationRevision(s, id, input, attachment) {
      if (!attachment) return post("requestQuotationRevision", s, input, { id });
      const form = new FormData();
      form.set("payload", JSON.stringify(input));
      form.append("attachment", attachment, attachment.name);
      return clientFor(s).post(path("requestQuotationRevision", { id }), form);
    },
    listInvoices: (s) => get("listInvoices", s),
    listPaymentMethods: (s) => get("listPaymentMethods", s),
    async payInvoice(s, invoiceId, methodId) {
      const intent = await clientFor(s).post(path("payInvoice", { id: invoiceId }), { methodId }, { idempotencyKey: crypto.randomUUID() });
      return parseOrThrow("payInvoice", paymentIntentSchema, intent);
    },
    listTickets: (s) => get("listTickets", s),
    getTicket: (s, id) => orNull(get("getTicket", s, { id })),
    async createTicket(s, input, photos) {
      const form = new FormData();
      form.set("payload", JSON.stringify(input));
      photos.forEach((photo) => form.append("photos", photo, photo.name));
      return clientFor(s).post(path("createTicket"), form);
    },
    async postTicketMessage(s, id, text, files = []) {
      if (files.length === 0) return post("postTicketMessage", s, { text }, { id });
      const form = new FormData();
      form.set("payload", JSON.stringify({ text }));
      files.forEach((file) => form.append("attachments", file, file.name));
      return clientFor(s).post(path("postTicketMessage", { id }), form);
    },
    listProducts: (s) => get("listProducts", s),
    getWarranty: (s, productId) => orNull(get("getWarranty", s, { id: productId })),
    lookupDevice: (s, serial) => orNull(get("lookupDevice", s, { id: serial })),
    registerDevice: (s, serial) => post("registerDevice", s, { serial }),
    getBookingOptions: (s) => get("getBookingOptions", s),
    bookService: (s, input) => post("bookService", s, input),
    getProfile: (s) => get("getProfile", s),
    listDocuments: async (s, folder) => clientFor(s).get(`${path("listDocuments")}${folder ? `?folder=${encodeURIComponent(folder)}` : ""}`),
    getInvoice: (s, id) => orNull(get("getInvoice", s, { id })),
    getBadges: (s) => get("getBadges", s),
    getAccount: (s) => get("getAccount", s),
    updatePersonal: async (s, input) => clientFor(s).patch(path("updatePersonal"), input),
    updateCompany: async (s, input) => clientFor(s).patch(path("updateCompany"), input),
    inviteMember: (s, input) => post("inviteMember", s, input),
    removeMember: async (s, id) => clientFor(s).delete(path("removeMember", { id })),
    saveSite: async (s, site) => (site.id ? clientFor(s).patch(path("saveSite", { id: site.id }), site) : post("saveSite", s, site)),
    deleteSite: async (s, id) => clientFor(s).delete(path("deleteSite", { id })),
    updateSettings: async (s, patch) => clientFor(s).patch(path("updateSettings"), patch),
    async changePassword(s, input) {
      try {
        await post("changePassword", s, input);
        return true;
      } catch (error) {
        // 400 = wrong current password. A 401 means the session ended: let it propagate so the
        // middleware signs the user out instead of reporting a wrong password.
        if (error instanceof ApiError && error.status === 400) return false;
        throw error;
      }
    },
    listDevices: (s) => get("listDevices", s),
    revokeDevice: async (s, id) => clientFor(s).delete(path("revokeDevice", { id })),
    async signOutOtherDevices(s) {
      await post("signOutOtherDevices", s, {});
    },
    async closeAccount(s, input) {
      try {
        await post("closeAccount", s, input);
        return { ok: true };
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) return { ok: false, reason: "wrong_password" };
        if (error instanceof ApiError && error.status === 409) return { ok: false, reason: "last_owner", message: error.messages[0] };
        throw error;
      }
    },
    listWishlist: (s) => get("listWishlist", s),
    removeWishlistItem: async (s, id) => clientFor(s).delete(path("removeWishlistItem", { id })),
    lookupPublicOrder: async (orderNumber) => orNull(clientFor().get(path("lookupPublicOrder", { id: orderNumber }))),
    listRfqs: (s) => get("listRfqs", s),
    async requestRfqClaim(s, reference) {
      try {
        return await post("requestRfqClaim", s, { reference });
      } catch (error) {
        if (error instanceof ApiError && [404, 409, 422].includes(error.status)) return null;
        throw error;
      }
    },
    async confirmRfqClaim(s, reference, code) {
      try {
        await post("confirmRfqClaim", s, { reference, code });
        return true;
      } catch (error) {
        if (error instanceof ApiError && [400, 401, 403, 410, 422].includes(error.status)) return false;
        throw error;
      }
    },
  };
}

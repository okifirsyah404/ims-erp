import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
import { z } from "astro/zod";
import { ApiError } from "@/api/client";
import { PortalNotConfiguredError, type AuthTokens, type PortalUser, type SettingsPatch } from "@/api/portal";
import { portal } from "../services/portal";
import { isPortalCustomer } from "@/lib/portal-role";
import { signIn, signOut } from "../services/auth";
import { SessionExpiredError, logUpstreamError } from "../services/errors";

/**
 * Server mutations for the customer portal. Auth actions manage the session; portal
 * actions require it. Optional fields stay top-level `.optional()` so Astro's form
 * parser maps absent/empty values to `undefined`.
 */

function requireAuth(context: ActionAPIContext) {
  const tokens = context.locals.tokens;
  if (!tokens) throw new ActionError({ code: "UNAUTHORIZED", message: "Your session has expired. Please sign in again." });
  return tokens;
}

/** Normalises upstream failures into user-facing action errors (details go to the server log). */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ActionError) throw error;
    if (error instanceof PortalNotConfiguredError) {
      throw new ActionError({ code: "SERVICE_UNAVAILABLE", message: "This feature isn't connected yet. Please contact support." });
    }
    if (error instanceof SessionExpiredError) {
      throw new ActionError({ code: "UNAUTHORIZED", message: "Your session has expired. Please sign in again." });
    }
    logUpstreamError("portal", error);
    // NestJS validation/conflict messages are written for API consumers and safe to relay.
    if (error instanceof ApiError && [400, 409, 422].includes(error.status) && error.messages[0]) {
      throw new ActionError({ code: "BAD_REQUEST", message: error.messages[0].slice(0, 200) });
    }
    if (error instanceof ApiError && error.status === 404) {
      throw new ActionError({ code: "NOT_FOUND", message: "We couldn't find that item. It may have been removed." });
    }
    throw new ActionError({ code: "BAD_GATEWAY", message: "Something went wrong on our side. Please try again." });
  }
}

const password = z.string().min(12, "Use at least 12 characters").max(128);

/**
 * Admits only a login carrying the global `customer` role (ADR-0027): the ERP returns the
 * roles and leaves the decision to the client. Any other login has its fresh ERP session
 * ended and gets the same answer as a wrong password, so the portal never reveals staff
 * accounts.
 */
async function admitCustomer(result: { user: PortalUser; tokens: AuthTokens }, message: string) {
  if (isPortalCustomer(result.user)) return;
  await portal.logout(result.tokens).catch((error: unknown) => logUpstreamError("auth.reject-role", error));
  throw new ActionError({ code: "UNAUTHORIZED", message });
}

/** The visitor's browser and address, so the ERP can list the device (ERP-0106). */
function clientOf(context: ActionAPIContext) {
  let ip: string | undefined;
  try {
    ip = context.clientAddress;
  } catch {
    ip = undefined;
  }
  return { userAgent: context.request.headers.get("user-agent") ?? undefined, ip };
}

export const server = {
  auth: {
    /** 04.01 Login / 04.08 error state. */
    login: defineAction({
      accept: "form",
      input: z.object({
        email: z.email("Enter a valid email address").max(160),
        password: z.string().min(1, "Enter your password").max(128),
        account_type: z.enum(["individual", "business"]).default("business"),
        remember: z.boolean().default(false),
      }),
      handler: async (input, context) => {
        const result = await call(() =>
          portal.login({ email: input.email, password: input.password, accountType: input.account_type, client: clientOf(context) }),
        );
        if (!result.ok) {
          if (result.reason === "locked") {
            const minutes = Math.max(1, Math.ceil((Date.parse(result.lockedUntil) - Date.now()) / 60_000));
            throw new ActionError({ code: "TOO_MANY_REQUESTS", message: `Account locked. Try again in ${minutes} minutes or reset your password.` });
          }
          if (result.reason === "two_step") {
            context.session?.set("pendingSignIn", { challenge: result.challenge, email: result.email, remember: input.remember });
            return { ok: true, twoStep: true };
          }
          if (result.reason === "unverified") {
            context.session?.set("pendingVerification", { email: result.email, accountType: input.account_type });
            throw new ActionError({ code: "FORBIDDEN", message: "Please verify your email first." });
          }
          const left = result.attemptsLeft;
          throw new ActionError({
            code: "UNAUTHORIZED",
            message:
              left !== undefined && left <= 3
                ? `Incorrect email or password|${left} attempt${left === 1 ? "" : "s"} left before your account is locked for 15 minutes.`
                : "Incorrect email or password",
          });
        }
        await admitCustomer(result, "Incorrect email or password");
        await signIn(context.session!, result.user, result.tokens, input.remember);
        return { ok: true, twoStep: false };
      },
    }),

    /** Second step of a two-step sign-in (ERP-0106): the code from the email. */
    verifyLoginCode: defineAction({
      accept: "form",
      input: z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }),
      handler: async (input, context) => {
        const pending = await context.session?.get("pendingSignIn");
        if (!pending) throw new ActionError({ code: "UNAUTHORIZED", message: "Your sign-in has expired. Please sign in again." });
        const result = await call(() => portal.verifyLoginCode({ challenge: pending.challenge, code: input.code, client: clientOf(context) }));
        if (!result) throw new ActionError({ code: "BAD_REQUEST", message: "That code is wrong or has expired." });
        context.session?.delete("pendingSignIn");
        await admitCustomer(result, "Incorrect email or password");
        await signIn(context.session!, result.user, result.tokens, pending.remember);
        return { ok: true };
      },
    }),

    resendLoginCode: defineAction({
      accept: "form",
      handler: async (_input, context) => {
        const pending = await context.session?.get("pendingSignIn");
        if (!pending) throw new ActionError({ code: "UNAUTHORIZED", message: "Your sign-in has expired. Please sign in again." });
        await call(() => portal.resendLoginCode({ challenge: pending.challenge }));
        return { ok: true };
      },
    }),

    /** 04.02 Register · Account type (kept in the session until step 2). */
    chooseAccountType: defineAction({
      accept: "form",
      input: z.object({ account_type: z.enum(["individual", "business"]) }),
      handler: async (input, context) => {
        context.session?.set("registerAccountType", input.account_type);
        return { accountType: input.account_type };
      },
    }),

    /** 04.03 Register · Details. */
    register: defineAction({
      accept: "form",
      input: z.object({
        name: z.string().trim().max(120).optional(),
        company_name: z.string().trim().max(160).optional(),
        npwp: z
          .string()
          .trim()
          .regex(/^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/, "Use the format 01.234.567.8-901.000")
          .optional(),
        industry: z.string().trim().max(80).optional(),
        email: z.email("Enter a valid email address").max(160),
        phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/, "Enter a valid phone number"),
        password,
        terms: z.boolean().refine((v) => v, "Please accept the Terms of Service"),
      }),
      handler: async (input, context) => {
        const accountType = (await context.session?.get("registerAccountType")) ?? "business";
        if (accountType === "business" && !input.company_name) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Enter your company name." });
        }
        if (accountType === "individual" && (!input.name || input.name.length < 2)) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Enter your full name." });
        }
        const { email } = await call(() =>
          portal.register({
            accountType,
            // Business sign-up (04.03) collects the contact name later in Profile.
            name: input.name ?? input.company_name ?? input.email,
            email: input.email,
            phone: input.phone,
            password: input.password,
            company: input.company_name ? { name: input.company_name, npwp: input.npwp, industry: input.industry } : undefined,
          }),
        );
        context.session?.set("pendingVerification", { email, accountType });
        return { email };
      },
    }),

    /** 04.06 Verify email (OTP). */
    verifyEmail: defineAction({
      accept: "form",
      input: z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }),
      handler: async (input, context) => {
        const pending = await context.session?.get("pendingVerification");
        if (!pending) throw new ActionError({ code: "BAD_REQUEST", message: "Your verification session expired. Please sign in." });
        const result = await call(() => portal.verifyEmail({ email: pending.email, code: input.code }));
        if (!result) throw new ActionError({ code: "UNAUTHORIZED", message: "That code is incorrect or expired." });
        context.session?.delete("pendingVerification");
        await admitCustomer(result, "This account can't use the customer portal.");
        await signIn(context.session!, result.user, result.tokens, true);
        return { accountType: pending.accountType };
      },
    }),

    resendCode: defineAction({
      accept: "form",
      handler: async (_input, context) => {
        const pending = await context.session?.get("pendingVerification");
        if (!pending) throw new ActionError({ code: "BAD_REQUEST", message: "Your verification session expired. Please sign in." });
        await call(() => portal.resendVerification({ email: pending.email }));
        return { ok: true };
      },
    }),

    /** 04.04 Forgot password. Always succeeds to avoid account enumeration. */
    forgotPassword: defineAction({
      accept: "form",
      input: z.object({
        method: z.enum(["email", "phone"]).default("email"),
        email: z.email("Enter a valid email address").max(160).optional(),
        phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/, "Enter a valid phone number").optional(),
      }),
      handler: async (input) => {
        if (input.method === "email" && !input.email) throw new ActionError({ code: "BAD_REQUEST", message: "Enter your email address." });
        if (input.method === "phone" && !input.phone) throw new ActionError({ code: "BAD_REQUEST", message: "Enter your phone number." });
        await call(() =>
          portal.requestPasswordReset(input.method === "email" ? { email: input.email } : { phone: input.phone }),
        ).catch(() => undefined);
        if (input.method === "phone") return { masked: `•••• ${input.phone!.replace(/\D/g, "").slice(-4)}`, method: "phone" as const };
        const [name, domain] = input.email!.split("@");
        return { masked: `${name.slice(0, 1)}•••••@${domain}`, method: "email" as const };
      },
    }),

    /** 04.07 Account setup (workspace). */
    completeSetup: defineAction({
      accept: "form",
      input: z.object({
        site: z.string().trim().min(5, "Enter your main site address").max(240),
        invite_email: z.array(z.email().max(160)).max(10).optional(),
        invite_role: z.array(z.enum(["approver", "finance", "viewer"])).max(10).optional(),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const invites = (input.invite_email ?? []).map((email, i) => ({ email, role: input.invite_role?.[i] ?? "viewer" }));
        await call(() => portal.completeOnboarding(tokens, { siteAddress: input.site, invites }));
        context.session?.set("flash", { tone: "success", title: "Workspace ready", description: "Your team will receive their invitations by email." });
        return { ok: true };
      },
    }),

    /** 04.05 Set new password. */
    resetPassword: defineAction({
      accept: "form",
      input: z
        .object({ token: z.string().min(8).max(512), password, confirm: z.string() })
        .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] }),
      handler: async (input) => {
        const ok = await call(() => portal.resetPassword({ token: input.token, password: input.password }));
        if (!ok) throw new ActionError({ code: "BAD_REQUEST", message: "This reset link is invalid or has expired." });
        return { ok };
      },
    }),

    logout: defineAction({
      accept: "form",
      handler: async (_input, context) => {
        const tokens = context.locals.tokens;
        if (tokens) await portal.logout(tokens).catch(() => undefined);
        if (context.session) signOut(context.session);
        return { ok: true };
      },
    }),
  },

  portal: {
    acceptQuotation: defineAction({
      accept: "form",
      input: z.object({
        id: z.string().max(40),
        po_number: z.string().trim().max(60).optional(),
        approver: z.string().max(60),
        agree: z.boolean().refine((v) => v, "Please confirm you accept the terms"),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.acceptQuotation(tokens, input.id, { poNumber: input.po_number, approverId: input.approver }));
        context.session?.set("flash", { tone: "success", title: "Quotation accepted", description: "A proforma invoice for the down payment has been issued." });
        return { ok: true };
      },
    }),

    requestRevision: defineAction({
      accept: "form",
      input: z.object({
        id: z.string().max(40),
        topics: z.array(z.string().max(40)).min(1, "Choose what should change"),
        message: z.string().trim().min(5, "Tell us what to change").max(500),
        attachment: z
          .instanceof(File)
          .optional()
          .refine((f) => !f || f.size === 0 || (f.size <= 25 * 1024 * 1024 && /\.pdf$/i.test(f.name)), "Attach a PDF up to 25 MB"),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const attachment = input.attachment && input.attachment.size > 0 ? input.attachment : undefined;
        await call(() => portal.requestQuotationRevision(tokens, input.id, { topics: input.topics, message: input.message }, attachment));
        context.session?.set("flash", { tone: "success", title: "Revision requested", description: "Your account manager replies within 1 working day." });
        return { ok: true };
      },
    }),

    payInvoice: defineAction({
      accept: "form",
      input: z.object({ invoice: z.string().max(40), method: z.string().max(40) }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const intent = await call(() => portal.payInvoice(tokens, input.invoice, input.method));
        context.session?.set("flash", {
          tone: "success",
          title: "Payment started",
          description: `Reference ${intent.reference}. A receipt will be sent to your email.`,
        });
        return intent;
      },
    }),

    createTicket: defineAction({
      accept: "form",
      input: z.object({
        category: z.enum(["hardware", "software", "installation", "billing", "warranty", "other"]),
        priority: z.enum(["low", "normal", "urgent"]),
        product: z.string().max(40).optional(),
        subject: z.string().trim().min(4, "Add a short subject").max(120),
        description: z.string().trim().min(10, "Describe the issue").max(1000),
        photos: z
          .array(z.instanceof(File))
          .transform((files) => files.filter((f) => f.size > 0))
          .refine((files) => files.length <= 5, "Attach up to 5 files")
          .refine((files) => files.every((f) => f.size <= 25 * 1024 * 1024), "Each file must be 25 MB or smaller")
          .refine((files) => files.every((f) => /^(image|video)\//.test(f.type)), "Photos and videos only"),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const ticket = await call(() =>
          portal.createTicket(
            tokens,
            { category: input.category, priority: input.priority, productId: input.product, subject: input.subject, description: input.description },
            input.photos,
          ),
        );
        const product = input.product ? (await call(() => portal.listProducts(tokens))).find((p) => p.id === input.product) : undefined;
        context.session?.set("ticketSubmitted", { ...ticket, device: product?.name, priority: input.priority });
        return ticket;
      },
    }),

    postMessage: defineAction({
      accept: "form",
      input: z.object({
        ticket: z.string().max(40),
        text: z.string().trim().max(2000).optional(),
        attachments: z
          .array(z.instanceof(File))
          .transform((files) => files.filter((f) => f.size > 0))
          .refine((files) => files.length <= 3, "Attach up to 3 files")
          .refine((files) => files.every((f) => f.size <= 10 * 1024 * 1024), "Each file must be 10 MB or smaller")
          .refine((files) => files.every((f) => /^image\//.test(f.type) || f.type === "application/pdf"), "Photos and PDFs only"),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        if (!input.text && input.attachments.length === 0) throw new ActionError({ code: "BAD_REQUEST", message: "Write a message or attach a file" });
        await call(() => portal.postTicketMessage(tokens, input.ticket, input.text ?? "", input.attachments));
        return { ok: true };
      },
    }),

    bookService: defineAction({
      accept: "form",
      input: z.object({
        service_type: z.enum(["repair", "maintenance", "inspection"]),
        product: z.string().max(40),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const booking = await call(() =>
          portal.bookService(tokens, { serviceType: input.service_type, productId: input.product, date: input.date, time: input.time }),
        );
        context.session?.set("flash", { tone: "success", title: "Service visit booked", description: `${booking.label}. We'll confirm the technician by WhatsApp.` });
        return booking;
      },
    }),

    lookupDevice: defineAction({
      accept: "form",
      input: z.object({ serial: z.string().trim().min(6).max(40) }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const device = await call(() => portal.lookupDevice(tokens, input.serial));
        if (!device) throw new ActionError({ code: "NOT_FOUND", message: "We couldn't find that serial number. Check the label and try again." });
        return device;
      },
    }),

    registerDevice: defineAction({
      accept: "form",
      input: z.object({ serial: z.string().trim().min(6).max(40) }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.registerDevice(tokens, input.serial));
        context.session?.set("flash", { tone: "success", title: "Device registered", description: "Warranty is now active for this device." });
        return { ok: true };
      },
    }),
  },
  /** Account, company, team, sites, settings and wishlist (05.09–05.11, 06.07). */
  /**
   * Guest RFQs from entragate.com join an account only after ownership is proven: the ERP
   * emails a one-time code to the address on the RFQ, and the customer enters it here.
   */
  rfq: {
    requestClaim: defineAction({
      accept: "form",
      input: z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z]{2,5}-[0-9A-Z-]{4,30}$/, "Enter the RFQ reference from your confirmation email") }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const challenge = await call(() => portal.requestRfqClaim(tokens, input.reference));
        if (!challenge) {
          throw new ActionError({ code: "NOT_FOUND", message: "We couldn't find a guest request with that reference, or it's already linked to an account." });
        }
        context.session?.set("rfqClaim", { reference: challenge.reference, maskedEmail: challenge.maskedEmail });
        return challenge;
      },
    }),

    confirmClaim: defineAction({
      accept: "form",
      input: z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const pending = await context.session?.get("rfqClaim");
        if (!pending) throw new ActionError({ code: "BAD_REQUEST", message: "Start again by entering your RFQ reference." });
        const ok = await call(() => portal.confirmRfqClaim(tokens, pending.reference, input.code));
        if (!ok) throw new ActionError({ code: "UNAUTHORIZED", message: "That code is incorrect or has expired." });
        context.session?.delete("rfqClaim");
        context.session?.set("flash", { tone: "success", title: "Request added to your account", description: `${pending.reference} now appears under Quotations.` });
        return { reference: pending.reference };
      },
    }),
  },

  account: {
    updatePersonal: defineAction({
      accept: "form",
      input: z.object({
        name: z.string().trim().min(2, "Enter your full name").max(80),
        phone: z.string().trim().regex(/^\+?[\d\s-]{8,20}$/, "Enter a valid phone number"),
        job_title: z.string().trim().max(80).optional(),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.updatePersonal(tokens, { name: input.name, phone: input.phone, jobTitle: input.job_title }));
        const auth = await context.session?.get("auth");
        if (auth) context.session?.set("auth", { ...auth, user: { ...auth.user, name: input.name, jobTitle: input.job_title ?? auth.user.jobTitle } });
        context.session?.set("flash", { tone: "success", title: "Personal details saved" });
        return { ok: true };
      },
    }),

    updateCompany: defineAction({
      accept: "form",
      input: z.object({
        name: z.string().trim().min(3, "Enter the registered company name").max(120),
        npwp: z
          .string()
          .trim()
          .regex(/^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/, "Use the format 01.234.567.8-901.000")
          .optional(),
        industry: z.string().trim().max(80).optional(),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.updateCompany(tokens, input));
        context.session?.set("flash", { tone: "success", title: "Company profile saved" });
        return { ok: true };
      },
    }),

    inviteMember: defineAction({
      accept: "form",
      input: z.object({
        email: z.string().trim().toLowerCase().pipe(z.email("Enter a work email").max(160)),
        role: z.enum(["approver", "finance", "viewer"]),
        approval_limit: z.number().int().min(1_000_000, "Set a limit of at least Rp 1.000.000").max(100_000_000_000).optional(),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        if (input.role === "approver" && !input.approval_limit) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Set an approval limit for approvers" });
        }
        const member = await call(() =>
          portal.inviteMember(tokens, { email: input.email, role: input.role, approvalLimit: input.role === "approver" ? input.approval_limit : undefined }),
        );
        context.session?.set("flash", { tone: "success", title: "Invitation sent", description: `${input.email} will get an email to join your company account.` });
        return { id: member.id };
      },
    }),

    removeMember: defineAction({
      accept: "form",
      input: z.object({ id: z.string().max(60) }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.removeMember(tokens, input.id));
        context.session?.set("flash", { tone: "info", title: "Member removed", description: "They no longer have access to your company account." });
        return { ok: true };
      },
    }),

    saveSite: defineAction({
      accept: "form",
      input: z.object({
        id: z.string().max(60).optional(),
        name: z.string().trim().min(2, "Name this site").max(80),
        address: z.string().trim().min(10, "Enter the full address").max(240),
        pic_name: z.string().trim().min(2, "Who should we contact on site?").max(80),
        pic_phone: z.string().trim().regex(/^\+?[\d\s-]{8,20}$/, "Enter a valid phone number"),
        primary: z.boolean().optional(),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const site = await call(() =>
          portal.saveSite(tokens, { id: input.id, name: input.name, address: input.address, picName: input.pic_name, picPhone: input.pic_phone, primary: input.primary }),
        );
        context.session?.set("flash", { tone: "success", title: input.id ? "Site updated" : "Site added", description: site.name });
        return site;
      },
    }),

    deleteSite: defineAction({
      accept: "form",
      input: z.object({ id: z.string().max(60) }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.deleteSite(tokens, input.id));
        context.session?.set("flash", { tone: "info", title: "Site removed" });
        return { ok: true };
      },
    }),

    /** Single preference toggle/select; sent immediately from the settings screens. */
    updateSetting: defineAction({
      accept: "form",
      input: z.object({
        key: z.enum(["push", "twoStep", "language"]),
        value: z.string().max(20),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const on = input.value === "true";
        let patch: SettingsPatch;
        if (input.key === "push") patch = { notifications: { push: on } };
        else if (input.key === "twoStep") patch = { security: { twoStep: on } };
        else patch = { preferences: { language: input.value === "id" ? "id" : "en" } };
        await call(() => portal.updateSettings(tokens, patch));
        return { ok: true };
      },
    }),

    changePassword: defineAction({
      accept: "form",
      input: z.object({
        current: z.string().min(1, "Enter your current password").max(128),
        password,
        confirm: z.string().max(128),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        if (input.password !== input.confirm) throw new ActionError({ code: "BAD_REQUEST", message: "The new passwords don't match" });
        if (input.password === input.current) throw new ActionError({ code: "BAD_REQUEST", message: "Choose a password you haven't used here" });
        const changed = await call(() => portal.changePassword(tokens, { current: input.current, next: input.password }));
        if (!changed) throw new ActionError({ code: "BAD_REQUEST", message: "Your current password is incorrect" });
        context.session?.set("flash", { tone: "success", title: "Password changed", description: "Use your new password the next time you sign in." });
        return { ok: true };
      },
    }),

    /** Signs one other device out (ERP-0106). */
    revokeDevice: defineAction({
      accept: "form",
      input: z.object({ id: z.string().min(1).max(128) }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.revokeDevice(tokens, input.id));
        return { ok: true };
      },
    }),

    signOutOtherDevices: defineAction({
      accept: "form",
      handler: async (_input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.signOutOtherDevices(tokens));
        return { ok: true };
      },
    }),

    /** Deletes the login only; orders, documents and the company stay (ERP-0106). */
    closeAccount: defineAction({
      accept: "form",
      input: z.object({
        password: z.string().min(1, "Enter your password").max(128),
        confirm: z.boolean().refine((value) => value, "Tick the box to confirm"),
      }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        const result = await call(() => portal.closeAccount(tokens, { password: input.password }));
        if (!result.ok) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message:
              result.reason === "wrong_password"
                ? "Your password is incorrect"
                : (result.message ?? "You are the only owner of this company account. Make a colleague an owner first."),
          });
        }
        signOut(context.session!);
        return { ok: true };
      },
    }),

    removeWishlistItem: defineAction({
      accept: "form",
      input: z.object({ id: z.string().max(60) }),
      handler: async (input, context) => {
        const tokens = requireAuth(context);
        await call(() => portal.removeWishlistItem(tokens, input.id));
        return { ok: true };
      },
    }),
  },
};

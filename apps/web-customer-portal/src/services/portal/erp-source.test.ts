/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { ApiError } from "@/api/client";
import { createErpPortalSource, PortalNotConfiguredError, type AuthTokens, type PortalSource } from "@/api/portal";
import { ErpContractError } from "@/api/portal-schemas";
import { SessionExpiredError } from "../errors";
import { envelopeUnwrapper, unwrapEnvelope } from "./envelope";
import { erpRoutes } from "./erp-routes";
import { withSessionExpiry } from "./session-expiry";

/**
 * The portal's ERP source against payloads shaped like the backend's
 * (`apps/backend/src/app/customer/utils/portal-presenter.ts` behind the `ok()` / `created()` /
 * `noContent()` envelope and `toErrorResponse`). Nothing here talks to a live backend.
 */

const BASE = "http://localhost:3001";
const PREFIX = "/customers/portal/v1";
const TOKEN = "ba_session_token_0123456789abcdef";
/** The ERP session cookie as the portal keeps it (`name=value`, ERP-0094, ADR-0027). */
const COOKIE = `better-auth.session_token=${TOKEN}`;
const session: AuthTokens = { sessionCookie: COOKIE, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };

type Call = { url: URL; init: RequestInit };

const envelope = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify({ requestId: "r-1", status, message: status === 201 ? "Created" : "OK", timestamp: 1, data }), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });

/** A sign-in answer: the session as `Set-Cookie` (Better Auth's attributes), never in the body. */
const signedIn = (data: unknown) => envelope(data, 200, { "set-cookie": `${COOKIE}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax` });

/** `errorEnvelope()` as written by `toErrorResponse` for an `AppError`. */
const errorEnvelope = (status: number, message: string) =>
  new Response(JSON.stringify({ requestId: "r-1", status, message, timestamp: 1, data: null, errors: [{ field: null, message }] }), {
    status,
    headers: { "content-type": "application/json" },
  });

function mockFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: new URL(String(input)), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, fetcher };
}

const sourceWith = (fetcher: typeof fetch, timeoutMs = 1000): PortalSource =>
  createErpPortalSource({
    baseUrl: BASE,
    routes: erpRoutes,
    fetcher,
    retries: 0,
    timeoutMs,
    unwrap: unwrapEnvelope,
    defaultHeaders: { "X-Client": "entragate-customer-portal", "Accept-Language": "en" },
  });

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

/** `portalUser()` output. */
const backendUser = {
  id: "7f3c9a52-0000-4000-8000-000000000001",
  name: "Hendra Wijaya",
  initials: "HW",
  email: "hendra@majulogistik.co.id",
  phone: "+62 812 0000 1111",
  accountType: "business",
  verified: true,
  company: { id: "11111111-2222-4333-8444-555555555555", name: "Maju Logistik", npwp: "01.234.567.8-901.000", shortName: "ML" },
};
const backendSession = { expiresAt: "2026-11-27T10:00:00.000Z" };

describe("route map", () => {
  test("every mapped route is under the backend's /customers/portal/v1 prefix", () => {
    for (const [operation, path] of Object.entries(erpRoutes)) {
      expect(path, operation).toStartWith(`${PREFIX}/`);
    }
  });

  test("no stale pre-ADR-0024 /portal/v1 paths remain", () => {
    expect(Object.values(erpRoutes).some((path) => path?.startsWith("/portal/"))).toBe(false);
  });
});

describe("envelope", () => {
  test("unwraps data, including noContent's null", () => {
    expect(unwrapEnvelope({ requestId: "r", status: 200, data: { a: 1 } })).toEqual({ a: 1 });
    // A paginated envelope keeps the shared TPaginationMeta (`okPaginated` in the backend).
    const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
    expect(unwrapEnvelope({ requestId: "r", status: 200, pagination, data: [{ a: 1 }] })).toEqual({ items: [{ a: 1 }], pagination });
    expect(unwrapEnvelope({ requestId: "r", status: 200, data: null })).toBeNull();
    expect(unwrapEnvelope("plain")).toBe("plain");
  });

  test("unwraps unless ERP_RESPONSE_ENVELOPE=none", () => {
    expect(envelopeUnwrapper(undefined)).toBe(unwrapEnvelope);
    expect(envelopeUnwrapper("data")).toBe(unwrapEnvelope);
    expect(envelopeUnwrapper("none")).toBeUndefined();
  });
});

describe("security settings (ERP-0106)", () => {
  test("two-step login: the challenge comes back, no cookie is taken, the visitor's browser is forwarded", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({ ok: false, twoStep: true, challenge: "c".repeat(32), email: "h***@majulogistik.co.id" }));
    const result = await sourceWith(fetcher).login({
      email: "hendra@majulogistik.co.id",
      password: "secret-password",
      accountType: "business",
      client: { userAgent: "Firefox/1", ip: "203.0.113.9" },
    });
    expect(result).toEqual({ ok: false, reason: "two_step", challenge: "c".repeat(32), email: "h***@majulogistik.co.id" });
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/auth/login`);
    expect(header(calls[0]!, "user-agent")).toBe("Firefox/1");
    expect(header(calls[0]!, "x-forwarded-for")).toBe("203.0.113.9");
    expect(JSON.parse(String(calls[0]!.init.body))).not.toHaveProperty("client");
  });

  test("verifyLoginCode keeps the Set-Cookie session; a wrong code (400) is null; resend posts the challenge", async () => {
    const { calls, fetcher } = mockFetch(({ url }) => {
      if (url.pathname.endsWith("/login/resend")) return envelope(null);
      return JSON.parse(String(calls[calls.length - 1]!.init.body)).code === "123456"
        ? signedIn({ ok: true, user: backendUser, session: backendSession })
        : errorEnvelope(400, "The code is wrong or has expired");
    });
    const source = withSessionExpiry(sourceWith(fetcher));
    const verified = await source.verifyLoginCode({ challenge: "c".repeat(32), code: "123456" });
    expect(verified?.tokens.sessionCookie).toBe(COOKIE);
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/auth/login/verify`);
    expect(header(calls[0]!, "cookie")).toBeNull();
    expect(await source.verifyLoginCode({ challenge: "c".repeat(32), code: "000000" })).toBeNull();
    await source.resendLoginCode({ challenge: "c".repeat(32) });
    expect(calls[2]!.url.pathname).toBe(`${PREFIX}/auth/login/resend`);
  });

  test("devices: list, sign one out by id, sign out the others; settings PATCH", async () => {
    const devices = [{ id: "sid-1", userAgent: "Firefox/1", ipAddress: null, createdAt: "2026-11-21T01:00:00.000Z", updatedAt: "2026-11-21T01:00:00.000Z", current: true }];
    const { calls, fetcher } = mockFetch(({ url }) => (url.pathname.endsWith("/account/devices") ? envelope(devices) : envelope(null)));
    const source = sourceWith(fetcher);
    expect(await source.listDevices(session)).toEqual(devices);
    await source.revokeDevice(session, "sid/2");
    await source.signOutOtherDevices(session);
    await source.updateSettings(session, { security: { twoStep: true } });
    expect(calls.map((call) => [call.init.method ?? "GET", call.url.pathname])).toEqual([
      ["GET", `${PREFIX}/account/devices`],
      ["DELETE", `${PREFIX}/account/devices/sid%2F2`],
      ["POST", `${PREFIX}/account/devices/sign-out-others`],
      ["PATCH", `${PREFIX}/account/settings`],
    ]);
    for (const call of calls) expect(header(call, "cookie")).toBe(COOKIE);
  });

  test("closeAccount: 400 is a wrong password, 409 the only owner with the ERP's message", async () => {
    let status = 400;
    const { fetcher } = mockFetch(() => (status === 200 ? envelope(null) : errorEnvelope(status, status === 409 ? "You are the only owner" : "The current password is wrong")));
    const source = sourceWith(fetcher);
    expect(await source.closeAccount(session, { password: "x" })).toEqual({ ok: false, reason: "wrong_password" });
    status = 409;
    expect(await source.closeAccount(session, { password: "x" })).toEqual({ ok: false, reason: "last_owner", message: "You are the only owner" });
    status = 200;
    expect(await source.closeAccount(session, { password: "x" })).toEqual({ ok: true });
  });
});

describe("authentication", () => {
  test("login posts the credentials without a session and keeps the Set-Cookie session server-side", async () => {
    const { calls, fetcher } = mockFetch(() => signedIn({ ok: true, user: backendUser, session: backendSession }));
    const result = await sourceWith(fetcher).login({ email: "hendra@majulogistik.co.id", password: "secret-password", accountType: "business" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.company?.shortName).toBe("ML");
      expect(result.tokens.sessionCookie).toBe(COOKIE);
      expect(result.tokens.expiresAt).toBe(backendSession.expiresAt);
      expect(result.tokens.refreshToken).toBeUndefined();
    }
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/auth/login`);
    expect(calls[0]!.init.method).toBe("POST");
    expect(header(calls[0]!, "authorization")).toBeNull();
    expect(header(calls[0]!, "cookie")).toBeNull();
    expect(header(calls[0]!, "accept-language")).toBe("en");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ email: "hendra@majulogistik.co.id", password: "secret-password", accountType: "business" });
  });

  test("401 from login is invalid credentials, 423 is locked", async () => {
    const wrong = sourceWith(mockFetch(() => errorEnvelope(401, "Invalid email or password")).fetcher);
    expect(await wrong.login({ email: "a@b.co", password: "x", accountType: "business" })).toEqual({ ok: false, reason: "invalid_credentials", attemptsLeft: undefined });

    const locked = sourceWith(mockFetch(() => errorEnvelope(423, "Too many failed sign-ins")).fetcher);
    const result = await locked.login({ email: "a@b.co", password: "x", accountType: "business" });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "locked") expect(Date.parse(result.lockedUntil)).toBeGreaterThan(Date.now());
    else throw new Error("expected a locked result");
  });

  test("a login body that breaks the contract raises ErpContractError", async () => {
    const source = sourceWith(mockFetch(() => signedIn({ ok: true, user: backendUser, session: { expiresAt: "nope" } })).fetcher);
    await expect(source.login({ email: "a@b.co", password: "x", accountType: "business" })).rejects.toBeInstanceOf(ErpContractError);
  });

  test("a sign-in without a session cookie raises ErpContractError", async () => {
    const source = sourceWith(mockFetch(() => envelope({ ok: true, user: backendUser, session: backendSession })).fetcher);
    await expect(source.login({ email: "a@b.co", password: "x", accountType: "business" })).rejects.toBeInstanceOf(ErpContractError);
  });

  test("register returns the email; a business sign-up (403, invitation only) surfaces as an ApiError", async () => {
    const ok = mockFetch(() => envelope({ email: "ani@example.com" }));
    expect(await sourceWith(ok.fetcher).register({ accountType: "individual", name: "Ani", email: "ani@example.com", phone: "0812000011", password: "a-long-password" })).toEqual({
      email: "ani@example.com",
    });
    expect(ok.calls[0]!.url.pathname).toBe(`${PREFIX}/auth/register`);

    const business = sourceWith(mockFetch(() => errorEnvelope(403, "Business accounts are created by invitation")).fetcher);
    const error = await business
      .register({ accountType: "business", name: "PT Maju", email: "a@b.co", phone: "0812000011", password: "a-long-password" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).messages).toEqual(["Business accounts are created by invitation"]);
  });

  test("verifyEmail returns the session for the right code and null for a wrong or expired one (400)", async () => {
    const good = mockFetch(() => signedIn({ user: backendUser, session: backendSession }));
    const verified = await sourceWith(good.fetcher).verifyEmail({ email: "ani@example.com", code: "482913" });
    expect(verified?.tokens.sessionCookie).toBe(COOKIE);
    expect(good.calls[0]!.url.pathname).toBe(`${PREFIX}/auth/verify-email`);

    const bad = sourceWith(mockFetch(() => errorEnvelope(400, "Invalid or expired code")).fetcher);
    expect(await bad.verifyEmail({ email: "ani@example.com", code: "000000" })).toBeNull();

    const down = sourceWith(mockFetch(() => errorEnvelope(500, "boom")).fetcher);
    await expect(down.verifyEmail({ email: "ani@example.com", code: "482913" })).rejects.toBeInstanceOf(ApiError);
  });

  test("resendVerification resolves to undefined for noContent()", async () => {
    const { calls, fetcher } = mockFetch(() => envelope(null));
    expect(await sourceWith(fetcher).resendVerification({ email: "ani@example.com" })).toBeUndefined();
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/auth/verify-email/resend`);
  });

  test("password reset by email posts only the email; by phone is not available", async () => {
    const { calls, fetcher } = mockFetch(() => envelope(null));
    const source = sourceWith(fetcher);
    await source.requestPasswordReset({ email: "ani@example.com" });
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/auth/password-reset`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ email: "ani@example.com" });

    await expect(source.requestPasswordReset({ phone: "+6281200001111" })).rejects.toBeInstanceOf(PortalNotConfiguredError);
    expect(calls).toHaveLength(1);
  });

  test("resetPassword is true on success and false for an invalid or expired link (400)", async () => {
    const ok = mockFetch(() => envelope(null));
    expect(await sourceWith(ok.fetcher).resetPassword({ token: "t".repeat(32), password: "a-long-password" })).toBe(true);
    expect(ok.calls[0]!.url.pathname).toBe(`${PREFIX}/auth/password-reset/confirm`);

    const expired = sourceWith(mockFetch(() => errorEnvelope(400, "Invalid or expired link")).fetcher);
    expect(await expired.resetPassword({ token: "t".repeat(32), password: "a-long-password" })).toBe(false);
  });

  test("logout sends the bearer token", async () => {
    const { calls, fetcher } = mockFetch(() => envelope(null));
    await sourceWith(fetcher).logout(session);
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/auth/logout`);
    expect(header(calls[0]!, "cookie")).toBe(COOKIE);
    expect(header(calls[0]!, "authorization")).toBeNull();
  });

  test("changePassword: 400 is a wrong current password, 401 is an ended session", async () => {
    const wrong = sourceWith(mockFetch(() => errorEnvelope(400, "The current password is wrong")).fetcher);
    expect(await wrong.changePassword(session, { current: "x", next: "a-long-password" })).toBe(false);

    const ok = mockFetch(() => envelope(null));
    expect(await sourceWith(ok.fetcher).changePassword(session, { current: "x", next: "a-long-password" })).toBe(true);
    expect(ok.calls[0]!.url.pathname).toBe(`${PREFIX}/account/password`);

    const ended = sourceWith(mockFetch(() => errorEnvelope(401, "Portal session required")).fetcher);
    await expect(ended.changePassword(session, { current: "x", next: "a-long-password" })).rejects.toMatchObject({ status: 401 });
  });
});

describe("authenticated reads", () => {
  const backendProject = {
    id: "8b1d0d7e-0000-4000-8000-000000000010",
    code: "PRJ-2026-0007",
    name: "Gate system HQ",
    site: "Jakarta HQ",
    status: "on_track",
    stage: 3,
    stageCount: 6,
    stageLabel: "Installation",
    progress: 0.5,
    nextLabel: "Cable pulling",
    completionLabel: "Target 30 Nov 2026",
    team: [{ initials: "BS", name: "Budi Santoso" }],
  };
  const backendTicket = {
    id: "9c2e1e8f-0000-4000-8000-000000000020",
    number: "TKT-2026-0042",
    subject: "Turnstile 2 does not read cards",
    shortSubject: "Turnstile 2 does not read cards",
    status: "awaiting_you",
    priority: "normal",
    lastMessage: { author: "Support", role: "Support", initials: "SU", text: "Please try again", ago: "2 hours ago", unread: 0 },
  };

  test("getHome, getBadges and getAccount hit the mapped routes with the bearer token", async () => {
    const { calls, fetcher } = mockFetch(({ url }) => {
      if (url.pathname.endsWith("/home")) {
        return envelope({ activeProject: { ...backendProject, index: 1, total: 1 }, quotations: [], openTickets: [backendTicket], activity: [], unreadNotifications: 0 });
      }
      if (url.pathname.endsWith("/badges")) return envelope({ activeOrders: 0, quotationsAwaiting: 0, openTickets: 1, unreadNotifications: 0 });
      return envelope({
        personal: { name: "Hendra Wijaya", email: "hendra@majulogistik.co.id", phone: "+62 812 0000 1111" },
        company: { name: "Maju Logistik", shortName: "ML", npwp: "01.234.567.8-901.000", verified: true },
        members: [
          { id: "m-1", name: "Hendra Wijaya", email: "hendra@majulogistik.co.id", initials: "HW", role: "owner", admin: true, status: "active", lastActiveLabel: "1 hour ago" },
        ],
        sites: [],
        notifications: { push: false, email: true, whatsapp: false },
        security: { twoStep: false, passwordChangedLabel: "", activeDevices: 1 },
        preferences: { language: "en", currency: "IDR" },
      });
    });
    const source = sourceWith(fetcher);

    const home = await source.getHome(session);
    expect(home.activeProject?.code).toBe("PRJ-2026-0007");
    expect(home.openTickets[0]?.status).toBe("awaiting_you");
    expect((await source.getBadges(session)).openTickets).toBe(1);
    const account = await source.getAccount(session);
    expect(account.members[0]?.role).toBe("owner");
    expect(account.sites).toEqual([]);

    expect(calls.map((c) => c.url.pathname)).toEqual([`${PREFIX}/home`, `${PREFIX}/badges`, `${PREFIX}/account`]);
    for (const call of calls) {
      expect(header(call, "cookie")).toBe(COOKIE);
      expect(header(call, "authorization")).toBeNull();
    }
  });

  test("projects: list, detail, and 404 → null", async () => {
    const detail = {
      ...backendProject,
      daysLeft: 12,
      openTasks: 4,
      milestones: [{ title: "Installation", dateLabel: "30 Nov 2026", state: "current", tasks: [{ label: "Cable pulling", done: false }], tasksDone: 0, tasksTotal: 1 }],
      documents: [{ id: "f-1", name: "BAST PRJ-2026-0007", meta: "30 Nov 2026", kind: "file" }],
      manager: { name: "Budi Santoso", role: "Project manager" },
    };
    const { calls, fetcher } = mockFetch(({ url }) => {
      if (url.pathname === `${PREFIX}/projects`) return envelope([backendProject]);
      if (url.pathname.endsWith(detail.id)) return envelope(detail);
      return errorEnvelope(404, "Project not found");
    });
    const source = sourceWith(fetcher);

    expect((await source.listProjects(session))[0]?.name).toBe("Gate system HQ");
    expect((await source.getProject(session, detail.id))?.milestones[0]?.state).toBe("current");
    expect(await source.getProject(session, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(calls[1]!.url.pathname).toBe(`${PREFIX}/projects/${detail.id}`);
  });

  test("tickets: list, detail with canConfirm, 404 → null", async () => {
    const detail = {
      ...backendTicket,
      stage: 4,
      agent: { name: "Support", initials: "SU", online: false, replyLabel: "" },
      messages: [{ kind: "message", id: "x:complaint", from: "customer", text: "It does not read cards", time: "14 Nov 2026" }],
      quickReplies: [],
      createdLabel: "14 Nov 2026",
      activity: [{ title: "Ticket created", dateLabel: "14 Nov 2026", state: "done" }],
      canConfirm: true,
    };
    const { fetcher } = mockFetch(({ url }) => {
      if (url.pathname === `${PREFIX}/tickets`) return envelope([backendTicket]);
      if (url.pathname.endsWith(backendTicket.id)) return envelope(detail);
      return errorEnvelope(404, "Not found");
    });
    const source = sourceWith(fetcher);

    expect((await source.listTickets(session))[0]?.number).toBe("TKT-2026-0042");
    const ticket = await source.getTicket(session, backendTicket.id);
    expect(ticket?.messages).toHaveLength(1);
    expect(await source.getTicket(session, "not-a-uuid")).toBeNull();
  });

  test("createTicket sends multipart `payload` and returns { id, number }", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({ id: backendTicket.id, number: "TKT-2026-0043" }, 201));
    const created = await sourceWith(fetcher).createTicket(
      session,
      { category: "hardware", priority: "normal", subject: "Reader broken", description: "The reader does not respond." },
      [],
    );
    expect(created).toEqual({ id: backendTicket.id, number: "TKT-2026-0043" });
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/tickets`);
    expect(calls[0]!.init.method).toBe("POST");
    const form = calls[0]!.init.body as FormData;
    expect(JSON.parse(String(form.get("payload")))).toMatchObject({ subject: "Reader broken", category: "hardware" });
    // multipart: the runtime sets the boundary itself
    expect(header(calls[0]!, "content-type")).toBeNull();
  });

  test("createTicket relays the backend's 422 when photos are attached (not stored yet)", async () => {
    const source = sourceWith(mockFetch(() => errorEnvelope(422, "Attachments are not supported yet")).fetcher);
    const photo = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const error = await source
      .createTicket(session, { category: "other", priority: "low", subject: "Photo", description: "With a photo attached." }, [photo])
      .catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).messages[0]).toBe("Attachments are not supported yet");
  });

  test("a 422 reports the envelope's field errors, not just the top-level message", async () => {
    const body = {
      requestId: "r-2",
      status: 422,
      message: "Validation failed",
      timestamp: 1,
      data: null,
      errors: [{ field: "subject", message: "Subject is required" }],
    };
    const source = sourceWith(
      mockFetch(() => new Response(JSON.stringify(body), { status: 422, headers: { "content-type": "application/json" } })).fetcher,
    );
    const error = await source
      .createTicket(session, { category: "other", priority: "low", subject: "", description: "Missing subject here." }, [])
      .catch((e: unknown) => e);
    expect((error as ApiError).errors).toEqual([{ field: "subject", message: "Subject is required" }]);
    expect((error as ApiError).messages).toEqual(["Subject is required"]);
  });

  test("postTicketMessage sends JSON { text } to the ticket thread", async () => {
    const { calls, fetcher } = mockFetch(() => envelope({ id: "msg-1" }, 201));
    await sourceWith(fetcher).postTicketMessage(session, backendTicket.id, "Thanks, it works now");
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/tickets/${backendTicket.id}/messages`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ text: "Thanks, it works now" });
    expect(header(calls[0]!, "content-type")).toBe("application/json");
  });

  test("products and warranty: the `<certificate>:<line>` id keeps its colon in the path", async () => {
    const productId = "5d4c3b2a-0000-4000-8000-000000000030:0";
    const device = {
      id: productId,
      name: "Turnstile Pro",
      serialLabel: "SN-001",
      site: "Jakarta HQ",
      siteKey: "prj-1",
      warrantyStatus: "active",
      monthsLeft: 10,
      daysLeft: 310,
      progress: 0.85,
    };
    const warranty = {
      productId,
      certificate: "WRC-2026-0001",
      plan: "12-month warranty",
      productName: "Turnstile Pro",
      serial: "SN-001",
      installedLabel: "1 Jan 2026",
      monthsRemaining: 10,
      termMonths: 12,
      periodLabel: "1 Jan 2026 – 31 Dec 2026",
      coverage: [{ title: "Parts and labour", detail: "", covered: true }],
      history: [],
      certificateFile: { id: "c-1", name: "Warranty certificate WRC-2026-0001", meta: "1 Jan 2026", kind: "file" },
    };
    const { calls, fetcher } = mockFetch(({ url }) => (url.pathname.endsWith("/warranty") ? envelope(warranty) : envelope([device])));
    const source = sourceWith(fetcher);

    expect((await source.listProducts(session))[0]?.warrantyStatus).toBe("active");
    expect((await source.getWarranty(session, productId))?.termMonths).toBe(12);
    expect(calls[1]!.url.pathname).toBe(`${PREFIX}/products/${productId}/warranty`);
    expect(calls[1]!.url.href).not.toContain("%3A");
  });

  test("members: invite posts email and role; removing one DELETEs by id", async () => {
    const member = { id: "m-2", email: "rina@majulogistik.co.id", initials: "RI", role: "finance", admin: false, status: "invited", lastActiveLabel: "" };
    const { calls, fetcher } = mockFetch(({ init }) => (init.method === "POST" ? envelope(member, 201) : envelope(null)));
    const source = sourceWith(fetcher);

    expect((await source.inviteMember(session, { email: "rina@majulogistik.co.id", role: "finance" })).status).toBe("invited");
    expect(calls[0]!.url.pathname).toBe(`${PREFIX}/account/members`);
    await source.removeMember(session, "m-2");
    expect(calls[1]!.init.method).toBe("DELETE");
    expect(calls[1]!.url.pathname).toBe(`${PREFIX}/account/members/m-2`);
  });
});

describe("failures", () => {
  test("a guard 401 on an authenticated call becomes SessionExpiredError through withSessionExpiry", async () => {
    const source = withSessionExpiry(sourceWith(mockFetch(() => errorEnvelope(401, "Portal session required")).fetcher));
    await expect(source.listProjects(session)).rejects.toBeInstanceOf(SessionExpiredError);
    await expect(source.getHome(session)).rejects.toBeInstanceOf(SessionExpiredError);
  });

  test("a 401 on a sessionless operation (wrong password at login) is not a session expiry", async () => {
    const source = withSessionExpiry(sourceWith(mockFetch(() => errorEnvelope(401, "Invalid email or password")).fetcher));
    const result = await source.login({ email: "a@b.co", password: "x", accountType: "business" });
    expect(result).toMatchObject({ ok: false, reason: "invalid_credentials" });
  });

  test("other errors keep their status (500 is not a session expiry)", async () => {
    const source = withSessionExpiry(sourceWith(mockFetch(() => errorEnvelope(500, "Something went wrong")).fetcher));
    await expect(source.listTickets(session)).rejects.toMatchObject({ status: 500 });
  });

  test("a request that exceeds the timeout fails as a network ApiError (status 0)", async () => {
    const fetcher = ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      })) as typeof fetch;
    const error = await sourceWith(fetcher, 25).getBadges(session).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  test("a network failure is an ApiError with status 0", async () => {
    const fetcher = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(sourceWith(fetcher).getHome(session)).rejects.toMatchObject({ status: 0 });
  });

  test("a backend id that does not exist answers 404 → null for the ticket, project and warranty reads", async () => {
    const source = sourceWith(mockFetch(() => errorEnvelope(404, "Not found")).fetcher);
    expect(await source.getTicket(session, "x")).toBeNull();
    expect(await source.getProject(session, "x")).toBeNull();
    expect(await source.getWarranty(session, "x:0")).toBeNull();
  });
});

describe("operations the backend has no route for", () => {
  const unavailable: [string, (source: PortalSource) => Promise<unknown>][] = [
    ["refreshSession", (s) => s.refreshSession("r".repeat(32))],
    ["completeOnboarding", (s) => s.completeOnboarding(session, { siteAddress: "Jl. Sudirman 1", invites: [] })],
    ["listNotifications", (s) => s.listNotifications(session)],
    ["listOrders", (s) => s.listOrders(session)],
    ["getOrder", (s) => s.getOrder(session, "1")],
    ["listQuotations", (s) => s.listQuotations(session)],
    ["getQuotation", (s) => s.getQuotation(session, "1")],
    ["acceptQuotation", (s) => s.acceptQuotation(session, "1", { approverId: "a" })],
    ["requestQuotationRevision", (s) => s.requestQuotationRevision(session, "1", { topics: ["price"], message: "Lower please" })],
    ["listInvoices", (s) => s.listInvoices(session)],
    ["getInvoice", (s) => s.getInvoice(session, "1")],
    ["listPaymentMethods", (s) => s.listPaymentMethods(session)],
    ["payInvoice", (s) => s.payInvoice(session, "1", "qris")],
    ["lookupDevice", (s) => s.lookupDevice(session, "SN-000001")],
    ["registerDevice", (s) => s.registerDevice(session, "SN-000001")],
    ["getBookingOptions", (s) => s.getBookingOptions(session)],
    ["bookService", (s) => s.bookService(session, { serviceType: "repair", productId: "p", date: "2026-12-01", time: "09:00" })],
    ["getProfile", (s) => s.getProfile(session)],
    ["listDocuments", (s) => s.listDocuments(session, "invoices")],
    ["updatePersonal", (s) => s.updatePersonal(session, { name: "Hendra", phone: "0812000011" })],
    ["updateCompany", (s) => s.updateCompany(session, { name: "Maju Logistik" })],
    ["saveSite", (s) => s.saveSite(session, { name: "HQ", address: "Jl. Sudirman 1", picName: "A", picPhone: "0812000011" })],
    ["deleteSite", (s) => s.deleteSite(session, "1")],
    ["listWishlist", (s) => s.listWishlist(session)],
    ["removeWishlistItem", (s) => s.removeWishlistItem(session, "1")],
    ["lookupPublicOrder", (s) => s.lookupPublicOrder("SO-2026-0001")],
    ["listRfqs", (s) => s.listRfqs(session)],
    ["requestRfqClaim", (s) => s.requestRfqClaim(session, "RFQ-0001")],
    ["confirmRfqClaim", (s) => s.confirmRfqClaim(session, "RFQ-0001", "123456")],
  ];

  test.each(unavailable)("%s rejects with PortalNotConfiguredError and never calls the backend", async (_name, call) => {
    const { calls, fetcher } = mockFetch(() => envelope(null));
    const source = withSessionExpiry(sourceWith(fetcher));
    await expect(call(source)).rejects.toBeInstanceOf(PortalNotConfiguredError);
    expect(calls).toHaveLength(0);
  });

  test("the same holds on the bare source (a rejection, not a synchronous throw)", async () => {
    const { fetcher } = mockFetch(() => envelope(null));
    const promise = sourceWith(fetcher).listOrders(session);
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toBeInstanceOf(PortalNotConfiguredError);
  });
});

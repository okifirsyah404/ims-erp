import { businessDateOf } from '@utils/business-date.util';
import { container } from 'tsyringe';
import { requestBodyDoc } from '@http/openapi';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { resolveLanguage, translator } from '@providers/i18n/translator';
import { PORTAL_AUTH_SERVICE_TOKEN, PORTAL_SERVICE_TOKEN } from '../constants/di';
import { portalMemberInviteSchema, portalSignupSchema } from '../contracts/portal-account.contract';
import {
	portalChangePasswordSchema,
	portalIdParamSchema,
	portalLoginSchema,
	portalMessageSchema,
	portalPasswordConfirmSchema,
	portalPasswordResetSchema,
	portalProductParamSchema,
	portalResendSchema,
	portalTicketSchema,
	portalVerifySchema,
} from '../contracts/portal.contract';
import {
	accountSettings,
	companyMember,
	deviceSummary,
	portalUser,
	projectDetail,
	projectSummary,
	type TPresenter,
	ticketDetail,
	ticketSummary,
	warrantyDetail,
} from '../utils/portal-presenter';
import { formPayload } from '../utils/form-payload';
import { PortalNotFoundError } from '../errors/portal.errors';

/** The presenter for one request: its language, today on the Jakarta clock. */
function presenter(ctx: unknown): TPresenter {
	const { request } = ctx as { request: Request };
	return {
		t: translator(ctx),
		language: resolveLanguage(request.headers.get('accept-language')),
		today: businessDateOf(),
		now: new Date(),
	};
}

/** How a sign-in answers: the session as a `Set-Cookie`, never in the body (ADR-0027). */
const SESSION_COOKIE_NOTE =
	'On success the ERP answers `Set-Cookie` with the Better Auth session cookie. The portal server keeps it in its own server-side session and sends it back as a `Cookie` header on every `/customers/portal/v1` call; the body carries only the user and `session.expiresAt`.';

/**
 * Sign-in and passwords of the customer portal (`/customers/portal/v1/auth`,
 * ERP-0022). No session: the portal's server calls these for a signed-out
 * visitor. Individuals sign up; business accounts come from a staff invitation.
 */
export class PortalAuthController {
	static plugin() {
		const auth = container.resolve(PORTAL_AUTH_SERVICE_TOKEN);
		const portal = container.resolve(PORTAL_SERVICE_TOKEN);

		return domainPlugin({ name: 'portal-auth', prefix: '/customers/portal/v1/auth', tags: ['Customer portal'] })
			.post(
				'/login',
				async (ctx) => {
					const { context, session } = await auth.login(portalLoginSchema.parse(ctx.body), ctx.request.headers);
					const customer = await portal.customer(context);
					ctx.set.headers['set-cookie'] = await auth.sessionCookie(session);
					return ok({ ok: true, user: portalUser(context, customer), session: { expiresAt: session.expiresAt.toISOString() } });
				},
				{
					detail: {
						summary: 'Sign in',
						description: `Email + password sign-in for a login with the \`customer\` role; 401 wrong credentials or a staff login, 423 locked after 5 failures. ${SESSION_COOKIE_NOTE}`,
						...requestBodyDoc(portalLoginSchema),
					},
				},
			)
			.post('/register', async ({ body }) => ok(await auth.register(portalSignupSchema.parse(body))), {
				detail: {
					summary: 'Sign up (individuals)',
					description: 'Individuals sign up (a 6-digit code goes to the email); business → 403, invitation only',
					...requestBodyDoc(portalSignupSchema),
				},
			})
			.post(
				'/verify-email',
				async (ctx) => {
					const input = portalVerifySchema.parse(ctx.body);
					const { context, session } = await auth.verifySignup(input.email, input.code);
					const customer = await portal.customer(context);
					ctx.set.headers['set-cookie'] = await auth.sessionCookie(session);
					return ok({ user: portalUser(context, customer), session: { expiresAt: session.expiresAt.toISOString() } });
				},
				{
					detail: {
						summary: 'Verify the sign-up code',
						description: `The right code creates the customer and an owner login and signs in; 400 wrong/expired (5 attempts). ${SESSION_COOKIE_NOTE}`,
						...requestBodyDoc(portalVerifySchema),
					},
				},
			)
			.post(
				'/verify-email/resend',
				async ({ body }) => {
					await auth.resendVerification(portalResendSchema.parse(body).email);
					return noContent();
				},
				{ detail: { summary: 'Resend the sign-up code', description: 'A new sign-up code for a pending sign-up; same answer for any email', ...requestBodyDoc(portalResendSchema) } },
			)
			.post(
				'/password-reset',
				async ({ body }) => {
					await auth.requestPasswordReset(portalPasswordResetSchema.parse(body).email);
					return noContent();
				},
				{ detail: { summary: 'Request a password reset', description: 'Emails a reset link to an active portal login; same answer for any email', ...requestBodyDoc(portalPasswordResetSchema) } },
			)
			.post(
				'/password-reset/confirm',
				async ({ body }) => {
					const input = portalPasswordConfirmSchema.parse(body);
					await auth.confirmPasswordReset(input.token, input.password);
					return noContent();
				},
				{ detail: { summary: 'Set a new password', description: 'Sets the password from an emailed link (also the first password after an invitation)', ...requestBodyDoc(portalPasswordConfirmSchema) } },
			);
	}
}

/**
 * The signed-in customer's portal (`/customers/portal/v1`, ERP-0022). Every
 * route runs the `portal` guard (session cookie → `customer` role → active
 * portal login, ADR-0027) and reads only that customer's data through the
 * owning modules' contracts.
 */
export class PortalController {
	static plugin() {
		const auth = container.resolve(PORTAL_AUTH_SERVICE_TOKEN);
		const service = container.resolve(PORTAL_SERVICE_TOKEN);
		// A malformed id is answered 404 like an unknown one: the portal reads 404 as "not found".
		const id = (params: unknown) => {
			const parsed = portalIdParamSchema.safeParse(params);
			if (!parsed.success) throw new PortalNotFoundError();
			return parsed.data.id;
		};
		const productId = (params: unknown) => {
			const parsed = portalProductParamSchema.safeParse(params);
			if (!parsed.success) throw new PortalNotFoundError();
			return parsed.data.id;
		};

		return domainPlugin({ name: 'portal', prefix: '/customers/portal/v1', tags: ['Customer portal'], guards: 'portal' })
			.post(
				'/auth/logout',
				async ({ portal, set }) => {
					await auth.logout(portal);
					set.headers['set-cookie'] = await auth.clearedSessionCookie();
					return noContent();
				},
				{ portal: true, detail: { summary: 'Sign out', description: 'Ends this portal session and clears the session cookie' } },
			)
			.post(
				'/account/password',
				async ({ portal, body }) => {
					const input = portalChangePasswordSchema.parse(body);
					await auth.changePassword(portal, input.current, input.next);
					return noContent();
				},
				{ portal: true, detail: { summary: 'Change password', description: 'Changes the password; 400 when the current one is wrong', ...requestBodyDoc(portalChangePasswordSchema) } },
			)
			.get(
				'/account',
				async (ctx) => {
					const [customer, members] = await Promise.all([service.customer(ctx.portal), service.members(ctx.portal)]);
					return ok(accountSettings(presenter(ctx), ctx.portal, customer, members));
				},
				{ portal: true, detail: { summary: 'Account', description: 'Account, company and the members (logins) of the customer' } },
			)
			.post(
				'/account/members',
				async (ctx) =>
					ctx.status(201, created(companyMember(presenter(ctx), await service.inviteMember(ctx.portal, portalMemberInviteSchema.parse(ctx.body))))),
				{ portal: true, detail: { summary: 'Invite a colleague', description: 'An owner invites a colleague (approver, finance, viewer); 403 for other roles', ...requestBodyDoc(portalMemberInviteSchema) } },
			)
			.delete(
				'/account/members/:id',
				async (ctx) => {
					await service.removeMember(ctx.portal, id(ctx.params));
					return noContent();
				},
				{ portal: true, detail: { summary: 'Remove a colleague', description: 'An owner removes a colleague (not themselves)' } },
			)
			.get('/me', async (ctx) => ok(portalUser(ctx.portal, await service.customer(ctx.portal))), {
				portal: true,
				detail: { summary: 'Current user', description: 'The signed-in portal user and their company' },
			})
			.get(
				'/home',
				async (ctx) => {
					const p = presenter(ctx);
					const [projects, tickets] = await Promise.all([service.listProjects(ctx.portal), service.listTickets(ctx.portal)]);
					const active = projects.filter((project) => project.status === 'active');
					return ok({
						...(active[0] ? { activeProject: { ...projectSummary(p, active[0]), index: 1, total: active.length } } : {}),
						quotations: [],
						openTickets: tickets.filter((ticket) => ticket.status !== 'closed').slice(0, 3).map((ticket) => ticketSummary(p, ticket)),
						activity: [],
						unreadNotifications: 0,
					});
				},
				{ portal: true, detail: { summary: 'Home screen', description: 'Home screen: active project and open tickets (orders and quotations come in stage 2)' } },
			)
			.get(
				'/badges',
				async ({ portal }) => {
					const tickets = await service.listTickets(portal);
					return ok({
						activeOrders: 0,
						quotationsAwaiting: 0,
						openTickets: tickets.filter((ticket) => ticket.status !== 'closed').length,
						unreadNotifications: 0,
					});
				},
				{ portal: true, detail: { summary: 'Navigation counters', description: 'Navigation counters' } },
			)
			.get('/projects', async (ctx) => ok((await service.listProjects(ctx.portal)).map((project) => projectSummary(presenter(ctx), project))), {
				portal: true,
				detail: { summary: 'List projects', description: "The customer's projects (no costs, no internal notes)" },
			})
			.get('/projects/:id', async (ctx) => ok(projectDetail(presenter(ctx), await service.getProject(ctx.portal, id(ctx.params)))), {
				portal: true,
				detail: { summary: 'Project detail', description: "One of the customer's projects with milestones, BASTs and files (signed links, 5 minutes)" },
			})
			.get('/tickets', async (ctx) => ok((await service.listTickets(ctx.portal)).map((ticket) => ticketSummary(presenter(ctx), ticket))), {
				portal: true,
				detail: { summary: 'List tickets', description: "The customer's service tickets" },
			})
			.get('/tickets/:id', async (ctx) => ok(ticketDetail(presenter(ctx), await service.getTicket(ctx.portal, id(ctx.params)))), {
				portal: true,
				detail: { summary: 'Ticket detail', description: 'One ticket with the customer-visible messages' },
			})
			.post(
				'/tickets',
				async (ctx) => {
					const ticket = await service.createTicket(ctx.portal, portalTicketSchema.parse(formPayload(ctx.body)));
					return ctx.status(201, created({ id: ticket.id, number: ticket.code }));
				},
				{ portal: true, detail: { summary: 'Open a ticket', description: 'Opens a ticket (JSON or the portal form; photos not stored yet)', ...requestBodyDoc(portalTicketSchema, { multipart: true }) } },
			)
			.post(
				'/tickets/:id/messages',
				async (ctx) => {
					const input = portalMessageSchema.parse(formPayload(ctx.body));
					return ctx.status(201, created(await service.addMessage(ctx.portal, id(ctx.params), input.text)));
				},
				{ portal: true, detail: { summary: 'Reply to a ticket', description: 'Adds a customer message to the ticket thread', ...requestBodyDoc(portalMessageSchema, { multipart: true }) } },
			)
			.post(
				'/tickets/:id/confirm',
				async (ctx) => ok(ticketDetail(presenter(ctx), await service.confirmTicket(ctx.portal, id(ctx.params)))),
				{ portal: true, detail: { summary: 'Confirm a ticket fix', description: 'The customer confirms the fix: resolved → closed' } },
			)
			.get('/products', async (ctx) => ok((await service.listDevices(ctx.portal)).map((device) => deviceSummary(presenter(ctx), device))), {
				portal: true,
				detail: { summary: 'List devices', description: "Devices on the customer's warranty certificates" },
			})
			.get(
				'/products/:id/warranty',
				async (ctx) => ok(warrantyDetail(presenter(ctx), await service.getDevice(ctx.portal, productId(ctx.params)))),
				{ portal: true, detail: { summary: 'Device warranty', description: "A device's warranty: period, coverage and exclusions" } },
			);
	}
}

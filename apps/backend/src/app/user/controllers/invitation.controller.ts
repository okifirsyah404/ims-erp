import type { ErpContext } from '@authorization/elysia-auth';
import { container } from 'tsyringe';
import {
	claimInvitationSchema,
	createInvitationSchema,
	invitationIdParamsSchema,
	invitationQuerySchema,
	usernameAvailableQuerySchema,
} from '../contracts/invitation.contract';
import {
	INVITATION_EMPLOYEE_PORT_TOKEN,
	INVITATION_SERVICE_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IInvitationEmployeePort } from '../contracts/invitation-employee.port';
import type { InvitationService, TActor } from '../../user/services/invitation.service';
import type { IUserManagementRepository } from '../contracts/user-management.repository.interface';
import { UserManagementError } from '../errors/invitation.errors';
import { NotGlobalAdminError } from '@http/errors';
import { domainPlugin } from '@http/plugin';
import { buildInvitationTemplate } from '../utils/invitation-template';
import { created, errorEnvelope, ok, okPaginated } from '@http/response';

/**
 * Extracts the audit actor from the guard-resolved context. Identity comes
 * from the session (server-side), never client input.
 */
function actorFrom(erp: ErpContext, request: Request): TActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * Server-side global-admin check (same pattern as the user module):
 * application invitations and cross-org invitation administration are
 * Better Auth's global-admin domain, not organization-scoped ERP access
 * control.
 */
function requireGlobalAdmin({ erp }: { erp: { session: { user: { role?: string | null } } } }): void {
	if (erp.session.user.role !== 'admin') {
		throw new NotGlobalAdminError();
	}
}

/**
 * Invitation administration + public claim-flow controller.
 *
 * @remarks
 * Layered boundary: HTTP concerns only — parsing, envelope/status mapping —
 * business logic lives in {@link InvitationService}. The claim flow is
 * public but token-gated (single-use hashed token; no session required);
 * admin routes require a global admin session.
 *
 * Admin routes live under `/admin/invitations` so every application-admin
 * surface shares one prefix. The claim flow stays at `/invitations/claim`,
 * mounted as its own plugin: it is public, sessionless, and must not inherit
 * the admin guard.
 */
export class InvitationController {
	static plugin() {
		const invitationService = container.resolve<InvitationService>(
			INVITATION_SERVICE_TOKEN,
		);
		const employeePort = container.resolve<IInvitationEmployeePort<unknown>>(
			INVITATION_EMPLOYEE_PORT_TOKEN,
		);

		return domainPlugin({
			name: 'user-management-invitations',
			prefix: '/admin/invitations',
			tags: ['User Management'],
			guards: 'erp',
		}).onError({ as: 'local' }, (ctx) => {
			const { error, set } = ctx;
			if (error instanceof UserManagementError) {
				set.status = error.status;
				return errorEnvelope(error.status, error.message, [
					{ field: null, message: error.message },
				]);
			}
			return undefined;
		})
			.post(
				'/',
				async (ctx) => {
					const actor = actorFrom(ctx.erp, ctx.request);
					const parsed = createInvitationSchema.parse(ctx.body);
					// Invite and employee creation are one step (ERP-0034): the port
					// is implemented by HR, so this controller never imports HR.
					if (Array.isArray(parsed)) {
						const result = await employeePort.inviteBulk(parsed, actor);
						return created(result);
					}
					const result = await employeePort.invite(parsed, actor);
					return created(result);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.get(
				'/',
				async ({ query, erp }) => {
					const parsed = invitationQuerySchema.parse(query);
					const result = await invitationService.list({
						...parsed,
						// Org-scoped callers are pinned to their own organization;
						// global admins may pass any organizationId filter.
						organizationId:
							erp.session.user.role === 'admin'
								? parsed.organizationId
								: erp.organizationId,
						page: 1,
						limit: 50,
					});
					return okPaginated(result);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.get(
				'/template',
				({ set, request }) => {
					const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
					const file = buildInvitationTemplate(format);
					set.headers['content-type'] = file.contentType;
					set.headers['content-disposition'] = `attachment; filename="${file.fileName}"`;
					return file.body;
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.post(
				'/:invitationId/resend',
				async ({ params, erp, request }) => {
					await invitationService.resend(
						invitationIdParamsSchema.parse(params).invitationId,
						actorFrom(erp, request),
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.post(
				'/:invitationId/cancel',
				async ({ params, erp, request }) => {
					await invitationService.cancel(
						invitationIdParamsSchema.parse(params).invitationId,
						actorFrom(erp, request),
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.delete(
				'/:invitationId',
				async ({ params, erp, request }) => {
					await invitationService.deleteUnclaimed(
						invitationIdParamsSchema.parse(params).invitationId,
						actorFrom(erp, request),
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			);
	}
}

/**
 * Public claim flow — token-gated, no session.
 *
 * @remarks
 * Deliberately unguarded and un-prefixed by `/admin`: the recipient of an
 * invitation follows a link from an email before they hold any account. The
 * token itself is the authorization (single-use, stored hashed).
 */
export class InvitationClaimController {
	static plugin() {
		const invitationService = container.resolve<InvitationService>(
			INVITATION_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'invitation-claim',
			prefix: '/invitations',
			tags: ['Invitations'],
		})
			.post(
				'/claim/:token',
				async ({ params, body, request, set }) => {
					const input = claimInvitationSchema.parse(body);
					const result = await invitationService.claim(
						params.token,
						input,
						// Real claim request headers (origin/user-agent/IP) are
						// forwarded so the post-claim sign-in passes CSRF/origin
						// validation and the session carries request context.
						request.headers,
					);
					if (result.setCookie) {
						set.headers['set-cookie'] = result.setCookie;
					}
					return ok({
						userId: result.userId,
						organizationName: result.organizationName,
						next: '/profile/complete',
					});
				},
			)
			.get(
				'/claim/:token',
				async ({ params }) => {
					const target = await invitationService.resolveClaimToken(
						params.token,
					);
					// Public surface: only what the claim forms need. Email is
					// read-only display context on the claim page.
					return ok({
						email: target.user.email,
						name: target.user.name,
						type: target.invitation.type,
					});
				},
			);
	}
}

/**
 * Username availability check.
 *
 * @remarks
 * Public (no guard): the claim form needs availability feedback before the
 * visitor holds any session. It only exposes a boolean for a candidate
 * handle, so the response is non-enumerating.
 *
 * Moved off `/users/username-available` — that path sat inside the
 * self-service `/users` plugin and collided with its `/:userId` parameter
 * route.
 */
export class UsernameCheckController {
	static plugin() {
		const userRepo = container.resolve<IUserManagementRepository>(
			USER_MANAGEMENT_REPOSITORY_TOKEN,
		);
		return domainPlugin({
			name: 'username-availability',
			prefix: '/username-availability',
			tags: ['Users'],
		}).get('/', async ({ query }) => {
			const { username } = usernameAvailableQuerySchema.parse(query);
			return ok({
				username,
				available: await userRepo.isUsernameAvailable(username),
			});
		});
	}
}

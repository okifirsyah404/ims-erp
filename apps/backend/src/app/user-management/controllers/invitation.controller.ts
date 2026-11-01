import {
	erpGuard,
	sessionGuard,
	type ErpContext,
} from '@authorization/elysia-auth';
import { Elysia } from 'elysia';
import { ZodError } from 'zod';
import { container } from 'tsyringe';
import type {
	TApiErrorMessage,
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import {
	claimInvitationSchema,
	createInvitationSchema,
	invitationIdParamsSchema,
	invitationQuerySchema,
	usernameAvailableQuerySchema,
} from '../contracts/invitation.contract';
import {
	INVITATION_SERVICE_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
} from '../constants/di';
import type { InvitationService, TActor } from '../services/invitation.service';
import type { IUserManagementRepository } from '../contracts/repositories.interface';
import {
	UserManagementError,
} from '../services/invitation.errors';

/**
 * Builds the response envelope metadata shared by all invitation endpoints.
 */
function buildMeta(status: number, message: string) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
	};
}

function ok<T>(data: T): TApiResponse<T> {
	return { ...buildMeta(200, 'OK'), data };
}

function created<T>(data: T): TApiResponse<T> {
	return { ...buildMeta(201, 'Created'), data };
}

function okPaginated<T>(
	result: TApiPaginatedResponse<T> extends never ? never : { meta: TApiPaginatedResponse<T>['pagination']; data: T[] },
): TApiPaginatedResponse<T> {
	return {
		...buildMeta(200, 'OK'),
		pagination: result.meta,
		data: result.data,
	};
}

function errorEnvelope(
	status: number,
	message: string,
	errors: TApiErrorMessage[],
): TApiResponse<null> {
	return { ...buildMeta(status, message), errors, data: null };
}

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
 * control. Organization invitations ride the erp guard (membership +
 * permission) in phase 3 when the org-scope endpoints land.
 */
function requireGlobalAdmin({ erp }: { erp: ErpContext }): void {
	if (erp.session.user.role !== 'admin') {
		throw new NotGlobalAdminError();
	}
}

/** Module-private sentinel thrown by {@link requireGlobalAdmin}. */
class NotGlobalAdminError extends Error {
	constructor() {
		super('Global administrator role required');
		this.name = 'NotGlobalAdminError';
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
 */
export class InvitationController {
	static plugin() {
		const invitationService = container.resolve<InvitationService>(
			INVITATION_SERVICE_TOKEN,
		);
		const userRepo = container.resolve<IUserManagementRepository>(
			USER_MANAGEMENT_REPOSITORY_TOKEN,
		);

		return new Elysia({
			prefix: '/invitations',
			name: 'user-management-invitations',
			tags: ['User Management'],
		})
			.use(erpGuard())
			.use(sessionGuard())
			.onError({ as: 'local' }, ({ code, error, set }) => {
				if (code === 'VALIDATION') {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{
							field: error.value ? String(error.value) : null,
							message: error.message,
						},
					]);
				}
				if (code === 'PARSE' || error instanceof ZodError) {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ field: null, message: String(error) },
					]);
				}
				if (error instanceof UserManagementError) {
					set.status = error.status;
					return errorEnvelope(error.status, error.message, [
						{ field: null, message: error.message },
					]);
				}
				if (error instanceof NotGlobalAdminError) {
					set.status = 403;
					return errorEnvelope(403, error.message, []);
				}
				return undefined;
			})
			// ---- Public claim flow (token-gated, no session) ----------------
			// Declared before the admin routes; the claim subpath cannot clash
			// with `/:invitationId` because both are POST/GET-prefixed routes
			// and claim uses the literal `claim` segment.
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
			)
			// ---- Admin surface (global admin) -------------------------------
			.post(
				'/',
				async (ctx) => {
					const actor = actorFrom(ctx.erp, ctx.request);
					const parsed = createInvitationSchema.parse(ctx.body);
					if (Array.isArray(parsed)) {
						const result = await invitationService.inviteBulk(parsed, actor);
						return created(result);
					}
					const result = await invitationService.invite(parsed, actor);
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

/** Username availability lives under /users; registered alongside. */
export class UsernameCheckController {
	static plugin() {
		const userRepo = container.resolve<IUserManagementRepository>(
			USER_MANAGEMENT_REPOSITORY_TOKEN,
		);
		return new Elysia({ name: 'username-availability', tags: ['Users'] })
			.get(
				'/users/username-available',
				async ({ query }) => {
					const { username } = usernameAvailableQuerySchema.parse(query);
					return ok({
						username,
						available: await userRepo.isUsernameAvailable(username),
					});
				},
				// Public (no guard): the claim form needs availability feedback
				// before the visitor holds any session. Only exposes a boolean
				// for a candidate handle; response shape is non-enumerating.
			);
	}
}

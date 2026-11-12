import type { ErpContext } from '@authorization/elysia-auth';
import { isGlobalAdmin } from '@authorization/require-global-admin';
import { container } from 'tsyringe';
import { DomainHttpError } from '@http/errors';
import { domainPlugin } from '@http/plugin';
import { buildInvitationTemplate } from '@app/user/utils/invitation-template';
import { created, ok, okPaginated } from '@http/response';
import type {
	InvitationService,
	TActor,
} from '../../user/services/invitation.service';
import {
	INVITATION_EMPLOYEE_PORT_TOKEN,
	INVITATION_SERVICE_TOKEN,
} from '../../user/constants/di';
import type { IInvitationEmployeePort } from '../../user/contracts/invitation-employee.port';
import {
	createOrgInvitationSchema,
	orgInvitationListParamsSchema,
	orgInvitationParamsSchema,
	orgInvitationQuerySchema,
} from '../contracts/organization-invitation.contract';

/** Audit actor from the guard-resolved session (never client input). */
function actorFrom(erp: ErpContext, request: Request): TActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * Binds the path's organization to the guard-resolved one.
 *
 * @remarks
 * The ERP guard resolves the organization from `x-organization-id` (or the
 * session's active organization), not from the URL, so a caller authorized in
 * organization A could otherwise pass organization B in the path and have the
 * permission check run against the wrong tenant. The organization exists only
 * once - in the path - and every handler reads it from there, so the two must
 * agree before anything is written.
 *
 * Application admins are exempt: they administer every organization
 * (ADR-0007) and reach organizations they hold no membership in, so their
 * guard context is one of many they may act on.
 */
function assertPathOrganization(erp: ErpContext, organizationId: string): void {
	if (isGlobalAdmin({ erp })) return;
	if (erp.organizationId !== organizationId) {
		throw new DomainHttpError(
			403,
			'Organization context does not match the requested organization',
		);
	}
}

/**
 * Organization-scoped invitation routes.
 *
 * @remarks
 * Owned by the organization module (path and permissions are organization
 * concerns) while the pipeline itself stays in `InvitationService`, reached
 * through its DI token - the same service-to-service seam the rest of the
 * codebase uses instead of importing another module's repository.
 *
 * Every id-targeted call passes `{ organizationId }` as the service scope:
 * an organization admin can act only on its own organization's invitations.
 * Application-wide invite/administration stays on `/admin/invitations`
 * (global-admin guarded).
 *
 * @throws 400 When body/query/path fail validation
 * @throws 401 When unauthenticated (erp guard)
 * @throws 403 When the path organization differs from the guard's, or the
 * caller lacks the route's permission
 * @throws 404 When the invitation is missing or owned by another organization
 * @throws 409 When a pending invitation already exists for the email
 */
export class OrganizationInvitationController {
	static plugin() {
		const invitationService = container.resolve<InvitationService>(
			INVITATION_SERVICE_TOKEN,
		);
		const employeePort = container.resolve<IInvitationEmployeePort<unknown>>(
			INVITATION_EMPLOYEE_PORT_TOKEN,
		);

		return domainPlugin({
			name: 'organization-invitations',
			prefix: '/organizations',
			tags: ['Organization'],
			guards: 'erp',
		})
			.get(
				'/:organizationId/invitations',
				async ({ params, query, erp }) => {
					const { organizationId } = orgInvitationListParamsSchema.parse(params);
					assertPathOrganization(erp, organizationId);
					const parsed = orgInvitationQuerySchema.parse(query);
					const result = await invitationService.list({
						...parsed,
						organizationId,
						page: parsed.page ?? 1,
						limit: parsed.limit ?? 50,
					});
					return okPaginated(result);
				},
				{ erp: { permission: ['member:read'] } },
			)
			.post(
				'/:organizationId/invitations',
				async (ctx) => {
					const { organizationId } = orgInvitationListParamsSchema.parse(
						ctx.params,
					);
					assertPathOrganization(ctx.erp, organizationId);
					const actor = actorFrom(ctx.erp, ctx.request);
					const parsed = createOrgInvitationSchema.parse(ctx.body);
					// The organization comes from the path, never the body, so a
					// caller cannot redirect an invitation it is allowed to send.
					if (Array.isArray(parsed)) {
						const result = await employeePort.inviteBulk(
							parsed.map((row) => ({ ...row, organizationId })),
							actor,
						);
						return created(result);
					}
					const result = await employeePort.invite(
						{ ...parsed, organizationId },
						actor,
					);
					return created(result);
				},
				{ erp: { permission: ['invitation:create'] } },
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
				{ erp: { permission: ['member:read'] } },
			)
			.post(
				'/:organizationId/invitations/:invitationId/resend',
				async ({ params, erp, request }) => {
					const { organizationId, invitationId } =
						orgInvitationParamsSchema.parse(params);
					assertPathOrganization(erp, organizationId);
					await invitationService.resend(
						invitationId,
						actorFrom(erp, request),
						{ organizationId },
					);
					return ok(null);
				},
				{ erp: { permission: ['invitation:create'] } },
			)
			.post(
				'/:organizationId/invitations/:invitationId/cancel',
				async ({ params, erp, request }) => {
					const { organizationId, invitationId } =
						orgInvitationParamsSchema.parse(params);
					assertPathOrganization(erp, organizationId);
					await invitationService.cancel(
						invitationId,
						actorFrom(erp, request),
						{ organizationId },
					);
					return ok(null);
				},
				{ erp: { permission: ['invitation:cancel'] } },
			)
			.delete(
				'/:organizationId/invitations/:invitationId',
				async ({ params, erp, request }) => {
					const { organizationId, invitationId } =
						orgInvitationParamsSchema.parse(params);
					assertPathOrganization(erp, organizationId);
					await invitationService.deleteUnclaimed(
						invitationId,
						actorFrom(erp, request),
						{ organizationId },
					);
					return ok(null);
				},
				{ erp: { permission: ['invitation:cancel'] } },
			);
	}
}

import { container } from 'tsyringe';
import { translator } from '@providers/i18n/translator';
import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';
import type { ErpContext } from '@authorization/elysia-auth';
import { isGlobalAdmin } from '@authorization/require-global-admin';
import { parseRoleList } from '@ims-erp/common';
import {
	addMemberSchema,
	memberIdParamsSchema,
	memberQuerySchema,
	organizationIdParamsSchema,
	organizationQuerySchema,
	updateMemberRoleSchema,
	updateOrganizationSchema,
} from '../contracts/organization.contract';
import { ORGANIZATION_SERVICE_TOKEN } from '../constants/di';
import {
	OrganizationService,
	type TMemberAssignmentContext,
} from '../services/organization.service';
import { organizationImageFrom } from '../utils/organization-image';
import {
	LastOrganizationError,
	LastOwnerError,
	MemberNotFoundError,
	MemberRoleNotAssignableError,
	OrganizationNotFoundError,
	OrganizationNotDeletedError,
	OrganizationSlugTakenError,
} from '../errors/organization.errors';

/**
 * Role-assignment context for member add/update, from the guard-resolved
 * session (never client input).
 *
 * @param erp - The guard context: caller's membership row plus platform role
 */
function memberAssignmentContext(erp: ErpContext): TMemberAssignmentContext {
	return {
		callerRoles: parseRoleList(erp.member.role),
		isPlatformAdmin: isGlobalAdmin({ erp }),
	};
}

/**
 * HTTP boundary for the organization module's organization-scoped routes.
 *
 * @remarks
 * Mounted as two plugins because organization creation has different
 * preconditions than every other route:
 *
 * - {@link OrganizationController.plugin} - all organization-scoped routes.
 *   Requires a valid session plus an organization context (`erpGuard`).
 * - {@link import('./organization-bootstrap.controller').OrganizationBootstrapController}
 *   - creation only. Requires a valid session and an application admin, but
 *   NO organization context, so a membershipless admin can create the first
 *   organization.
 *
 * Together they serve multiple organizations inside one company (ADR-0007).
 * The service owns the cross-organization rules (last-organization guard,
 * per-organization role provisioning). The service is resolved from the
 * tsyringe container here (the HTTP boundary), never deeper.
 *
 * @throws 400 When query/path/body parameters fail validation
 * @throws 401 When unauthenticated (erp guard)
 * @throws 403 When the caller lacks the requested permission (erp guard), or
 * Better Auth rejects the forwarded call (owner escalation rules)
 * @throws 404 When an id-targeted lookup finds no alive row
 * @throws 409 On slug conflicts, double delete/restore, last-owner
 * protection, or deleting the final live organization
 */
/**
 * Session-only plugin for `GET /organizations/mine`: the caller's own
 * memberships. No organization context is required (the switcher needs the
 * list before any org is active), so it does not ride `erpGuard`.
 */
export class OrganizationMembershipController {
	static plugin() {
		const organizationService = container.resolve<OrganizationService>(
			ORGANIZATION_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'organizations-mine',
			prefix: '/organizations',
			tags: ['Organization'],
			guards: 'session',
		}).get(
			'/mine',
			async ({ erp }) =>
				ok(await organizationService.listMyOrganizations(erp.session.user.id)),
			{
				erpSession: { session: true },
				detail: {
					description:
						"Lists the caller's live organizations with their role string. Session only; no active organization needed.",
				},
			},
		);
	}
}

export class OrganizationController {
	/**
	 * Builds the Elysia plugin mounting the organization-scoped routes.
	 *
	 * @remarks
	 * Resolves {@link OrganizationService} from the tsyringe container once
	 * at plugin build time. Validation failures are mapped by the shared
	 * {@link domainPlugin} hook; the module's domain errors (404/409) are
	 * mapped by the local `onError` arm below.
	 *
	 * @returns An Elysia instance with the `/organizations` route group mounted
	 */
	static plugin() {
		const organizationService = container.resolve<OrganizationService>(
			ORGANIZATION_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'organizations',
			prefix: '/organizations',
			tags: ['Organization'],
			guards: 'erp',
		})
			.onError({ as: 'local' }, (ctx) => {
				const { error, set } = ctx;
				const t = translator(ctx);
				if (
					error instanceof OrganizationNotFoundError ||
					error instanceof MemberNotFoundError
				) {
					set.status = 404;
					return errorEnvelope(404, t('common.notFound'), [
						{ message: t(error.key) },
					]);
				}
				if (
					error instanceof OrganizationSlugTakenError ||
					error instanceof OrganizationNotDeletedError ||
					error instanceof LastOwnerError ||
					error instanceof LastOrganizationError
				) {
					set.status = 409;
					return errorEnvelope(409, t('common.conflict'), [
						{ message: t(error.key) },
					]);
				}
				if (error instanceof MemberRoleNotAssignableError) {
					set.status = 403;
					return errorEnvelope(403, t('common.forbidden'), [
						{ message: t(error.key, { roles: error.roles.join(', ') }) },
					]);
				}
				return undefined;
			})
			// List
			.get(
				'',
				async ({ query }) =>
					okPaginated(
						await organizationService.listOrganizations({
							page: query.page,
							limit: query.limit,
							includeDeleted: query.includeDeleted,
						}),
					),
				{
					query: organizationQuerySchema,
					erp: { permission: ['organization:read'] },
				},
			)
			// Detail
			.get(
				'/:organizationId',
				async ({ params }) => {
					const row = await organizationService.getOrganization(
						params.organizationId,
					);
					return ok(row);
				},
				{
					params: organizationIdParamsSchema,
					erp: { permission: ['organization:read'] },
				},
			)
			// Update
			.patch(
				'/:organizationId',
				async ({ request, params, body }) => {
					const row = await organizationService.updateOrganization(
						request.headers,
						params.organizationId,
						body,
					);
					return ok(row);
				},
				{
					params: organizationIdParamsSchema,
					body: updateOrganizationSchema,
					erp: { permission: ['organization:update'] },
				},
			)
			// Soft delete
			.delete(
				'/:organizationId',
				async ({ request, params }) => {
					await organizationService.deleteOrganization(
						request.headers,
						params.organizationId,
					);
					return ok(null);
				},
				{
					params: organizationIdParamsSchema,
					erp: { permission: ['organization:delete'] },
				},
			)
			// Restore
			.post(
				'/:organizationId/restore',
				async ({ params }) => {
					await organizationService.restoreOrganization(params.organizationId);
					return ok(null);
				},
				{
					params: organizationIdParamsSchema,
					erp: { permission: ['organization:delete'] },
				},
			)
			// Profile image: replace (multipart WebP `file`)
			.post(
				'/:organizationId/image-profile',
				async ({ request, params, body }) => {
					const result = await organizationService.setImage(
						request.headers,
						params.organizationId,
						organizationImageFrom(body),
					);
					return ok(result);
				},
				{
					params: organizationIdParamsSchema,
					erp: { permission: ['organization:update'] },
					detail: {
						description:
							'Uploads the organization profile image (multipart `file`, WebP ≤ 2MB; magic bytes validated)',
					},
				},
			)
			// Profile image: read (presigned URL)
			.get(
				'/:organizationId/image-profile',
				async ({ params }) =>
					ok({ url: await organizationService.getImage(params.organizationId) }),
				{
					params: organizationIdParamsSchema,
					erp: { permission: ['organization:read'] },
					detail: {
						description: 'Presigned URL of the organization profile image (null before the first upload)',
					},
				},
			)
			// Profile image: clear
			.delete(
				'/:organizationId/image-profile',
				async ({ request, params }) => {
					const result = await organizationService.setImage(
						request.headers,
						params.organizationId,
						null,
					);
					return ok(result);
				},
				{
					params: organizationIdParamsSchema,
					erp: { permission: ['organization:update'] },
				},
			)
			// Members: list
			.get(
				'/:organizationId/members',
				async ({ params, query }) =>
					okPaginated(
						await organizationService.listMembers(params.organizationId, {
							page: query.page,
							limit: query.limit,
							role: query.role,
						}),
					),
				{
					params: organizationIdParamsSchema,
					query: memberQuerySchema,
					erp: { permission: ['member:read'] },
				},
			)
			// Members: add
			.post(
				'/:organizationId/members',
				async ({ request, params, body, status, erp }) => {
					const member = await organizationService.addMember(
						request.headers,
						params.organizationId,
						body,
						memberAssignmentContext(erp),
					);
					return status(201, ok(member));
				},
				{
					params: organizationIdParamsSchema,
					body: addMemberSchema,
					erp: { permission: ['member:create'] },
				},
			)
			// Members: update role
			.patch(
				'/:organizationId/members/:memberId',
				async ({ request, params, body, erp }) => {
					const member = await organizationService.updateMemberRole(
						request.headers,
						params.organizationId,
						params.memberId,
						body,
						memberAssignmentContext(erp),
					);
					return ok(member);
				},
				{
					params: memberIdParamsSchema,
					body: updateMemberRoleSchema,
					erp: { permission: ['member:update'] },
				},
			)
			// Members: remove
			.delete(
				'/:organizationId/members/:memberId',
				async ({ request, params }) => {
					await organizationService.removeMember(
						request.headers,
						params.organizationId,
						params.memberId,
					);
					return ok(null);
				},
				{
					params: memberIdParamsSchema,
					erp: { permission: ['member:delete'] },
				},
			);
	}
}

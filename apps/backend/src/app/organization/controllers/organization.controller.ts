import { container } from 'tsyringe';
import { translator } from '@providers/i18n/translator';
import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';
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
import { OrganizationService } from '../services/organization.service';
import {
	LastOrganizationError,
	LastOwnerError,
	MemberNotFoundError,
	OrganizationNotFoundError,
	OrganizationNotDeletedError,
	OrganizationSlugTakenError,
} from '../errors/organization.errors';

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
				async ({ request, params, body, status }) => {
					const member = await organizationService.addMember(
						request.headers,
						params.organizationId,
						body,
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
				async ({ request, params, body }) => {
					const member = await organizationService.updateMemberRole(
						request.headers,
						params.organizationId,
						params.memberId,
						body,
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

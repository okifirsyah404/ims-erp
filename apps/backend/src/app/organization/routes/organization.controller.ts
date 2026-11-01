import {
	erpGuard,
	sessionGuard,
} from '@authorization/elysia-auth';
import type { TApiResponse } from '@ims-erp/common';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { container } from 'tsyringe';
import {
	addMemberSchema,
	createOrganizationSchema,
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
} from '../services/organization.errors';

/**
 * Builds the response envelope metadata shared by all organization
 * endpoints.
 */
function buildMeta(status: number, message: string) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
	};
}

/** Wraps a single row in the standard API response envelope. */
function ok<T>(data: T): TApiResponse<T> {
	return { ...buildMeta(200, 'OK'), data, errors: [] };
}

/**
 * Builds the standard error envelope for a failed request.
 */
function errorEnvelope(
	status: number,
	message: string,
	errors: { message: string }[],
): TApiResponse<null> {
	return { ...buildMeta(status, message), errors, data: null };
}

/**
 * Organization creation is reserved for application admins — the company
 * owner role (`user.role === 'admin'`, ADR-0007).
 *
 * @remarks
 * Read from the guard-resolved session, never from client input. It is
 * deliberately membership-independent: an application admin with no
 * organization memberships must be able to bootstrap the first organization.
 * Better Auth re-checks the same rule inside `organization.create`
 * (`allowUserToCreateOrganization`).
 */
function requireGlobalAdmin({ erp }: { erp: { session: { user: { role?: string | null } } } }): void {
	if (erp.session.user.role !== 'admin') {
		throw new NotGlobalAdminError();
	}
}

/** Module-private sentinel thrown by {@link requireGlobalAdmin} (403). */
class NotGlobalAdminError extends Error {
	constructor() {
		super('Application administrator role required');
		this.name = 'NotGlobalAdminError';
	}
}

/**
 * HTTP boundary for the organization module.
 *
 * @remarks
 * Mounted as two plugins because organization creation has different
 * preconditions than every other route:
 *
 * - {@link OrganizationController.plugin} — all organization-scoped routes.
 *   Requires a valid session plus an organization context (`erpGuard`).
 * - {@link OrganizationBootstrapController.plugin} — creation only. Requires
 *   a valid session and an application admin, but NO organization context, so
 *   a membershipless admin can create the first organization.
 *
 * Together they serve multiple organizations inside one company (ADR-0007).
 * The service owns the cross-organization rules (last-organization guard,
 * per-organization role provisioning). The service is resolved from the
 * tsyringe container here (the HTTP boundary), never deeper.
 *
 * @throws 400 When query/path/body parameters fail validation
 * @throws 401 When unauthenticated (erp/session guard)
 * @throws 403 When the caller lacks the requested permission (erp guard),
 * lacks the application admin role (create), or Better Auth rejects the
 * forwarded call (owner escalation rules)
 * @throws 404 When an id-targeted lookup finds no alive row
 * @throws 409 On slug conflicts, double delete/restore, last-owner
 * protection, or deleting the final live organization
 */
export class OrganizationController {
	/**
	 * Builds the Elysia plugin mounting all organization routes.
	 *
	 * @remarks
	 * Resolves {@link OrganizationService} from the tsyringe container once
	 * at plugin build time. The local `onError` hook maps validation
	 * failures to `400` and the module's domain errors onto their declared
	 * `status` fields (404/409/422); see the class-level `@throws` list for
	 * the full mapping.
	 *
	 * @returns An Elysia instance with the `/organizations` route group mounted
	 */
	static plugin() {
		const organizationService = container.resolve<OrganizationService>(
			ORGANIZATION_SERVICE_TOKEN,
		);

		return new Elysia({
			prefix: '/organizations',
			name: 'organizations',
			tags: ['Organization'],
		})
			.use(erpGuard())
			.onError({ as: 'local' }, ({ code, error, set }) => {
				if (code === 'VALIDATION') {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ message: error.message },
					]);
				}
				if (error instanceof z.ZodError) {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ message: error.issues.map((i) => i.message).join('; ') },
					]);
				}
				if (
					error instanceof OrganizationNotFoundError ||
					error instanceof MemberNotFoundError
				) {
					set.status = 404;
					return errorEnvelope(404, error.message, [
						{ message: error.message },
					]);
				}
				if (
					error instanceof OrganizationSlugTakenError ||
					error instanceof OrganizationNotDeletedError ||
					error instanceof LastOwnerError ||
					error instanceof LastOrganizationError
				) {
					set.status = 409;
					return errorEnvelope(409, error.message, [
						{ message: error.message },
					]);
				}
				return undefined;
			})
			// List
			.get(
				'',
				async ({ query }) => {
					const result = await organizationService.listOrganizations({
						page: query.page,
						limit: query.limit,
						includeDeleted: query.includeDeleted,
					});
					const pagination = {
						page: query.page,
						limit: query.limit,
						total: result.meta.total,
						totalPages: result.meta.totalPages,
					};
					return {
						...ok(result.data),
						pagination,
					};
				},
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
				async ({ request, params, status }) => {
					await organizationService.deleteOrganization(
						request.headers,
						params.organizationId,
					);
					return status(200, {
						...buildMeta(200, 'Deleted'),
						data: null,
						errors: [],
					});
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
					return {
						...buildMeta(200, 'Restored'),
						data: null,
						errors: [],
					};
				},
				{
					params: organizationIdParamsSchema,
					erp: { permission: ['organization:delete'] },
				},
			)
			// Members: list
			.get(
				'/:organizationId/members',
				async ({ params, query }) => {
					const result = await organizationService.listMembers(
						params.organizationId,
						{ page: query.page, limit: query.limit, role: query.role },
					);					const pagination = {
						page: query.page,
						limit: query.limit,
						total: result.meta.total,
						totalPages: result.meta.totalPages,
					};
					return {
						...ok(result.data),
						pagination,
					};
				},
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
					return status(201, {
						...buildMeta(201, 'Member added'),
						data: member,
						errors: [],
					});
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
				async ({ request, params, status }) => {
					await organizationService.removeMember(
						request.headers,
						params.organizationId,
						params.memberId,
					);
					return status(200, {
						...buildMeta(200, 'Member removed'),
						data: null,
						errors: [],
					});
				},
				{
					params: memberIdParamsSchema,
					erp: { permission: ['member:delete'] },
				},
			);
	}
}

/**
 * Organization creation boundary.
 *
 * @remarks
 * Split from {@link OrganizationController} because creation must work
 * WITHOUT an organization context: an application admin who belongs to no
 * organization has to be able to bootstrap the first one. `erpGuard` would
 * reject that caller with 403 before any role check, so this plugin rides
 * `sessionGuard` (session only) plus the {@link requireGlobalAdmin} policy.
 *
 * Better Auth independently enforces the same rule through
 * `allowUserToCreateOrganization` and, because caller headers are forwarded,
 * activates the new organization for the creating session.
 *
 * @throws 400 When the body fails validation
 * @throws 401 When unauthenticated
 * @throws 403 When the caller is not an application administrator
 * @throws 409 When the slug is already taken
 */
export class OrganizationBootstrapController {
	/**
	 * Builds the Elysia plugin mounting `POST /organizations`.
	 *
	 * @returns An Elysia instance sharing the `/organizations` prefix
	 */
	static plugin() {
		const organizationService = container.resolve<OrganizationService>(
			ORGANIZATION_SERVICE_TOKEN,
		);

		return new Elysia({
			prefix: '/organizations',
			name: 'organizations-bootstrap',
			tags: ['Organization'],
		})
			.use(sessionGuard())
			.onError({ as: 'local' }, ({ code, error, set }) => {
				if (error instanceof NotGlobalAdminError) {
					set.status = 403;
					return errorEnvelope(403, error.message, [
						{ message: error.message },
					]);
				}
				if (code === 'VALIDATION') {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ message: error.message },
					]);
				}
				if (error instanceof z.ZodError) {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ message: error.issues.map((i) => i.message).join('; ') },
					]);
				}
				if (error instanceof OrganizationSlugTakenError) {
					set.status = 409;
					return errorEnvelope(409, error.message, [
						{ message: error.message },
					]);
				}
				return undefined;
			})
			.post(
				'',
				async ({ request, body, erp, status }) => {
					const row = await organizationService.createOrganization(
						request.headers,
						{ ...body, creatorUserId: erp.session.user.id },
					);
					return status(201, {
						...buildMeta(201, 'Created'),
						data: row,
						errors: [],
					});
				},
				{
					body: createOrganizationSchema,
					erpSession: { policy: requireGlobalAdmin },
					detail: {
						description:
							'Creates an organization owned by the calling application administrator. Multiple organizations are supported.',
					},
				},
			);
	}
}

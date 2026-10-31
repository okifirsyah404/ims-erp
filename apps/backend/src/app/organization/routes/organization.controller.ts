import { erpGuard } from '@authorization/elysia-auth';
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
	LastOwnerError,
	MemberNotFoundError,
	OrganizationAlreadyExistsError,
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

function errorEnvelope(
	status: number,
	message: string,
	errors: { message: string }[],
): TApiResponse<null> {
	return { ...buildMeta(status, message), errors, data: null };
}

/**
 * HTTP boundary for the organization module.
 *
 * @remarks
 * All routes require a valid session plus an organization context (via
 * `erpGuard`); `permission` entries map onto the Better Auth organization
 * statements (`organization:*`, `member:*`) granted through the ERP role
 * catalog. The single-organization invariant is enforced in the service —
 * the create route responds 422 once any organization exists. The service is
 * resolved from the tsyringe container here (the HTTP boundary), never
 * deeper.
 *
 * @throws 400 When query/path/body parameters fail validation
 * @throws 401 When unauthenticated (erp guard)
 * @throws 403 When the caller lacks the requested permission (erp guard) or
 * Better Auth rejects the forwarded call (owner escalation rules)
 * @throws 404 When an id-targeted lookup finds no alive row
 * @throws 409 On slug conflicts, double delete/restore, or last-owner
 * protection
 * @throws 422 When creating an organization while one already exists
 */
export class OrganizationController {
	/**
	 * Builds the Elysia plugin mounting all organization routes.
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
				if (error instanceof OrganizationAlreadyExistsError) {
					set.status = 422;
					return errorEnvelope(422, error.message, [
						{ message: error.message },
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
					error instanceof LastOwnerError
				) {
					set.status = 409;
					return errorEnvelope(409, error.message, [
						{ message: error.message },
					]);
				}
				return undefined;
			})
			// Create — single-organization invariant: 422 once any org exists.
			.post(
				'',
				async ({ body, erp, status }) => {
					const row = await organizationService.createOrganization({
						...body,
						creatorUserId: erp.session.user.id,
					});
					return status(
						201,
						{ ...buildMeta(201, 'Created'), data: row, errors: [] },
					);
				},
				{
					body: createOrganizationSchema,
					erp: { permission: ['organization:create'] },
					detail: {
						description:
							'Creates the organization. Responds 422 once an organization already exists (single-organization deployment).',
					},
				},
			)
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
				async ({ params, status }) => {
					await organizationService.deleteOrganization(params.organizationId);
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

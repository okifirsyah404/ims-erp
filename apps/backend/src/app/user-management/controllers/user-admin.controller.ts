import { erpGuard, type ErpContext } from '@authorization/elysia-auth';
import { Elysia } from 'elysia';
import { ZodError } from 'zod';
import { container } from 'tsyringe';
import type {
	TApiErrorMessage,
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { builtInOrgStatements, erpStatements, portalStatements } from '@ims-erp/common';
import {
	auditQuerySchema,
	createRoleSchema,
	permissionCatalog,
	roleIdParamsSchema,
	roleQuerySchema,
	updateRoleSchema,
	userIdParamsSchema,
	userQuerySchema,
} from '../contracts/admin.contract';
import {
	AUDIT_QUERY_SERVICE_TOKEN,
	ROLE_MANAGEMENT_SERVICE_TOKEN,
	ROLE_REPOSITORY_TOKEN,
	USER_ADMIN_SERVICE_TOKEN,
} from '../constants/di';
import type { RoleManagementService } from '../services/role-management.service';
import type { UserAdminService } from '../services/user-admin.service';
import type { AuditQueryService } from '../services/audit-query.service';
import type { IRoleRepository } from '../contracts/repositories.interface';
import { UserManagementError } from '../services/invitation.errors';
import { translator, type ApiKey } from '@providers/i18n/translator';
import type { TActor } from '../services/invitation.service';

/** Envelope metadata shared by the admin endpoints. */
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

function errorEnvelope(
	status: number,
	message: string,
	errors: TApiErrorMessage[],
): TApiResponse<null> {
	return { ...buildMeta(status, message), errors, data: null };
}

/** Paginated envelope with the shared pagination meta. */
function okPaginated<T>(
	page: number,
	limit: number,
	result: { data: T[]; meta: { total: number; totalPages: number } },
): TApiPaginatedResponse<T> {
	return {
		...buildMeta(200, 'OK'),
		pagination: {
			page,
			limit,
			total: result.meta.total,
			totalPages: result.meta.totalPages,
		},
		data: result.data,
	};
}

/** Audit actor derived from the guard-resolved session, never client input. */
function actorFrom(erp: ErpContext, request: Request): TActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * Highest role rank the caller holds in the validated organization — the
 * ceiling for the escalation guard (D5). A global app admin who is also an
 * organization owner gets the owner ceiling; a caller with no live role row
 * falls back to the shared catalog value for their role names.
 */
async function callerRank(
	erp: ErpContext,
	roleRepository: IRoleRepository,
): Promise<number> {
	const roleNames = erp.member.role
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);

	let highest = 0;
	for (const name of roleNames) {
		const role = await roleRepository.findByName(erp.organizationId, name);
		if (role && role.rank > highest) highest = role.rank;
	}

	// Global app admin acting in an org where they hold no dynamic role row:
	// treat them as the org administrator ceiling, never the owner's.
	if (highest === 0 && erp.session.user.role === 'admin') return 80;
	return highest;
}

/** Shared error mapping for the admin endpoints. */
function mapAdminError(
	error: unknown,
):
	| { status: number; key: ApiKey; params?: Record<string, string | number> }
	| { status: number; message: string }
	| null {
	if (error instanceof UserManagementError) {
		return { status: error.status, key: error.key, params: error.params };
	}
	if (error instanceof ZodError) {
		return {
			status: 400,
			message: error.issues.map((issue) => issue.message).join('; '),
		};
	}
	return null;
}

/**
 * Phase-4 administration controller: account lifecycle (`/users`), dynamic
 * role CRUD (`/roles`) and the audit trail (`/audit`).
 *
 * @remarks
 * HTTP concerns only — parsing, envelope/status mapping. Every business rule
 * (escalation guard, grant validation, session revocation) lives in the
 * services. All three surfaces ride the `erp` guard, so they require a
 * validated organization context and the matching dynamic permission.
 */
export class UserAdminController {
	static plugin() {
		const userAdmin = container.resolve<UserAdminService>(
			USER_ADMIN_SERVICE_TOKEN,
		);
		const roleManagement = container.resolve<RoleManagementService>(
			ROLE_MANAGEMENT_SERVICE_TOKEN,
		);
		const auditQuery = container.resolve<AuditQueryService>(
			AUDIT_QUERY_SERVICE_TOKEN,
		);
		const roleRepository = container.resolve<IRoleRepository>(
			ROLE_REPOSITORY_TOKEN,
		);

		return new Elysia({ name: 'user-management-admin', tags: ['User Management'] })
			.use(erpGuard())
			.onError({ as: 'local' }, (ctx) => {
				const { code, error, set } = ctx;
				const t = translator(ctx);
				if (code === 'VALIDATION') {
					set.status = 400;
					return errorEnvelope(400, t('common.validationFailed'), [
						{ message: error.message },
					]);
				}
				const mapped = mapAdminError(error);
				if (mapped) {
					set.status = mapped.status;
					const message =
						'key' in mapped ? t(mapped.key, mapped.params) : mapped.message;
					return errorEnvelope(mapped.status, message, [
						{ message },
					]);
				}
				return undefined;
			})

			// ---------------------------------------------------------------
			// Users
			// ---------------------------------------------------------------
			.get(
				'/users',
				async ({ query }) => {
					const parsed = userQuerySchema.parse(query);
					const result = await userAdmin.list(parsed);
					return okPaginated(parsed.page, parsed.limit, result);
				},
				{ erp: { permission: ['member:read'] } },
			)
			.post(
				'/users/:userId/deactivate',
				async ({ params, erp, request }) => {
					const { userId } = userIdParamsSchema.parse(params);
					await userAdmin.deactivate(
						userId,
						await callerRank(erp, roleRepository),
						actorFrom(erp, request),
					);
					return ok(null);
				},
				{ erp: { permission: ['member:update'] } },
			)
			.post(
				'/users/:userId/restore',
				async ({ params, erp, request }) => {
					const { userId } = userIdParamsSchema.parse(params);
					await userAdmin.restore(userId, actorFrom(erp, request));
					return ok(null);
				},
				{ erp: { permission: ['member:update'] } },
			)
			.delete(
				'/users/:userId',
				async ({ params, erp, request }) => {
					const { userId } = userIdParamsSchema.parse(params);
					await userAdmin.remove(
						userId,
						await callerRank(erp, roleRepository),
						actorFrom(erp, request),
					);
					return ok(null);
				},
				{ erp: { permission: ['member:delete'] } },
			)

			// ---------------------------------------------------------------
			// Roles
			// ---------------------------------------------------------------
			.get(
				'/roles',
				async ({ query }) => {
					const parsed = roleQuerySchema.parse(query);
					const rows = await roleManagement.list(
						parsed.organizationId,
						parsed.includeDeleted,
					);
					return ok(rows);
				},
				{ erp: { permission: ['member:read'] } },
			)
			.get(
				'/roles/permissions',
				async () =>
					ok(
						permissionCatalog({
							...builtInOrgStatements,
							...erpStatements,
							...portalStatements,
						}),
					),
				{ erp: { permission: ['member:read'] } },
			)
			.post(
				'/roles',
				async ({ body, erp, request, status }) => {
					const parsed = createRoleSchema.parse(body);
					const row = await roleManagement.create(
						parsed,
						await callerRank(erp, roleRepository),
						actorFrom(erp, request),
					);
					return status(201, {
						...buildMeta(201, 'Role created'),
						data: row,
					});
				},
				{ erp: { permission: ['member:create'] } },
			)
			.patch(
				'/roles/:roleId',
				async ({ params, body, erp, request }) => {
					const { roleId } = roleIdParamsSchema.parse(params);
					const row = await roleManagement.update(
						roleId,
						erp.organizationId,
						updateRoleSchema.parse(body),
						await callerRank(erp, roleRepository),
						actorFrom(erp, request),
					);
					return ok(row);
				},
				{ erp: { permission: ['member:update'] } },
			)
			.delete(
				'/roles/:roleId',
				async ({ params, erp, request }) => {
					const { roleId } = roleIdParamsSchema.parse(params);
					await roleManagement.remove(
						roleId,
						erp.organizationId,
						await callerRank(erp, roleRepository),
						actorFrom(erp, request),
					);
					return ok(null);
				},
				{ erp: { permission: ['member:delete'] } },
			)

			// ---------------------------------------------------------------
			// Audit
			// ---------------------------------------------------------------
			.get(
				'/audit',
				async ({ query }) => {
					const parsed = auditQuerySchema.parse(query);
					const result = await auditQuery.list(parsed);
					return okPaginated(parsed.page, parsed.limit, result);
				},
				{ erp: { permission: ['audit_log:read'] } },
			);
	}
}

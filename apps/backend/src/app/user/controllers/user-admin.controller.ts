import type { ErpContext } from '@authorization/elysia-auth';
import { container } from 'tsyringe';
import { translator, type ApiKey } from '@providers/i18n/translator';
import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';
import {
	userIdParamsSchema,
	userQuerySchema,
} from '../contracts/admin.contract';
import { USER_ADMIN_SERVICE_TOKEN } from '../constants/di';
import type { UserAdminService } from '../../user/services/user-admin.service';
import { UserManagementError } from '../errors/invitation.errors';
import type { TActor } from '../../user/services/invitation.service';

/** Audit actor derived from the guard-resolved session, never client input. */
function actorFrom(erp: ErpContext, request: Request): TActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
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
	return null;
}

/**
 * Phase-4 administration controller: account lifecycle (`/admin/users`).
 *
 * @remarks
 * HTTP concerns only — parsing, envelope/status mapping. Every business rule
 * (escalation guard, session revocation) lives in the service. The surface
 * rides the `erp` guard, so it requires a validated organization context and
 * the matching permission.
 *
 * The `/admin/roles` CRUD surface (dynamic role master data) was removed:
 * organization roles are a closed enum (`erpRoleNames` in
 * `@ims-erp/common`) with no per-organization rows to manage.
 *
 * The audit trail moved to `AuditController` (`@app/audit`) in W6 — see
 * `src/app/audit/controllers/audit.controller.ts`.
 */
export class UserAdminController {
	static plugin() {
		const userAdmin = container.resolve<UserAdminService>(
			USER_ADMIN_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'user-management-admin',
			prefix: '/admin',
			tags: ['User Management'],
			guards: 'erp',
		})
			.onError({ as: 'local' }, (ctx) => {
				const { error, set } = ctx;
				const t = translator(ctx);
				const mapped = mapAdminError(error);
				if (mapped) {
					set.status = mapped.status;
					const message =
						'key' in mapped ? t(mapped.key, mapped.params) : mapped.message;
					return errorEnvelope(mapped.status, message, [{ message }]);
				}
				return undefined;
			})

			// ---------------------------------------------------------------
			// Users
			// ---------------------------------------------------------------
			.get(
				'/users',
				async ({ query }) =>
					okPaginated(await userAdmin.list(userQuerySchema.parse(query))),
				{ erp: { permission: ['member:read'] } },
			)
			.post(
				'/users/:userId/deactivate',
				async ({ params, erp, request }) => {
					const { userId } = userIdParamsSchema.parse(params);
					await userAdmin.deactivate(
						userId,
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
						actorFrom(erp, request),
					);
					return ok(null);
				},
				{ erp: { permission: ['member:delete'] } },
			);
		// `GET /admin/audit` moved to `AuditController` (@app/audit) in W6 —
		// the ledger is a cross-cutting module, not a user-management concern.
		// `/admin/roles/*` (dynamic role CRUD) was removed with the closed
		// role enum.
	}
}

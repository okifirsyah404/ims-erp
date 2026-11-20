import type { ErpContext } from '@authorization/elysia-auth';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { parseRoleList } from '@ims-erp/common';
import { container } from 'tsyringe';
import type { THrContext } from '../contracts/hr-records.contract';

/**
 * Builds the server-side context of the M08 record endpoints: the actor, the
 * employee scope (active organization + company level, or all for an
 * application admin — the ERP-0034 rule) and `employee:read_private`.
 */
export function hrContext() {
	const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
	return async (erp: ErpContext): Promise<THrContext> => {
		const canReadPrivate = await permissions.hasPermission(erp.organizationId, parseRoleList(erp.member.role), {
			employee: ['read_private'],
		});
		return {
			actorUserId: erp.session.user.id,
			// `user.role` is comma-joined (ADR-0018): compare with `hasAppRole`.
			scope: { organizationId: erp.organizationId, all: hasAppRole(erp.session.user.role, GLOBAL_ADMIN_ROLE) },
			canReadPrivate,
		};
	};
}

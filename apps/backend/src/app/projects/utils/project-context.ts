import type { ErpContext } from '@authorization/elysia-auth';
import type { IPermissionResolver } from '@authorization/permission-resolver';
import type { ErpPermissionRequest } from '@ims-erp/common';
import type { TProjectContext } from '../services/project.service';

/**
 * Builds the server-derived project context from the guard-resolved caller.
 * Shared by the project controller and the After-Sales warranty controller
 * (same visibility rule for documents of a project).
 */
export async function projectContextFor(permissions: Pick<IPermissionResolver, 'hasPermission'>, erp: ErpContext): Promise<TProjectContext> {
	const roles = erp.member.role.split(',').map((role) => role.trim());
	const can = (request: ErpPermissionRequest) => permissions.hasPermission(erp.organizationId, roles, request);
	const [assign, readCost, exportAll, ticketAssign, taskAssign, update] = await Promise.all([
		can({ project: ['assign'] }),
		can({ project: ['read_cost'] }),
		can({ project: ['export'] }),
		// Ticket managers (customer service) need every project.
		can({ service_ticket: ['assign'] }),
		can({ task: ['assign'] }),
		can({ project: ['update'] }),
	]);
	return {
		organizationId: erp.organizationId,
		actorUserId: erp.session.user.id,
		canViewAll: assign || readCost || exportAll || ticketAssign,
		canSeeCost: readCost,
		canAssignTasks: taskAssign,
		canManage: update,
	};
}

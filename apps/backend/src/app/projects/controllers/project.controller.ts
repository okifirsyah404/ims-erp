import type { ErpContext } from '@authorization/elysia-auth';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import type { ErpPermissionRequest } from '@ims-erp/common';
import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { PROJECT_SERVICE_TOKEN } from '../constants/di';
import {
	costBodySchema,
	createProjectSchema,
	evidenceUploadSchema,
	projectChildParamSchema,
	projectIdParamSchema,
	projectListQuerySchema,
	reasonSchema,
	taskBodySchema,
	taskStatusSchema,
	updateProjectSchema,
} from '../contracts/project.contract';
import type { TProjectContext } from '../services/project.service';

/**
 * REST controller for projects (`/projects`, M07, ADR-0011 step 6a).
 *
 * @remarks
 * Reading needs `project:read` (record visibility in the service); creating
 * `project:create`; header, stage and PIC `project:update`; closing and
 * cancelling `project:close`; tasks `task:create|assign` (status changes
 * `task:update`, own tasks unless `task:assign`); evidence `task:update`;
 * costs `project:read_cost` + `project:update`.
 */
export class ProjectController {
	static plugin() {
		const service = container.resolve(PROJECT_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);

		const context = async (erp: ErpContext): Promise<TProjectContext> => {
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
		};
		const id = (params: unknown) => projectIdParamSchema.parse(params).id;
		const child = (params: unknown) => projectChildParamSchema.parse(params);

		return domainPlugin({ name: 'projects', prefix: '/projects', tags: ['Projects'], guards: 'erp' })
			.get('', async ({ query, erp }) => okPaginated(await service.list(await context(erp), projectListQuerySchema.parse(query))), {
				erp: { permission: ['project:read'] },
				detail: { description: 'Paginated projects visible to the caller' },
			})
			.get(
				'/open-deals',
				async ({ query }) => ok(await service.openDeals(z.object({ search: z.string().trim().max(100).optional() }).parse(query).search)),
				{ erp: { permission: ['project:create'] }, detail: { description: 'Live deals (sales orders) for a new project' } },
			)
			.get('/staff', async ({ erp }) => ok(await service.staff(await context(erp))), {
				erp: { permission: ['project:read'] },
				detail: { description: 'Members who can lead projects and members who can work tasks' },
			})
			.get('/:id', async ({ params, erp }) => ok(await service.get(await context(erp), id(params))), {
				erp: { permission: ['project:read'] },
				detail: { description: 'One project with tasks, evidence and (with project:read_cost) costs' },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(await context(erp), createProjectSchema.parse(body)))),
				{ erp: { permission: ['project:create'] }, detail: { description: 'Creates a project from a deal with the default checklist' } },
			)
			.put('/:id', async ({ params, body, erp }) => ok(await service.update(await context(erp), id(params), updateProjectSchema.parse(body))), {
				erp: { permission: ['project:update'] },
				detail: { description: 'Updates PIC, site, target dates, stage and notes' },
			})
			.post('/:id/close', async ({ params, erp }) => ok(await service.close(await context(erp), id(params))), {
				erp: { permission: ['project:close'] },
				detail: { description: 'Closes the project once the closing evidence exists' },
			})
			.post(
				'/:id/cancel',
				async ({ params, body, erp }) => ok(await service.cancel(await context(erp), id(params), reasonSchema.parse(body).reason)),
				{ erp: { permission: ['project:close'] }, detail: { description: 'Cancels the project; the deal is freed' } },
			)
			.post(
				'/:id/tasks',
				async ({ params, body, erp, status }) =>
					status(201, created(await service.addTask(await context(erp), id(params), taskBodySchema.parse(body)))),
				{ erp: { permission: ['task:create'] }, detail: { description: 'Adds a task' } },
			)
			.put(
				'/:id/tasks/:childId',
				async ({ params, body, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await service.updateTask(await context(erp), projectId, childId, taskBodySchema.parse(body)));
				},
				{ erp: { permission: ['task:assign'] }, detail: { description: 'Updates a task' } },
			)
			.post(
				'/:id/tasks/:childId/status',
				async ({ params, body, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await service.setTaskStatus(await context(erp), projectId, childId, taskStatusSchema.parse(body).status));
				},
				{ erp: { permission: ['task:update'] }, detail: { description: 'Moves a task (own tasks unless task:assign)' } },
			)
			.delete(
				'/:id/tasks/:childId',
				async ({ params, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await service.removeTask(await context(erp), projectId, childId));
				},
				{ erp: { permission: ['task:assign'] }, detail: { description: 'Removes a task (soft)' } },
			)
			.post(
				'/:id/evidence',
				async ({ params, body, erp, status }) =>
					status(201, created(await service.addEvidence(await context(erp), id(params), evidenceUploadSchema.parse(body)))),
				{ erp: { permission: ['task:update'] }, detail: { description: 'Uploads an evidence file (JPG, PNG, WebP, PDF; 15 MB)' } },
			)
			.delete(
				'/:id/evidence/:childId',
				async ({ params, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await service.removeEvidence(await context(erp), projectId, childId));
				},
				{ erp: { permission: ['task:update'] }, detail: { description: 'Removes an evidence file (uploader or manager)' } },
			)
			.post(
				'/:id/costs',
				async ({ params, body, erp, status }) =>
					status(201, created(await service.addCost(await context(erp), id(params), costBodySchema.parse(body)))),
				{ erp: { permission: ['project:read_cost', 'project:update'] }, detail: { description: 'Records a direct cost' } },
			)
			.post(
				'/:id/costs/:childId/void',
				async ({ params, body, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await service.voidCost(await context(erp), projectId, childId, reasonSchema.parse(body).reason));
				},
				{ erp: { permission: ['project:read_cost', 'project:update'] }, detail: { description: 'Voids a direct cost' } },
			);
	}
}

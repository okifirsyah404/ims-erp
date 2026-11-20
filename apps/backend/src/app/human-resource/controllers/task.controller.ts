import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { TASK_SERVICE_TOKEN } from '../constants/di';
import { recordIdParamSchema, taskBodySchema, taskListQuerySchema, taskStatusSchema } from '../contracts/hr-records.contract';
import { hrContext } from './hr-context';

/**
 * Tasks given to employees outside projects (`/hr/tasks`, M08). Reading
 * needs `task:read`; giving `task:create`; editing and ticking off
 * `task:update`. Only employees the caller sees (ERP-0034 scope).
 */
export class TaskController {
	static plugin() {
		const service = container.resolve(TASK_SERVICE_TOKEN);
		const context = hrContext();
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-tasks', prefix: '/human-resources/employee-tasks', tags: ['Human Resource'], guards: 'erp' })
			.get('', async ({ query, erp }) => okPaginated(await service.list((await context(erp)).scope, taskListQuerySchema.parse(query))), {
				erp: { permission: ['task:read'] },
				detail: { description: 'Employee tasks, open first' },
			})
			.post(
				'',
				async ({ body, erp, status }) => {
					const ctx = await context(erp);
					return status(201, created(await service.create(ctx.scope, ctx.actorUserId, taskBodySchema.parse(body))));
				},
				{ erp: { permission: ['task:create'] }, detail: { description: 'Gives an employee a task' } },
			)
			.put('/:id', async ({ params, body, erp }) => ok(await service.update((await context(erp)).scope, id(params), taskBodySchema.parse(body))), {
				erp: { permission: ['task:update'] },
				detail: { description: 'Edits a task' },
			})
			.post(
				'/:id/status',
				async ({ params, body, erp }) => ok(await service.setStatus((await context(erp)).scope, id(params), taskStatusSchema.parse(body).status)),
				{ erp: { permission: ['task:update'] }, detail: { description: 'Marks a task done, cancelled or open again' } },
			);
	}
}

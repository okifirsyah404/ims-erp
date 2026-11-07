import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { TASK_SERVICE_TOKEN } from '../constants/di';
import { idParamSchema, taskBodySchema, taskListQuerySchema, taskStatusSchema } from '../contracts/hr.contract';

/** REST controller for employee tasks (`/hr/tasks`): `task:read | create | update`. */
export class TaskController {
	static plugin() {
		const service = container.resolve(TASK_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-tasks', prefix: '/hr/tasks', tags: ['HR'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.list(taskListQuerySchema.parse(query))), {
				erp: { permission: ['task:read'] },
				detail: { description: 'Employee tasks, open first' },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(erp.session.user.id, taskBodySchema.parse(body)))),
				{ erp: { permission: ['task:create'] }, detail: { description: 'Gives an employee a task' } },
			)
			.put('/:id', async ({ params, body }) => ok(await service.update(id(params), taskBodySchema.parse(body))), {
				erp: { permission: ['task:update'] },
				detail: { description: 'Edits a task' },
			})
			.post('/:id/status', async ({ params, body }) => ok(await service.setStatus(id(params), taskStatusSchema.parse(body).status)), {
				erp: { permission: ['task:update'] },
				detail: { description: 'Marks a task done, cancelled or open again' },
			});
	}
}

import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { container } from 'tsyringe';
import { SCHEDULE_SERVICE_TOKEN } from '../constants/di';
import { recordIdParamSchema } from '../contracts/hr-records.contract';
import { scheduleBodySchema, scheduleFillSchema, scheduleWeekQuerySchema } from '../contracts/schedule.contract';
import { hrContext } from './hr-context';

/**
 * Employee work schedule (`/hr/schedule`, ERP-0118). Reading needs
 * `schedule:read`; a new cell or a fill `schedule:create`; editing
 * `schedule:update`; deleting (soft) `schedule:delete`. Only employees the
 * caller sees (ERP-0034 scope).
 */
export class ScheduleController {
	static plugin() {
		const service = container.resolve(SCHEDULE_SERVICE_TOKEN);
		const context = hrContext();
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-schedules', prefix: '/human-resources/schedules', tags: ['Human Resource'], guards: 'erp' })
			.get('/week', async ({ query, erp }) => ok(await service.week((await context(erp)).scope, scheduleWeekQuerySchema.parse(query).start)), {
				erp: { permission: ['schedule:read'] },
				detail: { description: 'The week grid: seven days from `start`, one row per employee' },
			})
			.post(
				'/fill',
				async ({ body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.fill(ctx.scope, ctx.actorUserId, scheduleFillSchema.parse(body)));
				},
				{ erp: { permission: ['schedule:create'] }, detail: { description: 'Fills a date range from a weekly pattern; existing cells are skipped' } },
			)
			.post(
				'',
				async ({ body, erp, status }) => {
					const ctx = await context(erp);
					return status(201, created(await service.create(ctx.scope, ctx.actorUserId, scheduleBodySchema.parse(body))));
				},
				{ erp: { permission: ['schedule:create'] }, detail: { description: 'Enters one cell (409 when the day already has one)' } },
			)
			.put('/:id', async ({ params, body, erp }) => ok(await service.update((await context(erp)).scope, id(params), scheduleBodySchema.parse(body))), {
				erp: { permission: ['schedule:update'] },
				detail: { description: 'Edits one cell' },
			})
			.delete('/:id', async ({ params, erp }) => ok(await service.remove((await context(erp)).scope, id(params))), {
				erp: { permission: ['schedule:delete'] },
				detail: { description: 'Soft deletes one cell' },
			});
	}
}

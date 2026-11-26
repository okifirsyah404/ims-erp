import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { container } from 'tsyringe';
import { SALARY_PERIOD_SERVICE_TOKEN } from '../constants/di';
import { recordIdParamSchema } from '../contracts/hr-records.contract';
import { salaryPeriodCreateSchema, salaryPeriodUpdateSchema } from '../contracts/salary-period.contract';
import { hrContext } from './hr-context';

/**
 * Salary periods of an employee (the "Gaji" card of the employee page,
 * ERP-0119). Reading needs `payroll:read`; a new period `payroll:create`;
 * editing or deleting `payroll:update`. Only employees the caller sees
 * (ERP-0034 scope).
 */
export class SalaryPeriodController {
	static plugin() {
		const service = container.resolve(SALARY_PERIOD_SERVICE_TOKEN);
		const context = hrContext();
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-salary-periods', prefix: '/human-resources', tags: ['Human Resource'], guards: 'erp' })
			.get('/employees/:id/salaries', async ({ params, erp }) => ok(await service.list((await context(erp)).scope, id(params))), {
				erp: { permission: ['payroll:read'] },
				detail: { description: 'Salary periods of an employee, newest first' },
			})
			.post(
				'/employees/:id/salaries',
				async ({ params, body, erp, status }) => {
					const ctx = await context(erp);
					return status(201, created(await service.create(ctx.scope, ctx.actorUserId, id(params), salaryPeriodCreateSchema.parse(body))));
				},
				{ erp: { permission: ['payroll:create'] }, detail: { description: 'Starts a new period; the current one closes the day before' } },
			)
			.put('/salaries/:id', async ({ params, body, erp }) => ok(await service.update((await context(erp)).scope, id(params), salaryPeriodUpdateSchema.parse(body))), {
				erp: { permission: ['payroll:update'] },
				detail: { description: 'Edits the amounts of the active period' },
			})
			.delete('/salaries/:id', async ({ params, erp }) => ok(await service.remove((await context(erp)).scope, id(params))), {
				erp: { permission: ['payroll:update'] },
				detail: { description: 'Deletes the latest period and reopens the previous one' },
			});
	}
}

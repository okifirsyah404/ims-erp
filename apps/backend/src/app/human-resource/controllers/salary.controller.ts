import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { SALARY_SERVICE_TOKEN } from '../constants/di';
import { recordIdParamSchema, salaryBodySchema, salaryPeriodQuerySchema } from '../contracts/hr-records.contract';
import { fileOf } from '../utils/import-file';
import { xlsxResponse } from '../utils/spreadsheet';
import { hrContext } from './hr-context';

/**
 * Monthly salary summary (`/hr/salary`, M08; decision of 2026-11-07): HR or
 * finance enter, generate or import drafts (`payroll:create|update`), the
 * owner approves and locks the month (`payroll:approve`). Only employees
 * the caller sees (ERP-0034 scope).
 */
export class SalaryController {
	static plugin() {
		const service = container.resolve(SALARY_SERVICE_TOKEN);
		const context = hrContext();
		const period = (query: unknown) => salaryPeriodQuerySchema.parse(query).period;
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-salary', prefix: '/human-resources/salary-records', tags: ['Human Resource'], guards: 'erp' })
			.get('', async ({ query, erp }) => ok(await service.period((await context(erp)).scope, period(query))), {
				erp: { permission: ['payroll:read'] },
				detail: { description: 'The summaries of a month with totals' },
			})
			.put(
				'',
				async ({ body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.save(ctx.scope, ctx.actorUserId, salaryBodySchema.parse(body)));
				},
				{ erp: { permission: ['payroll:update'] }, detail: { description: 'Saves one employee’s draft summary' } },
			)
			.delete(
				'/:id',
				async ({ params, erp }) => {
					await service.remove((await context(erp)).scope, id(params));
					return ok({ removed: true });
				},
				{ erp: { permission: ['payroll:update'] }, detail: { description: 'Removes a draft summary' } },
			)
			.post(
				'/generate',
				async ({ query, erp }) => {
					const ctx = await context(erp);
					return ok(await service.generate(ctx.scope, ctx.actorUserId, period(query)));
				},
				{ erp: { permission: ['payroll:create'] }, detail: { description: 'Drafts every working employee without a summary (amounts from last month)' } },
			)
			.get('/template', async () => xlsxResponse(await service.template(), 'template-gaji.xlsx'), {
				erp: { permission: ['payroll:read'] },
				detail: { description: 'The salary import template (.xlsx)' },
			})
			.post(
				'/import',
				async ({ query, body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.import(ctx.scope, ctx.actorUserId, period(query), fileOf(body)));
				},
				{ erp: { permission: ['payroll:create'] }, detail: { description: 'Imports a filled template; all rows or none' } },
			)
			.post(
				'/approve',
				async ({ query, erp }) => {
					const ctx = await context(erp);
					return ok(await service.approve(ctx.scope, ctx.actorUserId, period(query)));
				},
				{ erp: { permission: ['payroll:approve'] }, detail: { description: 'Approves and locks the month' } },
			);
	}
}

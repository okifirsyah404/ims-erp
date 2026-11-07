import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { SALARY_SERVICE_TOKEN } from '../constants/di';
import { idParamSchema, salaryBodySchema, salaryPeriodQuerySchema } from '../contracts/hr.contract';
import { fileOf } from '../utils/import-file';
import { xlsxResponse } from '../utils/spreadsheet';

/**
 * REST controller for monthly salary summaries (`/hr/salary`). Salary data
 * needs `payroll:read`; entering, generating and importing `payroll:create`
 * / `payroll:update` (HR, finance); approving the period `payroll:approve`
 * (owner).
 */
export class SalaryController {
	static plugin() {
		const service = container.resolve(SALARY_SERVICE_TOKEN);
		const period = (query: unknown) => salaryPeriodQuerySchema.parse(query).period;
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-salary', prefix: '/hr/salary', tags: ['HR'], guards: 'erp' })
			.get('', async ({ query }) => ok(await service.period(period(query))), {
				erp: { permission: ['payroll:read'] },
				detail: { description: 'The salary summaries of a month with totals' },
			})
			.put('', async ({ body, erp }) => ok(await service.save(erp.session.user.id, salaryBodySchema.parse(body))), {
				erp: { permission: ['payroll:update'] },
				detail: { description: 'Saves one draft summary (net pay computed)' },
			})
			.delete(
				'/:id',
				async ({ params }) => {
					await service.remove(id(params));
					return ok({ removed: true });
				},
				{ erp: { permission: ['payroll:update'] }, detail: { description: 'Removes a draft summary' } },
			)
			.post('/generate', async ({ query, erp }) => ok(await service.generate(erp.session.user.id, period(query))), {
				erp: { permission: ['payroll:create'] },
				detail: { description: 'Drafts every active employee at the base salary' },
			})
			.get('/template', async () => xlsxResponse(await service.template(), 'template-gaji.xlsx'), {
				erp: { permission: ['payroll:read'] },
				detail: { description: 'The salary import template (.xlsx)' },
			})
			.post('/import', async ({ query, body, erp }) => ok(await service.import(erp.session.user.id, period(query), fileOf(body))), {
				erp: { permission: ['payroll:create'] },
				detail: { description: 'Imports a period sheet; all rows or none (rupiah)' },
			})
			.post('/approve', async ({ query, erp }) => ok(await service.approve(erp.session.user.id, period(query))), {
				erp: { permission: ['payroll:approve'] },
				detail: { description: 'The owner approves and locks the period' },
			});
	}
}

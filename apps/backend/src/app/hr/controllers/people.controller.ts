import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { HR_PEOPLE_SERVICE_TOKEN } from '../constants/di';
import { bankAccountSchema, recordIdParamSchema } from '../contracts/hr-records.contract';
import { hrContext } from './hr-context';

/**
 * M08 additions to the ERP-0034 employee surface: the active-employee picker
 * of the record forms and the salary bank account. Reading needs
 * `employee:read` (the account number is masked without
 * `employee:read_private`); setting the account `employee:update`.
 */
export class HrPeopleController {
	static plugin() {
		const service = container.resolve(HR_PEOPLE_SERVICE_TOKEN);
		const context = hrContext();
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-people', prefix: '/hr', tags: ['HR'], guards: 'erp' })
			.get('/active-employees', async ({ erp }) => ok(await service.listActive((await context(erp)).scope)), {
				erp: { permission: ['employee:read'] },
				detail: { description: 'Active employees the caller sees, for the attendance/leave/task/salary forms' },
			})
			.get('/employees/:id/bank-account', async ({ params, erp }) => ok(await service.bank(await context(erp), id(params))), {
				erp: { permission: ['employee:read'] },
				detail: { description: 'The salary bank account (masked without employee:read_private)' },
			})
			.put(
				'/employees/:id/bank-account',
				async ({ params, body, erp }) => ok(await service.saveBank(await context(erp), id(params), bankAccountSchema.parse(body))),
				{ erp: { permission: ['employee:update'] }, detail: { description: 'Sets the salary bank account' } },
			);
	}
}

import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { HR_PEOPLE_SERVICE_TOKEN } from '../constants/di';
import { hrContext } from './hr-context';

/**
 * M08 addition to the ERP-0034 employee surface: the active-employee picker
 * of the record forms (`employee:read`). The salary bank account moved to
 * `/finance/employee-bank-accounts` (ERP-0119).
 */
export class HrPeopleController {
	static plugin() {
		const service = container.resolve(HR_PEOPLE_SERVICE_TOKEN);
		const context = hrContext();

		return domainPlugin({ name: 'hr-people', prefix: '/human-resources', tags: ['Human Resource'], guards: 'erp' })
			.get('/active-employees', async ({ erp }) => ok(await service.listActive((await context(erp)).scope)), {
				erp: { permission: ['employee:read'] },
				detail: { description: 'Active employees the caller sees, for the attendance/leave/task/salary forms' },
			});
	}
}

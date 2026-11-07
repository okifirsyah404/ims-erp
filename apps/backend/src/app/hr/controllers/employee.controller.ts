import type { ErpContext } from '@authorization/elysia-auth';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { EMPLOYEE_SERVICE_TOKEN } from '../constants/di';
import { bankAccountSchema, deactivateSchema, employeeBodySchema, employeeListQuerySchema, idParamSchema } from '../contracts/hr.contract';
import type { THrContext } from '../services/employee.service';

/** Caller context of the HR controllers: who acts, and may they see private data. */
export function hrContext(permissions: IPermissionResolver) {
	return async (erp: ErpContext): Promise<THrContext> => {
		const roles = erp.member.role.split(',').map((role) => role.trim());
		const canReadPrivate = await permissions.hasPermission(erp.organizationId, roles, { employee: ['read_private'] });
		return { actorUserId: erp.session.user.id, canReadPrivate };
	};
}

/**
 * REST controller for employees (`/hr/employees`, M08 stage 1). Reading needs
 * `employee:read` (NIK, bank account and salary only with
 * `employee:read_private`); creating `:create`; editing `:update`;
 * deactivating / reactivating `:archive`; the bank account `:update` and
 * `:read_private`.
 */
export class EmployeeController {
	static plugin() {
		const service = container.resolve(EMPLOYEE_SERVICE_TOKEN);
		const context = hrContext(container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN));
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-employees', prefix: '/hr/employees', tags: ['HR'], guards: 'erp' })
			.get('', async ({ query, erp }) => okPaginated(await service.list(await context(erp), employeeListQuerySchema.parse(query))), {
				erp: { permission: ['employee:read'] },
				detail: { description: 'Employees (private data masked without employee:read_private)' },
			})
			.get('/active', async () => ok(await service.listActive()), {
				erp: { permission: ['employee:read'] },
				detail: { description: 'Active employees for pickers' },
			})
			.get('/:id', async ({ params, erp }) => ok(await service.get(await context(erp), id(params))), {
				erp: { permission: ['employee:read'] },
				detail: { description: 'One employee with the bank account and the linked login' },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(await context(erp), employeeBodySchema.parse(body)))),
				{ erp: { permission: ['employee:create'] }, detail: { description: 'Adds an employee (numbered EMP-####)' } },
			)
			.put('/:id', async ({ params, body, erp }) => ok(await service.update(await context(erp), id(params), employeeBodySchema.parse(body))), {
				erp: { permission: ['employee:update'] },
				detail: { description: 'Edits an employee' },
			})
			.post(
				'/:id/deactivate',
				async ({ params, body, erp }) =>
					ok(await service.deactivate(await context(erp), id(params), deactivateSchema.parse(body).inactiveSince)),
				{ erp: { permission: ['employee:archive'] }, detail: { description: 'The employee left (history kept)' } },
			)
			.post('/:id/reactivate', async ({ params, erp }) => ok(await service.reactivate(await context(erp), id(params))), {
				erp: { permission: ['employee:archive'] },
				detail: { description: 'Makes an inactive employee active again' },
			})
			.put(
				'/:id/bank-account',
				async ({ params, body, erp }) => ok(await service.saveBank(await context(erp), id(params), bankAccountSchema.parse(body))),
				{
					erp: { permission: ['employee:update', 'employee:read_private'] },
					detail: { description: 'Sets the salary bank account' },
				},
			);
	}
}

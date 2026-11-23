import type { ErpContext } from '@authorization/elysia-auth';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { parseRoleList } from '@ims-erp/common';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { container } from 'tsyringe';
import { EMPLOYEE_BANK_ACCOUNT_SERVICE_TOKEN } from '../constants/di';
import {
	employeeBankAccountBodySchema,
	employeeBankAccountCreateSchema,
	employeeBankAccountIdParamSchema,
	employeeBankAccountListQuerySchema,
	type TEmployeeBankAccountContext,
} from '../contracts/employee-bank-account.contract';

/**
 * Employees' salary payee accounts (`/finance/employee-bank-accounts`,
 * ERP-0119). Reading needs `payroll:read`; writing `payroll:update`. The
 * account number is masked without `employee:read_private`; employees are
 * limited to the ERP-0034 scope (company-level + the caller's organization,
 * all for an application admin).
 */
export class EmployeeBankAccountController {
	static plugin() {
		const service = container.resolve(EMPLOYEE_BANK_ACCOUNT_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const context = async (erp: ErpContext): Promise<TEmployeeBankAccountContext> => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
			// `user.role` is comma-joined (ADR-0018): compare with `hasAppRole`.
			allOrganizations: hasAppRole(erp.session.user.role, GLOBAL_ADMIN_ROLE),
			canReadPrivate: await permissions.hasPermission(erp.organizationId, parseRoleList(erp.member.role), { employee: ['read_private'] }),
		});
		const id = (params: unknown) => employeeBankAccountIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'finance-employee-bank-accounts', prefix: '/finance/employee-bank-accounts', tags: ['Accounting'], guards: 'erp' })
			.get('', async ({ query, erp }) => ok(await service.list(await context(erp), employeeBankAccountListQuerySchema.parse(query).employeeId)), {
				erp: { permission: ['payroll:read'] },
				detail: { description: "An employee's salary payee accounts, primary first" },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(await context(erp), employeeBankAccountCreateSchema.parse(body)))),
				{ erp: { permission: ['payroll:update'] }, detail: { description: 'Adds a payee account (the first one is primary)' } },
			)
			.put('/:id', async ({ params, body, erp }) => ok(await service.update(await context(erp), id(params), employeeBankAccountBodySchema.parse(body))), {
				erp: { permission: ['payroll:update'] },
				detail: { description: 'Edits a payee account; making it primary clears the previous one' },
			})
			.delete('/:id', async ({ params, erp }) => ok(await service.remove(await context(erp), id(params))), {
				erp: { permission: ['payroll:update'] },
				detail: { description: 'Soft deletes a payee account' },
			});
	}
}

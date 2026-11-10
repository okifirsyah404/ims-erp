import type { ErpContext } from '@authorization/elysia-auth';
import { GLOBAL_ADMIN_ROLE } from '@providers/better-auth/ac/admin-ac';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { EMPLOYEE_SERVICE_TOKEN } from '../constants/di';
import {
	createEmployeeSchema,
	employeeListQuerySchema,
	employeePickerQuerySchema,
	idParamSchema,
	updateEmployeeSchema,
} from '../contracts/hr.contract';
import type { EmployeeService, TEmployeeContext } from '../services/employee.service';

/**
 * Builds the service context from the `erpGuard`-resolved context.
 *
 * @remarks
 * The platform-admin flag rides the **session's platform role**, not the
 * membership: an application admin who is a member of the org can also be
 * the one creating a company-level employee. `requireGlobalAdmin`-style
 * checks stay in the service (`CompanyEmployeeForbiddenError`) so the rule
 * ("company-level rows are admin-managed") cannot be bypassed by another
 * caller of the service.
 */
function contextFrom(erp: ErpContext): TEmployeeContext {
	return {
		actor: {
			userId: erp.session.user.id,
			email: erp.session.user.email ?? '',
			ip: erp.session.session.ipAddress ?? null,
			userAgent: erp.session.session.userAgent ?? null,
		},
		organizationId: erp.organizationId,
		isPlatformAdmin: erp.session.user.role === GLOBAL_ADMIN_ROLE,
		canManage: true,
	};
}

/**
 * REST controller for employees (`/hr/employees`, ERP-0034).
 *
 * @remarks
 * **Authorization.** Every route rides `erpGuard` + the closed `employee:*`
 * vocabulary (`erpRoleGrants`: `hr` full, `admin` read, `owner` all). The
 * picker (warehouse PIC dropdown) also rides `employee:read` because no
 * organization role holds `warehouse:*` (ADR-0008). Company-level employees
 * (`organization_id IS NULL`) are visible to every `employee:read` holder
 * but writable only by platform admins — enforced in the service.
 */
export class EmployeeController {
	static plugin() {
		const service = container.resolve<EmployeeService>(EMPLOYEE_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr', prefix: '/hr/employees', tags: ['HR'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(await service.list(contextFrom(erp), employeeListQuerySchema.parse(query))),
				{ erp: { permission: ['employee:read'] }, detail: { description: "Own organization's employees plus company-level ones" } },
			)
			.get(
				'/picker',
				async ({ query }) => {
					const parsed = employeePickerQuerySchema.parse(query);
					return ok(await service.picker(parsed.organizationIds, parsed.search, parsed.limit));
				},
				{
					// `warehouse:*` is application-admin-only (ADR-0008), so the
					// warehouse form's PIC dropdown rides `employee:read`: any role
					// that can open the warehouse form already holds it (`hr` full,
					// `admin` read, `owner` all). The endpoint returns only
					// id/code/name — no PII beyond the list page.
					erp: { permission: ['employee:read'] },
					detail: { description: 'PIC candidates for the warehouse form (linked orgs + company-level)' },
				},
			)
			.get(
				'/:id',
				async ({ params, erp }) => ok(await service.get(contextFrom(erp), id(params))),
				{ erp: { permission: ['employee:read'] }, detail: { description: 'One employee (own org or company-level)' } },
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const ctx = contextFrom(erp);
					return status(
						201,
						created(
							await service.create(
								{
									...ctx,
									actor: {
										...ctx.actor,
										ip: request.headers.get('x-forwarded-for'),
										userAgent: request.headers.get('user-agent'),
									},
								},
								createEmployeeSchema.parse(body),
							),
						),
					);
				},
				{ erp: { permission: ['employee:create'] }, detail: { description: 'Invite-first creation: runs the invitation pipeline and inserts the employee' } },
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) =>
					ok(await service.update(contextFrom(erp), id(params), updateEmployeeSchema.parse(body))),
				{ erp: { permission: ['employee:update'] }, detail: { description: 'Edits mutable employee fields' } },
			)
			.delete(
				'/:id',
				async ({ params, erp }) => {
					await service.archive(contextFrom(erp), id(params));
					return ok({ archived: true });
				},
				{ erp: { permission: ['employee:archive'] }, detail: { description: 'Soft-deletes the employee' } },
			);
	}
}

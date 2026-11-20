import type { ErpContext } from '@authorization/elysia-auth';
import {
	roleAssignmentContext,
	unassignableInviteRoles,
} from '@authorization/role-assignment';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { hrContext } from './hr-context';
import { EMPLOYEE_SERVICE_TOKEN } from '../constants/di';
import {
	createEmployeeSchema,
	employeeListQuerySchema,
	employeePickerQuerySchema,
	idParamSchema,
	updateEmployeeSchema,
} from '../contracts/hr.contract';
import type { EmployeeService, TEmployeeContext } from '../services/employee.service';
import { RoleNotAssignableError } from '@app/user/errors/invitation.errors';

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
		isPlatformAdmin: hasAppRole(erp.session.user.role, GLOBAL_ADMIN_ROLE),
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
		// `employee:read_private` decides whether the NIK is shown (M08).
		const records = hrContext();
		const withPrivate = async (erp: ErpContext): Promise<TEmployeeContext> => ({
			...contextFrom(erp),
			canReadPrivate: (await records(erp)).canReadPrivate,
		});

		return domainPlugin({ name: 'hr', prefix: '/human-resources/employees', tags: ['Human Resource'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(await service.list(await withPrivate(erp), employeeListQuerySchema.parse(query))),
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
				async ({ params, erp }) => ok(await service.get(await withPrivate(erp), id(params))),
				{ erp: { permission: ['employee:read'] }, detail: { description: 'One employee (own org or company-level)' } },
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const ctx = contextFrom(erp);
					const parsed = createEmployeeSchema.parse(body);
					// The invite-first form can carry organization roles, so it
					// passes the same ladder as the invitation endpoints: HR must
					// not smuggle `admin`/`hr`/`owner` in through an employee.
					if (parsed.organizationRoles?.length) {
						const illegal = unassignableInviteRoles(
							roleAssignmentContext(erp),
							parsed.organizationRoles,
						);
						if (illegal.length > 0) {
							throw new RoleNotAssignableError(illegal);
						}
					}
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
								parsed,
							),
						),
					);
				},
				{ erp: { permission: ['employee:create'] }, detail: { description: 'Invite-first creation: runs the invitation pipeline and inserts the employee' } },
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) =>
					ok(await service.update(await withPrivate(erp), id(params), updateEmployeeSchema.parse(body))),
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

import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { EMPLOYEE_PORTAL_RESOLVER_TOKEN } from '@authorization/employee-portal-resolver';
import { EMPLOYEE_PORTAL_SERVICE_TOKEN } from '../constants/di';
import { recordIdParamSchema } from '../contracts/hr-records.contract';
import {
	myAttendanceListQuerySchema,
	myAttendanceMonthQuerySchema,
	myLeaveBodySchema,
	myLeaveListQuerySchema,
	myOvertimeBodySchema,
	myOvertimeListQuerySchema,
	myProfileUpdateSchema,
	myScheduleQuerySchema,
	myTaskListQuerySchema,
	myTaskStatusSchema,
} from '../contracts/employee-portal.contract';

/**
 * Portal access probe (`/human-resources/me/access`).
 *
 * @remarks
 * Session only, no organization required: the portal calls it right after
 * sign-in to decide whether to keep the session. It answers which
 * organizations have an employee record for the caller; the client signs out
 * and shows the denial message when the list is empty.
 */
export class MyPortalAccessController {
	static plugin() {
		const resolver = container.resolve(EMPLOYEE_PORTAL_RESOLVER_TOKEN);

		return domainPlugin({ name: 'hr-portal-access', prefix: '/human-resources/me', tags: ['Human Resource'], guards: 'session' }).get(
			'/access',
			async ({ erp }) => ok({ organizations: await resolver.listOrganizationsForUser(erp.session.user.id) }),
			{
				erpSession: { session: true },
				detail: { description: 'Organizations where the caller has an employee record (portal login gate)' },
			},
		);
	}
}

/**
 * Employee self-service (`/human-resources/me/*`).
 *
 * @remarks
 * Every route resolves the employee from the session through the
 * `employeePortal` guard; no route accepts an `employeeId`. Excluded app roles
 * (`admin`, `investor`, `customer`) are refused by the guard even when they
 * hold an employee record.
 */
export class EmployeePortalController {
	static plugin() {
		const service = container.resolve(EMPLOYEE_PORTAL_SERVICE_TOKEN);
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({
			name: 'hr-employee-portal',
			prefix: '/human-resources/me',
			tags: ['Human Resource'],
			guards: 'employee-portal',
		})
			.get('/context', async ({ erp }) => ok(await service.context(erp.session.user.id, erp.employee.id, erp.organizationId)), {
				employeePortal: { enabled: true },
				detail: { description: 'The caller employee, active organization and portal-usable organizations' },
			})
			.get('/profile', async ({ erp }) => ok(await service.profile(erp.employee.id)), {
				employeePortal: { enabled: true },
				detail: { description: "The caller's own profile" },
			})
			.patch('/profile', async ({ body, erp }) => ok(await service.updateProfile(erp.employee.id, myProfileUpdateSchema.parse(body))), {
				employeePortal: { enabled: true },
				detail: { description: 'Updates the whitelisted profile fields (nickname, phone, primary address)' },
			})
			.get('/attendance/today', async ({ erp }) => ok(await service.today(erp.employee.id)), {
				employeePortal: { enabled: true },
				detail: { description: "Today's attendance row, if any" },
			})
			.post('/attendance/check-in', async ({ erp }) => ok(await service.checkIn(erp.employee.id, erp.session.user.id)), {
				employeePortal: { enabled: true },
				detail: { description: 'Self check-in for today (409 when already checked in or on leave)' },
			})
			.post('/attendance/check-out', async ({ erp }) => ok(await service.checkOut(erp.employee.id)), {
				employeePortal: { enabled: true },
				detail: { description: 'Self check-out for today (422 without a check-in)' },
			})
			.get('/attendance', async ({ query, erp }) => {
				const { period } = myAttendanceListQuerySchema.parse(query);
				return okPaginated(await service.attendanceList(erp.employee.id, period));
			}, {
				employeePortal: { enabled: true },
				detail: { description: "The caller's attendance rows, newest first" },
			})
			.get('/attendance/month', async ({ query, erp }) => ok(await service.attendanceMonth(erp.employee.id, myAttendanceMonthQuerySchema.parse(query).period)), {
				employeePortal: { enabled: true },
				detail: { description: "The caller's status counts for a month" },
			})
			.get('/schedule', async ({ query, erp }) => ok(await service.schedule(erp.employee.id, myScheduleQuerySchema.parse(query).start)), {
				employeePortal: { enabled: true },
				detail: { description: "The caller's seven-day schedule window" },
			})
			.get('/leave-types', async () => ok(await service.listLeaveTypes()), {
				employeePortal: { enabled: true },
				detail: { description: 'Active leave types' },
			})
			.get('/leave', async ({ query, erp }) =>
				okPaginated(await service.leaveList(erp.employee.id, erp.organizationId, myLeaveListQuerySchema.parse(query))),
			{
				employeePortal: { enabled: true },
				detail: { description: "The caller's leave requests" },
			})
			.get('/leave-balances', async ({ erp }) => ok(await service.leaveBalances(erp.employee.id, erp.organizationId)), {
				employeePortal: { enabled: true },
				detail: { description: "The caller's leave quota balances for the current year" },
			})
			.post('/leave', async ({ body, erp, status }) =>
				status(201, created(await service.requestLeave(erp.employee.id, erp.organizationId, erp.session.user.id, myLeaveBodySchema.parse(body)))),
			{
				employeePortal: { enabled: true },
				detail: { description: 'Submits a leave request for the caller (HR still decides)' },
			})
			.post('/leave/:id/cancel', async ({ params, erp }) =>
				ok(await service.cancelLeave(erp.employee.id, erp.organizationId, erp.session.user.id, id(params))),
			{
				employeePortal: { enabled: true },
				detail: { description: "Cancels one of the caller's own leave requests" },
			})
			.get('/overtime', async ({ query, erp }) =>
				okPaginated(await service.overtimeList(erp.employee.id, erp.organizationId, myOvertimeListQuerySchema.parse(query))),
			{
				employeePortal: { enabled: true },
				detail: { description: "The caller's overtime records" },
			})
			.post('/overtime', async ({ body, erp, status }) =>
				status(201, created(await service.requestOvertime(erp.employee.id, erp.organizationId, erp.session.user.id, myOvertimeBodySchema.parse(body)))),
			{
				employeePortal: { enabled: true },
				detail: { description: 'Submits an overtime record for the caller (HR still decides)' },
			})
			.get('/tasks', async ({ query, erp }) =>
				okPaginated(await service.taskList(erp.employee.id, erp.organizationId, myTaskListQuerySchema.parse(query))),
			{
				employeePortal: { enabled: true },
				detail: { description: 'Tasks HR assigned to the caller' },
			})
			.post('/tasks/:id/status', async ({ params, body, erp }) =>
				ok(await service.setTaskStatus(erp.employee.id, erp.organizationId, id(params), myTaskStatusSchema.parse(body).status)),
			{
				employeePortal: { enabled: true },
				detail: { description: "Marks one of the caller's own tasks open, done or cancelled" },
			});
	}
}

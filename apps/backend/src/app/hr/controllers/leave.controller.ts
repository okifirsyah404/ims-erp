import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { LEAVE_SERVICE_TOKEN } from '../constants/di';
import {
	balanceQuerySchema,
	decisionSchema,
	idParamSchema,
	leaveBodySchema,
	overtimeBodySchema,
	requestListQuerySchema,
} from '../contracts/hr.contract';

const note = (body: unknown) => decisionSchema.parse(body ?? {}).note;

/**
 * REST controller for leave and overtime (`/hr/leave`, `/hr/overtime`).
 * Reading needs `leave:read` / `overtime:read`; recording `:create`;
 * approving `:approve`, rejecting `:reject`, cancelling `:cancel` (never by
 * whoever recorded the request, for approve and reject).
 */
export class LeaveController {
	static plugin() {
		const service = container.resolve(LEAVE_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-leave', prefix: '/hr', tags: ['HR'], guards: 'erp' })
			.get('/leave-types', async () => ok(await service.listTypes()), {
				erp: { permission: ['leave:read'] },
				detail: { description: 'Active leave types' },
			})
			.get('/leave', async ({ query }) => okPaginated(await service.listLeave(requestListQuerySchema.parse(query))), {
				erp: { permission: ['leave:read'] },
				detail: { description: 'Leave requests' },
			})
			.get('/leave/balances', async ({ query }) => {
				const { employeeId, year } = balanceQuerySchema.parse(query);
				return ok(await service.balances(employeeId, year));
			}, { erp: { permission: ['leave:read'] }, detail: { description: 'Quota balances of an employee for a year' } })
			.post(
				'/leave',
				async ({ body, erp, status }) => status(201, created(await service.createLeave(erp.session.user.id, leaveBodySchema.parse(body)))),
				{ erp: { permission: ['leave:create'] }, detail: { description: 'Records a leave request for an employee' } },
			)
			.post('/leave/:id/approve', async ({ params, body, erp }) => ok(await service.approveLeave(erp.session.user.id, id(params), note(body))), {
				erp: { permission: ['leave:approve'] },
				detail: { description: 'Approves; the days become attendance' },
			})
			.post('/leave/:id/reject', async ({ params, body, erp }) => ok(await service.rejectLeave(erp.session.user.id, id(params), note(body))), {
				erp: { permission: ['leave:reject'] },
				detail: { description: 'Rejects a submitted request' },
			})
			.post('/leave/:id/cancel', async ({ params, body, erp }) => ok(await service.cancelLeave(erp.session.user.id, id(params), note(body))), {
				erp: { permission: ['leave:cancel'] },
				detail: { description: 'Cancels; an approved leave gives its days back' },
			})
			.get('/overtime', async ({ query }) => okPaginated(await service.listOvertime(requestListQuerySchema.parse(query))), {
				erp: { permission: ['overtime:read'] },
				detail: { description: 'Overtime records' },
			})
			.post(
				'/overtime',
				async ({ body, erp, status }) =>
					status(201, created(await service.createOvertime(erp.session.user.id, overtimeBodySchema.parse(body)))),
				{ erp: { permission: ['overtime:create'] }, detail: { description: 'Records overtime for an employee' } },
			)
			.post(
				'/overtime/:id/approve',
				async ({ params, body, erp }) => ok(await service.approveOvertime(erp.session.user.id, id(params), note(body))),
				{ erp: { permission: ['overtime:approve'] }, detail: { description: 'Approves overtime' } },
			)
			.post(
				'/overtime/:id/reject',
				async ({ params, body, erp }) => ok(await service.rejectOvertime(erp.session.user.id, id(params), note(body))),
				{ erp: { permission: ['overtime:reject'] }, detail: { description: 'Rejects overtime' } },
			)
			.post(
				'/overtime/:id/cancel',
				async ({ params, body, erp }) => ok(await service.cancelOvertime(erp.session.user.id, id(params), note(body))),
				{ erp: { permission: ['overtime:cancel'] }, detail: { description: 'Cancels overtime' } },
			);
	}
}

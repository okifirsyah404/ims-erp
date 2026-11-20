import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { LEAVE_SERVICE_TOKEN } from '../constants/di';
import {
	balanceQuerySchema,
	decisionSchema,
	leaveBodySchema,
	overtimeBodySchema,
	recordIdParamSchema,
	requestListQuerySchema,
} from '../contracts/hr-records.contract';
import { hrContext } from './hr-context';

const note = (body: unknown) => decisionSchema.parse(body ?? {}).note;

/**
 * Leave and overtime (`/hr/leave*`, `/hr/overtime`, M08; decision of
 * 2026-11-07): HR records a request, someone else decides it
 * (`leave:approve|reject`, `overtime:approve|reject`). Only employees the
 * caller sees (ERP-0034 scope).
 */
export class LeaveController {
	static plugin() {
		const service = container.resolve(LEAVE_SERVICE_TOKEN);
		const context = hrContext();
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-leave', prefix: '/human-resources', tags: ['Human Resource'], guards: 'erp' })
			.get('/leave-types', async () => ok(await service.listTypes()), {
				erp: { permission: ['leave:read'] },
				detail: { description: 'Active leave types' },
			})
			.get('/leave', async ({ query, erp }) => okPaginated(await service.listLeave((await context(erp)).scope, requestListQuerySchema.parse(query))), {
				erp: { permission: ['leave:read'] },
				detail: { description: 'Leave requests' },
			})
			.get(
				'/leave/balances',
				async ({ query, erp }) => {
					const { employeeId, year } = balanceQuerySchema.parse(query);
					return ok(await service.balances((await context(erp)).scope, employeeId, year));
				},
				{ erp: { permission: ['leave:read'] }, detail: { description: 'Quota balances of an employee for a year' } },
			)
			.post(
				'/leave',
				async ({ body, erp, status }) => {
					const ctx = await context(erp);
					return status(201, created(await service.createLeave(ctx.scope, ctx.actorUserId, leaveBodySchema.parse(body))));
				},
				{ erp: { permission: ['leave:create'] }, detail: { description: 'Records a leave request for an employee' } },
			)
			.post(
				'/leave/:id/approve',
				async ({ params, body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.approveLeave(ctx.scope, ctx.actorUserId, id(params), note(body)));
				},
				{ erp: { permission: ['leave:approve'] }, detail: { description: 'Approves (writes the attendance days)' } },
			)
			.post(
				'/leave/:id/reject',
				async ({ params, body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.rejectLeave(ctx.scope, ctx.actorUserId, id(params), note(body)));
				},
				{ erp: { permission: ['leave:reject'] }, detail: { description: 'Rejects a leave request' } },
			)
			.post(
				'/leave/:id/cancel',
				async ({ params, body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.cancelLeave(ctx.scope, ctx.actorUserId, id(params), note(body)));
				},
				{ erp: { permission: ['leave:cancel'] }, detail: { description: 'Cancels (removes its attendance days)' } },
			)
			.get('/overtime', async ({ query, erp }) => okPaginated(await service.listOvertime((await context(erp)).scope, requestListQuerySchema.parse(query))), {
				erp: { permission: ['overtime:read'] },
				detail: { description: 'Overtime records' },
			})
			.post(
				'/overtime',
				async ({ body, erp, status }) => {
					const ctx = await context(erp);
					return status(201, created(await service.createOvertime(ctx.scope, ctx.actorUserId, overtimeBodySchema.parse(body))));
				},
				{ erp: { permission: ['overtime:create'] }, detail: { description: 'Records overtime for an employee' } },
			)
			.post(
				'/overtime/:id/approve',
				async ({ params, body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.approveOvertime(ctx.scope, ctx.actorUserId, id(params), note(body)));
				},
				{ erp: { permission: ['overtime:approve'] }, detail: { description: 'Approves overtime' } },
			)
			.post(
				'/overtime/:id/reject',
				async ({ params, body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.rejectOvertime(ctx.scope, ctx.actorUserId, id(params), note(body)));
				},
				{ erp: { permission: ['overtime:reject'] }, detail: { description: 'Rejects overtime' } },
			)
			.post(
				'/overtime/:id/cancel',
				async ({ params, body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.cancelOvertime(ctx.scope, ctx.actorUserId, id(params), note(body)));
				},
				{ erp: { permission: ['overtime:cancel'] }, detail: { description: 'Cancels overtime' } },
			);
	}
}

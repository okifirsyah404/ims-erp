import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import { EMPLOYEE_ADVANCE_SERVICE_TOKEN } from '../constants/di';
import { advanceCreateSchema, advanceListQuerySchema, settlementCreateSchema } from '../contracts/employee-advance.contract';

const idSchema = z.object({ id: z.uuid() });

/**
 * Employee advances (`/finance/advances`) and their settlements
 * (`/finance/settlements`), ERP-0144. Permissions from the existing
 * `advance` and `settlement` resources; disbursement and pay-out happen in
 * `payment` (allocations `employee_advance` / `expense_settlement`).
 */
export class EmployeeAdvanceController {
	static plugin() {
		const service = container.resolve(EMPLOYEE_ADVANCE_SERVICE_TOKEN);
		const ctxOf = (erp: ErpContext) => ({ organizationId: erp.organizationId, actorUserId: erp.session.user.id });
		const id = (params: unknown) => idSchema.parse(params).id;

		return domainPlugin({ name: 'finance-advances', prefix: '/finance', tags: ['Finance'], guards: 'erp' })
			.get('/advances', async ({ query, erp }) => okPaginated(await service.listAdvances(erp.organizationId, advanceListQuerySchema.parse(query))), {
				erp: { permission: ['advance:read'] },
				detail: { description: 'Employee advances' },
			})
			.get('/advances/:id', async ({ params, erp }) => ok(await service.getAdvance(erp.organizationId, id(params))), {
				erp: { permission: ['advance:read'] },
				detail: { description: 'One employee advance' },
			})
			.post(
				'/advances',
				async ({ body, erp, status }) => status(201, created(await service.createAdvance(ctxOf(erp), advanceCreateSchema.parse(body)))),
				{ erp: { permission: ['advance:create'] }, detail: { description: 'Requests an advance (draft)' } },
			)
			.post('/advances/:id/submit', async ({ params, erp }) => ok(await service.submitAdvance(ctxOf(erp), id(params))), {
				erp: { permission: ['advance:submit'] },
				detail: { description: 'draft -> submitted' },
			})
			.post('/advances/:id/approve', async ({ params, erp }) => ok(await service.approveAdvance(ctxOf(erp), id(params))), {
				erp: { permission: ['advance:approve'] },
				detail: { description: 'submitted -> approved (not by the requester)' },
			})
			.post('/advances/:id/cancel', async ({ params, erp }) => ok(await service.cancelAdvance(ctxOf(erp), id(params))), {
				erp: { permission: ['advance:reject'] },
				detail: { description: 'Rejects or cancels an advance before disbursement' },
			})
			.get(
				'/settlements',
				async ({ query, erp }) => okPaginated(await service.listSettlements(erp.organizationId, advanceListQuerySchema.parse(query))),
				{ erp: { permission: ['settlement:read'] }, detail: { description: 'Advance settlements' } },
			)
			.get('/settlements/:id', async ({ params, erp }) => ok(await service.getSettlement(erp.organizationId, id(params))), {
				erp: { permission: ['settlement:read'] },
				detail: { description: 'One settlement with its lines' },
			})
			.post(
				'/settlements',
				async ({ body, erp, status }) => status(201, created(await service.createSettlement(ctxOf(erp), settlementCreateSchema.parse(body)))),
				{ erp: { permission: ['settlement:create'] }, detail: { description: 'Settles a disbursed advance with expense lines (draft)' } },
			)
			.post('/settlements/:id/submit', async ({ params, erp }) => ok(await service.submitSettlement(ctxOf(erp), id(params))), {
				erp: { permission: ['settlement:submit'] },
				detail: { description: 'draft -> submitted' },
			})
			.post('/settlements/:id/verify', async ({ params, erp }) => ok(await service.verifySettlement(ctxOf(erp), id(params))), {
				erp: { permission: ['settlement:verify'] },
				detail: { description: 'submitted -> verified (not by the submitter)' },
			})
			.post('/settlements/:id/approve', async ({ params, erp }) => ok(await service.approveSettlement(ctxOf(erp), id(params))), {
				erp: { permission: ['settlement:approve'] },
				detail: { description: 'verified -> approved: posts the settlement journal and offsets the advance' },
			})
			.post('/settlements/:id/reject', async ({ params, erp }) => ok(await service.rejectSettlement(ctxOf(erp), id(params))), {
				erp: { permission: ['settlement:reject'] },
				detail: { description: 'submitted/verified -> rejected' },
			})
			.post('/settlements/:id/cancel', async ({ params, erp }) => ok(await service.cancelSettlement(ctxOf(erp), id(params))), {
				erp: { permission: ['settlement:update'] },
				detail: { description: 'draft -> cancelled' },
			});
	}
}

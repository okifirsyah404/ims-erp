import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	paymentAllocationsSchema,
	paymentCreateSchema,
	paymentIdParamSchema,
	paymentListQuerySchema,
	paymentVoidSchema,
} from '../contracts/payment.contract';
import { PAYMENT_SERVICE_TOKEN } from '../constants/di';
import type { IPaymentService } from '../contracts/payment.service.interface';

/**
 * REST controller for the payment ledger (M09 F4, ADR-0024).
 *
 * @remarks
 * Permissions follow the D5 workflow: `payment:create` (draft and its
 * allocations), `payment:submit`, `payment:approve` (one approver role),
 * `payment:execute`, `payment:read` for the list and one document.
 *
 * `POST /payments/:id/void-executed` stays in Accounting (F7 reversal through a
 * month-end adjustment), so it is deliberately not mounted here.
 */
export class PaymentLedgerController {
	static plugin() {
		const payments = container.resolve<IPaymentService>(PAYMENT_SERVICE_TOKEN);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'payment-ledger',
			prefix: '',
			tags: ['Payment'],
			guards: 'erp',
		})
			.get(
				'/payments',
				async ({ query, erp }) =>
					okPaginated(
						await payments.list(
							erp.organizationId,
							paymentListQuerySchema.parse(query),
							paymentListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['payment:read'] },
					detail: { description: 'Paginated payment ledger' },
				},
			)
			.get(
				'/payments/:id',
				async ({ params, erp }) => ok(await payments.get(erp.organizationId, paymentIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['payment:read'] },
					detail: { description: 'One payment document' },
				},
			)
			.post(
				'/payments',
				async ({ body, erp, status }) => {
					const input = paymentCreateSchema.parse(body);
					const payment = await payments.create(ctxOf(erp), input, input.allocations);
					if (input.allocations.length > 0) {
						await payments.setAllocations(ctxOf(erp), payment.id, input.allocations);
					}
					return status(201, created(payment));
				},
				{
					erp: { permission: ['payment:create'] },
					detail: { description: 'Creates a draft customer payment' },
				},
			)
			.put(
				'/payments/:id/allocations',
				async ({ params, body, erp }) => {
					const { allocations } = paymentAllocationsSchema.parse(body);
					return ok(
						await payments.setAllocations(
							ctxOf(erp),
							paymentIdParamSchema.parse(params).id,
							allocations,
						),
					);
				},
				{
					erp: { permission: ['payment:create'] },
					detail: { description: 'Replaces the allocation set of a draft payment' },
				},
			)
			.post(
				'/payments/:id/submit',
				async ({ params, erp }) =>
					ok(await payments.submit(ctxOf(erp), paymentIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['payment:submit'] },
					detail: { description: 'draft → submitted' },
				},
			)
			.post(
				'/payments/:id/approve',
				async ({ params, erp }) =>
					ok(await payments.approve(ctxOf(erp), paymentIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['payment:approve'] },
					detail: { description: 'submitted → approved (single approver role, D5)' },
				},
			)
			.post(
				'/payments/:id/execute',
				async ({ params, erp }) =>
					ok(await payments.execute(ctxOf(erp), paymentIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['payment:execute'] },
					detail: {
						description:
							'approved → executed: allocates to invoices, updates the AR mirrors and posts the cash movement with its journal',
					},
				},
			)
			.post(
				'/payments/:id/void',
				async ({ params, body, erp }) =>
					ok(
						await payments.void(
							ctxOf(erp),
							paymentIdParamSchema.parse(params).id,
							paymentVoidSchema.parse(body).reason,
						),
					),
				{
					erp: { permission: ['payment:approve'] },
					detail: {
						description:
							'Voids a not-yet-executed payment; executed payments go through /payments/:id/void-executed (F7 reversal, Accounting)',
					},
				},
			);
	}
}

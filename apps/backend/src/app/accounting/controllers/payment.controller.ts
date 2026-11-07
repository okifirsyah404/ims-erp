import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	AGING_BUCKETS,
	apAgingQuerySchema,
	arAgingQuerySchema,
	paymentAllocationsSchema,
	paymentCreateSchema,
	paymentListQuerySchema,
	paymentVoidSchema,
	supplierBillCreateSchema,
	supplierBillListQuerySchema,
	type TAgingBucket,
} from '../contracts/payment.contract';
import { ledgerIdParamSchema } from '../contracts/ledger.contract';
import { PAYMENT_SERVICE_TOKEN, SUPPLIER_BILL_SERVICE_TOKEN } from '../constants/ar-di';
import type { PaymentService } from '../services/payment.service';
import type { SupplierBillService } from '../services/supplier-bill.service';
import { LEDGER_REPOSITORY_TOKEN } from '../constants/di';
import type { LedgerRepository } from '../repositories/ledger.repository';

/**
 * REST controller for the payments + AR slice (M09 F4).
 *
 * @remarks
 * Permissions follow the D5 workflow: `payment:create` (draft),
 * `payment:submit`, `payment:approve` (one approver role), `payment:execute`,
 * `payment:read` for lists and the aging report. Routes live under `/payments`
 * and `/ar`.
 */
export class PaymentController {
	/** Builds the Elysia plugin mounting `/payments` and `/ar`. */
	static plugin() {
		const payments = container.resolve<PaymentService>(PAYMENT_SERVICE_TOKEN);
		const bills = container.resolve<SupplierBillService>(
			SUPPLIER_BILL_SERVICE_TOKEN,
		);
		const ledgerRepo = container.resolve<LedgerRepository>(
			LEDGER_REPOSITORY_TOKEN,
		);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		const agingBucketOf = (dueDate: string | null, asOf: string): TAgingBucket => {
			if (!dueDate) return 'current';
			const days = Math.floor(
				(Date.parse(asOf) - Date.parse(dueDate)) / 86_400_000,
			);
			if (days <= 0) return 'current';
			if (days <= 30) return 'd1_30';
			if (days <= 60) return 'd31_60';
			if (days <= 90) return 'd61_90';
			return 'd90plus';
		};

		return domainPlugin({
			name: 'payments-ar',
			prefix: '',
			tags: ['Accounting'],
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
				async ({ params, erp }) =>
					ok(
						await payments.get(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
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
						await payments.setAllocations(
							ctxOf(erp),
							payment.id,
							input.allocations,
						);
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
							ledgerIdParamSchema.parse(params).id,
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
					ok(
						await payments.submit(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['payment:submit'] },
					detail: { description: 'draft → submitted' },
				},
			)
			.post(
				'/payments/:id/approve',
				async ({ params, erp }) =>
					ok(
						await payments.approve(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['payment:approve'] },
					detail: { description: 'submitted → approved (single approver role, D5)' },
				},
			)
			.post(
				'/payments/:id/execute',
				async ({ params, erp }) =>
					ok(
						await payments.execute(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
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
							ledgerIdParamSchema.parse(params).id,
							paymentVoidSchema.parse(body).reason,
						),
					),
				{
					erp: { permission: ['payment:approve'] },
					detail: {
						description: 'Voids a not-yet-executed payment (executed ones need an F7 adjustment)',
					},
				},
			)
			.get(
				'/ar/aging',
				async ({ query, erp }) => {
					const { asOfDate, customerId } = arAgingQuerySchema.parse(query);
					const asOf = asOfDate ?? new Date().toISOString().slice(0, 10);
					const items = await ledgerRepo.listArOpenItemsForAging(
						erp.organizationId,
						customerId,
					);
					const byCustomer = new Map<
						string,
						{
							customerId: string | null;
							buckets: Record<TAgingBucket, number>;
							total: number;
						}
					>();
					for (const item of items) {
						const key = item.customerId ?? 'none';
						const entry = byCustomer.get(key) ?? {
							customerId: item.customerId,
							buckets: {
								current: 0,
								d1_30: 0,
								d31_60: 0,
								d61_90: 0,
								d90plus: 0,
							},
							total: 0,
						};
						const bucket = agingBucketOf(item.dueDate, asOf);
						entry.buckets[bucket] += item.outstandingAmount;
						entry.total += item.outstandingAmount;
						byCustomer.set(key, entry);
					}
					const rows = [...byCustomer.values()];
					return ok({
						asOfDate: asOf,
						buckets: AGING_BUCKETS,
						rows,
						grandTotal: rows.reduce((s, r) => s + r.total, 0),
					});
				},
				{
					erp: { permission: ['payment:read'] },
					detail: {
						description:
							'AR aging buckets (current/1-30/31-60/61-90/90+) computed on demand from the sub-ledger (D7)',
					},
				},
			)
			/* ---------------- supplier bills (F5) ---------------- */
			.get(
				'/bills',
				async ({ query, erp }) =>
					okPaginated(
						await bills.list(
							erp.organizationId,
							supplierBillListQuerySchema.parse(query),
							supplierBillListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['bill:read'] },
					detail: { description: 'Paginated supplier bill list' },
				},
			)
			.get(
				'/bills/:id',
				async ({ params, erp }) =>
					ok(
						await bills.get(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['bill:read'] },
					detail: { description: 'One supplier bill' },
				},
			)
			.post(
				'/bills',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await bills.create(
								ctxOf(erp),
								supplierBillCreateSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['bill:create'] },
					detail: { description: 'Creates a draft supplier bill' },
				},
			)
			.post(
				'/bills/:id/cancel',
				async ({ params, erp }) =>
					ok(
						await bills.cancel(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['bill:create'] },
					detail: { description: 'Voids a draft supplier bill (no journal impact)' },
				},
			)
			.post(
				'/bills/:id/record',
				async ({ params, erp }) =>
					ok(
						await bills.record(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['bill:record'] },
					detail: {
						description:
							'draft → approved: posts DR expense / DR input tax / CR AP and opens the AP sub-ledger row',
					},
				},
			)
			.get(
				'/ap/aging',
				async ({ query, erp }) => {
					const { asOfDate, supplierId } = apAgingQuerySchema.parse(query);
					const asOf = asOfDate ?? new Date().toISOString().slice(0, 10);
					const items = (await ledgerRepo.listApOpenItemsForAging(
						erp.organizationId,
						supplierId,
					)) as Array<{
						supplierId: string | null;
						dueDate: string | null;
						outstandingAmount: number;
					}>;
					const bySupplier = new Map<
						string,
						{
							supplierId: string | null;
							buckets: Record<TAgingBucket, number>;
							total: number;
						}
					>();
					for (const item of items) {
						const key = item.supplierId ?? 'none';
						const entry = bySupplier.get(key) ?? {
							supplierId: item.supplierId,
							buckets: {
								current: 0,
								d1_30: 0,
								d31_60: 0,
								d61_90: 0,
								d90plus: 0,
							},
							total: 0,
						};
						const bucket = agingBucketOf(item.dueDate, asOf);
						entry.buckets[bucket] += item.outstandingAmount;
						entry.total += item.outstandingAmount;
						bySupplier.set(key, entry);
					}
					const rows = [...bySupplier.values()];
					return ok({
						asOfDate: asOf,
						buckets: AGING_BUCKETS,
						rows,
						grandTotal: rows.reduce((s, r) => s + r.total, 0),
					});
				},
				{
					erp: { permission: ['bill:read'] },
					detail: {
						description:
							'AP aging buckets computed on demand from the sub-ledger (D7)',
					},
				},
			);
	}
}

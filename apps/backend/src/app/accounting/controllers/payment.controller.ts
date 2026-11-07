import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	AGING_BUCKETS,
	apAgingQuerySchema,
	arAgingQuerySchema,
	balanceSheetQuerySchema,
	cashFlowQuerySchema,
	paymentAllocationsSchema,
	paymentCreateSchema,
	paymentListQuerySchema,
	paymentVoidSchema,
	profitAndLossQuerySchema,
	reconciliationCreateSchema,
	reconciliationItemsSchema,
	reconciliationListQuerySchema,
	reconciliationMatchSchema,
	closeChecklistQuerySchema,
	supplierBillCreateSchema,
	supplierBillListQuerySchema,
	type TAgingBucket,
} from '../contracts/payment.contract';
import { ledgerIdParamSchema } from '../contracts/ledger.contract';
import {
	BANK_RECONCILIATION_SERVICE_TOKEN,
	MONTH_END_CLOSE_SERVICE_TOKEN,
	PAYMENT_SERVICE_TOKEN,
	REPORT_SERVICE_TOKEN,
	SUPPLIER_BILL_SERVICE_TOKEN,
} from '../constants/ar-di';
import type { PaymentService } from '../services/payment.service';
import type { SupplierBillService } from '../services/supplier-bill.service';
import type { ReportService } from '../services/report.service';
import type { BankReconciliationService } from '../services/bank-reconciliation.service';
import type { MonthEndCloseService } from '../services/month-end-close.service';
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
		const reports = container.resolve<ReportService>(REPORT_SERVICE_TOKEN);
		const reconciliations =
			container.resolve<BankReconciliationService>(
				BANK_RECONCILIATION_SERVICE_TOKEN,
			);
		const close = container.resolve<MonthEndCloseService>(
			MONTH_END_CLOSE_SERVICE_TOKEN,
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
						description:
							'Voids a not-yet-executed payment; executed payments go through /close/payment-void (F7 reversal)',
					},
				},
			)
			.post(
				'/payments/:id/void-executed',
				async ({ params, body, erp }) =>
					ok(
						await close.voidExecutedPayment(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							paymentVoidSchema.parse(body),
						),
					),
				{
					erp: { permission: ['payment:approve'] },
					detail: {
						description:
							'Reverses an executed payment: mirrored JE + cash movement + open-item rollback (append-only, D4)',
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
			)
			/* ---------------- financial reports (F6) ---------------- */
			.get(
				'/reports/profit-and-loss',
				async ({ query, erp }) => {
					const { startDate, endDate } = profitAndLossQuerySchema.parse(query);
					return ok(
						await reports.profitAndLoss(
							{ organizationId: erp.organizationId },
							startDate,
							endDate,
						),
					);
				},
				{
					erp: { permission: ['financial_report:read'] },
					detail: {
						description:
							'Income statement computed on demand from posted journal lines (D7)',
					},
				},
			)
			.get(
				'/reports/balance-sheet',
				async ({ query, erp }) => {
					const { asOfDate } = balanceSheetQuerySchema.parse(query);
					return ok(
						await reports.balanceSheet(
							{ organizationId: erp.organizationId },
							asOfDate,
						),
					);
				},
				{
					erp: { permission: ['financial_report:read'] },
					detail: {
						description:
							'Balance sheet as of a date; current earnings close into equity',
					},
				},
			)
			.get(
				'/reports/cash-flow',
				async ({ query, erp }) => {
					const { startDate, endDate } = cashFlowQuerySchema.parse(query);
					return ok(
						await reports.cashFlow(
							{ organizationId: erp.organizationId },
							startDate,
							endDate,
						),
					);
				},
				{
					erp: { permission: ['financial_report:read'] },
					detail: {
						description:
							'Direct-method cash flow classified by cash_flow_category (D11)',
					},
				},
			)
			/* ---------------- month-end close (F7) ---------------- */
			.get(
				'/close/checklist',
				async ({ query, erp }) => {
					const { periodYear, periodMonth } =
						closeChecklistQuerySchema.parse(query);
					return ok(
						await close.checklist(
							erp.organizationId,
							periodYear,
							periodMonth,
						),
					);
				},
				{
					erp: { permission: ['accounting_period:close'] },
					detail: {
						description:
							'Pre-close checklist computed on demand (D7): drafts, pending payments, open reconciliations',
					},
				},
			)
			/* ---------------- bank reconciliation (F6) ---------------- */
			.get(
				'/bank-reconciliations',
				async ({ query, erp }) =>
					okPaginated(
						await reconciliations.list(
							erp.organizationId,
							reconciliationListQuerySchema.parse(query),
							reconciliationListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['cash_bank:read'] },
					detail: { description: 'Paginated bank reconciliation list' },
				},
			)
			.get(
				'/bank-reconciliations/:id',
				async ({ params, erp }) =>
					ok(
						await reconciliations.get(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['cash_bank:read'] },
					detail: { description: 'One bank reconciliation' },
				},
			)
			.post(
				'/bank-reconciliations',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await reconciliations.create(
								ctxOf(erp),
								reconciliationCreateSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: {
						description:
							'Opens a draft reconciliation; book balance snapshot taken from the cash account',
					},
				},
			)
			.post(
				'/bank-reconciliations/:id/items',
				async ({ params, body, erp }) => {
					const { items } = reconciliationItemsSchema.parse(body);
					return ok(
						await reconciliations.addItems(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							items,
						),
					);
				},
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: { description: 'Appends statement lines to a draft reconciliation' },
				},
			)
			.post(
				'/bank-reconciliations/:id/items/:itemId/match',
				async ({ params, body, erp }) => {
					const { cashBankTransactionId } =
						reconciliationMatchSchema.parse(body);
					return ok(
						await reconciliations.matchItem(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							ledgerIdParamSchema.parse({ id: params.itemId }).id,
							cashBankTransactionId,
						),
					);
				},
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: {
						description: 'Matches a statement item (moves draft → in_progress)',
					},
				},
			)
			.post(
				'/bank-reconciliations/:id/reconcile',
				async ({ params, erp }) =>
					ok(
						await reconciliations.reconcile(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: {
						description:
							'Marks reconciled: all items matched and statement = book balance',
					},
				},
			)
			.post(
				'/bank-reconciliations/:id/close',
				async ({ params, erp }) =>
					ok(
						await reconciliations.close(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: { description: 'reconciled → closed (terminal)' },
				},
			);
	}
}

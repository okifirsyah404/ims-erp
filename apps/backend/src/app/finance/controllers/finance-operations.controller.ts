import { z } from 'zod';
import { generalLedgerQuerySchema, trialBalanceQuerySchema } from '../contracts/ledger.contract';
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
	paymentVoidSchema,
	profitAndLossQuerySchema,
	reconciliationCreateSchema,
	reconciliationItemsSchema,
	reconciliationListQuerySchema,
	reconciliationMatchSchema,
	closeChecklistQuerySchema,
	reportArchiveCreateSchema,
	reportArchiveListQuerySchema,
	supplierBillCreateSchema,
	supplierBillFromOrderSchema,
	supplierBillListQuerySchema,
	type TAgingBucket,
} from '../contracts/payment.contract';
import { ledgerIdParamSchema } from '../contracts/ledger.contract';
import {
	balanceSheetToCsv,
	cashFlowToCsv,
	profitAndLossToCsv,
} from '../utils/report-csv';
import {
	BANK_RECONCILIATION_SERVICE_TOKEN,
	MONTH_END_CLOSE_SERVICE_TOKEN,
	REPORT_ARCHIVE_SERVICE_TOKEN,
	REPORT_SERVICE_TOKEN,
	SUPPLIER_BILL_SERVICE_TOKEN,
} from '../constants/ar-di';
import type { SupplierBillService } from '../services/supplier-bill.service';
import type { ReportService } from '../services/report.service';
import type { ReportArchiveService } from '../services/report-archive.service';
import type { BankReconciliationService } from '../services/bank-reconciliation.service';
import type { MonthEndCloseService } from '../services/month-end-close.service';
import { AR_OPEN_ITEM_REPOSITORY_TOKEN, AP_OPEN_ITEM_REPOSITORY_TOKEN } from '../constants/di';
import type { IArOpenItemRepository } from '../contracts/ar-open-item.repository.interface';
import type { IApOpenItemRepository } from '../contracts/ap-open-item.repository.interface';

/** Sets the CSV download headers and returns the body unchanged. */
function csvResponse(
	set: { status?: number | string; headers: Record<string, string> },
	filename: string,
	body: string,
): string {
	set.status = 200;
	set.headers['content-type'] = 'text/csv; charset=utf-8';
	set.headers['content-disposition'] = `attachment; filename="${filename}"`;
	return body;
}

/**
 * REST controller for the payments + AR slice (M09 F4). *
 * @remarks
 * Permissions follow the D5 workflow: `payment:create` (draft),
 * `payment:submit`, `payment:approve` (one approver role), `payment:execute`,
 * `payment:read` for lists and the aging report. Routes live under `/payments`
 * and `/ar`.
 */
export class FinanceOperationsController {
	/** Builds the Elysia plugin mounting `/payments` and `/ar`. */
	static plugin() {
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
		const archives = container.resolve<ReportArchiveService>(
			REPORT_ARCHIVE_SERVICE_TOKEN,
		);
		const arOpenItems = container.resolve<IArOpenItemRepository>(
			AR_OPEN_ITEM_REPOSITORY_TOKEN,
		);
		const apOpenItems = container.resolve<IApOpenItemRepository>(
			AP_OPEN_ITEM_REPOSITORY_TOKEN,
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
			name: 'finance-operations',
			prefix: '/finance',
			tags: ['Accounting'],
			guards: 'erp',
		})
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
					const items = await arOpenItems.listArOpenItemsForAging(
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
				'/supplier-bills',
				async ({ query, erp }) =>
					okPaginated(
						await bills.list({
							organizationId: erp.organizationId,
							...supplierBillListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['bill:read'] },
					detail: { description: 'Paginated supplier bill list' },
				},
			)
			.get(
				'/supplier-bills/billable-orders',
				async ({ query }) =>
					ok(await bills.billableOrders(z.object({ search: z.string().trim().max(100).optional() }).parse(query).search)),
				{
					erp: { permission: ['bill:create'] },
					detail: { description: 'Purchase orders with received goods that are not billed yet (ERP-0012)' },
				},
			)
			.post(
				'/supplier-bills/from-purchase-order',
				async ({ body, erp, status }) =>
					status(201, created(await bills.createFromPurchaseOrder(ctxOf(erp), supplierBillFromOrderSchema.parse(body)))),
				{
					erp: { permission: ['bill:create'] },
					detail: { description: 'Drafts a supplier bill from received purchase order lines (ERP-0012)' },
				},
			)
			.get(
				'/supplier-bills/:id',
				async ({ params, erp }) =>
					ok(
						await bills.detail(
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
				'/supplier-bills',
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
				'/supplier-bills/:id/cancel',
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
				'/supplier-bills/:id/record',
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
							'draft → approved: posts DR inventory (stock lines) / DR expense / DR input tax / CR AP and opens the AP sub-ledger row',
					},
				},
			)
			.get(
				'/ap/aging',
				async ({ query, erp }) => {
					const { asOfDate, supplierCompanyId } = apAgingQuerySchema.parse(query);
					const asOf = asOfDate ?? new Date().toISOString().slice(0, 10);
					const items = (await apOpenItems.listApOpenItemsForAging(
						erp.organizationId,
						supplierCompanyId,
					)) as Array<{
						supplierCompanyId: string | null;
						dueDate: string | null;
						outstandingAmount: number;
					}>;
					const bySupplier = new Map<
						string,
						{
							supplierCompanyId: string | null;
							buckets: Record<TAgingBucket, number>;
							total: number;
						}
					>();
					for (const item of items) {
						const key = item.supplierCompanyId ?? 'none';
						const entry = bySupplier.get(key) ?? {
							supplierCompanyId: item.supplierCompanyId,
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
				'/reports/trial-balance',
				async ({ query, erp }) => {
					const { startDate, endDate } = trialBalanceQuerySchema.parse(query);
					return ok(await reports.trialBalance({ organizationId: erp.organizationId }, startDate, endDate));
				},
				{
					erp: { permission: ['financial_report:read'] },
					detail: { description: 'Trial balance: opening, period movement and closing per account (ERP-0133)' },
				},
			)
			.get(
				'/reports/general-ledger',
				async ({ query, erp }) => {
					const { accountId, startDate, endDate } = generalLedgerQuerySchema.parse(query);
					return ok(
						await reports.generalLedger({ organizationId: erp.organizationId }, accountId, startDate, endDate),
					);
				},
				{
					erp: { permission: ['financial_report:read'] },
					detail: { description: 'General ledger of one account with a running balance (ERP-0133)' },
				},
			)
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
			/* ---------------- statement exports (M12 T30) ---------------- */
			.get(
				'/reports/profit-and-loss.csv',
				async ({ query, erp, set }) => {
					const { startDate, endDate } = profitAndLossQuerySchema.parse(query);
					const report = await reports.profitAndLoss(
						{ organizationId: erp.organizationId },
						startDate,
						endDate,
					);
					return csvResponse(
						set,
						`profit-and-loss-${startDate}_${endDate}.csv`,
						profitAndLossToCsv(report),
					);
				},
				{
					erp: { permission: ['financial_report:export'] },
					detail: { description: 'Income statement as CSV' },
				},
			)
			.get(
				'/reports/balance-sheet.csv',
				async ({ query, erp, set }) => {
					const { asOfDate } = balanceSheetQuerySchema.parse(query);
					const report = await reports.balanceSheet(
						{ organizationId: erp.organizationId },
						asOfDate,
					);
					return csvResponse(
						set,
						`balance-sheet-${asOfDate}.csv`,
						balanceSheetToCsv(report),
					);
				},
				{
					erp: { permission: ['financial_report:export'] },
					detail: { description: 'Balance sheet as CSV' },
				},
			)
			.get(
				'/reports/cash-flow.csv',
				async ({ query, erp, set }) => {
					const { startDate, endDate } = cashFlowQuerySchema.parse(query);
					const report = await reports.cashFlow(
						{ organizationId: erp.organizationId },
						startDate,
						endDate,
					);
					return csvResponse(
						set,
						`cash-flow-${startDate}_${endDate}.csv`,
						cashFlowToCsv(report),
					);
				},
				{
					erp: { permission: ['financial_report:export'] },
					detail: { description: 'Cash flow statement as CSV' },
				},
			)
			/* ---------------- monthly report archive (M12 T30) ---------------- */
			.get(
				'/reports/archives',
				async ({ query, erp }) =>
					okPaginated(
						await archives.list({
							organizationId: erp.organizationId,
							...reportArchiveListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['financial_report:read'] },
					detail: {
						description:
							'Frozen monthly statements, newest period first',
					},
				},
			)
			.get(
				'/reports/archives/:id',
				async ({ params, erp }) =>
					ok(
						await archives.get(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['financial_report:read'] },
					detail: {
						description: 'One archived statement, payload included',
					},
				},
			)
			.post(
				'/reports/archives',
				async ({ body, erp, status }) => {
					const { periodYear, periodMonth } =
						reportArchiveCreateSchema.parse(body);
					return status(
						201,
						created(
							await archives.archivePeriod(
								ctxOf(erp),
								periodYear,
								periodMonth,
							),
						),
					);
				},
				{
					erp: { permission: ['accounting_period:close'] },
					detail: {
						description:
							'Archives the three statements of a closed month; idempotent per scope',
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
				'/reconciliations',
				async ({ query, erp }) =>
					okPaginated(
						await reconciliations.list({
							organizationId: erp.organizationId,
							...reconciliationListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['cash_bank:read'] },
					detail: { description: 'Paginated bank reconciliation list' },
				},
			)
			.get(
				'/reconciliations/:id',
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
				'/reconciliations',
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
				'/reconciliations/:id/items',
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
				'/bank-reconciliations/:id/items/:productId/match',
				async ({ params, body, erp }) => {
					const { cashBankTransactionId } =
						reconciliationMatchSchema.parse(body);
					return ok(
						await reconciliations.matchItem(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							ledgerIdParamSchema.parse({ id: params.productId }).id,
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
				'/reconciliations/:id/reconcile',
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
				'/reconciliations/:id/close',
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
			)
			/* ---------------- bank statement import (ERP-0143) ---------------- */
			.put(
				'/cash-bank-accounts/:id/statement-mapping',
				async ({ params, body, erp }) =>
					ok(await reconciliations.setStatementMapping(ctxOf(erp), ledgerIdParamSchema.parse(params).id, body)),
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: { description: "Saves the bank's statement CSV layout on a cash/bank account" },
				},
			)
			.post(
				'/reconciliations/:id/statement',
				async ({ params, body, erp }) => {
					const file = body && typeof body === 'object' && 'file' in body ? (body as { file: unknown }).file : undefined;
					return ok(await reconciliations.importStatement(ctxOf(erp), ledgerIdParamSchema.parse(params).id, file));
				},
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: { description: 'Imports a bank statement CSV as statement lines (all or nothing, duplicates skipped)' },
				},
			)
			.post(
				'/reconciliations/:id/auto-match',
				async ({ params, erp }) => ok(await reconciliations.autoMatch(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: { description: 'Matches statement lines on amount, direction, +-3 days and reference' },
				},
			)
			.post(
				'/reconciliations/:id/items/:itemId/transaction',
				async ({ params, body, erp }) => {
					const { counterpartAccountId } = z.object({ counterpartAccountId: z.uuid() }).parse(body);
					return ok(
						await reconciliations.createTransaction(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							ledgerIdParamSchema.parse({ id: (params as { itemId: string }).itemId }).id,
							counterpartAccountId,
						),
					);
				},
				{
					erp: { permission: ['cash_bank:reconcile'] },
					detail: { description: 'Books an unmatched statement line as a cash/bank movement and matches it' },
				},
			);
	}
}
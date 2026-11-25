import { container } from 'tsyringe';
import { z } from 'zod';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { isoDate, ledgerIdParamSchema } from '../contracts/ledger.contract';
import {
	DEFERRED_REVENUE_SERVICE_TOKEN,
	GATEWAY_SETTLEMENT_SERVICE_TOKEN,
	RECEIVABLE_ADJUSTMENT_SERVICE_TOKEN,
} from '../constants/di';
import type { GatewaySettlementService } from '../services/gateway-settlement.service';
import { TAX_LEDGER_SERVICE_TOKEN } from '../constants/di';
import { PAYROLL_PAYMENT_ROLES, TAX_PAYMENT_ROLES, type TaxLedgerService } from '../services/tax-ledger.service';
import type { DeferredRevenueService } from '../services/deferred-revenue.service';
import type { ReceivableAdjustmentService } from '../services/receivable-adjustment.service';

const pageQuery = {
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
};
const creditMemoListQuerySchema = z.object({
	...pageQuery,
	invoiceId: z.string().uuid().optional(),
	status: z.enum(['draft', 'issued', 'applied', 'void']).optional(),
});
const creditMemoCreateSchema = z.object({
	invoiceId: z.string().uuid(),
	memoDate: isoDate,
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	reason: z.string().trim().min(1).max(500),
});
const reasonSchema = z.object({ reason: z.string().trim().min(1).max(500) });
const invoiceParamSchema = z.object({ invoiceId: z.string().uuid() });
const deferredListQuerySchema = z.object({
	...pageQuery,
	status: z.enum(['active', 'completed', 'cancelled']).optional(),
});
const gatewaySettlementSchema = z.object({
	cashBankAccountId: z.string().uuid(),
	settlementDate: isoDate,
	grossAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	feeAmount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
	reference: z.string().trim().min(1).max(100),
});
const ppnSettlementSchema = z.object({
	year: z.number().int().min(2000).max(2100),
	month: z.number().int().min(1).max(12),
});
const taxPaymentSchema = z.object({
	role: z.enum(TAX_PAYMENT_ROLES),
	taxCode: z.string().trim().max(32).nullish().transform((v) => v ?? null),
	cashBankAccountId: z.string().uuid(),
	paymentDate: isoDate,
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	reference: z.string().trim().min(1).max(100),
});
const payrollPaymentSchema = z.object({
	role: z.enum(PAYROLL_PAYMENT_ROLES),
	cashBankAccountId: z.string().uuid(),
	paymentDate: isoDate,
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	reference: z.string().trim().min(1).max(100),
});
const deferredRunSchema = z.object({
	year: z.number().int().min(2000).max(2100),
	month: z.number().int().min(1).max(12),
});

/**
 * Receivable adjustments and deferred revenue (ERP-0135).
 *
 * @remarks
 * `/finance/credit-memos*` (credit notes against issued invoices),
 * `/finance/ar/write-offs` + `/finance/ar/:invoiceId/write-off/*`
 * (maker-checker write-off), `/finance/deferred-revenue*` (schedules and the
 * monthly amortisation run). HTTP only.
 */
export class ReceivablesController {
	static plugin() {
		const adjustments = container.resolve<ReceivableAdjustmentService>(RECEIVABLE_ADJUSTMENT_SERVICE_TOKEN);
		const deferred = container.resolve<DeferredRevenueService>(DEFERRED_REVENUE_SERVICE_TOKEN);
		const settlements = container.resolve<GatewaySettlementService>(GATEWAY_SETTLEMENT_SERVICE_TOKEN);
		const taxLedger = container.resolve<TaxLedgerService>(TAX_LEDGER_SERVICE_TOKEN);
		const ctxOf = (erp: ErpContext) => ({ organizationId: erp.organizationId, actorUserId: erp.session.user.id });

		return domainPlugin({ name: 'finance-receivables', prefix: '/finance', tags: ['Accounting'], guards: 'erp' })
			/* ---------------- credit memos ---------------- */
			.get(
				'/credit-memos',
				async ({ query, erp }) =>
					okPaginated(
						await adjustments.listCreditMemos({
							organizationId: erp.organizationId,
							...creditMemoListQuerySchema.parse(query),
						}),
					),
				{ erp: { permission: ['credit_memo:read'] }, detail: { description: 'Paginated credit memos' } },
			)
			.post(
				'/credit-memos',
				async ({ body, erp, status }) =>
					status(201, created(await adjustments.createCreditMemo(ctxOf(erp), creditMemoCreateSchema.parse(body)))),
				{
					erp: { permission: ['credit_memo:create'] },
					detail: { description: 'Drafts a credit memo against an issued invoice' },
				},
			)
			.post(
				'/credit-memos/:id/apply',
				async ({ params, erp }) =>
					ok(await adjustments.applyCreditMemo(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['credit_memo:apply'] },
					detail: { description: 'Posts the credit (Dr sales returns + VAT / Cr receivable) and lowers the open amount' },
				},
			)
			.post(
				'/credit-memos/:id/void',
				async ({ params, body, erp }) =>
					ok(
						await adjustments.voidCreditMemo(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							reasonSchema.parse(body).reason,
						),
					),
				{
					erp: { permission: ['credit_memo:void'] },
					detail: { description: 'Voids a draft, or reverses an applied credit memo' },
				},
			)
			/* ---------------- write-offs ---------------- */
			.get(
				'/ar/write-offs',
				async ({ erp }) => ok(await adjustments.listWriteOffRequests(erp.organizationId)),
				{
					erp: { permission: ['ar_write_off:read'] },
					detail: { description: 'Receivables with a pending write-off request' },
				},
			)
			.post(
				'/ar/:invoiceId/write-off/request',
				async ({ params, body, erp }) =>
					ok(
						await adjustments.requestWriteOff(
							ctxOf(erp),
							invoiceParamSchema.parse(params).invoiceId,
							reasonSchema.parse(body).reason,
						),
					),
				{
					erp: { permission: ['ar_write_off:request'] },
					detail: { description: 'Requests a write-off of the open amount (maker)' },
				},
			)
			.post(
				'/ar/:invoiceId/write-off/cancel',
				async ({ params, erp }) =>
					ok(await adjustments.cancelWriteOff(ctxOf(erp), invoiceParamSchema.parse(params).invoiceId)),
				{
					erp: { permission: ['ar_write_off:request'] },
					detail: { description: 'Withdraws a pending write-off request' },
				},
			)
			.post(
				'/ar/:invoiceId/write-off/approve',
				async ({ params, erp }) =>
					ok(await adjustments.approveWriteOff(ctxOf(erp), invoiceParamSchema.parse(params).invoiceId)),
				{
					erp: { permission: ['ar_write_off:approve'] },
					detail: {
						description: 'Approves and posts a write-off (Dr allowance / Cr receivable); not by the requester',
					},
				},
			)
			/* ---------------- gateway settlement (ERP-0139) ---------------- */
			.post(
				'/gateway-settlements',
				async ({ body, erp, status }) =>
					status(201, created(await settlements.record(ctxOf(erp), gatewaySettlementSchema.parse(body)))),
				{
					erp: { permission: ['cash_bank:create'] },
					detail: {
						description: 'Records a gateway payout: net to the bank against gateway clearing, fee to gateway fees',
					},
				},
			)
			/* ---------------- tax postings (ERP-0140) ---------------- */
			.post(
				'/tax/ppn-settlements',
				async ({ body, erp }) => {
					const { year, month } = ppnSettlementSchema.parse(body);
					return ok(await taxLedger.settlePpn(ctxOf(erp), year, month));
				},
				{
					erp: { permission: ['journal:post'] },
					detail: { description: "Settles a month's PPN: output vs input, the difference to Utang PPN or PPN Lebih Bayar" },
				},
			)
			.post(
				'/tax/payments',
				async ({ body, erp, status }) => status(201, created(await taxLedger.payTax(ctxOf(erp), taxPaymentSchema.parse(body)))),
				{
					erp: { permission: ['cash_bank:create'] },
					detail: { description: 'Pays a tax liability to the state from a cash/bank account' },
				},
			)
			.post(
				'/payroll/payments',
				async ({ body, erp, status }) =>
					status(201, created(await taxLedger.payPayroll(ctxOf(erp), payrollPaymentSchema.parse(body)))),
				{
					erp: { permission: ['payroll_payment:execute'] },
					detail: { description: 'Pays salaries or BPJS from a cash/bank account (ERP-0138)' },
				},
			)
			/* ---------------- deferred revenue ---------------- */
			.get(
				'/deferred-revenue',
				async ({ query, erp }) =>
					okPaginated(
						await deferred.list({ organizationId: erp.organizationId, ...deferredListQuerySchema.parse(query) }),
					),
				{ erp: { permission: ['journal:read'] }, detail: { description: 'Deferred revenue schedules' } },
			)
			.post(
				'/deferred-revenue/run',
				async ({ body, erp }) => {
					const { year, month } = deferredRunSchema.parse(body);
					return ok(await deferred.runMonth(ctxOf(erp), year, month));
				},
				{
					erp: { permission: ['journal:post'] },
					detail: { description: 'Amortises every due deferred-revenue schedule through the month' },
				},
			);
	}
}

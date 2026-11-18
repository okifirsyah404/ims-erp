import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import { CLOSE_CHECKLIST_REPOSITORY_TOKEN, AR_OPEN_ITEM_REPOSITORY_TOKEN, AP_OPEN_ITEM_REPOSITORY_TOKEN, SUPPLIER_BILL_REPOSITORY_TOKEN, BANK_ACCOUNT_LINK_REPOSITORY_TOKEN, JOURNAL_REPOSITORY_TOKEN, INVOICE_MIRROR_REPOSITORY_TOKEN } from '../constants/di';
import { CASH_BANK_SERVICE_TOKEN } from '../constants/ar-di';
import type { CashBankService } from './cash-bank.service';
import type { TPaymentSelect } from '@drizzle/schemas/payment.schema';
// elysia-module rule 3.4: cross-module imports are the DI token and the contract
// type only — never the other module's index (that would pull its HTTP surface
// and container into Accounting).
import { PAYMENT_LEDGER_GATEWAY_TOKEN } from '@app/payment/constants/di';
import type { IPaymentLedgerGateway } from '@app/payment/contracts/payment-ledger.gateway.interface';
import {
	CashBankLinkRequiredError,
	JournalEntryNotFoundError,
	OpenItemNotFoundError,
	ReportPeriodInvalidError,
} from '../errors/ledger.errors';
import type { ICloseChecklistRepository, IArOpenItemRepository, IApOpenItemRepository, ISupplierBillRepository, IBankAccountLinkRepository, IJournalRepository, IInvoiceMirrorRepository } from '../contracts/ledger.repositories';

export type TCloseActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TCloseChecklistItem = {
	key: string;
	label: string;
	pass: boolean;
	count: number;
};

export type TCloseChecklist = {
	periodYear: number;
	periodMonth: number;
	startDate: string;
	endDate: string;
	allClear: boolean;
	items: TCloseChecklistItem[];
};

export type TVoidExecutedPaymentInput = {
	reason: string;
};

/**
 * Month-end close application service (M09 F7).
 *
 * @remarks
 * Final locking and audited reopen already live in {@link PeriodService}
 * (F2: open → closed → locked with a per-account balance snapshot, reopen
 * stamped with `reopened_by`/`reopened_at`, `locked → open` owner-only at
 * the route guard). This service adds the pre-close checklist and the
 * executed-payment reversal that the F4 decision 4a deferred here.
 *
 * The checklist is advisory (computed on demand, D7): it surfaces the work
 * that should be finished before a close — draft invoices, payments not yet
 * executed, unrecorded supplier bills, open bank reconciliations — plus a
 * sanity count of posted entries inside the period. Closing itself does not
 * hard-require a green checklist (the accountant decides), but the UI can
 * block on it.
 *
 * Voiding an executed payment is a reversing ledger event, never an edit
 * (D4): a mirrored JE (DR AR/AP / CR cash, or the reverse for supplier
 * payments) is posted with idempotency key `payment-void:<id>`, the cash
 * sub-ledger gets the offsetting movement, both open-item mirrors are
 * rolled back, and the payment row flips to `void` with the reason.
 */
@injectable()
export class MonthEndCloseService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CLOSE_CHECKLIST_REPOSITORY_TOKEN) private readonly closeChecks: ICloseChecklistRepository,
		@inject(AR_OPEN_ITEM_REPOSITORY_TOKEN) private readonly ar: IArOpenItemRepository,
		@inject(AP_OPEN_ITEM_REPOSITORY_TOKEN) private readonly ap: IApOpenItemRepository,
		@inject(SUPPLIER_BILL_REPOSITORY_TOKEN) private readonly bills: ISupplierBillRepository,
		@inject(BANK_ACCOUNT_LINK_REPOSITORY_TOKEN) private readonly links: IBankAccountLinkRepository,
		@inject(JOURNAL_REPOSITORY_TOKEN) private readonly journal: IJournalRepository,
		@inject(INVOICE_MIRROR_REPOSITORY_TOKEN) private readonly invoices: IInvoiceMirrorRepository,
		@inject(CASH_BANK_SERVICE_TOKEN) private readonly cashBank: CashBankService,
		/** ADR-0024: payment owns payment.payments; F7 reads/stamps it through this. */
		@inject(PAYMENT_LEDGER_GATEWAY_TOKEN) private readonly payments: IPaymentLedgerGateway,
	) {}

	/** Pre-close checklist for one month (computed on demand, D7). */
	async checklist(
		organizationId: string,
		periodYear: number,
		periodMonth: number,
	): Promise<TCloseChecklist> {
		if (periodMonth < 1 || periodMonth > 12) {
			throw new ReportPeriodInvalidError();
		}
		const startDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
		const endDate = new Date(Date.UTC(periodYear, periodMonth, 0))
			.toISOString()
			.slice(0, 10);
		const pendingPayments = await this.payments.countOpen(organizationId);
		const counts = await this.closeChecks.closeChecklistCounts(
			organizationId,
			startDate,
			endDate,
		);
		const items: TCloseChecklistItem[] = [
			{
				key: 'draft_invoices',
				label: 'Draft invoices in range must be issued or voided',
				pass: counts.draftInvoicesInRange === 0,
				count: counts.draftInvoicesInRange,
			},
			{
				key: 'pending_payments',
				label: 'Payments not yet executed must be finished or voided',
				pass: pendingPayments === 0,
				count: pendingPayments,
			},
			{
				key: 'draft_bills',
				label: 'Draft supplier bills must be recorded or voided',
				pass: counts.draftBills === 0,
				count: counts.draftBills,
			},
			{
				key: 'open_reconciliations',
				label: 'Bank reconciliations must be reconciled or closed',
				pass: counts.unreconciledReconciliations === 0,
				count: counts.unreconciledReconciliations,
			},
			{
				key: 'posted_entries',
				label: 'Posted entries exist in the period (informational)',
				pass: true,
				count: counts.postedInPeriod,
			},
		];
		return {
			periodYear,
			periodMonth,
			startDate,
			endDate,
			allClear: items.every((item) => item.pass),
			items,
		};
	}

	/**
	 * Reverses an executed payment (F4 decision 4a, deferred to F7): mirrored
	 * JE + cash movement + open-item rollback, all in one transaction.
	 */
	async voidExecutedPayment(
		ctx: TCloseActionContext,
		id: string,
		input: TVoidExecutedPaymentInput,
	): Promise<TPaymentSelect> {
		return this.database.transaction(async (tx) => {
			// Payment owns its own state rules (ADR-0024): this throws its
			// domain errors, so Accounting never imports them.
			const payment = await this.payments.requireExecuted(ctx.organizationId, id, tx);

			const allocations = await this.payments.listAllocations(
				ctx.organizationId,
				payment.id,
				tx,
			);
			const isPayable =
				(payment.paymentType as TCreateLike['paymentType']) === 'supplier_payment';

			// 1) Roll back both mirrors per allocation (AR invoices or AP bills).
			for (const allocation of allocations) {
				if (isPayable && allocation.supplierBillId) {
					await this.rollbackBillAllocation(
						ctx.organizationId,
						allocation.supplierBillId,
						allocation.amount,
						tx,
					);
				} else if (!isPayable && allocation.salesInvoiceId) {
					await this.rollbackInvoiceAllocation(
						ctx.organizationId,
						allocation.salesInvoiceId,
						allocation.amount,
						tx,
					);
				}
			}

			// 2) Mirrored cash movement — the true opposite of the original
			// posting (money returns): supplier payment in → 'in', customer
			// payment out → 'out'. The auto-journal inside postMovement is the
			// exact mirror of the execute-time entry.
			// The counterpart and cash GL accounts come from the original JE
			// lines instead of re-resolving roles: the reversal must mirror
			// what was actually posted (D4 append-only corrections).
			const originalEntry = await this.journal.findEntryBySource(
				ctx.organizationId,
				'payment',
				payment.id,
				tx,
			);
			if (!originalEntry) throw new JournalEntryNotFoundError();
			const originalLines = await this.journal.findLinesByEntryId(
				ctx.organizationId,
				originalEntry.id,
				tx,
			);
			const link = await this.links.findBankAccountLinkByCashAccount(
				ctx.organizationId,
				payment.cashBankAccountId!,
			);
			if (!link) throw new CashBankLinkRequiredError();
			const counterpartLine = originalLines.find(
				(line) => line.accountId !== link.chartOfAccountId,
			);
			if (!counterpartLine) throw new JournalEntryNotFoundError();

			await this.cashBank.postMovement(
				ctx,
				{
					cashBankAccountId: payment.cashBankAccountId!,
					transactionDate: new Date().toISOString().slice(0, 10),
					direction: isPayable ? 'in' : 'out',
					amount: payment.amount,
					description: `Void of payment ${payment.code}: ${input.reason}`,
					referenceNumber: payment.code,
					counterpartAccountId: counterpartLine.accountId,
					sourceType: 'payment_void',
					sourceId: payment.id,
				},
				tx,
			);

			return this.payments.markVoided(ctx.organizationId, payment.id, input.reason, tx);
		});
	}

	/* ----------------------------- internals ----------------------------- */

	/** Rolls paid/outstanding back on `ar_open_items` + `sales.invoices`. */
	private async rollbackInvoiceAllocation(
		organizationId: string,
		invoiceId: string,
		amount: number,
		tx: TTx,
	): Promise<void> {
		const item = (await this.ar.findArOpenItemByInvoice(
			organizationId,
			invoiceId,
			tx,
		)) as {
			paidAmount: number;
			originalAmount: number;
		} | null;
		if (!item) throw new OpenItemNotFoundError();
		const paidAmount = item.paidAmount - amount;
		const outstandingAmount = item.originalAmount - paidAmount;
		await this.ar.updateArOpenItem(organizationId, invoiceId, {
			paidAmount,
			outstandingAmount,
			status: paidAmount === 0 ? 'open' : 'partially_paid',
		}, tx);
		// The invoice itself returns to `issued` with rolled-back totals; the
		// original invoice status check only allows issued/partially_paid/paid.
		await this.invoices.updateSalesInvoiceTotals(organizationId, invoiceId, {
			paidTotal: paidAmount,
			outstandingTotal: outstandingAmount,
			status: paidAmount === 0 ? 'issued' : 'partially_paid',
		}, tx);
	}

	/** Rolls paid/outstanding back on `ap_open_items` + `finance.supplier_bills`. */
	private async rollbackBillAllocation(
		organizationId: string,
		billId: string,
		amount: number,
		tx: TTx,
	): Promise<void> {
		const item = (await this.ap.findApOpenItemByBill(
			organizationId,
			billId,
			tx,
		)) as {
			paidAmount: number;
			originalAmount: number;
		} | null;
		if (!item) throw new OpenItemNotFoundError();
		const paidAmount = item.paidAmount - amount;
		const outstandingAmount = item.originalAmount - paidAmount;
		const status = paidAmount === 0 ? 'approved' : 'partially_paid';
		await this.ap.updateApOpenItem(organizationId, billId, {
			paidAmount,
			outstandingAmount,
			status,
		}, tx);
		await this.bills.updateSupplierBill(organizationId, billId, {
			paidTotal: paidAmount,
			outstandingTotal: outstandingAmount,
			status,
		}, tx);
	}
}

type TCreateLike = {
	paymentType: 'customer_payment' | 'supplier_payment';
};

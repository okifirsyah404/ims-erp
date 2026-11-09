import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { TPaginationResult } from '@ims-erp/common';
import type { TSupplierBillSelect } from '@drizzle/schemas/finance.schema';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import {
	AR_ACCOUNT_RESOLVER_TOKEN,
	LEDGER_REPOSITORY_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/ar-di';
import type { LedgerRepository } from '../repositories/ledger.repository';
import type { PostingService } from './posting.service';
import type { ArAccountResolverService } from './ar-account-resolver.service';
import {
	BillNotDraftError,
	BillNotFoundError,
	PaymentTargetNotIssuedError,
} from '../errors/ledger.errors';

export type TBillActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TCreateSupplierBillInput = {
	supplierId: string;
	purchaseOrderId: string | null;
	billDate: string;
	dueDate: string | null;
	/** Expense subtotal before tax. */
	subtotal: number;
	taxTotal: number;
	currencyCode: string;
	notes: string | null;
};

/**
 * Supplier-bill application service (M09 F5).
 *
 * @remarks
 * Mirror of the invoice flow on the purchasing side. **Recording** the bill
 * is the ledger event: one transaction approves the bill, posts
 * DR expense / DR input tax / CR AP through the shared posting service (D9),
 * and opens the `finance.ap_open_items` sub-ledger row (D3). Bills live in
 * `finance.supplier_bills` — finance owns them outright (unlike invoices,
 * which belong to sales per D2).
 */
@injectable()
export class SupplierBillService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(LEDGER_REPOSITORY_TOKEN) private readonly repo: LedgerRepository,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
		@inject(AR_ACCOUNT_RESOLVER_TOKEN)
		private readonly accountResolver: ArAccountResolverService,
		@inject(NUMBERING_SERVICE_TOKEN)
		private readonly numbering: NumberingService,
	) {}

	async list(
		organizationId: string,
		filters: { status?: string; supplierId?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TSupplierBillSelect>> {
		return this.repo.listSupplierBills(organizationId, filters, pagination);
	}

	async get(organizationId: string, id: string): Promise<TSupplierBillSelect> {
		const bill = await this.repo.findSupplierBillById(organizationId, id);
		if (!bill) throw new BillNotFoundError();
		return bill;
	}

	/** Creates a draft bill; grand total is derived (subtotal + tax). */
	async create(
		ctx: TBillActionContext,
		input: TCreateSupplierBillInput,
	): Promise<TSupplierBillSelect> {
		return this.database.transaction(async (tx) => {
			const code = await this.numbering.next('supplier_bill', {
				date: new Date(`${input.billDate}T12:00:00+07:00`),
				tx,
			});
			return this.repo.insertSupplierBill(
				{
					organizationId: ctx.organizationId,
					code,
					supplierId: input.supplierId,
					purchaseOrderId: input.purchaseOrderId,
					billDate: input.billDate,
					dueDate: input.dueDate,
					subtotal: input.subtotal,
					taxTotal: input.taxTotal,
					grandTotal: input.subtotal + input.taxTotal,
					paidTotal: 0,
					outstandingTotal: 0,
					currencyCode: input.currencyCode,
					status: 'draft',
					approvedBy: null,
					approvedAt: null,
				},
				tx,
			);
		});
	}

	/** Draft → void. No journal impact (nothing was posted). */
	async cancel(ctx: TBillActionContext, id: string): Promise<TSupplierBillSelect> {
		const bill = await this.repo.findSupplierBillById(ctx.organizationId, id);
		if (!bill) throw new BillNotFoundError();
		if (bill.status !== 'draft') throw new BillNotDraftError();
		const updated = await this.repo.updateSupplierBill(ctx.organizationId, id, {
			status: 'void',
		});
		return updated ?? bill;
	}

	/**
	 * Records the bill — the ledger event of F5. One transaction covers the
	 * status stamp, the journal (DR expense / DR input tax / CR AP) and the
	 * `ap_open_items` row. Idempotent through the JE idempotency key.
	 */
	async record(ctx: TBillActionContext, id: string): Promise<TSupplierBillSelect> {
		return this.database.transaction(async (tx) => {
			const bill = await this.repo.findSupplierBillById(ctx.organizationId, id, tx);
			if (!bill) throw new BillNotFoundError();
			if (bill.status !== 'draft') throw new BillNotDraftError();

			const accounts = await this.accountResolver.resolveAllBill(ctx.organizationId);
			const billDate = bill.billDate ?? new Date().toISOString().slice(0, 10);

			const lines: Array<{
				accountId: string;
				debit: number;
				credit: number;
			}> = [
				{
					accountId: accounts.expense,
					debit: bill.subtotal,
					credit: 0,
				},
			];
			if (bill.taxTotal > 0) {
				lines.push({
					accountId: accounts.taxInput,
					debit: bill.taxTotal,
					credit: 0,
				});
			}
			lines.push({
				accountId: accounts.ap,
				debit: 0,
				credit: bill.grandTotal,
			});

			await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: billDate,
				sourceModule: 'finance',
				sourceType: 'supplier_bill',
				sourceId: bill.id,
				idempotencyKey: `supplier-bill:${bill.id}`,
				description: `Supplier bill ${bill.code}`,
				lines,
			});

			await this.repo.insertApOpenItem(
				{
					organizationId: ctx.organizationId,
					supplierBillId: bill.id,
					supplierId: bill.supplierId,
					billDate,
					dueDate: bill.dueDate,
					originalAmount: bill.grandTotal,
					paidAmount: 0,
					outstandingAmount: bill.grandTotal,
					currencyCode: bill.currencyCode,
					status: 'open',
				},
				tx,
			);

			return this.repo.updateSupplierBill(
				ctx.organizationId,
				id,
				{
					status: 'approved',
					approvedBy: ctx.actorUserId,
					approvedAt: new Date(),
					outstandingTotal: bill.grandTotal,
				},
				tx,
			).then((updated) => updated ?? bill);
		});
	}
}

// Kept so the payment side can refuse bills that were never recorded.
export { PaymentTargetNotIssuedError };

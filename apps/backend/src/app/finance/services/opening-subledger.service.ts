import { EXPORTED_CUSTOMER_SERVICE_TOKEN } from '@app/customer/constants/di';
import type { ExportedCustomerService } from '@app/customer/services/exported-customer.service';
import { EXPORTED_SUPPLIER_SERVICE_TOKEN } from '@app/supplier/constants/di';
import type { ExportedSupplierService } from '@app/supplier/services/exported-supplier.service';
import type { TOpeningBalanceSelect, TOpeningSubledgerItemSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	AP_OPEN_ITEM_REPOSITORY_TOKEN,
	AR_OPEN_ITEM_REPOSITORY_TOKEN,
	FINANCE_NUMBERING_SERVICE_TOKEN,
	OPENING_BALANCE_REPOSITORY_TOKEN,
	OPENING_SUBLEDGER_REPOSITORY_TOKEN,
	POSTING_RULE_SERVICE_TOKEN,
	SUPPLIER_BILL_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IApOpenItemRepository } from '../contracts/ap-open-item.repository.interface';
import type { IArOpenItemRepository } from '../contracts/ar-open-item.repository.interface';
import type { IOpeningBalanceRepository } from '../contracts/opening-balance.repository.interface';
import type {
	IOpeningSubledgerRepository,
	TOpeningSubledgerError,
	TOpeningSubledgerImportResult,
	TOpeningSubledgerRow,
	TSubledger,
	TSubledgerTie,
} from '../contracts/opening-subledger.contract';
import type { ISupplierBillRepository } from '../contracts/supplier-bill.repository.interface';
import {
	OpeningSubledgerDateError,
	OpeningSubledgerFileError,
	OpeningSubledgerMismatchError,
	OpeningSubledgerPostedError,
} from '../errors/ledger.errors';
import { csvCells } from '../utils/csv';
import type { FinanceNumberingService } from './finance-numbering.service';
import type { PostingRuleService } from './posting-rule.service';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const LEDGER_ROLE = { ar: 'receivable', ap: 'payable' } as const;

/** `1.500.000` / `1500000,50` / `Rp 1.500.000` → minor units. */
function rupiah(value: string): number | null {
	const normalized = value.replace(/rp/gi, '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
	if (!/^\d{1,13}(\.\d{1,2})?$/.test(normalized)) return null;
	return Math.round(Number(normalized) * 100);
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/**
 * Sub-ledger opening balances (ERP-0142, grill decision on opening balances).
 *
 * @remarks
 * Finance imports the open AR invoices and AP bills at cutover as CSV, one
 * ledger at a time. The opening-balance batch cannot post while a ledger's
 * draft total differs from the draft opening row of its control account
 * (posting rules `receivable` / `payable`); the check runs whenever either
 * side is non-zero. Posting materialises the rows in the same transaction:
 * AR rows become open items without an invoice, AP rows become approved
 * supplier bills with their open items, so later supplier payments settle
 * them. Neither posts a journal: the opening journal already carries the
 * control-account amounts. Stock and fixed assets are not covered here (no
 * inventory valuation contract yet; the asset register is Phase C).
 */
@injectable()
export class OpeningSubledgerService {
	constructor(
		@inject(OPENING_SUBLEDGER_REPOSITORY_TOKEN) private readonly items: IOpeningSubledgerRepository,
		@inject(OPENING_BALANCE_REPOSITORY_TOKEN) private readonly balances: Pick<IOpeningBalanceRepository, 'listOpeningBalances'>,
		@inject(POSTING_RULE_SERVICE_TOKEN) private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(EXPORTED_CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<ExportedCustomerService, 'findCustomerByCode'>,
		@inject(EXPORTED_SUPPLIER_SERVICE_TOKEN) private readonly suppliers: Pick<ExportedSupplierService, 'findCompanyByCode'>,
		@inject(AR_OPEN_ITEM_REPOSITORY_TOKEN) private readonly arItems: Pick<IArOpenItemRepository, 'insertArOpenItem'>,
		@inject(AP_OPEN_ITEM_REPOSITORY_TOKEN) private readonly apItems: Pick<IApOpenItemRepository, 'insertApOpenItem'>,
		@inject(SUPPLIER_BILL_REPOSITORY_TOKEN) private readonly bills: Pick<ISupplierBillRepository, 'insertSupplierBill'>,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<FinanceNumberingService, 'next'>,
	) {}

	list(organizationId: string): Promise<TOpeningSubledgerItemSelect[]> {
		return this.items.list(organizationId);
	}

	private async ties(organizationId: string, drafts: TOpeningSubledgerItemSelect[], rows: TOpeningBalanceSelect[], posted: TOpeningSubledgerItemSelect[]) {
		const result: TSubledgerTie[] = [];
		for (const ledger of ['ar', 'ap'] as const) {
			const controlAccountId = await this.rules
				.resolveAccountId(organizationId, { eventType: '*', role: LEDGER_ROLE[ledger] })
				.catch(() => null);
			const sign = ledger === 'ar' ? 1 : -1;
			const control = rows
				.filter((row) => row.accountId === controlAccountId)
				.reduce((sum, row) => sum + sign * (row.debitBalance - row.creditBalance), 0);
			const mine = drafts.filter((item) => item.ledger === ledger);
			const total = mine.reduce((sum, item) => sum + item.amount, 0);
			result.push({
				ledger,
				items: mine.length,
				total,
				controlAccountId,
				control,
				tied: total === control,
				posted: posted.filter((item) => item.ledger === ledger).length,
			});
		}
		return result;
	}

	/** Draft totals per ledger against the draft opening rows of the control accounts. */
	async summary(organizationId: string): Promise<{ ledgers: TSubledgerTie[]; items: TOpeningSubledgerItemSelect[] }> {
		const [items, rows] = await Promise.all([this.items.list(organizationId), this.balances.listOpeningBalances(organizationId)]);
		const drafts = items.filter((item) => !item.postedAt);
		const ledgers = await this.ties(
			organizationId,
			drafts,
			rows.filter((row) => !row.postedAt),
			items.filter((item) => item.postedAt),
		);
		return { ledgers, items };
	}

	template(ledger: TSubledger): string {
		const party = ledger === 'ar' ? 'kode_pelanggan' : 'kode_pemasok';
		return `${party},nomor_dokumen,tanggal_dokumen,jatuh_tempo,sisa_rupiah\n`;
	}

	async import(
		ctx: { organizationId: string; actorUserId: string },
		ledger: TSubledger,
		asOfDate: string,
		file: unknown,
	): Promise<TOpeningSubledgerImportResult> {
		if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv')) throw new OpeningSubledgerFileError('type');
		if (file.size === 0) throw new OpeningSubledgerFileError('empty');
		if (file.size > MAX_BYTES) throw new OpeningSubledgerFileError('size');
		if ((await this.items.list(ctx.organizationId, ledger)).some((item) => item.postedAt)) throw new OpeningSubledgerPostedError();
		const lines = (await file.text())
			.replace(/^﻿/, '')
			.split(/\r?\n/)
			.map((line, index) => ({ row: index + 1, line: line.trim() }))
			.filter(({ line }) => line !== '');
		// A header is a first line whose document date column is not a date.
		if (lines[0] && !isDate(csvCells(lines[0].line)[2] ?? '')) lines.shift();
		if (lines.length === 0) throw new OpeningSubledgerFileError('empty');
		if (lines.length > MAX_ROWS) throw new OpeningSubledgerFileError('tooMany');

		const errors: TOpeningSubledgerError[] = [];
		const rows: TOpeningSubledgerRow[] = [];
		const seen = new Set<string>();
		const parties = new Map<string, { id: string; name: string } | null>();
		for (const { row, line } of lines) {
			const [code = '', documentNumber = '', documentDate = '', dueDate = '', amountText = ''] = csvCells(line);
			const key = code.toUpperCase();
			if (!parties.has(key)) {
				const found =
					ledger === 'ar' ? await this.customers.findCustomerByCode(key) : await this.suppliers.findCompanyByCode(key);
				parties.set(key, found ? { id: found.id, name: found.name } : null);
			}
			const party = parties.get(key);
			const amount = rupiah(amountText);
			if (!party) errors.push({ row, code: 'partyUnknown', value: code });
			if (documentNumber === '' || documentNumber.length > 100) errors.push({ row, code: 'documentInvalid', value: documentNumber });
			if (!isDate(documentDate)) errors.push({ row, code: 'dateInvalid', value: documentDate });
			else if (documentDate > asOfDate) errors.push({ row, code: 'afterAsOf', value: documentDate });
			if (dueDate !== '' && !isDate(dueDate)) errors.push({ row, code: 'dueDateInvalid', value: dueDate });
			if (amount === null || amount <= 0) errors.push({ row, code: 'amountInvalid', value: amountText });
			if (seen.has(documentNumber)) errors.push({ row, code: 'duplicate', value: documentNumber });
			seen.add(documentNumber);
			if (!party || amount === null || amount <= 0 || !isDate(documentDate)) continue;
			rows.push({
				customerId: ledger === 'ar' ? party.id : null,
				supplierCompanyId: ledger === 'ap' ? party.id : null,
				partyCode: key,
				partyName: party.name,
				documentNumber,
				documentDate,
				dueDate: dueDate === '' ? null : dueDate,
				amount,
			});
		}
		const total = rows.reduce((sum, item) => sum + item.amount, 0);
		if (errors.length > 0) return { imported: 0, total, errors };
		await this.transactions.run((tx) => this.items.replaceDrafts(ctx.organizationId, ledger, asOfDate, ctx.actorUserId, rows, tx));
		return { imported: rows.length, total, errors: [] };
	}

	async discard(organizationId: string, ledger: TSubledger): Promise<{ removed: number }> {
		return { removed: await this.items.discardDrafts(organizationId, ledger) };
	}

	/**
	 * Refuses an opening batch whose control-account rows and sub-ledger drafts
	 * disagree; returns the drafts to materialise once the journal is posted.
	 */
	async assertTied(organizationId: string, asOfDate: string, rows: TOpeningBalanceSelect[]): Promise<TOpeningSubledgerItemSelect[]> {
		const drafts = (await this.items.list(organizationId)).filter((item) => !item.postedAt);
		const wrongDate = drafts.find((item) => item.asOfDate !== asOfDate);
		if (wrongDate) throw new OpeningSubledgerDateError({ itemDate: wrongDate.asOfDate, batchDate: asOfDate });
		for (const tie of await this.ties(organizationId, drafts, rows, [])) {
			if (!tie.tied) throw new OpeningSubledgerMismatchError({ ledger: tie.ledger.toUpperCase(), subledger: tie.total / 100, control: tie.control / 100 });
		}
		return drafts;
	}

	/** Creates the open items (and opening supplier bills) inside the opening-journal transaction. */
	async materialize(tx: TTx, ctx: { organizationId: string; actorUserId: string }, drafts: TOpeningSubledgerItemSelect[]): Promise<void> {
		for (const item of drafts) {
			if (item.ledger === 'ar') {
				const open = await this.arItems.insertArOpenItem(
					{
						organizationId: ctx.organizationId,
						invoiceId: null,
						customerId: item.customerId,
						invoiceDate: item.documentDate,
						dueDate: item.dueDate,
						originalAmount: item.amount,
						paidAmount: 0,
						outstandingAmount: item.amount,
						currencyCode: 'IDR',
						status: 'open',
					},
					tx,
				);
				await this.items.markPosted(ctx.organizationId, item.id, { arOpenItemId: open.id }, tx);
				continue;
			}
			const code = await this.numbering.next('supplier_bill', { date: new Date(`${item.documentDate}T12:00:00+07:00`), tx });
			const bill = await this.bills.insertSupplierBill(
				{
					organizationId: ctx.organizationId,
					code,
					supplierCompanyId: item.supplierCompanyId as string,
					purchaseOrderId: null,
					supplierInvoiceNumber: item.documentNumber,
					billDate: item.documentDate,
					dueDate: item.dueDate,
					subtotal: item.amount,
					taxTotal: 0,
					grandTotal: item.amount,
					paidTotal: 0,
					outstandingTotal: item.amount,
					currencyCode: 'IDR',
					status: 'approved',
					approvedBy: ctx.actorUserId,
					approvedAt: new Date(),
				},
				tx,
			);
			const open = await this.apItems.insertApOpenItem(
				{
					organizationId: ctx.organizationId,
					supplierBillId: bill.id,
					supplierCompanyId: item.supplierCompanyId,
					billDate: item.documentDate,
					dueDate: item.dueDate,
					originalAmount: item.amount,
					paidAmount: 0,
					outstandingAmount: item.amount,
					currencyCode: 'IDR',
					status: 'open',
				},
				tx,
			);
			await this.items.markPosted(ctx.organizationId, item.id, { supplierBillId: bill.id, apOpenItemId: open.id }, tx);
		}
	}
}

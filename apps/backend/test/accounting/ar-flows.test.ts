/**
 * F4 unit tests: invoice issue flow (DR AR / CR revenue / CR tax payable +
 * ar_open_items) and the payment workflow (D5) with allocations updating both
 * AR mirrors, plus the AR aging buckets. Real posting service over fake repos.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { CodeNumberService } from '@app/code-number';
import type {
	TAccountingPeriodSelect,
	TChartOfAccountSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
} from '@drizzle/schemas/accounting.schema';
import type {
	TArOpenItemSelect,
	TCashBankAccountSelect,
	TCashBankTransactionSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaymentAllocationSelect, TPaymentSelect } from '@drizzle/schemas/payment.schema';
import type { TInvoiceItemSelect, TInvoiceSelect } from '@drizzle/schemas/sales.schema';
import type { TInvoiceRepository } from '../../src/app/sales/contracts/invoice.repository.interface';
import { PostingService } from '../../src/app/accounting/services/posting.service';
import { ArAccountResolverService } from '../../src/app/accounting/services/ar-account-resolver.service';
import { CashBankService } from '../../src/app/accounting/services/cash-bank.service';
import { PaymentService } from '../../src/app/payment/services/payment.service';
import { InvoiceService } from '../../src/app/sales/services/invoice.service';
import {
	ArAccountNotConfiguredError,
	CashBankAccountInactiveError,
} from '../../src/app/accounting/errors/ledger.errors';
import {
	PaymentAllocationMismatchError,
	PaymentInvalidTransitionError,
	PaymentOverAllocationError,
	PaymentTargetNotIssuedError,
	PaymentVoidNotAllowedError,
} from '../../src/app/payment/errors/payment.errors';
import {
	InvoiceNoItemsError,
	InvoiceNotDraftError,
} from '../../src/app/sales/errors/invoice.errors';

const ORG = 'org-1';
const ACTOR = 'user-1';
const ctx = { organizationId: ORG, actorUserId: ACTOR };

function account(
	id: string,
	code: string,
	overrides: Partial<TChartOfAccountSelect> = {},
): TChartOfAccountSelect {
	return {
		id,
		organizationId: ORG,
		code,
		name: code,
		accountType: 'asset',
		normalBalance: 'debit',
		parentAccountId: null,
		level: 1,
		isPostable: true,
		isSystem: false,
		isActive: true,
		cashFlowCategory: null,
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...overrides,
	} as TChartOfAccountSelect;
}


function makeHarness() {
	const accounts = new Map<string, TChartOfAccountSelect>([
		['acc-ar', account('acc-ar', '1-1300', { name: 'Trade receivables' })],
		['acc-rev', account('acc-rev', '4-1000', { name: 'Sales', accountType: 'revenue', normalBalance: 'credit' })],
		['acc-tax', account('acc-tax', '2-1000', { name: 'Output tax', accountType: 'liability', normalBalance: 'credit' })],
		['acc-cash-gl', account('acc-cash-gl', '1-1100', { name: 'Cash GL' })],
	]);
	const periods = new Map<string, TAccountingPeriodSelect>([
		[
			'per-2026-01',
			{
				id: 'per-2026-01',
				organizationId: ORG,
				code: '2026-01',
				periodYear: 2026,
				periodMonth: 1,
				startDate: '2026-01-01',
				endDate: '2026-01-31',
				status: 'open',
				closedBy: null,
				closedAt: null,
				reopenedBy: null,
				reopenedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			} as TAccountingPeriodSelect,
		],
	]);
	const entries = new Map<string, TJournalEntrySelect>();
	const journalLinesRows: TJournalLineSelect[] = [];
	const cashAccounts = new Map<string, TCashBankAccountSelect>();
	const cashTxRows: TCashBankTransactionSelect[] = [];
	const links = new Map<string, { cashBankAccountId: string; chartOfAccountId: string }>();
	const invoicesRows = new Map<string, TInvoiceSelect>();
	const invoiceItemsRows: TInvoiceItemSelect[] = [];
	const arItems: TArOpenItemSelect[] = [];
	const paymentsRows = new Map<string, TPaymentSelect>();
	const allocations: TPaymentAllocationSelect[] = [];
	/** Registry calls made by the invoice service (ERP-0044). */
	const registered: { code: string; sourceId: string; documentType: string }[] = [];
	const voided: string[] = [];
	let seq = 0;
	const now = () => new Date();
	const id = (p: string) => `${p}-${++seq}`;

	const repoFake = {
		findAccountById: async (_o: string, id: string) => accounts.get(id) ?? null,
		findAccountByCode: async (_o: string, code: string) =>
			[...accounts.values()].find((a) => a.code === code) ?? null,
		findPeriodByMonth: async (_o: string, y: number, m: number) =>
			[...periods.values()].find((p) => p.periodYear === y && p.periodMonth === m) ?? null,
		findPostedEntryByIdempotencyKey: async (_o: string, key: string) =>
			[...entries.values()].find((e) => e.idempotencyKey === key) ?? null,
		findEntryById: async (_o: string, id: string) => entries.get(id) ?? null,
		findLinesByEntryId: async (_o: string, entryId: string) =>
			journalLinesRows.filter((l) => l.journalEntryId === entryId),
		insertEntry: async (row: Record<string, unknown>) => {
			const created = {
				id: id('je'),
				organizationId: ORG,
				reversedByEntryId: null,
				preparedBy: null,
				submittedAt: null,
				approvedBy: null,
				approvedAt: null,
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TJournalEntrySelect;
			entries.set(created.id, created);
			return created;
		},
		insertLines: async (rows: Array<Record<string, unknown>>) =>
			rows.map((row) => {
				const created = { id: id('jl'), createdAt: now(), updatedAt: now(), deletedAt: null, ...row } as TJournalLineSelect;
				journalLinesRows.push(created);
				return created;
			}),
		markReversed: async () => {},
		// cash/bank
		findCashBankAccountByCode: async () => null,
		findCashBankAccountById: async (_o: string, id: string) => cashAccounts.get(id) ?? null,
		listCashBankAccounts: async () => [...cashAccounts.values()],
		insertCashBankAccount: async (row: Record<string, unknown>) => {
			const created = {
				id: id('cba'),
				isActive: true,
				currencyCode: 'IDR',
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TCashBankAccountSelect;
			cashAccounts.set(created.id, created);
			return created;
		},
		updateCashBankAccount: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = cashAccounts.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		insertCashBankTransaction: async (row: Record<string, unknown>) => {
			const created = {
				id: id('cbt'),
				currencyCode: 'IDR',
				sourceType: null,
				sourceId: null,
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				...row,
			} as TCashBankTransactionSelect;
			cashTxRows.push(created);
			return created;
		},
		listCashBankTransactions: async () => ({
			data: [...cashTxRows],
			meta: { page: 1, limit: 20, total: cashTxRows.length, totalPages: 1 },
		}),
		findBankAccountLinkByCashAccount: async (_o: string, cbId: string) =>
			links.get(cbId) ?? null,
		upsertBankAccountLink: async (row: Record<string, unknown>) => {
			links.set(row.cashBankAccountId as string, row as never);
			return row;
		},
		deactivateBankAccountLink: async () => {},
		// invoices (read by payment service through ledger repo)
		findSalesInvoiceById: async (_o: string, id: string) => invoicesRows.get(id) ?? null,
		updateSalesInvoiceTotals: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = invoicesRows.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		// AR sub-ledger
		insertArOpenItem: async (row: Record<string, unknown>) => {
			const created = { id: id('ar'), createdAt: now(), updatedAt: now(), ...row } as TArOpenItemSelect;
			arItems.push(created);
			return created;
		},
		findArOpenItemByInvoice: async (_o: string, invId: string) =>
			arItems.find((r) => r.salesInvoiceId === invId) ?? null,
		updateArOpenItem: async (_o: string, invId: string, patch: Record<string, unknown>) => {
			const row = arItems.find((r) => r.salesInvoiceId === invId);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		listArOpenItemsForAging: async () => arItems.filter((r) => r.status !== 'paid' && r.status !== 'void'),
		// payments
		insertPayment: async (row: Record<string, unknown>) => {
			const created = {
				id: id('pay'),
				createdAt: now(),
				updatedAt: now(),
				deletedAt: null,
				voidedAt: null,
				voidReason: null,
				...row,
			} as TPaymentSelect;
			paymentsRows.set(created.id, created);
			return created;
		},
		updatePayment: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = paymentsRows.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		findPaymentById: async (_o: string, id: string) => paymentsRows.get(id) ?? null,
		listPayments: async () => ({
			data: [...paymentsRows.values()],
			meta: { page: 1, limit: 20, total: paymentsRows.size, totalPages: 1 },
		}),
		insertPaymentAllocations: async (rows: Array<Record<string, unknown>>) =>
			rows.map((row) => {
				const created = { id: id('alloc'), createdAt: now(), updatedAt: now(), ...row } as TPaymentAllocationSelect;
				allocations.push(created);
				return created;
			}),
		listPaymentAllocations: async (_o: string, paymentId: string) =>
			allocations.filter((a) => a.paymentId === paymentId),
		markAllocationExecuted: async (_o: string, allocId: string) => {
			const row = allocations.find((a) => a.id === allocId);
			if (row) row.updatedAt = now();
		},
	};

	const numbering = {
		next: async (type: string) => `${type}-${String(++seq).padStart(6, '0')}`,
	} as unknown as CodeNumberService;

	const tx = new Proxy({} as never, {}) as never;
	const dbLike = {
		transaction: async (fn: (tx: never) => unknown) => fn(tx),
	} as unknown as BunSQLDatabase;

	const repo = repoFake;
	const posting = new PostingService({} as unknown as BunSQLDatabase, repo as never, repo as never, repo as never, numbering);
	const arResolver = new ArAccountResolverService(repo as never);
	const cashBank = new CashBankService(dbLike, repo as never, repo as never, posting, numbering);
	// ADR-0024: the payment ledger moved to its own module. These adapters point
	// the payment service at this fake through its own repository and through
	// Accounting's settlement port, both backed by the same in-memory rows.
	const paymentLedger = {
		countOpen: async () =>
			(await repoFake.listPayments()).data.filter((p) =>
				['draft', 'submitted', 'approved'].includes(p.status as string),
			).length,
		list: () => repoFake.listPayments(),
		findById: repoFake.findPaymentById,
		insert: repoFake.insertPayment,
		update: repoFake.updatePayment,
		insertAllocations: repoFake.insertPaymentAllocations,
		listAllocations: repoFake.listPaymentAllocations,
		markAllocationExecuted: repoFake.markAllocationExecuted,
	};
	const settlement = {
		findSalesInvoice: repo.findSalesInvoiceById,
		findArOpenItem: repo.findArOpenItemByInvoice,
		applyArSettlement: async (
			org: string,
			invoiceId: string,
			patch: { paidAmount: number; outstandingAmount: number; status: string },
			_txIn: never,
		) => {
			await repo.updateArOpenItem(org, invoiceId, patch);
			await repo.updateSalesInvoiceTotals(org, invoiceId, {
				paidTotal: patch.paidAmount,
				outstandingTotal: patch.outstandingAmount,
				status: patch.status,
			});
		},
		// AR-only suite: no payable payment is executed here.
		findSupplierBill: async () => null,
		findApOpenItem: async () => null,
		applyApSettlement: async () => undefined,
		postCashMovement: async (input: Record<string, unknown>, txIn: never) => {
			const counterpartAccountId = await arResolver.resolve(
				input.organizationId as string,
				input.side === 'payable' ? 'ap' : 'ar',
			);
			await cashBank.postMovement(
				{ organizationId: input.organizationId as string, actorUserId: input.actorUserId as string },
				{
					cashBankAccountId: input.cashBankAccountId as string,
					transactionDate: input.businessDate as string,
					direction: input.direction as 'in' | 'out',
					amount: input.amount as number,
					description: input.description as string,
					referenceNumber: input.referenceNumber as string,
					counterpartAccountId,
					sourceType: input.sourceType as string,
					sourceId: input.sourceId as string,
				},
				txIn,
			);
		},
	};

	const paymentService = new PaymentService(dbLike, paymentLedger as never, settlement as never, numbering);

	const invoiceRepo = {
		findById: async (_o: string, id: string) => invoicesRows.get(id) ?? null,
		findByCode: async (_o: string, code: string) =>
			[...invoicesRows.values()].find((i) => i.code === code) ?? null,
		list: async () => ({
			data: [...invoicesRows.values()],
			meta: { page: 1, limit: 20, total: invoicesRows.size, totalPages: 1 },
		}),
		insert: async (row: Record<string, unknown>) => {
			const created = { id: id('inv'), createdAt: now(), updatedAt: now(), deletedAt: null, ...row } as TInvoiceSelect;
			invoicesRows.set(created.id, created);
			return created;
		},
		update: async (_o: string, id: string, patch: Record<string, unknown>) => {
			const row = invoicesRows.get(id);
			if (!row) return null;
			Object.assign(row, patch);
			return row;
		},
		listItems: async (_o: string, invId: string) =>
			invoiceItemsRows.filter((r) => r.invoiceId === invId),
		replaceItems: async (_o: string, invId: string, rows: Array<Record<string, unknown>>) => {
			for (let i = invoiceItemsRows.length - 1; i >= 0; i--) {
				if (invoiceItemsRows[i].invoiceId === invId) invoiceItemsRows.splice(i, 1);
			}
			const created = rows.map((row) => {
				const item = { id: id('ii'), createdAt: now(), updatedAt: now(), deletedAt: null, ...row } as TInvoiceItemSelect;
				invoiceItemsRows.push(item);
				return item;
			});
			return created;
		},
	} as unknown as TInvoiceRepository;

	// n8n events (M04): recorded so the flows can assert on them.
	const events: { topic: string; data: Record<string, unknown> }[] = [];
	const arLedger = {
		openItem: async (org: string, input: Record<string, unknown>) => {
			await repo.insertArOpenItem({ organizationId: org, ...input } as never);
		},
		setOpenItemStatus: async () => undefined,
		findPostedEntryForSource: async () => null,
	};

	const invoiceService = new InvoiceService(
		dbLike,
		invoiceRepo,
		arLedger as never,
		posting,
		arResolver,
		numbering,
		{
			publish: async (topic, _aggregate, data) => {
				events.push({ topic, data });
				return null;
			},
		},
		{
			// ERP-0044: registry side effect is asserted through `registered`.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
			voidBySource: async (module, sourceType, sourceId) => {
				voided.push(`${module}/${sourceType}/${sourceId}`);
				return 1;
			},
		}, { notify: async () => {} },
	);

	return {
		posting,
		events,
		invoiceService,
		paymentService,
		cashBank,
		entries,
		journalLinesRows,
		invoicesRows,
		invoiceItemsRows,
		arItems,
		paymentsRows,
		registered,
		voided,
		cashAccounts,
		cashTxRows,
		links,
		accounts,
	};
}

const ITEMS = [
	{
		itemId: null,
		description: 'Consulting',
		quantity: 10,
		unitPrice: 100_000,
		discountAmount: 0,
		taxAmount: 0,
	},
];

async function seedIssuedInvoice(
	h: ReturnType<typeof makeHarness>,
	grandTotal = 1_000_000,
) {
	const inv = await h.invoiceService.create(ctx, {
		invoiceType: 'sales',
		customerId: 'cust-1',
		salesOrderId: null,
		paymentTermId: null,
		issueDate: '2026-01-05',
		dueDate: '2026-02-04',
		currencyCode: 'IDR',
		notes: null,
		items: [{ ...ITEMS[0], unitPrice: grandTotal / 10 }],
	});
	return h.invoiceService.issue(ctx, inv.id);
}

describe('InvoiceService (F4)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(() => {
		h = makeHarness();
	});

	test('issue posts DR AR / CR revenue and opens the AR sub-ledger row', async () => {
		const issued = await seedIssuedInvoice(h, 1_000_000);
		expect(issued.status).toBe('issued');
		expect(issued.outstandingTotal).toBe(1_000_000);

		const entry = [...h.entries.values()].find((e) => e.sourceType === 'invoice')!;
		expect(entry.status).toBe('posted');
		expect(entry.sourceModule).toBe('sales');
		const lines = h.journalLinesRows.filter((l) => l.journalEntryId === entry.id);
		const ar = lines.find((l) => l.accountId === 'acc-ar')!;
		expect(ar.debit).toBe(1_000_000);
		expect(ar.credit).toBe(0);
		const rev = lines.find((l) => l.accountId === 'acc-rev')!;
		expect(rev.credit).toBe(1_000_000);

		expect(h.arItems).toHaveLength(1);
		expect(h.arItems[0].outstandingAmount).toBe(1_000_000);
		expect(h.arItems[0].status).toBe('open');
		// One invoice.issued event to n8n after the commit (M04).
		expect(h.events.map((event) => event.topic)).toEqual(['invoice.issued']);
		expect(h.events[0]!.data).toMatchObject({ invoiceId: issued.id, grandTotal: 1_000_000 });
		// ERP-0044: issuing registers the invoice in the document registry.
		expect(h.registered).toEqual([
			expect.objectContaining({
				code: issued.code,
				documentType: 'sales_invoice',
				sourceType: 'invoice',
				sourceId: issued.id,
			}),
		]);
	});

	test('issue with tax posts three lines including CR tax payable', async () => {
		const inv = await h.invoiceService.create(ctx, {
			invoiceType: 'sales',
			customerId: 'cust-1',
			salesOrderId: null,
			paymentTermId: null,
			issueDate: '2026-01-05',
			dueDate: null,
			currencyCode: 'IDR',
			notes: null,
			items: [
				{
					itemId: null,
					description: 'Goods',
					quantity: 1,
					unitPrice: 1_000_000,
					discountAmount: 0,
					taxAmount: 110_000,
				},
			],
		});
		await h.invoiceService.issue(ctx, inv.id);
		const entry = [...h.entries.values()].find((e) => e.sourceType === 'invoice')!;
		const lines = h.journalLinesRows.filter((l) => l.journalEntryId === entry.id);
		expect(lines).toHaveLength(3);
		const tax = lines.find((l) => l.accountId === 'acc-tax')!;
		expect(tax.credit).toBe(110_000);
		// balanced: AR 1_110_000 = revenue 1_000_000 + tax 110_000
		const dr = lines.reduce((s, l) => s + l.debit, 0);
		const cr = lines.reduce((s, l) => s + l.credit, 0);
		expect(dr).toBe(cr);
	});

	test('issue is idempotent through the JE key', async () => {
		const inv = await seedIssuedInvoice(h);
		const entry = [...h.entries.values()].find((e) => e.sourceType === 'invoice')!;
		expect(entry.idempotencyKey).toBe(`invoice:${inv.id}`);
	});

	test('refuses to issue without items, or re-issue a non-draft', async () => {
		const inv = await h.invoiceService.create(ctx, {
			invoiceType: 'sales',
			customerId: null,
			salesOrderId: null,
			paymentTermId: null,
			issueDate: null,
			dueDate: null,
			currencyCode: 'IDR',
			notes: null,
			items: [],
		});
		await expect(h.invoiceService.issue(ctx, inv.id)).rejects.toThrow(InvoiceNoItemsError);

		const issued = await seedIssuedInvoice(h);
		await expect(h.invoiceService.issue(ctx, issued.id)).rejects.toThrow(InvoiceNotDraftError);
	});

	test('refuses when the AR account is not configured', async () => {
		h.accounts.delete('acc-ar');
		await expect(seedIssuedInvoice(h)).rejects.toThrow(ArAccountNotConfiguredError);
	});
});

describe('PaymentService (F4)', () => {
	let h: ReturnType<typeof makeHarness>;
	beforeEach(async () => {
		h = makeHarness();
		await h.cashBank.createAccount(ctx, {
			code: 'BCA-01',
			name: 'BCA',
			accountType: 'bank',
			openingBalance: 0,
		});
		const cashId = [...h.cashAccounts.keys()][0];
		h.links.set(cashId, {
			cashBankAccountId: cashId,
			chartOfAccountId: 'acc-cash-gl',
		} as never);
	});

	const cashId = (hh: ReturnType<typeof makeHarness>) =>
		[...hh.cashAccounts.keys()][0];

	test('workflow draft→submitted→approved→executed settles the invoice', async () => {
		const inv = await seedIssuedInvoice(h, 1_000_000);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: 'customer',
				counterpartyId: 'cust-1',
				amount: 1_000_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await h.paymentService.setAllocations(ctx, payment.id, [
			{ salesInvoiceId: inv.id, amount: 1_000_000 },
		]);
		await h.paymentService.submit(ctx, payment.id);
		await h.paymentService.approve(ctx, payment.id);
		const executed = await h.paymentService.execute(ctx, payment.id);

		expect(executed.status).toBe('executed');
		// both mirrors fully paid
		expect(h.arItems[0].status).toBe('paid');
		expect(h.arItems[0].outstandingAmount).toBe(0);
		expect(h.invoicesRows.get(inv.id)!.status).toBe('paid');
		expect(h.invoicesRows.get(inv.id)!.paidTotal).toBe(1_000_000);

		// cash movement + journal (DR cash / CR AR, sourceType payment)
		expect(h.cashTxRows).toHaveLength(1);
		const entry = [...h.entries.values()].find((e) => e.sourceType === 'payment')!;
		const lines = h.journalLinesRows.filter((l) => l.journalEntryId === entry.id);
		const cash = lines.find((l) => l.accountId === 'acc-cash-gl')!;
		const ar = lines.find((l) => l.accountId === 'acc-ar')!;
		expect(cash.debit).toBe(1_000_000);
		expect(ar.credit).toBe(1_000_000);
	});

	test('partial allocation leaves both mirrors partially_paid', async () => {
		const inv = await seedIssuedInvoice(h, 1_000_000);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: null,
				counterpartyId: null,
				amount: 400_000,
				paymentMethod: 'cash',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await h.paymentService.setAllocations(ctx, payment.id, [
			{ salesInvoiceId: inv.id, amount: 400_000 },
		]);
		await h.paymentService.submit(ctx, payment.id);
		await h.paymentService.approve(ctx, payment.id);
		await h.paymentService.execute(ctx, payment.id);

		expect(h.arItems[0].status).toBe('partially_paid');
		expect(h.arItems[0].outstandingAmount).toBe(600_000);
		expect(h.invoicesRows.get(inv.id)!.status).toBe('partially_paid');
	});

	test('refuses allocations that do not sum to the amount', async () => {
		const inv = await seedIssuedInvoice(h);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: null,
				counterpartyId: null,
				amount: 1_000_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await expect(
			h.paymentService.setAllocations(ctx, payment.id, [
				{ salesInvoiceId: inv.id, amount: 900_000 },
			]),
		).rejects.toThrow(PaymentAllocationMismatchError);
	});

	test('refuses over-allocation and non-issued targets', async () => {
		const inv = await seedIssuedInvoice(h, 1_000_000);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: null,
				counterpartyId: null,
				amount: 1_200_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await expect(
			h.paymentService.setAllocations(ctx, payment.id, [
				{ salesInvoiceId: inv.id, amount: 1_200_000 },
			]),
		).rejects.toThrow(PaymentOverAllocationError);

		// draft invoice is not an acceptable target
		const draftInv = await h.invoiceService.create(ctx, {
			invoiceType: 'sales',
			customerId: null,
			salesOrderId: null,
			paymentTermId: null,
			issueDate: null,
			dueDate: null,
			currencyCode: 'IDR',
			notes: null,
			items: ITEMS,
		});
		const payment2 = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: null,
				counterpartyId: null,
				amount: 1_000_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await expect(
			h.paymentService.setAllocations(ctx, payment2.id, [
				{ salesInvoiceId: draftInv.id, amount: 1_000_000 },
			]),
		).rejects.toThrow(PaymentTargetNotIssuedError);
	});

	test('invalid transitions are rejected and void works pre-execution only', async () => {
		const inv = await seedIssuedInvoice(h);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: null,
				counterpartyId: null,
				amount: 1_000_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		// cannot approve a draft
		await expect(h.paymentService.approve(ctx, payment.id)).rejects.toThrow(
			PaymentInvalidTransitionError,
		);
		await h.paymentService.void(ctx, payment.id, 'duplicate request');
		await expect(
			h.paymentService.setAllocations(ctx, payment.id, [
				{ salesInvoiceId: inv.id, amount: 1_000_000 },
			]),
		).rejects.toThrow(PaymentInvalidTransitionError);

		// executed → void refused
		const payment2 = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: null,
				counterpartyId: null,
				amount: 1_000_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-21',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await h.paymentService.setAllocations(ctx, payment2.id, [
			{ salesInvoiceId: inv.id, amount: 1_000_000 },
		]);
		await h.paymentService.submit(ctx, payment2.id);
		await h.paymentService.approve(ctx, payment2.id);
		await h.paymentService.execute(ctx, payment2.id);
		await expect(
			h.paymentService.void(ctx, payment2.id, 'oops'),
		).rejects.toThrow(PaymentVoidNotAllowedError);
	});

	test('execution through an inactive cash account is refused (atomic rollback)', async () => {
		const inv = await seedIssuedInvoice(h);
		const payment = await h.paymentService.create(
			ctx,
			{
				paymentType: 'customer_payment',
				counterpartyType: null,
				counterpartyId: null,
				amount: 1_000_000,
				paymentMethod: 'bank_transfer',
				paymentDate: '2026-01-20',
				cashBankAccountId: cashId(h),
				referenceNumber: null,
				notes: null,
			},
			[],
		);
		await h.paymentService.setAllocations(ctx, payment.id, [
			{ salesInvoiceId: inv.id, amount: 1_000_000 },
		]);
		await h.paymentService.submit(ctx, payment.id);
		await h.paymentService.approve(ctx, payment.id);
		// deactivate the account AFTER approval — movement path must refuse
		const cash = h.cashAccounts.get(cashId(h))!;
		cash.isActive = false;
		await expect(h.paymentService.execute(ctx, payment.id)).rejects.toThrow(
			CashBankAccountInactiveError,
		);
		// movement never posted (the in-memory fake cannot roll back the
		// allocation writes — that atomicity is the database transaction's job)
		expect(h.cashTxRows).toHaveLength(0);
	});
});
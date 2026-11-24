import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TExpenseClaimItemSelect,
	TExpenseClaimSelect,
} from '@drizzle/schemas/finance.schema';
import { EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN } from '@app/human-resource/constants/di';
import type { ExportedEmployeeService } from '@app/human-resource/services/exported-employee.service';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type { IExpenseClaimRepository, TExpenseClaimPaginationRequest } from '../contracts/expense-claim.repository.interface';
import {
	CHART_OF_ACCOUNT_REPOSITORY_TOKEN,
	EXPENSE_CLAIM_REPOSITORY_TOKEN,
	FINANCE_NUMBERING_SERVICE_TOKEN,
	JOURNAL_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IJournalRepository } from '../contracts/journal.repository.interface';
import {
	AR_ACCOUNT_RESOLVER_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/ar-di';
import type { FinanceNumberingService } from './finance-numbering.service';
import type { PostingService } from './posting.service';
import type { ArAccountResolverService } from './ar-account-resolver.service';
import {
	ExpenseClaimAccountError,
	ExpenseClaimEmployeeError,
	ExpenseClaimEmptyError,
	ExpenseClaimNotFoundError,
	ExpenseClaimNotDraftError,
	ExpenseClaimTransitionError,
} from '../errors/expense.errors';

export type TExpenseActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TExpenseClaimItemInput = {
	expenseDate: string | null;
	categoryCode: string;
	description: string | null;
	amount: number;
	taxAmount: number;
};

export type TCreateExpenseClaimInput = {
	employeeId: string;
	claimDate: string;
	notes: string | null;
	items: TExpenseClaimItemInput[];
};

export type TUpdateExpenseClaimInput = {
	employeeId?: string;
	claimDate?: string;
	notes?: string | null;
	items?: TExpenseClaimItemInput[];
};

export type TExpenseClaimDetail = TExpenseClaimSelect & {
	items: TExpenseClaimItemSelect[];
	/** The accrual entry, once the claim has been approved. */
	journalEntry: { id: string; code: string; entryDate: string | null } | null;
};

const sum = (items: TExpenseClaimItemInput[]) =>
	items.reduce((total, item) => total + item.amount + item.taxAmount, 0);

/**
 * Employee expense-claim application service (ERP-0013).
 *
 * @remarks
 * Approval is the ledger event: one transaction posts
 * DR expense (per `category_code`) / DR input tax / CR expense-claims payable
 * through the shared posting service (D9), idempotent on `expense_claim:<id>`.
 * Paying a claim (`paid`, `payment_id`) is deliberately out of this slice.
 */
@injectable()
export class ExpenseClaimService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(EXPENSE_CLAIM_REPOSITORY_TOKEN)
		private readonly claims: IExpenseClaimRepository,
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN)
		private readonly accounts: IChartOfAccountRepository,
		@inject(JOURNAL_REPOSITORY_TOKEN) private readonly journal: IJournalRepository,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
		@inject(AR_ACCOUNT_RESOLVER_TOKEN)
		private readonly accountResolver: ArAccountResolverService,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: FinanceNumberingService,
		@inject(EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN)
		private readonly employees: Pick<ExportedEmployeeService, 'findEmployeeById'>,
	) {}

	/** Employee must exist and not be terminated, in an organization that matches. */
	private async assertEmployee(organizationId: string, employeeId: string): Promise<void> {
		const employee = await this.employees.findEmployeeById(employeeId);
		if (!employee || employee.employmentStatus === 'terminated') {
			throw new ExpenseClaimEmployeeError();
		}
		if (employee.organizationId && employee.organizationId !== organizationId) {
			throw new ExpenseClaimEmployeeError();
		}
	}

	/** Fetches one page of the tenant's claims. */
	async list(
		request: TExpenseClaimPaginationRequest,
	): Promise<TPaginationResult<TExpenseClaimSelect>> {
		return this.claims.paginate(request);
	}

	async get(organizationId: string, id: string): Promise<TExpenseClaimSelect> {
		const claim = await this.claims.findExpenseClaimById(organizationId, id);
		if (!claim) throw new ExpenseClaimNotFoundError();
		return claim;
	}

	async detail(organizationId: string, id: string): Promise<TExpenseClaimDetail> {
		const claim = await this.get(organizationId, id);
		const [items, entry] = await Promise.all([
			this.claims.findExpenseClaimItems(organizationId, id),
			this.journal.findEntryBySource(organizationId, 'expense_claim', id),
		]);
		return {
			...claim,
			items,
			journalEntry: entry
				? { id: entry.id, code: entry.code ?? '', entryDate: entry.entryDate }
				: null,
		};
	}

	private async insertItems(
		organizationId: string,
		claimId: string,
		items: TExpenseClaimItemInput[],
		tx: TTx,
	) {
		return this.claims.insertExpenseClaimItems(
			items.map((item) => ({
				organizationId,
				expenseClaimId: claimId,
				expenseDate: item.expenseDate,
				categoryCode: item.categoryCode,
				description: item.description,
				amount: item.amount,
				taxAmount: item.taxAmount,
				currencyCode: 'IDR',
				receiptDocumentId: null,
			})),
			tx,
		);
	}

	/** Creates a draft claim; `total_amount` is derived from the lines. */
	async create(
		ctx: TExpenseActionContext,
		input: TCreateExpenseClaimInput,
	): Promise<TExpenseClaimDetail> {
		await this.assertEmployee(ctx.organizationId, input.employeeId);
		const created = await this.database.transaction(async (tx) => {
			const code = await this.numbering.next('expense_claim', {
				date: new Date(`${input.claimDate}T12:00:00+07:00`),
				tx,
			});
			const claim = await this.claims.insertExpenseClaim(
				{
					organizationId: ctx.organizationId,
					code,
					employeeId: input.employeeId,
					claimDate: input.claimDate,
					totalAmount: sum(input.items),
					currencyCode: 'IDR',
					status: 'draft',
					submittedBy: null,
					submittedAt: null,
					approvedBy: null,
					approvedAt: null,
					paymentId: null,
					notes: input.notes,
				},
				tx,
			);
			await this.insertItems(ctx.organizationId, claim.id, input.items, tx);
			return claim;
		});
		return this.detail(ctx.organizationId, created.id);
	}

	/** Edits a draft (or rejected) claim; lines are replaced as a whole. */
	async update(
		ctx: TExpenseActionContext,
		id: string,
		input: TUpdateExpenseClaimInput,
	): Promise<TExpenseClaimDetail> {
		const claim = await this.get(ctx.organizationId, id);
		if (claim.status !== 'draft' && claim.status !== 'rejected') {
			throw new ExpenseClaimNotDraftError();
		}
		if (input.employeeId) await this.assertEmployee(ctx.organizationId, input.employeeId);
		await this.database.transaction(async (tx) => {
			const patch: Record<string, unknown> = {};
			if (input.employeeId) patch.employeeId = input.employeeId;
			if (input.claimDate) patch.claimDate = input.claimDate;
			if (input.notes !== undefined) patch.notes = input.notes;
			if (input.items) {
				await this.claims.deleteExpenseClaimItems(ctx.organizationId, id, tx);
				await this.insertItems(ctx.organizationId, id, input.items, tx);
				patch.totalAmount = sum(input.items);
			}
			// A rejected claim that is edited becomes a draft again.
			if (claim.status === 'rejected') patch.status = 'draft';
			if (Object.keys(patch).length > 0) {
				await this.claims.updateExpenseClaim(ctx.organizationId, id, patch, tx);
			}
		});
		return this.detail(ctx.organizationId, id);
	}

	private async transition(
		organizationId: string,
		id: string,
		from: readonly string[],
		to: string,
		extra: Record<string, unknown> = {},
	): Promise<TExpenseClaimSelect> {
		return this.database.transaction(async (tx) => {
			const claim = await this.claims.findExpenseClaimById(organizationId, id, tx);
			if (!claim) throw new ExpenseClaimNotFoundError();
			if (!from.includes(claim.status)) {
				throw new ExpenseClaimTransitionError(claim.status, to);
			}
			const updated = await this.claims.updateExpenseClaim(
				organizationId,
				id,
				{ status: to, ...extra },
				tx,
			);
			return updated ?? claim;
		});
	}

	/** draft|rejected → submitted. Needs at least one line with a positive total. */
	async submit(ctx: TExpenseActionContext, id: string): Promise<TExpenseClaimSelect> {
		const claim = await this.get(ctx.organizationId, id);
		if (claim.status !== 'draft' && claim.status !== 'rejected') {
			throw new ExpenseClaimTransitionError(claim.status, 'submitted');
		}
		const items = await this.claims.findExpenseClaimItems(ctx.organizationId, id);
		if (items.length === 0 || claim.totalAmount <= 0) throw new ExpenseClaimEmptyError();
		return this.transition(ctx.organizationId, id, ['draft', 'rejected'], 'submitted', {
			submittedBy: ctx.actorUserId,
			submittedAt: new Date(),
		});
	}

	/**
	 * submitted → approved, posting the accrual journal in the same transaction:
	 * DR each expense account (by `category_code`), DR input tax, CR claims
	 * payable. Idempotent through `expense_claim:<id>`.
	 */
	async approve(ctx: TExpenseActionContext, id: string): Promise<TExpenseClaimSelect> {
		return this.database.transaction(async (tx) => {
			const claim = await this.claims.findExpenseClaimById(ctx.organizationId, id, tx);
			if (!claim) throw new ExpenseClaimNotFoundError();
			if (claim.status !== 'submitted') {
				throw new ExpenseClaimTransitionError(claim.status, 'approved');
			}
			const items = await this.claims.findExpenseClaimItems(ctx.organizationId, id, tx);
			if (items.length === 0) throw new ExpenseClaimEmptyError();

			// One debit per expense account, regardless of how many lines share it.
			const byCode = new Map<string, number>();
			let taxTotal = 0;
			for (const item of items) {
				const code = item.categoryCode;
				if (!code) throw new ExpenseClaimAccountError('—');
				byCode.set(code, (byCode.get(code) ?? 0) + item.amount);
				taxTotal += item.taxAmount;
			}
			const debits: { accountId: string; amount: number }[] = [];
			for (const [code, amount] of byCode) {
				if (amount === 0) continue;
				const account = await this.accounts.findAccountByCode(ctx.organizationId, code);
				if (
					!account ||
					account.accountType !== 'expense' ||
					!account.isActive ||
					!account.isPostable
				) {
					throw new ExpenseClaimAccountError(code);
				}
				debits.push({ accountId: account.id, amount });
			}
			const lines = debits.map((debit) => ({
				accountId: debit.accountId,
				debit: debit.amount,
				credit: 0,
			}));
			if (taxTotal > 0) {
				lines.push({
					accountId: await this.accountResolver.resolve(ctx.organizationId, 'taxInput'),
					debit: taxTotal,
					credit: 0,
				});
			}
			lines.push({
				accountId: await this.accountResolver.resolve(ctx.organizationId, 'claimPayable'),
				debit: 0,
				credit: claim.totalAmount,
			});

			await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: claim.claimDate ?? new Date().toISOString().slice(0, 10),
				sourceModule: 'finance',
				sourceType: 'expense_claim',
				sourceId: claim.id,
				idempotencyKey: `expense_claim:${claim.id}`,
				description: `Expense claim ${claim.code}`,
				lines,
			});

			const updated = await this.claims.updateExpenseClaim(
				ctx.organizationId,
				id,
				{ status: 'approved', approvedBy: ctx.actorUserId, approvedAt: new Date() },
				tx,
			);
			return updated ?? claim;
		});
	}

	/** submitted → rejected. */
	async reject(ctx: TExpenseActionContext, id: string): Promise<TExpenseClaimSelect> {
		return this.transition(ctx.organizationId, id, ['submitted'], 'rejected');
	}

	/** draft|submitted → cancelled (nothing was posted, so no reversal). */
	async cancel(ctx: TExpenseActionContext, id: string): Promise<TExpenseClaimSelect> {
		return this.transition(ctx.organizationId, id, ['draft', 'submitted'], 'cancelled');
	}
}

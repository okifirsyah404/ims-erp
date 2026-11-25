import type { TJournalEntrySelect } from '@drizzle/schemas/finance.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import type { AuditWriter } from '@shared/audit';
import { inject, injectable } from 'tsyringe';
import {
	FINANCE_AUDIT_WRITER_TOKEN,
	JOURNAL_REPOSITORY_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { IJournalRepository } from '../contracts/journal.repository.interface';
import {
	JournalEntryNotFoundError,
	JournalSelfApprovalError,
	JournalTransitionError,
} from '../errors/ledger.errors';
import type { PostingService, TPostingLine, TPostingResult } from './posting.service';

export type TManualJournalActor = { organizationId: string; actorUserId: string };

export type TManualJournalInput = {
	entryDate: string;
	description: string | null;
	isAdjusting: boolean;
	lines: TPostingLine[];
};

type TJournalAuditAction =
	| 'journal.drafted'
	| 'journal.updated'
	| 'journal.submitted'
	| 'journal.approved'
	| 'journal.rejected'
	| 'journal.voided'
	| 'journal.reversed';

/**
 * Manual journal lifecycle with maker-checker (ERP-0129, ADR-0030 §4).
 *
 * @remarks
 * `draft -> submitted -> approved` where approving also posts the entry
 * (number assigned at posting). `reject` returns a submitted entry to
 * `draft`; `void` discards a draft or submitted entry. The approver must not
 * be the preparer. Every transition is audited. Drafts never reach the
 * ledger: reports sum `posted` and `reversed` entries only.
 */
@injectable()
export class ManualJournalService {
	constructor(
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(JOURNAL_REPOSITORY_TOKEN) private readonly journal: IJournalRepository,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
		@inject(FINANCE_AUDIT_WRITER_TOKEN) private readonly audit?: AuditWriter,
	) {}

	async createDraft(ctx: TManualJournalActor, input: TManualJournalInput) {
		const result = await this.transactions.run(async (tx) => {
			const validated = await this.posting.validateDraft(ctx.organizationId, input, tx);
			const entry = await this.journal.insertEntry(
				{
					organizationId: ctx.organizationId,
					code: null,
					accountingPeriodId: validated.period.id,
					entryDate: input.entryDate,
					description: input.description,
					sourceType: 'manual',
					sourceId: null,
					idempotencyKey: null,
					sourceModule: 'finance',
					status: 'draft',
					totalDebit: validated.total,
					totalCredit: validated.total,
					currencyCode: 'IDR',
					postedBy: null,
					postedAt: null,
					preparedBy: ctx.actorUserId,
					isAdjusting: input.isAdjusting,
				},
				tx,
			);
			const lines = await this.insertLines(ctx.organizationId, entry.id, validated.lines, tx);
			return { ...entry, lines };
		});
		await this.record(ctx, 'journal.drafted', result.id, { entryDate: result.entryDate, total: result.totalDebit });
		return result;
	}

	async updateDraft(ctx: TManualJournalActor, entryId: string, input: TManualJournalInput) {
		const result = await this.transactions.run(async (tx) => {
			const entry = await this.requireEntry(ctx.organizationId, entryId);
			if (entry.status !== 'draft') throw new JournalTransitionError();
			const validated = await this.posting.validateDraft(ctx.organizationId, input, tx);
			await this.journal.softDeleteLines(ctx.organizationId, entryId, tx);
			const updated = await this.journal.updateEntry(
				ctx.organizationId,
				entryId,
				{
					entryDate: input.entryDate,
					accountingPeriodId: validated.period.id,
					description: input.description,
					isAdjusting: input.isAdjusting,
					totalDebit: validated.total,
					totalCredit: validated.total,
				},
				tx,
			);
			if (!updated) throw new JournalEntryNotFoundError();
			const lines = await this.insertLines(ctx.organizationId, entryId, validated.lines, tx);
			return { ...updated, lines };
		});
		await this.record(ctx, 'journal.updated', entryId, { total: result.totalDebit });
		return result;
	}

	async submit(ctx: TManualJournalActor, entryId: string): Promise<TJournalEntrySelect> {
		const entry = await this.requireEntry(ctx.organizationId, entryId);
		if (entry.status !== 'draft') throw new JournalTransitionError();
		const updated = await this.journal.updateEntry(ctx.organizationId, entryId, {
			status: 'submitted',
			submittedAt: new Date(),
		});
		if (!updated) throw new JournalEntryNotFoundError();
		await this.record(ctx, 'journal.submitted', entryId, {});
		return updated;
	}

	/** Approves and posts a submitted entry; the preparer cannot approve. */
	async approve(ctx: TManualJournalActor, entryId: string): Promise<TJournalEntrySelect> {
		const posted = await this.transactions.run(async (tx) => {
			const entry = await this.journal.findEntryById(ctx.organizationId, entryId, tx);
			if (!entry) throw new JournalEntryNotFoundError();
			if (entry.status !== 'submitted') throw new JournalTransitionError();
			if (entry.preparedBy && entry.preparedBy === ctx.actorUserId) {
				throw new JournalSelfApprovalError();
			}
			return this.posting.postDraft(tx, ctx.organizationId, entry, ctx.actorUserId);
		});
		await this.record(ctx, 'journal.approved', entryId, { code: posted.code, total: posted.totalDebit });
		return posted;
	}

	async reject(ctx: TManualJournalActor, entryId: string, reason: string): Promise<TJournalEntrySelect> {
		const entry = await this.requireEntry(ctx.organizationId, entryId);
		if (entry.status !== 'submitted') throw new JournalTransitionError();
		const updated = await this.journal.updateEntry(ctx.organizationId, entryId, {
			status: 'draft',
			submittedAt: null,
		});
		if (!updated) throw new JournalEntryNotFoundError();
		await this.record(ctx, 'journal.rejected', entryId, { reason });
		return updated;
	}

	async void(ctx: TManualJournalActor, entryId: string): Promise<TJournalEntrySelect> {
		const entry = await this.requireEntry(ctx.organizationId, entryId);
		if (entry.status !== 'draft' && entry.status !== 'submitted') throw new JournalTransitionError();
		const updated = await this.journal.updateEntry(ctx.organizationId, entryId, { status: 'void' });
		if (!updated) throw new JournalEntryNotFoundError();
		await this.record(ctx, 'journal.voided', entryId, {});
		return updated;
	}

	/** Manual reversal; the reason becomes the reversal's description. */
	async reverse(
		ctx: TManualJournalActor,
		entryId: string,
		input: { entryDate?: string; reason: string },
	): Promise<TPostingResult> {
		const result = await this.transactions.run((tx) =>
			this.posting.reverse(tx, ctx.organizationId, entryId, ctx.actorUserId, {
				entryDate: input.entryDate,
				description: input.reason,
			}),
		);
		await this.record(ctx, 'journal.reversed', entryId, {
			reason: input.reason,
			reversalEntryId: result.entry.id,
			reversalDate: result.entry.entryDate,
		});
		return result;
	}

	private async requireEntry(organizationId: string, entryId: string): Promise<TJournalEntrySelect> {
		const entry = await this.journal.findEntryById(organizationId, entryId);
		if (!entry) throw new JournalEntryNotFoundError();
		return entry;
	}

	private insertLines(
		organizationId: string,
		entryId: string,
		lines: Array<TPostingLine & { accountId: string }>,
		tx: Parameters<IJournalRepository['insertLines']>[1],
	) {
		return this.journal.insertLines(
			lines.map((line, index) => ({
				organizationId,
				journalEntryId: entryId,
				lineNo: index + 1,
				accountId: line.accountId,
				debit: line.debit,
				credit: line.credit,
				currencyCode: 'IDR',
				description: line.description ?? null,
				costCenterId: line.costCenterId ?? null,
				projectId: line.projectId ?? null,
				partyType: line.partyType ?? null,
				partyId: line.partyId ?? null,
				productId: line.productId ?? null,
			})),
			tx,
		);
	}

	private async record(
		ctx: TManualJournalActor,
		action: TJournalAuditAction,
		targetId: string,
		meta: Record<string, unknown>,
	): Promise<void> {
		await this.audit?.record({
			actor: { userId: ctx.actorUserId },
			action,
			targetType: 'journal_entry',
			targetId,
			organizationId: ctx.organizationId,
			meta,
		});
	}
}

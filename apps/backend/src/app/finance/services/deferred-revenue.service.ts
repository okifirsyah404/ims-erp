import type { TTx } from '@drizzle/types';
import type { TDeferredRevenueScheduleSelect } from '@drizzle/schemas/finance.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	DEFERRED_REVENUE_REPOSITORY_TOKEN,
	JOURNAL_REPOSITORY_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { IDeferredRevenuePort, TDeferredScheduleInput } from '../contracts/deferred-revenue.port';
import type {
	IDeferredRevenueRepository,
	TDeferredRevenuePaginationRequest,
} from '../contracts/deferred-revenue.repository.interface';
import type { IJournalRepository } from '../contracts/journal.repository.interface';
import { ReportPeriodInvalidError } from '../errors/ledger.errors';
import { amortisationForMonth, monthEnd, monthsBetween, nextMonth } from '../utils/deferred-revenue';
import type { PostingService } from './posting.service';

/** Source type stamped on amortisation journals; `sourceId` is the schedule id. */
export const DEFERRED_REVENUE_SOURCE = 'deferred_revenue_schedule';

export type TAmortisationRunResult = {
	month: string;
	schedules: number;
	entries: number;
	amount: number;
};

/**
 * Deferred revenue (ERP-0135, grill Q27): schedules opened by invoice lines
 * with a service period, amortised straight-line per calendar month.
 *
 * @remarks
 * The monthly run catches a schedule up through the requested month, one
 * journal per schedule and month (Dr deferred revenue / Cr revenue with the
 * line's product-category discriminator), idempotent on
 * `deferred:<schedule>:<YYYY-MM>`. A month whose period is no longer open
 * fails that schedule's posting and is reported, never skipped silently.
 */
@injectable()
export class DeferredRevenueService implements IDeferredRevenuePort {
	constructor(
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(DEFERRED_REVENUE_REPOSITORY_TOKEN) private readonly schedules: IDeferredRevenueRepository,
		@inject(JOURNAL_REPOSITORY_TOKEN) private readonly journal: Pick<IJournalRepository, 'listEntriesBySource'>,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'postBusinessEvent' | 'reverse'>,
	) {}

	async createSchedules(
		tx: TTx,
		input: { organizationId: string; invoiceId: string; issueEntryId: string; schedules: TDeferredScheduleInput[] },
	): Promise<void> {
		await this.schedules.insertMany(
			input.schedules.map((schedule) => ({
				organizationId: input.organizationId,
				invoiceId: input.invoiceId,
				invoiceItemId: schedule.invoiceItemId,
				issueEntryId: input.issueEntryId,
				discriminatorType: schedule.discriminatorType,
				discriminatorValue: schedule.discriminatorValue,
				totalAmount: schedule.amount,
				recognizedAmount: 0,
				startDate: schedule.startDate,
				endDate: schedule.endDate,
				recognizedThrough: null,
				status: 'active',
			})),
			tx,
		);
	}

	async cancelForInvoice(tx: TTx, organizationId: string, invoiceId: string, actorUserId: string): Promise<void> {
		const rows = await this.schedules.listByInvoice(organizationId, invoiceId, tx);
		for (const schedule of rows) {
			if (schedule.status === 'cancelled') continue;
			const entries = await this.journal.listEntriesBySource(organizationId, DEFERRED_REVENUE_SOURCE, schedule.id, tx);
			for (const entry of entries) {
				if (entry.status === 'posted' && !entry.reversedByEntryId) {
					await this.posting.reverse(tx, organizationId, entry.id, actorUserId, {
						description: `Invoice void: reversal of deferred revenue ${entry.code}`,
					});
				}
			}
			await this.schedules.update(organizationId, schedule.id, { status: 'cancelled' }, tx);
		}
	}

	list(request: TDeferredRevenuePaginationRequest) {
		return this.schedules.paginate(request);
	}

	/** Schedules still owing an amortisation for `YYYY-MM` (period lock gate). */
	countPending(organizationId: string, month: string): Promise<number> {
		return this.schedules.countPending(organizationId, month, monthEnd(month));
	}

	/** Amortises every due schedule through `year`-`month`. */
	async runMonth(ctx: { organizationId: string; actorUserId: string }, year: number, month: number): Promise<TAmortisationRunResult> {
		if (month < 1 || month > 12) throw new ReportPeriodInvalidError();
		const target = `${year}-${String(month).padStart(2, '0')}`;
		const due = await this.schedules.listDue(ctx.organizationId, target, monthEnd(target));
		let entries = 0;
		let amount = 0;
		for (const schedule of due) {
			const result = await this.catchUp(ctx, schedule, target);
			entries += result.entries;
			amount += result.amount;
		}
		return { month: target, schedules: due.length, entries, amount };
	}

	private async catchUp(
		ctx: { organizationId: string; actorUserId: string },
		schedule: TDeferredRevenueScheduleSelect,
		target: string,
	): Promise<{ entries: number; amount: number }> {
		const months = monthsBetween(schedule.startDate, schedule.endDate);
		const lastMonth = months[months.length - 1];
		let month = schedule.recognizedThrough ? nextMonth(schedule.recognizedThrough) : months[0];
		let recognized = schedule.recognizedAmount;
		let entries = 0;
		let amount = 0;
		while (month <= target && month <= lastMonth) {
			const portion = amortisationForMonth(schedule.totalAmount, schedule.startDate, schedule.endDate, month);
			const current = month;
			await this.transactions.run(async (tx) => {
				if (portion > 0) {
					await this.posting.postBusinessEvent(tx, {
						organizationId: ctx.organizationId,
						entryDate: monthEnd(current),
						sourceModule: 'finance',
						sourceType: DEFERRED_REVENUE_SOURCE,
						sourceId: schedule.id,
						idempotencyKey: `deferred:${schedule.id}:${current}`,
						eventType: 'finance.deferred_revenue_recognized',
						description: `Deferred revenue ${current}`,
						actorUserId: ctx.actorUserId,
						lines: [
							{ role: 'deferred_revenue', debit: portion, credit: 0 },
							{
								role: 'revenue',
								discriminatorType: schedule.discriminatorType || null,
								discriminatorValue: schedule.discriminatorValue || null,
								debit: 0,
								credit: portion,
							},
						],
					});
				}
				recognized += portion;
				await this.schedules.update(
					ctx.organizationId,
					schedule.id,
					{
						recognizedAmount: recognized,
						recognizedThrough: current,
						status: current === lastMonth ? 'completed' : 'active',
					},
					tx,
				);
			});
			if (portion > 0) entries += 1;
			amount += portion;
			month = nextMonth(month);
		}
		return { entries, amount };
	}
}

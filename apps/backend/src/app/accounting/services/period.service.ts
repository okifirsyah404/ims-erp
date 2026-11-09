import type { TAccountingPeriodSelect } from '@drizzle/schemas/accounting.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { LEDGER_REPOSITORY_TOKEN } from '../constants/di';
import type { LedgerRepository } from '../repositories/ledger.repository';
import {
	PeriodNotFoundError,
	PeriodTransitionError,
} from '../errors/ledger.errors';

export type TPeriodTransitionContext = {
	organizationId: string;
	actorUserId: string;
};

/** Allowed period transitions. `locked → open` is owner-only (guard level). */
const PERIOD_TRANSITIONS: Record<string, readonly string[]> = {
	open: ['closed'],
	closed: ['locked', 'open'],
	locked: ['open'],
};

/**
 * Accounting-period application service (M09 F2).
 *
 * @remarks
 * A period is one calendar month, created lazily (the first posting into a
 * month may create it, or it is created explicitly here). Closing computes
 * the `account_balances` snapshot (finance plan D7: balances are a
 * period-close snapshot, never incrementally maintained) and then flips the
 * status. Reopening is allowed from `closed` and `locked` (the route guard
 * restricts `locked → open` to owner) and is audited through the actor
 * stamping on the row.
 */
@injectable()
export class PeriodService {
	constructor(
		@inject(LEDGER_REPOSITORY_TOKEN) private readonly repo: LedgerRepository,
	) {}

	async listPeriods(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TAccountingPeriodSelect>> {
		return this.repo.listPeriods(organizationId, pagination);
	}

	async getPeriod(
		organizationId: string,
		id: string,
	): Promise<TAccountingPeriodSelect> {
		const row = await this.repo.findPeriodById(organizationId, id);
		if (!row) throw new PeriodNotFoundError();
		return row;
	}

	/** Explicitly creates (or returns the existing) period for a month. */
	async ensurePeriod(
		organizationId: string,
		year: number,
		month: number,
	): Promise<TAccountingPeriodSelect> {
		const existing = await this.repo.findPeriodByMonth(
			organizationId,
			year,
			month,
		);
		if (existing) return existing;

		const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
		const endDate = new Date(Date.UTC(year, month, 0))
			.toISOString()
			.slice(0, 10);
		return this.repo.insertPeriod({
			organizationId,
			code: `${year}-${String(month).padStart(2, '0')}`,
			periodYear: year,
			periodMonth: month,
			startDate,
			endDate,
			status: 'open',
		});
	}

	/**
	 * Moves a period through `open → closed → locked` and back.
	 *
	 * @remarks Closing to `closed` writes the per-account balance snapshot
	 * first (D7). The `locked → open` transition is owner-only at the route
	 * guard and audited via `reopened_by`/`reopened_at`.
	 */
	async transition(
		organizationId: string,
		periodId: string,
		to: 'closed' | 'locked' | 'open',
		ctx: TPeriodTransitionContext,
	): Promise<TAccountingPeriodSelect> {
		const period = await this.repo.findPeriodById(organizationId, periodId);
		if (!period) throw new PeriodNotFoundError();

		const allowed = PERIOD_TRANSITIONS[period.status] ?? [];
		if (!allowed.includes(to)) throw new PeriodTransitionError();

		const now = new Date();

		if (to === 'closed') {
			await this.snapshotBalances(organizationId, period);
			return (
				(await this.repo.updatePeriodStatus(organizationId, period.id, {
					status: 'closed',
					closedBy: ctx.actorUserId,
					closedAt: now,
				})) ?? period
			);
		}
		if (to === 'locked') {
			return (
				(await this.repo.updatePeriodStatus(organizationId, period.id, {
					status: 'locked',
				})) ?? period
			);
		}
		// reopen
		return (
			(await this.repo.updatePeriodStatus(organizationId, period.id, {
				status: 'open',
				reopenedBy: ctx.actorUserId,
				reopenedAt: now,
			})) ?? period
		);
	}

	/**
	 * Writes the `account_balances` snapshot for every account touched by
	 * posted entries in the period (finance plan D7 — computed from
	 * `journal_lines` at close time, never maintained incrementally).
	 */
	private async snapshotBalances(
		organizationId: string,
		period: TAccountingPeriodSelect,
	): Promise<void> {
		const totals = await this.repo.accountTotalsForPeriod(
			organizationId,
			period.id,
		);
		const calculatedAt = new Date();
		for (const total of totals) {
			await this.repo.upsertAccountBalance({
				organizationId,
				accountId: total.accountId,
				accountingPeriodId: period.id,
				balanceDate: period.endDate,
				debitTotal: Number(total.debit),
				creditTotal: Number(total.credit),
				closingBalance: Number(total.debit) - Number(total.credit),
				currencyCode: 'IDR',
				calculatedAt,
			});
		}
	}
}

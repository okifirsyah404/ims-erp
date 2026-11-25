import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import {
	REPORT_ARCHIVE_TYPES,
	type ReportArchiveType,
	type TReportArchiveSelect,
} from '@drizzle/schemas/finance.schema';
import { REPORT_ARCHIVE_REPOSITORY_TOKEN, REPORT_SERVICE_TOKEN } from '../constants/ar-di';
import { ACCOUNTING_PERIOD_REPOSITORY_TOKEN, MANAGEMENT_PACK_SERVICE_TOKEN } from '../constants/di';
import type { TReportArchivePaginationRequest } from '../repositories/report-archive.repository';
import type { IAccountingPeriodRepository } from '../contracts/accounting-period.repository.interface';
import type { ReportArchiveRepository } from '../repositories/report-archive.repository';
import type { ManagementPackService } from './management-pack.service';
import type { ReportService } from './report.service';
import {
	ReportArchiveNotFoundError,
	ReportArchivePeriodOpenError,
	PeriodNotFoundError,
} from '../errors/ledger.errors';

export type TReportArchiveContext = {
	organizationId: string;
	actorUserId: string | null;
};

/** One calendar month resolved to the date range the statements use. */
const monthRange = (year: number, month: number) => {
	const pad = String(month).padStart(2, '0');
	const startDate = `${year}-${pad}-01`;
	const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
	return { startDate, endDate };
};

/**
 * Monthly report archive (M12 T30, SOP S13).
 *
 * @remarks
 * Archives the three financial statements (and, since ERP-0152, the
 * management pack) of a **closed** month as immutable
 * `accounting.report_archives` rows, so the figures the owner approved cannot
 * drift after a later posting. The payload is the `ReportService` output
 * verbatim - no reshaping, no stored totals that could disagree with it.
 *
 * Re-archiving is safe: the scope index
 * `(organization_id, period_year, period_month, report_type)` makes the insert
 * idempotent, so closing twice or closing after a reopen writes nothing new.
 */
@injectable()
export class ReportArchiveService {
	constructor(
		@inject(REPORT_ARCHIVE_REPOSITORY_TOKEN)
		private readonly repo: ReportArchiveRepository,
		@inject(ACCOUNTING_PERIOD_REPOSITORY_TOKEN)
		private readonly periods: IAccountingPeriodRepository,
		@inject(REPORT_SERVICE_TOKEN)
		private readonly reports: ReportService,
		/** ERP-0152: archives the management pack too; optional for older tests. */
		@inject(MANAGEMENT_PACK_SERVICE_TOKEN)
		private readonly managementPack?: Pick<ManagementPackService, 'build'>,
	) {}

	/**
	 * Freezes the three statements for a closed month.
	 *
	 * @returns The rows created by this call; empty when the month was already
	 * archived (idempotent re-close).
	 */
	async archivePeriod(
		ctx: TReportArchiveContext,
		periodYear: number,
		periodMonth: number,
	): Promise<TReportArchiveSelect[]> {
		const period = await this.periods.findPeriodByMonth(
			ctx.organizationId,
			periodYear,
			periodMonth,
		);
		if (!period) throw new PeriodNotFoundError();
		if (period.status === 'open') {
			throw new ReportArchivePeriodOpenError(periodYear, periodMonth);
		}

		const { startDate, endDate } = monthRange(periodYear, periodMonth);
		const generatedAt = new Date();
		const payloads: Array<[ReportArchiveType, unknown]> = [
			[
				'profit_and_loss',
				await this.reports.profitAndLoss(
					{ organizationId: ctx.organizationId },
					startDate,
					endDate,
				),
			],
			[
				'balance_sheet',
				await this.reports.balanceSheet(
					{ organizationId: ctx.organizationId },
					endDate,
				),
			],
			[
				'cash_flow',
				await this.reports.cashFlow(
					{ organizationId: ctx.organizationId },
					startDate,
					endDate,
				),
			],
		];
		if (this.managementPack) {
			payloads.push(['management_pack', await this.managementPack.build(ctx.organizationId, periodYear, periodMonth)]);
		}

		const created: TReportArchiveSelect[] = [];
		for (const [reportType, payload] of payloads) {
			const row = await this.repo.insert({
				organizationId: ctx.organizationId,
				periodYear,
				periodMonth,
				reportType,
				payload,
				generatedBy: ctx.actorUserId,
				generatedAt,
			});
			if (row) created.push(row);
		}
		return created;
	}

	/** Fetches one page of archived reports. */
	async list(
		request: TReportArchivePaginationRequest,
	): Promise<TPaginationResult<TReportArchiveSelect>> {
		return this.repo.paginate(request);
	}

	async get(organizationId: string, id: string): Promise<TReportArchiveSelect> {
		const row = await this.repo.findById(organizationId, id);
		if (!row) throw new ReportArchiveNotFoundError();
		return row;
	}

	/** Exposed so the UI can render the type list without a second contract. */
	readonly reportTypes = REPORT_ARCHIVE_TYPES;
}

import { EXPORTED_PAYROLL_SERVICE_TOKEN } from '@app/human-resource/constants/di';
import type { ExportedPayrollService } from '@app/human-resource/services/exported-payroll.service';
import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectLookupService } from '@app/project/services/project-lookup.service';
import { inject, injectable } from 'tsyringe';
import { CASH_FORECAST_REPOSITORY_TOKEN, STATEMENT_REPOSITORY_TOKEN } from '../constants/di';
import type { ICashForecastRepository } from '../contracts/cash-forecast.contract';
import type { IStatementRepository } from '../contracts/statement.contract';

const DAY = 86_400_000;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const WEEKS = 13;

type TFlows = { receivables: number; manualIn: number; payables: number; payroll: number; statutory: number; manualOut: number };

/** The day `payDay` of a month, clamped to its last day. */
function payDate(year: number, month: number, payDay: number): string {
	const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(payDay, last)).padStart(2, '0')}`;
}

/**
 * 13-week cash-flow forecast (ERP-0149).
 *
 * @remarks
 * Starts from today's cash (the ledger balance of the cash accounts used by
 * the statements) and rolls 13 weeks forward: open receivables and payables
 * on their due dates (overdue or undated ones in week 1), payroll at the
 * latest approved month's run-rate - net pay on payday (month end when none
 * is set), PPh 21 and BPJS on the 10th of the next month - and the manual
 * lines. Licence contracts ending in the horizon are listed for finance to
 * add their expected amounts as manual lines (contracts carry no amount).
 */
@injectable()
export class CashForecastService {
	constructor(
		@inject(CASH_FORECAST_REPOSITORY_TOKEN) private readonly repo: ICashForecastRepository,
		@inject(STATEMENT_REPOSITORY_TOKEN) private readonly statements: Pick<IStatementRepository, 'cashAccountIds' | 'activity'>,
		@inject(EXPORTED_PAYROLL_SERVICE_TOKEN) private readonly payroll: Pick<ExportedPayrollService, 'payrollEstimate'>,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN) private readonly projects: Pick<ProjectLookupService, 'renewalsDue'>,
	) {}

	async forecast(organizationId: string, today: string) {
		const horizonEnd = addDays(today, WEEKS * 7 - 1);
		const weeks = Array.from({ length: WEEKS }, (_, index) => ({
			week: index + 1,
			start: addDays(today, index * 7),
			end: addDays(today, index * 7 + 6),
			flows: { receivables: 0, manualIn: 0, payables: 0, payroll: 0, statutory: 0, manualOut: 0 } as TFlows,
		}));
		const bucket = (date: string | null) => {
			if (!date || date < today) return weeks[0];
			return weeks.find((week) => date >= week.start && date <= week.end) ?? null;
		};

		for (const item of await this.repo.openReceivables(organizationId)) {
			const week = bucket(item.dueDate);
			if (week) week.flows.receivables += item.outstanding;
		}
		for (const item of await this.repo.openPayables(organizationId)) {
			const week = bucket(item.dueDate);
			if (week) week.flows.payables += item.outstanding;
		}
		for (const line of await this.repo.listLines(organizationId, today, horizonEnd)) {
			const week = bucket(line.expectedDate);
			if (!week) continue;
			if (line.direction === 'in') week.flows.manualIn += line.amount;
			else week.flows.manualOut += line.amount;
		}

		const estimate = await this.payroll.payrollEstimate();
		if (estimate) {
			const [startYear, startMonth] = today.split('-').map(Number) as [number, number];
			for (let offset = 0; offset < 5; offset += 1) {
				const month = ((startMonth - 1 + offset) % 12) + 1;
				const year = startYear + Math.floor((startMonth - 1 + offset) / 12);
				const pay = payDate(year, month, estimate.payDay ?? 31);
				const statutoryDate = payDate(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 10);
				if (pay >= today) {
					const week = bucket(pay);
					if (week) week.flows.payroll += estimate.net;
				}
				if (statutoryDate >= today) {
					const week = bucket(statutoryDate);
					if (week) week.flows.statutory += estimate.statutory;
				}
			}
		}

		const cashIds = new Set(await this.statements.cashAccountIds(organizationId));
		const openingCash = (await this.statements.activity(organizationId, '0001-01-01', today))
			.filter((row) => cashIds.has(row.accountId))
			.reduce((sum, row) => sum + row.debit - row.credit, 0);
		let balance = openingCash;
		const rows = weeks.map((week) => {
			const inflow = week.flows.receivables + week.flows.manualIn;
			const outflow = week.flows.payables + week.flows.payroll + week.flows.statutory + week.flows.manualOut;
			const opening = balance;
			balance += inflow - outflow;
			return { week: week.week, start: week.start, end: week.end, ...week.flows, inflow, outflow, net: inflow - outflow, opening, closing: balance };
		});
		const lowest = rows.reduce((low, row) => (row.closing < low.closing ? row : low), rows[0]!);
		return {
			today,
			openingCash,
			weeks: rows,
			lowestWeek: { week: lowest.week, closing: lowest.closing },
			payrollBasis: estimate ? { period: estimate.period, net: estimate.net, statutory: estimate.statutory, payDay: estimate.payDay } : null,
			renewalsDue: await this.projects.renewalsDue(horizonEnd),
		};
	}

	listLines(organizationId: string, from: string, to: string) {
		return this.repo.listLines(organizationId, from, to);
	}

	addLine(ctx: { organizationId: string; actorUserId: string }, input: { expectedDate: string; direction: 'in' | 'out'; amount: number; description: string }) {
		return this.repo.insertLine({ ...input, organizationId: ctx.organizationId, createdBy: ctx.actorUserId });
	}

	removeLine(organizationId: string, id: string) {
		return this.repo.removeLine(organizationId, id);
	}
}

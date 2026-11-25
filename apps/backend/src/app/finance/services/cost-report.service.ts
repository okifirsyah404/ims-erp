import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectLookupService } from '@app/project/services/project-lookup.service';
import { inject, injectable } from 'tsyringe';
import { COST_REPORT_REPOSITORY_TOKEN, PROJECT_BUDGET_REPOSITORY_TOKEN } from '../constants/di';
import type { ICostReportRepository } from '../contracts/cost-report.contract';
import type { IProjectBudgetRepository } from '../contracts/project-budget.contract';

/**
 * Cost accounting reports from the general ledger (ERP-0147): project job
 * costing (revenue, cost, margin and the active budget per project) and the
 * cost-centre P&L. Read-only, over the line dimensions `project_id` and
 * `cost_center_id` of posted journal lines in a date range.
 */
@injectable()
export class CostReportService {
	constructor(
		@inject(COST_REPORT_REPOSITORY_TOKEN) private readonly repo: ICostReportRepository,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN) private readonly projects: Pick<ProjectLookupService, 'getProject'>,
		@inject(PROJECT_BUDGET_REPOSITORY_TOKEN) private readonly budgets: Pick<IProjectBudgetRepository, 'findActive' | 'listLines'>,
	) {}

	async projectCosting(organizationId: string, from: string, to: string) {
		const rows = [];
		for (const row of await this.repo.byProject(organizationId, from, to)) {
			const project = await this.projects.getProject(row.projectId);
			const active = await this.budgets.findActive(organizationId, row.projectId);
			const budget = active ? (await this.budgets.listLines(organizationId, active.id)).reduce((sum, line) => sum + line.amount, 0) : null;
			const margin = row.revenue - row.cost;
			rows.push({
				projectId: row.projectId,
				code: project?.code ?? null,
				title: project?.title ?? null,
				revenue: row.revenue,
				cost: row.cost,
				margin,
				/** Basis points of revenue; null without revenue. */
				marginBps: row.revenue > 0 ? Math.round((margin * 10_000) / row.revenue) : null,
				budget,
			});
		}
		return { from, to, rows: rows.sort((a, b) => b.cost - a.cost) };
	}

	async projectDetail(organizationId: string, projectId: string, from: string, to: string) {
		return { projectId, from, to, rows: await this.repo.projectAccounts(organizationId, projectId, from, to) };
	}

	/** Lines without a cost centre are reported as the unassigned row, listed last. */
	async costCenterPl(organizationId: string, from: string, to: string) {
		const rows = (await this.repo.byCostCenter(organizationId, from, to)).map((row) => ({ ...row, result: row.revenue - row.cost }));
		rows.sort((a, b) => (a.costCenterId === null ? 1 : b.costCenterId === null ? -1 : (a.code ?? '').localeCompare(b.code ?? '')));
		return {
			from,
			to,
			rows,
			totals: {
				revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
				cost: rows.reduce((sum, row) => sum + row.cost, 0),
				result: rows.reduce((sum, row) => sum + row.result, 0),
			},
		};
	}
}

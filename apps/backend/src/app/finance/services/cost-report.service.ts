import { EXPORTED_CUSTOMER_SERVICE_TOKEN } from '@app/customer/constants/di';
import type { ExportedCustomerService } from '@app/customer/services/exported-customer.service';
import { EXPORTED_PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ExportedProductService } from '@app/product/services/exported-product.service';
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
		/** ERP-0150: names for the customer, product and business-line views; optional for older tests. */
		@inject(EXPORTED_CUSTOMER_SERVICE_TOKEN) private readonly customers?: Pick<ExportedCustomerService, 'assertCustomer'>,
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN) private readonly products?: Pick<ExportedProductService, 'productsById' | 'categoryNames'>,
	) {}

	/**
	 * Profitability by project, customer, product or business line (product
	 * category) for a date range (ERP-0150). Revenue and cost come from the
	 * dimensions on the journal lines; what carries no such dimension (most
	 * overheads, and lines posted before the dimension existed) is reported as
	 * the unassigned row, so the rows always add up to the P&L.
	 */
	async profitability(organizationId: string, from: string, to: string, dimension: 'project' | 'customer' | 'product' | 'business_line') {
		const raw = await this.repo.byDimension(organizationId, from, to, dimension === 'business_line' ? 'product' : dimension);
		let rows: Array<{ key: string | null; revenue: number; cost: number }> = raw;
		const labels = new Map<string, string>();
		if (dimension === 'product' || dimension === 'business_line') {
			const products = this.products ? await this.products.productsById(raw.map((row) => row.key).filter((key): key is string => !!key)) : new Map();
			if (dimension === 'product') {
				for (const [id, product] of products) labels.set(id, `${product.code} — ${product.name}`);
			} else {
				const grouped = new Map<string | null, { key: string | null; revenue: number; cost: number }>();
				for (const row of raw) {
					const category = row.key ? (products.get(row.key)?.productCategoryId ?? null) : null;
					const current = grouped.get(category) ?? { key: category, revenue: 0, cost: 0 };
					current.revenue += row.revenue;
					current.cost += row.cost;
					grouped.set(category, current);
				}
				rows = [...grouped.values()];
				const names = this.products ? await this.products.categoryNames(rows.map((row) => row.key).filter((key): key is string => !!key)) : new Map<string, string>();
				for (const [id, name] of names) labels.set(id, name);
			}
		} else if (dimension === 'project') {
			for (const row of raw) {
				if (!row.key) continue;
				const project = await this.projects.getProject(row.key);
				if (project) labels.set(row.key, `${project.code} — ${project.title}`);
			}
		} else if (this.customers) {
			for (const row of raw) {
				if (!row.key) continue;
				const customer = await this.customers.assertCustomer(row.key).catch(() => null);
				if (customer) labels.set(row.key, `${customer.code} — ${customer.name}`);
			}
		}
		const result = rows
			.filter((row) => row.revenue !== 0 || row.cost !== 0)
			.map((row) => {
				const margin = row.revenue - row.cost;
				return {
					key: row.key,
					label: row.key ? (labels.get(row.key) ?? row.key) : null,
					revenue: row.revenue,
					cost: row.cost,
					margin,
					marginBps: row.revenue > 0 ? Math.round((margin * 10_000) / row.revenue) : null,
				};
			})
			.sort((a, b) => (a.key === null ? 1 : b.key === null ? -1 : b.margin - a.margin));
		return {
			from,
			to,
			dimension,
			rows: result,
			totals: {
				revenue: result.reduce((sum, row) => sum + row.revenue, 0),
				cost: result.reduce((sum, row) => sum + row.cost, 0),
				margin: result.reduce((sum, row) => sum + row.margin, 0),
			},
		};
	}

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

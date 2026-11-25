import { EXPORTED_PURCHASE_ORDER_SERVICE_TOKEN } from '@app/procurement/constants/di';
import type { ExportedPurchaseOrderService } from '@app/procurement/services/exported-purchase-order.service';
import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectLookupService } from '@app/project/services/project-lookup.service';
import type { TProjectBudgetLineSelect, TProjectBudgetSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { PROJECT_BUDGET_REPOSITORY_TOKEN } from '../constants/di';
import type { IProjectBudgetRepository, TBudgetCheck, TBudgetLineInput } from '../contracts/project-budget.contract';
import { ProjectBudgetExceededError, ProjectBudgetNotFoundError, ProjectBudgetProjectError, ProjectBudgetStateError } from '../errors/project-budget.errors';

export type TBudgetContext = { organizationId: string; actorUserId: string };

/**
 * Project budgets (ERP-0146, grill decision on budgets).
 *
 * @remarks
 * Project x account x month, versioned: one draft is edited, activating it
 * supersedes the previous active version. Actual is the posted journal
 * movement of expense accounts tagged with the project; commitment is every
 * approved purchase order of the project not yet billed. The check runs at
 * purchase-order approval, expense-claim submission and project-cost entry
 * against the active version's total: `warn` lets the action through (the
 * report shows the overrun), `block` refuses it. Projects are company-wide,
 * so a project has at most one active budget across organizations; the
 * organization that owns it is the ledger the actuals and bills come from.
 */
@injectable()
export class ProjectBudgetService {
	constructor(
		@inject(PROJECT_BUDGET_REPOSITORY_TOKEN) private readonly repo: IProjectBudgetRepository,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN) private readonly projects: Pick<ProjectLookupService, 'getProject'>,
		@inject(EXPORTED_PURCHASE_ORDER_SERVICE_TOKEN) private readonly orders: Pick<ExportedPurchaseOrderService, 'openOrdersOfProject'>,
	) {}

	/** Projects are company-wide; the project must exist. */
	private async project(_organizationId: string, projectId: string) {
		const project = await this.projects.getProject(projectId);
		if (!project) throw new ProjectBudgetProjectError();
		return project;
	}

	async versions(organizationId: string, projectId: string): Promise<Array<TProjectBudgetSelect & { lines: TProjectBudgetLineSelect[] }>> {
		await this.project(organizationId, projectId);
		const versions = await this.repo.listVersions(organizationId, projectId);
		return Promise.all(versions.map(async (version) => ({ ...version, lines: await this.repo.listLines(organizationId, version.id) })));
	}

	async createVersion(ctx: TBudgetContext, projectId: string, input: { controlMode: 'warn' | 'block'; notes: string | null; copyFromActive: boolean }) {
		await this.project(ctx.organizationId, projectId);
		return this.transactions.run(async (tx) => {
			const versions = await this.repo.listVersions(ctx.organizationId, projectId);
			if (versions.some((version) => version.status === 'draft')) throw new ProjectBudgetStateError('draftExists');
			const active = versions.find((version) => version.status === 'active');
			const budget = await this.repo.insertBudget(
				{
					organizationId: ctx.organizationId,
					projectId,
					version: (versions[0]?.version ?? 0) + 1,
					status: 'draft',
					controlMode: input.controlMode,
					notes: input.notes,
					createdBy: ctx.actorUserId,
				},
				tx,
			);
			if (input.copyFromActive && active) {
				const lines = await this.repo.listLines(ctx.organizationId, active.id, tx);
				await this.repo.replaceLines(
					ctx.organizationId,
					budget.id,
					lines.map((line) => ({ accountId: line.accountId, period: line.period, amount: line.amount })),
					tx,
				);
			}
			return budget;
		});
	}

	private async draft(organizationId: string, id: string, tx?: TTx) {
		const budget = await this.repo.findBudget(organizationId, id, tx);
		if (!budget) throw new ProjectBudgetNotFoundError();
		if (budget.status !== 'draft') throw new ProjectBudgetStateError('notDraft');
		return budget;
	}

	async replaceLines(ctx: TBudgetContext, id: string, lines: TBudgetLineInput[]) {
		const keys = new Set(lines.map((line) => `${line.accountId}|${line.period}`));
		if (keys.size !== lines.length) throw new ProjectBudgetStateError('duplicateLine');
		await this.transactions.run(async (tx) => {
			await this.draft(ctx.organizationId, id, tx);
			await this.repo.replaceLines(ctx.organizationId, id, lines, tx);
		});
		return this.repo.listLines(ctx.organizationId, id);
	}

	/** draft -> active; the previous active version is superseded. */
	async activate(ctx: TBudgetContext, id: string) {
		return this.transactions.run(async (tx) => {
			const budget = await this.draft(ctx.organizationId, id, tx);
			const active = await this.repo.findActive(ctx.organizationId, budget.projectId as string, tx);
			if (active) await this.repo.updateBudget(ctx.organizationId, active.id, { status: 'superseded' }, tx);
			return this.repo.updateBudget(ctx.organizationId, id, { status: 'active', activatedBy: ctx.actorUserId, activatedAt: new Date() }, tx);
		});
	}

	async setControlMode(ctx: TBudgetContext, id: string, controlMode: 'warn' | 'block') {
		const budget = await this.repo.findBudget(ctx.organizationId, id);
		if (!budget || budget.status === 'superseded') throw new ProjectBudgetNotFoundError();
		return this.repo.updateBudget(ctx.organizationId, id, { controlMode });
	}

	private async commitment(organizationId: string, projectId: string, excludePurchaseOrderId?: string): Promise<number> {
		const orders = (await this.orders.openOrdersOfProject(projectId)).filter((order) => order.id !== excludePurchaseOrderId);
		const billed = await this.repo.billedByOrder(organizationId, orders.map((order) => order.id));
		return orders.reduce((sum, order) => sum + Math.max(0, order.subtotal - (billed.get(order.id) ?? 0)), 0);
	}

	/**
	 * Budget vs actual per account and month, plus the commitment and the
	 * totals of the active version.
	 */
	async report(organizationId: string, projectId: string) {
		await this.project(organizationId, projectId);
		const active = await this.repo.findActive(organizationId, projectId);
		const lines = active ? await this.repo.listLines(organizationId, active.id) : [];
		const actuals = await this.repo.actuals(organizationId, projectId);
		const rows = new Map<string, { accountId: string; period: string; budget: number; actual: number }>();
		for (const line of lines) rows.set(`${line.accountId}|${line.period}`, { accountId: line.accountId, period: line.period, budget: line.amount, actual: 0 });
		for (const actual of actuals) {
			const key = `${actual.accountId}|${actual.period}`;
			const row = rows.get(key) ?? { accountId: actual.accountId, period: actual.period, budget: 0, actual: 0 };
			row.actual += actual.amount;
			rows.set(key, row);
		}
		const budget = lines.reduce((sum, line) => sum + line.amount, 0);
		const actual = actuals.reduce((sum, row) => sum + row.amount, 0);
		const commitment = await this.commitment(organizationId, projectId);
		return {
			budget: active,
			rows: [...rows.values()].sort((a, b) => a.period.localeCompare(b.period) || a.accountId.localeCompare(b.accountId)),
			totals: { budget, actual, commitment, available: budget - actual - commitment },
		};
	}

	/**
	 * Checks `amount` against the project's active budget. Called by
	 * procurement (PO approval), finance (claim submit) and project (cost
	 * entry); `block` throws, `warn` returns the figures.
	 */
	async check(input: { projectId: string; amount: number; excludePurchaseOrderId?: string }): Promise<TBudgetCheck | null> {
		// Projects are company-wide; the one active budget of the project decides
		// which organization's ledger and bills count.
		const active = await this.repo.findActiveByProject(input.projectId);
		if (!active?.organizationId) return null;
		const organizationId = active.organizationId;
		const budget = (await this.repo.listLines(organizationId, active.id)).reduce((sum, line) => sum + line.amount, 0);
		const actual = (await this.repo.actuals(organizationId, input.projectId)).reduce((sum, row) => sum + row.amount, 0);
		const commitment = await this.commitment(organizationId, input.projectId, input.excludePurchaseOrderId);
		const available = budget - actual - commitment;
		const exceeded = input.amount > available;
		if (exceeded && active.controlMode === 'block') throw new ProjectBudgetExceededError(Math.max(available, 0) / 100);
		return { budgetId: active.id, controlMode: active.controlMode, budget, actual, commitment, available, amount: input.amount, exceeded };
	}
}

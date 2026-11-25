/**
 * Project budgets (ERP-0146): versions, actual + commitment, warn / block.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { ProjectBudgetService } from '../../src/app/finance/services/project-budget.service';
import { ProjectBudgetExceededError, ProjectBudgetStateError } from '../../src/app/finance/errors/project-budget.errors';

const rp = (rupiah: number) => rupiah * 100;
const ctx = { organizationId: 'org-1', actorUserId: 'acc' };

function harness() {
	const budgets: Array<Record<string, any>> = [];
	const lines: Array<Record<string, any>> = [];
	let actuals: Array<{ accountId: string; period: string; amount: number }> = [];
	let orders: Array<{ id: string; subtotal: number }> = [];
	let billed = new Map<string, number>();
	const service = new ProjectBudgetService(
		{
			listVersions: async () => [...budgets].sort((a, b) => b.version - a.version) as never,
			findBudget: async (_o: string, id: string) => (budgets.find((b) => b.id === id) ?? null) as never,
			findActive: async () => (budgets.find((b) => b.status === 'active') ?? null) as never,
			findActiveByProject: async (projectId: string) => (budgets.find((b) => b.status === 'active' && b.projectId === projectId) ?? null) as never,
			listActiveBudgets: async () => budgets.filter((b) => b.status === 'active') as never,
			insertBudget: async (row: Record<string, unknown>) => {
				const created = { ...row, id: `b-${budgets.length + 1}` };
				budgets.push(created);
				return created as never;
			},
			updateBudget: async (_o: string, id: string, patch: Record<string, unknown>) => Object.assign(budgets.find((b) => b.id === id)!, patch) as never,
			listLines: async (_o: string, budgetId: string) => lines.filter((l) => l.projectBudgetId === budgetId && !l.deleted) as never,
			replaceLines: async (_o: string, budgetId: string, rows: Array<Record<string, unknown>>) => {
				for (const line of lines) if (line.projectBudgetId === budgetId) line.deleted = true;
				lines.push(...rows.map((row) => ({ ...row, projectBudgetId: budgetId })));
			},
			actuals: async () => actuals,
			billedByOrder: async () => billed,
		},
		{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
		{ getProject: async (id: string) => (id === 'prj-1' ? ({ id } as never) : null) },
		{ openOrdersOfProject: async () => orders },
	);
	return {
		service,
		budgets,
		set: (next: { actuals?: typeof actuals; orders?: typeof orders; billed?: Map<string, number> }) => {
			if (next.actuals) actuals = next.actuals;
			if (next.orders) orders = next.orders;
			if (next.billed) billed = next.billed;
		},
	};
}

describe('ProjectBudgetService', () => {
	test('versions: one draft at a time, activation supersedes, new drafts copy the active lines', async () => {
		const h = harness();
		const v1 = await h.service.createVersion(ctx, 'prj-1', { controlMode: 'warn', notes: null, copyFromActive: true });
		await expect(h.service.createVersion(ctx, 'prj-1', { controlMode: 'warn', notes: null, copyFromActive: true })).rejects.toThrow(ProjectBudgetStateError);
		await h.service.replaceLines(ctx, v1.id, [
			{ accountId: 'acc-6-2100', period: '2026-11', amount: rp(10_000_000) },
			{ accountId: 'acc-5-1200', period: '2026-12', amount: rp(5_000_000) },
		]);
		await expect(
			h.service.replaceLines(ctx, v1.id, [
				{ accountId: 'a', period: '2026-11', amount: 1 },
				{ accountId: 'a', period: '2026-11', amount: 2 },
			]),
		).rejects.toThrow(ProjectBudgetStateError);
		await h.service.activate(ctx, v1.id);
		await expect(h.service.replaceLines(ctx, v1.id, [])).rejects.toThrow(ProjectBudgetStateError);
		const v2 = await h.service.createVersion(ctx, 'prj-1', { controlMode: 'block', notes: 'Revisi', copyFromActive: true });
		await h.service.activate(ctx, v2.id);
		expect(h.budgets.map((b) => [b.version, b.status])).toEqual([
			[1, 'superseded'],
			[2, 'active'],
		]);
		const versions = await h.service.versions('org-1', 'prj-1');
		expect(versions[0]!.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(rp(15_000_000));
	});

	test('check: actual plus unbilled commitment; warn passes, block refuses', async () => {
		const h = harness();
		const v1 = await h.service.createVersion(ctx, 'prj-1', { controlMode: 'warn', notes: null, copyFromActive: false });
		await h.service.replaceLines(ctx, v1.id, [{ accountId: 'acc-6-2100', period: '2026-11', amount: rp(10_000_000) }]);
		await h.service.activate(ctx, v1.id);
		h.set({
			actuals: [{ accountId: 'acc-6-2100', period: '2026-11', amount: rp(4_000_000) }],
			orders: [
				{ id: 'po-1', subtotal: rp(3_000_000) },
				{ id: 'po-2', subtotal: rp(2_000_000) },
			],
			billed: new Map([['po-1', rp(1_000_000)]]),
		});
		const warn = await h.service.check({ projectId: 'prj-1', amount: rp(2_000_000) });
		expect(warn).toMatchObject({ budget: rp(10_000_000), actual: rp(4_000_000), commitment: rp(4_000_000), available: rp(2_000_000), exceeded: false });
		expect((await h.service.check({ projectId: 'prj-1', amount: rp(2_500_000) }))?.exceeded).toBe(true);
		// The order being approved is not its own commitment.
		expect((await h.service.check({ projectId: 'prj-1', amount: rp(2_000_000), excludePurchaseOrderId: 'po-2' }))?.available).toBe(rp(4_000_000));
		await h.service.setControlMode(ctx, v1.id, 'block');
		await expect(h.service.check({ projectId: 'prj-1', amount: rp(2_500_000) })).rejects.toThrow(ProjectBudgetExceededError);
		expect(await h.service.check({ projectId: 'prj-other', amount: 1 })).toBeNull();
	});

	test('report joins budget and actual per account and month', async () => {
		const h = harness();
		const v1 = await h.service.createVersion(ctx, 'prj-1', { controlMode: 'warn', notes: null, copyFromActive: false });
		await h.service.replaceLines(ctx, v1.id, [{ accountId: 'acc-6-2100', period: '2026-11', amount: rp(10_000_000) }]);
		await h.service.activate(ctx, v1.id);
		h.set({ actuals: [{ accountId: 'acc-6-2100', period: '2026-11', amount: rp(4_000_000) }, { accountId: 'acc-5-1200', period: '2026-11', amount: rp(500_000) }] });
		const report = await h.service.report('org-1', 'prj-1');
		expect(report.rows).toEqual([
			{ accountId: 'acc-5-1200', period: '2026-11', budget: 0, actual: rp(500_000) },
			{ accountId: 'acc-6-2100', period: '2026-11', budget: rp(10_000_000), actual: rp(4_000_000) },
		]);
		expect(report.totals).toEqual({ budget: rp(10_000_000), actual: rp(4_500_000), commitment: 0, available: rp(5_500_000) });
	});
});

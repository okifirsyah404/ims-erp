import type { TProjectBudgetLineSelect, TProjectBudgetSelect, projectBudgets } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { z } from 'zod';

export const budgetCreateSchema = z.object({
	controlMode: z.enum(['warn', 'block']).default('warn'),
	notes: z.string().trim().max(1000).nullish().transform((v) => v ?? null),
	/** Starts from the lines of the active version. */
	copyFromActive: z.boolean().default(true),
});

export const budgetLinesSchema = z.object({
	lines: z
		.array(
			z.object({
				accountId: z.uuid(),
				period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
				amount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
			}),
		)
		.max(2000),
});

export const budgetModeSchema = z.object({ controlMode: z.enum(['warn', 'block']) });

export type TBudgetLineInput = z.output<typeof budgetLinesSchema>['lines'][number];

/** Result of a budget check (ERP-0146); `null` when the project has no active budget. */
export type TBudgetCheck = {
	budgetId: string;
	controlMode: 'warn' | 'block';
	budget: number;
	actual: number;
	commitment: number;
	available: number;
	amount: number;
	exceeded: boolean;
};

/** Persistence port of project budgets (ERP-0146). */
export interface IProjectBudgetRepository {
	listVersions(organizationId: string, projectId: string): Promise<TProjectBudgetSelect[]>;
	findBudget(organizationId: string, id: string, tx?: TTx): Promise<TProjectBudgetSelect | null>;
	findActive(organizationId: string, projectId: string, tx?: TTx): Promise<TProjectBudgetSelect | null>;
	/** The project's active budget whatever organization owns it (projects are company-wide). */
	findActiveByProject(projectId: string): Promise<TProjectBudgetSelect | null>;
	insertBudget(row: Omit<typeof projectBudgets.$inferInsert, 'createdAt' | 'updatedAt'>, tx?: TTx): Promise<TProjectBudgetSelect>;
	updateBudget(organizationId: string, id: string, patch: Partial<TProjectBudgetSelect>, tx?: TTx): Promise<TProjectBudgetSelect | null>;
	listLines(organizationId: string, budgetId: string, tx?: TTx): Promise<TProjectBudgetLineSelect[]>;
	replaceLines(organizationId: string, budgetId: string, rows: TBudgetLineInput[], tx?: TTx): Promise<void>;
	/** Posted expense-account movement of the project per account and month (debit - credit). */
	actuals(organizationId: string, projectId: string, tx?: TTx): Promise<Array<{ accountId: string; period: string; amount: number }>>;
	/** Billed subtotal per purchase order (non-void, non-draft supplier bills). */
	billedByOrder(organizationId: string, orderIds: string[], tx?: TTx): Promise<Map<string, number>>;
}

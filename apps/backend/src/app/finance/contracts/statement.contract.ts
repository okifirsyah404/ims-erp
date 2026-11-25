import { z } from 'zod';

const isoDate = z.iso.date();

export const statementQuerySchema = z
	.object({
		from: isoDate,
		to: isoDate,
		compare: z.enum(['none', 'previous_period', 'previous_year']).default('none'),
	})
	.refine((value) => value.from <= value.to, { message: 'from must not be after to' });

export type TStatementLine = { accountId: string; code: string; name: string; amount: number };
export type TCashFlowSection = { lines: TStatementLine[]; total: number };

/** Read port of the ERP-0148 statements. */
export interface IStatementRepository {
	cashAccountIds(organizationId: string): Promise<string[]>;
	cashCounterparts(organizationId: string, cashAccountIds: string[], from: string, to: string): Promise<Array<{ accountId: string; inflow: number }>>;
	activity(organizationId: string, from: string, to: string): Promise<Array<{ accountId: string; debit: number; credit: number }>>;
}

import type { TCashForecastLineSelect, cashForecastLines } from '@drizzle/schemas/finance.schema';
import { z } from 'zod';

export const forecastLineSchema = z.object({
	expectedDate: z.iso.date(),
	direction: z.enum(['in', 'out']),
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	description: z.string().trim().min(1).max(300),
});

/** Persistence port of the cash forecast (ERP-0149). */
export interface ICashForecastRepository {
	openReceivables(organizationId: string): Promise<Array<{ dueDate: string | null; outstanding: number }>>;
	openPayables(organizationId: string): Promise<Array<{ dueDate: string | null; outstanding: number }>>;
	listLines(organizationId: string, from: string, to: string): Promise<TCashForecastLineSelect[]>;
	insertLine(row: Omit<typeof cashForecastLines.$inferInsert, 'createdAt' | 'updatedAt'>): Promise<TCashForecastLineSelect>;
	removeLine(organizationId: string, id: string): Promise<boolean>;
}

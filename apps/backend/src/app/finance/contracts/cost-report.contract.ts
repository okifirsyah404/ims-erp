import { z } from 'zod';

const isoDate = z.iso.date();

export const costReportQuerySchema = z
	.object({ from: isoDate, to: isoDate })
	.refine((value) => value.from <= value.to, { message: 'from must not be after to' });

export const profitabilityQuerySchema = z
	.object({ from: isoDate, to: isoDate, dimension: z.enum(['project', 'customer', 'product', 'business_line']) })
	.refine((value) => value.from <= value.to, { message: 'from must not be after to' });

/** Read port of the cost-accounting aggregates (ERP-0147). */
export interface ICostReportRepository {
	/** Revenue and cost per dimension value (ERP-0150); `null` key = lines without it. */
	byDimension(
		organizationId: string,
		from: string,
		to: string,
		dimension: 'project' | 'customer' | 'product',
	): Promise<Array<{ key: string | null; revenue: number; cost: number }>>;
	byProject(organizationId: string, from: string, to: string): Promise<Array<{ projectId: string; revenue: number; cost: number }>>;
	projectAccounts(
		organizationId: string,
		projectId: string,
		from: string,
		to: string,
	): Promise<Array<{ accountId: string; code: string; name: string; accountType: string; amount: number }>>;
	byCostCenter(
		organizationId: string,
		from: string,
		to: string,
	): Promise<Array<{ costCenterId: string | null; code: string | null; name: string | null; revenue: number; cost: number }>>;
}

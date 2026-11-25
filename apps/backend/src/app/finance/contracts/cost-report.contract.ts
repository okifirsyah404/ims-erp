import { z } from 'zod';

const isoDate = z.iso.date();

export const costReportQuerySchema = z
	.object({ from: isoDate, to: isoDate })
	.refine((value) => value.from <= value.to, { message: 'from must not be after to' });

/** Read port of the cost-accounting aggregates (ERP-0147). */
export interface ICostReportRepository {
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

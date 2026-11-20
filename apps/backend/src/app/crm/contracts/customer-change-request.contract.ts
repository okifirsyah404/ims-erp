import type { ChangeRequestStatus, TCompanyChanges, TCustomerChangeRequestSelect } from '@drizzle/schemas/crm.schema';
import { z } from 'zod';
import { taxIdSchema } from './customer.contract';

/** Company-data change requests from the customer portal (ERP-0076). */

/** What the portal sends (`updateCompany`): the company name, NPWP and line of business. */
export const companyChangeSchema = z.object({
	name: z.string().trim().min(1).max(200),
	npwp: taxIdSchema.optional(),
	industry: z
		.string()
		.trim()
		.max(100)
		.optional()
		.transform((value) => (value ? value : null)),
});

export const changeDecisionSchema = z.object({ note: z.string().trim().max(500).optional() });

export const changeRequestParamSchema = z.object({ id: z.uuid(), requestId: z.uuid() });

/** A parsed company change (the controller parses the request body). */
export type TCompanyChangeInput = z.output<typeof companyChangeSchema>;

export interface ICustomerChangeRequestRepository {
	/** The customer's requests, newest first. */
	list(customerId: string, limit: number): Promise<TCustomerChangeRequestSelect[]>;
	findPending(customerId: string): Promise<TCustomerChangeRequestSelect | null>;
	/** Marks a pending request superseded and inserts the new one (one transaction). */
	create(data: {
		customerId: string;
		changes: TCompanyChanges;
		previous: TCompanyChanges;
		requestedByUserId: string;
		requestedByName: string;
	}): Promise<TCustomerChangeRequestSelect>;
	/** Pending → approved / rejected; `null` when it is not pending any more (race). */
	decide(id: string, status: Extract<ChangeRequestStatus, 'approved' | 'rejected'>, actorUserId: string, note: string | null): Promise<TCustomerChangeRequestSelect | null>;
}

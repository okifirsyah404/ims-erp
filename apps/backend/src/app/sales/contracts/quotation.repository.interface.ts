import type { TQuotationSelect } from '@drizzle/schemas/sales.schema';

export type TCreateQuotationInput = {
	organizationId: string;
	code: string;
	title: string;
	amount: number;
	createdBy: string;
};

export type TUpdateQuotationInput = {
	title?: string;
	amount?: number;
};

export type TSubmitQuotationInput = {
	/** Acting user id; self-approval checks use it. */
	actorUserId: string;
};

export type TApproveQuotationInput = {
	actorUserId: string;
	decision: 'approve' | 'reject';
};

export type TQuotationRepository = {
	create(input: TCreateQuotationInput): Promise<TQuotationSelect>;
	findById(
		organizationId: string,
		id: string,
	): Promise<TQuotationSelect | null>;
	list(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<{ data: TQuotationSelect[]; total: number }>;
	update(
		organizationId: string,
		id: string,
		patch: TUpdateQuotationInput,
	): Promise<TQuotationSelect | null>;
	/**
	 * Conditional state transition, executed atomically. Returns the updated
	 * row or null when the expected status did not match (race-safe).
	 */
	transitionStatus(
		organizationId: string,
		id: string,
		from: TQuotationSelect['status'],
		to: TQuotationSelect['status'],
	): Promise<TQuotationSelect | null>;
};

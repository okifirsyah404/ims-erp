import type { TPaginationResult } from '@ims-erp/common';
import type { TQuotationSelect } from '@drizzle/schemas/sales.schema';

/**
 * Tenant-scoped input for creating a quotation. `organizationId` and
 * `createdBy` are supplied by the service from guard context, never by
 * the client.
 */
export type TCreateQuotationInput = {
	organizationId: string;
	code: string;
	title: string;
	amount: number;
	createdBy: string;
};

/**
 * Whitelisted patch for quotation updates. Mass-assignment protection:
 * `organizationId`, `status`, and `createdBy` are never client-writable.
 */
export type TUpdateQuotationInput = {
	title?: string;
	amount?: number;
};

export type TSubmitQuotationInput = {
	/** Acting user id; self-approval checks use it. */
	actorUserId: string;
};

/** Decision input for the quotation approval workflow. */
export type TApproveQuotationInput = {
	actorUserId: string;
	decision: 'approve' | 'reject';
};

/**
 * Data-access contract for quotations within one tenant.
 *
 * @remarks
 * Every method takes `organizationId` explicitly — all queries are
 * tenant-scoped and none may run unscoped. `transitionStatus` is a
 * conditional update on the expected status, making workflow transitions
 * race-safe.
 */
export type TQuotationRepository = {
	/** Creates a quotation in `draft` state. */
	create(input: TCreateQuotationInput): Promise<TQuotationSelect>;

	/**
	 * Fetches one quotation, scoped to the tenant.
	 *
	 * @returns The quotation, or `null` when absent or foreign
	 */
	findById(
		organizationId: string,
		id: string,
	): Promise<TQuotationSelect | null>;

	/**
	 * Lists one page of the tenant's quotations, oldest first.
	 *
	 * @returns The page plus the unpaginated total
	 */
	list(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TQuotationSelect>>;
	/**
	 * Applies a whitelisted partial update to a quotation.
	 *
	 * @returns The updated row, or `null` when absent or foreign
	 */
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

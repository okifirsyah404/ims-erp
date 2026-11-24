import { AUDIT_ACTIONS, type TAuditLogSelect } from '@drizzle/schemas/audit.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/**
 * Data-access contract over the append-only audit ledger
 * (`audit.audit_logs`).
 *
 * @remarks
 * The ledger is insert-only: there is no update and no delete method, by
 * design. Both the writer ({@link import('../services/audit.service').AuditService})
 * and the reader ({@link import('../services/audit-query.service').AuditQueryService})
 * go through this interface, so no service holds a Drizzle handle.
 */

/** A target an audit entry can point at. */
export type TAuditTargetType =
	| 'invitation'
	| 'user'
	| 'role'
	| 'member'
	| 'organization'
	| 'stock_adjustment'
	| 'borrowing'
	| 'stock_movement'
	| 'item'
	| 'warehouse'
	| 'warehouse_storage'
	| 'asset'
	| 'asset_category'
	| 'asset_assignment'
	| 'asset_movement'
	| 'asset_condition_check'
	| 'asset_maintenance'
	| 'asset_depreciation'
	| 'asset_disposal'
	| 'asset_document'
	| 'tool_set'
	| 'journal_entry'
	| 'accounting_period'
	| 'chart_of_account'
	| 'posting_rule'
	| 'cost_center'
	| 'credit_memo'
	| 'ar_open_item';

/** One audited action (mirrors the `audit.audit_logs.action` enum). */
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * One entry to append to the audit ledger.
 *
 * @remarks
 * This is the repository's write DTO — the service fills it in, the
 * repository persists it.
 */
export type TAuditEntry = {
	actorUserId: string;
	actorEmail?: string | null;
	action: AuditAction;
	targetType: TAuditTargetType;
	targetId: string;
	organizationId?: string | null;
	meta?: Record<string, unknown>;
	/** Caller request context; extracted from the real request headers. */
	request?: { ip?: string | null; userAgent?: string | null };
};

/**
 * Validated filters for a ledger read. All filters are optional and ANDed.
 *
 * @remarks
 * Page settings come from {@link TPaginationRequest}; the tenant filter is a
 * plain column match, not the tri-state balance scope, because the ledger's
 * `organization_id` is nullable (system rows have no tenant).
 */
export type TAuditPaginationRequest = TPaginationRequest & {
	action?: AuditAction;
	actorUserId?: string;
	targetType?: TAuditTargetType;
	organizationId?: string;
	/** Inclusive lower bound. */
	from?: Date;
	/** Exclusive upper bound. */
	to?: Date;
};

export interface IAuditRepository {
	/** Appends one immutable audit row. */
	insert(entry: TAuditEntry): Promise<void>;
	/** Fetches one filtered page of ledger rows, newest first. */
	paginate(
		request: TAuditPaginationRequest,
	): Promise<TPaginationResult<TAuditLogSelect>>;
}

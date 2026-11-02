import { AUDIT_ACTIONS, type TAuditLogSelect } from '@drizzle/schemas/audit.schema';
import type { TPaginationResult } from '@ims-erp/common';

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
	| 'organization';

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

/** Validated filters for a ledger read. All filters are optional and ANDed. */
export type TAuditListRequest = {
	action?: AuditAction;
	actorUserId?: string;
	targetType?: TAuditTargetType;
	organizationId?: string;
	/** Inclusive lower bound. */
	from?: Date;
	/** Exclusive upper bound. */
	to?: Date;
	page: number;
	limit: number;
};

export interface IAuditRepository {
	/** Appends one immutable audit row. */
	insert(entry: TAuditEntry): Promise<void>;
	/** Lists ledger rows newest-first, filtered. */
	list(
		request: TAuditListRequest,
	): Promise<TPaginationResult<TAuditLogSelect>>;
}

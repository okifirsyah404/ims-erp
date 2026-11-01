import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DRIZZLE_TOKEN } from '@di/provider';
import { auditLogs, type AuditAction } from '@drizzle/schemas/audit.schema';

/** Data for one audit entry. */
export type TAuditEntry = {
	actorUserId: string;
	actorEmail?: string | null;
	action: AuditAction;
	targetType: 'invitation' | 'user' | 'role' | 'member' | 'organization';
	targetId: string;
	organizationId?: string | null;
	meta?: Record<string, unknown>;
	/** Caller request context; extracted from the real request headers. */
	request?: { ip?: string | null; userAgent?: string | null };
};

/**
 * Append-only audit writer for user-management events. Fire-and-forget by
 * contract: callers never block on audit persistence, and an audit failure
 * is logged, never thrown into the business flow.
 */
@injectable()
export class AuditService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/**
	 * Writes one entry. Never throws — audit failures are logged and
	 * swallowed so they cannot fail the guarded business operation.
	 */
	async record(entry: TAuditEntry): Promise<void> {
		try {
			await this.database.insert(auditLogs).values({
				id: crypto.randomUUID(),
				actorUserId: entry.actorUserId,
				actorEmail: entry.actorEmail ?? null,
				action: entry.action,
				targetType: entry.targetType,
				targetId: entry.targetId,
				organizationId: entry.organizationId ?? null,
				meta: entry.meta ?? null,
				ipAddress: entry.request?.ip ?? null,
				userAgent: entry.request?.userAgent ?? null,
				createdAt: new Date(),
			});
		} catch (error) {
			console.error('[audit] write failed', entry.action, error);
		}
	}
}

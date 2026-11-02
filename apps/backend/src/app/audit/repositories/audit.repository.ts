import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, gte, lt } from 'drizzle-orm';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/tokens';
import { auditLogs, type TAuditLogSelect } from '@drizzle/schemas/audit.schema';
import type {
	IAuditRepository,
	TAuditEntry,
	TAuditListRequest,
} from '../contracts/audit.repository.interface';

/**
 * Append-only persistence for the audit ledger (`audit.audit_logs`).
 *
 * @remarks
 * Owns every SQL statement against the ledger: the insert used by
 * {@link import('../services/audit.service').AuditService} and the filtered
 * read used by the audit query service. Rows are never updated or deleted
 * through the application.
 */
@injectable()
export class AuditRepository implements IAuditRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/**
	 * Appends one audit row.
	 *
	 * @remarks
	 * Deliberately does not swallow errors - the swallowing policy belongs
	 * to the calling service, which must not fail a business operation just
	 * because auditing failed.
	 */
	async insert(entry: TAuditEntry): Promise<void> {
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
	}

	async list(
		request: TAuditListRequest,
	): Promise<TPaginationResult<TAuditLogSelect>> {
		const { action, actorUserId, targetType, organizationId, from, to, page, limit } =
			request;

		const filters = [
			action ? eq(auditLogs.action, action) : undefined,
			actorUserId ? eq(auditLogs.actorUserId, actorUserId) : undefined,
			targetType ? eq(auditLogs.targetType, targetType) : undefined,
			organizationId
				? eq(auditLogs.organizationId, organizationId)
				: undefined,
			// `created_at` is a unix-seconds integer column, so the range
			// bounds are converted to epoch seconds rather than Date objects.
			from
				? gte(auditLogs.createdAt, new Date(Math.floor(from.getTime() / 1000) * 1000))
				: undefined,
			to
				? lt(auditLogs.createdAt, new Date(Math.ceil(to.getTime() / 1000) * 1000))
				: undefined,
		].filter(Boolean);
		const where = filters.length > 0 ? and(...filters) : undefined;

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(auditLogs)
			.where(where);

		const data = await this.database
			.select()
			.from(auditLogs)
			.where(where)
			.orderBy(desc(auditLogs.createdAt))
			.offset((page - 1) * limit)
			.limit(limit);

		return {
			data,
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
		};
	}
}

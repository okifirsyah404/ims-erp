import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, gte, lt } from 'drizzle-orm';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/tokens';
import { auditLogs, type TAuditLogSelect } from '@drizzle/schemas/audit.schema';
import type {
	IAuditRepository,
	TAuditListRequest,
} from '../contracts/repositories.interface';

/**
 * Read side of the append-only audit ledger (`audit.audit_logs`).
 *
 * @remarks
 * The writer stays {@link import('../services/audit.service').AuditService};
 * this repository is read-only by design — audit rows are never updated or
 * deleted through the application.
 */
@injectable()
export class AuditRepository implements IAuditRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

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

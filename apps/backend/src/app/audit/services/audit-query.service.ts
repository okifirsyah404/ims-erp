import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type { TAdminAudit, TAuditQuery } from '../contracts/audit.contract';
import { AUDIT_REPOSITORY_TOKEN } from '../constants/di';
import type { IAuditRepository } from '../contracts/audit.repository.interface';

/**
 * Read-only view over the audit ledger (phase 4, decision D12).
 *
 * @remarks
 * The audit table is insert-only; this service can only list and filter.
 * Nothing here ever mutates an audit row.
 */
@injectable()
export class AuditQueryService {
	constructor(
		@inject(AUDIT_REPOSITORY_TOKEN)
		private readonly repository: IAuditRepository,
	) {}

	/**
	 * Lists audit entries, newest first.
	 *
	 * @param query validated filters (page/limit/action/actor/target/org/range)
	 */
	async list(query: TAuditQuery): Promise<TPaginationResult<TAdminAudit>> {
		const result = await this.repository.list({
			action: query.action,
			actorUserId: query.actorUserId,
			targetType: query.targetType,
			organizationId: query.organizationId,
			from: query.from ? new Date(query.from) : undefined,
			to: query.to ? new Date(query.to) : undefined,
			page: query.page,
			limit: query.limit,
		});

		return {
			data: result.data.map((row) => ({
				id: row.id,
				actorUserId: row.actorUserId,
				actorEmail: row.actorEmail,
				action: row.action,
				targetType: row.targetType,
				targetId: row.targetId,
				organizationId: row.organizationId,
				meta: row.meta,
				ipAddress: row.ipAddress,
				userAgent: row.userAgent,
				createdAt: row.createdAt,
			})),
			meta: result.meta,
		};
	}
}

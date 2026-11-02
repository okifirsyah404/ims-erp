import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { okPaginated } from '@http/response';
import { auditQuerySchema } from '../contracts/audit.contract';
import { AUDIT_QUERY_SERVICE_TOKEN } from '../constants/di';
import type { AuditQueryService } from '../services/audit-query.service';

/**
 * Read-only HTTP surface over the audit ledger.
 *
 * @remarks
 * One route: `GET /admin/audit`. Writes are never exposed over HTTP — each
 * module's own service records the entries for its actions.
 *
 * Sits under the `/admin` prefix alongside the other administration
 * surfaces, and rides the `erp` guard so the caller needs a validated
 * organization context plus `audit_log:read`.
 */
export class AuditController {
	/**
	 * Builds the Elysia plugin mounting the audit read route.
	 *
	 * @returns An Elysia instance with `/admin/audit` mounted
	 */
	static plugin() {
		const auditQuery = container.resolve<AuditQueryService>(
			AUDIT_QUERY_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'audit',
			prefix: '/admin',
			tags: ['Audit'],
			guards: 'erp',
		}).get(
			'/audit',
			async ({ query }) =>
				okPaginated(await auditQuery.list(auditQuerySchema.parse(query))),
			{ erp: { permission: ['audit_log:read'] } },
		);
	}
}

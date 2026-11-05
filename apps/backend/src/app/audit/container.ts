import type { DependencyContainer } from 'tsyringe';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './services/audit.service';
import { AuditQueryService } from './services/audit-query.service';
import {
	AUDIT_QUERY_SERVICE_TOKEN,
	AUDIT_REPOSITORY_TOKEN,
	AUDIT_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the audit module: the ledger repository plus its writer and
 * reader.
 *
 * @remarks
 * Extracted from `user-management` (W6) because the ledger is
 * cross-cutting — every module writes to it — while `user-management` only
 * happened to be its first writer. Registration order DOES matter at the
 * composition root: `registerInventory` resolves `AUDIT_SERVICE_TOKEN`
 * eagerly (it builds the shared `InventoryAuditWriter` at registration
 * time), so `registerAudit` must run before it.
 */
export function registerAudit(container: DependencyContainer): void {
	container.register(AUDIT_REPOSITORY_TOKEN, { useClass: AuditRepository });
	container.register(AUDIT_SERVICE_TOKEN, { useClass: AuditService });
	container.register(AUDIT_QUERY_SERVICE_TOKEN, {
		useClass: AuditQueryService,
	});
}

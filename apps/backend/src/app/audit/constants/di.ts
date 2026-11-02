import type { InjectionToken } from 'tsyringe';
import type { IAuditRepository } from '../contracts/audit.repository.interface';
import type { AuditService } from '../services/audit.service';
import type { AuditQueryService } from '../services/audit-query.service';

/**
 * Injection tokens for the audit module.
 *
 * @remarks
 * Standalone constants module so services and the composition root never
 * form an import cycle. Both tokens are annotated with `InjectionToken<T>`
 * so a mismatched `useClass` is a compile error.
 */
export const AUDIT_REPOSITORY_TOKEN: InjectionToken<IAuditRepository> = Symbol(
	'AUDIT_REPOSITORY',
);
export const AUDIT_SERVICE_TOKEN: InjectionToken<AuditService> =
	Symbol('AUDIT_SERVICE');
export const AUDIT_QUERY_SERVICE_TOKEN: InjectionToken<AuditQueryService> =
	Symbol('AUDIT_QUERY_SERVICE');

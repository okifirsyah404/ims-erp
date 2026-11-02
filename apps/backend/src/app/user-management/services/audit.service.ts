import { inject, injectable } from 'tsyringe';
import { pinoLogger } from '@providers/logger/logger';
import { AUDIT_REPOSITORY_TOKEN } from '../constants/di';
import type {
	IAuditRepository,
	TAuditEntry,
} from '../contracts/repositories.interface';

export type { TAuditEntry };

/**
 * Append-only audit writer for user-management events.
 *
 * @remarks
 * Fire-and-forget by contract: callers never block on audit persistence, and
 * an audit failure is logged, never thrown into the business flow.
 *
 * Persistence goes through {@link IAuditRepository} — this service holds no
 * Drizzle handle and issues no SQL.
 */
@injectable()
export class AuditService {
	constructor(
		@inject(AUDIT_REPOSITORY_TOKEN)
		private readonly repository: IAuditRepository,
	) {}

	/**
	 * Writes one entry. Never throws - audit failures are logged and
	 * swallowed so they cannot fail the guarded business operation.
	 */
	async record(entry: TAuditEntry): Promise<void> {
		try {
			await this.repository.insert(entry);
		} catch (error) {
			pinoLogger.error(
				{ err: error, action: entry.action },
				'audit write failed',
			);
		}
	}
}

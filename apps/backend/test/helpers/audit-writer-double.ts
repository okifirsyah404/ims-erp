import { AuditWriter } from '@shared/audit';
import type { TAuditEntry } from '@app/audit/contracts/audit.repository.interface';

/**
 * No-op audit double for module service tests.
 *
 * @remarks
 * Records every `record()` call so tests can assert audit behavior without a
 * database, while `record` itself stays fire-and-forget (never throws).
 *
 * ADR-0026 moved the writer to `@shared/audit`, so the double extends the
 * shared class instead of the deleted `inventory-audit.writer` and feeds it a
 * capturing `AuditService` stand-in.
 */
export class AuditWriterDouble extends AuditWriter {
	readonly entries: TAuditEntry[] = [];

	constructor() {
		super({
			record: async (entry: TAuditEntry) => {
				this.entries.push(entry);
			},
		} as never);
	}

	/** Entries for one action, e.g. `item.created`. */
	forAction(action: string): TAuditEntry[] {
		return this.entries.filter((entry) => entry.action === action);
	}
}

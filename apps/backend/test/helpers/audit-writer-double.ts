import { InventoryAuditWriter } from '../../src/app/inventory/services/inventory-audit.writer';
import type { TAuditEntry } from '../../src/app/audit/contracts/audit.repository.interface';

/**
 * No-op audit double for inventory service tests.
 *
 * @remarks
 * Records every `record()` call so tests can assert audit behavior without a
 * database, while `record` itself stays fire-and-forget (never throws).
 */
export class AuditWriterDouble extends InventoryAuditWriter {
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

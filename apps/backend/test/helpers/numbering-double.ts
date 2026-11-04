import type { TTx } from '@drizzle/types';
import type { DocumentNumberingService } from '../../src/app/organization/services/document-numbering.service';

/**
 * In-memory double for the ERP-0009 {@link DocumentNumberingService}.
 *
 * @remarks
 * Mirrors the real contract: strictly monotonic per
 * `(organizationId, docType)` — which is the property document-code
 * uniqueness rests on. The counter survives across `build()` calls in a
 * file only if the same instance is reused; each `createNumberingDouble()`
 * starts fresh at 1, matching a lazily seeded database row.
 */
export class NumberingServiceDouble {
	private readonly counters = new Map<string, number>();

	async allocate(
		organizationId: string | null,
		docType: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_tx?: TTx,
	): Promise<number> {
		const key = `${organizationId ?? ''}::${docType}`;
		const next = (this.counters.get(key) ?? 0) + 1;
		this.counters.set(key, next);
		return next;
	}

	format(prefix: string, middle: string, number: number, pad = 6): string {
		return `${prefix}-${middle}-${String(number).padStart(pad, '0')}`;
	}
}

/** Creates a fresh numbering double starting at 1 for every sequence. */
export function createNumberingDouble(): DocumentNumberingService {
	return new NumberingServiceDouble() as unknown as DocumentNumberingService;
}

import type { DocumentType } from '@drizzle/schemas/organization.schema';
import { DOCUMENT_TYPE_CODES, defaultPattern, renderNumber } from '../../src/app/organization/domain/document-number';
import type { NumberingService } from '../../src/app/organization/services/numbering.service';

/**
 * In-memory double for the {@link NumberingService} (`next`), the one
 * numbering authority (ERP-0009).
 *
 * @remarks
 * Mirrors the real contract: strictly monotonic per document type (the
 * property document-code uniqueness rests on), rendered with the type's
 * default pattern. Each `createNumberingDouble()` starts fresh at 1,
 * matching a new series row.
 */
export class NumberingServiceDouble {
	private readonly counters = new Map<string, number>();

	async next(documentType: DocumentType): Promise<string> {
		const seq = (this.counters.get(documentType) ?? 0) + 1;
		this.counters.set(documentType, seq);
		return renderNumber(defaultPattern(documentType), {
			seq,
			typeCode: DOCUMENT_TYPE_CODES[documentType],
			companyCode: 'IMS',
			date: new Date(),
		});
	}
}

/** Creates a fresh numbering double starting at 1 for every series. */
export function createNumberingDouble(): Pick<NumberingService, 'next'> {
	return new NumberingServiceDouble() as unknown as Pick<NumberingService, 'next'>;
}

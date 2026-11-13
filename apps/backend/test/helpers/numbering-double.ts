import type { CodeType } from '@drizzle/schemas/code-number.schema';
import { CODE_TYPE_CODES, defaultPattern, renderNumber } from '../../src/app/code-number/domain/code-number';
import type { CodeNumberService } from '../../src/app/code-number';

/**
 * In-memory double for the {@link CodeNumberService} (`next`), the one
 * numbering authority (ERP-0009).
 *
 * @remarks
 * Mirrors the real contract: strictly monotonic per code type (the property
 * document-code uniqueness rests on), rendered with the type's default
 * pattern. Each `createNumberingDouble()` starts fresh at 1, matching a new
 * series row.
 */
export class CodeNumberServiceDouble {
	private readonly counters = new Map<string, number>();

	async next(codeType: CodeType): Promise<string> {
		const seq = (this.counters.get(codeType) ?? 0) + 1;
		this.counters.set(codeType, seq);
		return renderNumber(defaultPattern(codeType), {
			seq,
			typeCode: CODE_TYPE_CODES[codeType],
			companyCode: 'IMS',
			date: new Date(),
		});
	}
}

/** Creates a fresh numbering double starting at 1 for every series. */
export function createNumberingDouble(): Pick<CodeNumberService, 'next'> {
	return new CodeNumberServiceDouble() as unknown as Pick<CodeNumberService, 'next'>;
}

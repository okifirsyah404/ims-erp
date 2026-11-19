import { CODE_TYPE_CODES, type CodeType, defaultPattern, renderNumber } from '@shared/numbering';

/**
 * In-memory double for the per-module numbering services (`next`):
 * `InventoryNumberingService`, `SaleNumberingService`,
 * `ProcurementNumberingService`, `FinanceNumberingService`, ...
 *
 * @remarks
 * Mirrors the real contract: strictly monotonic per code type (the property
 * document-code uniqueness rests on), rendered with the type's default
 * pattern. Each `createNumberingDouble()` starts fresh at 1, matching a new
 * series row.
 */
export class NumberingDouble {
	private readonly counters = new Map<string, number>();

	async next(codeType: CodeType, _options?: unknown): Promise<string> {
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
export function createNumberingDouble(): NumberingDouble {
	return new NumberingDouble();
}

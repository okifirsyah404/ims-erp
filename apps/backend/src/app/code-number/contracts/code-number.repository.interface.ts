import type {
	CodeType,
	ResetPolicy,
	TCodeNumberSeriesSelect,
} from '@drizzle/schemas/code-number.schema';
import type { TTx } from '@drizzle/types';

/** The owner's override of a series; `null` keeps the code default. */
export type TCodeNumberSettings = {
	module: string;
	codeType: CodeType;
	pattern: string | null;
	resetPolicy: ResetPolicy | null;
	updatedBy: string;
};

/** Persistence port for `code_number.series`. */
export interface ICodeNumberRepository {
	/** Every live series row (types without a row use the code defaults). */
	findAll(): Promise<TCodeNumberSeriesSelect[]>;

	/** The live series row of one code type, if any. */
	findByType(codeType: CodeType, tx?: TTx): Promise<TCodeNumberSeriesSelect | null>;

	/**
	 * Reserves the next number of a series for `periodKey` and returns it.
	 *
	 * @remarks
	 * One atomic statement: creates the row on first use, increments it in
	 * the same period, and starts again at 1 when the period changed.
	 * Concurrent callers never receive the same number.
	 */
	allocate(module: string, codeType: CodeType, periodKey: string, tx?: TTx): Promise<number>;

	/** Saves the owner's pattern / reset policy override (creates the row if needed). */
	saveSettings(settings: TCodeNumberSettings, periodKey: string): Promise<TCodeNumberSeriesSelect>;
}

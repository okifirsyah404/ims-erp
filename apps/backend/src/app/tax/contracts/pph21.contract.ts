import type {
	TPph21BracketSelect,
	TPph21PtkpSelect,
	TPph21TerRateSelect,
	TTerCategory,
} from '@drizzle/schemas/tax.schema';
import type { TTx } from '@drizzle/types';

/** One TER row of an import, already validated (minor units, percentage string). */
export type TTerRateRow = { category: TTerCategory; lowerBound: number; rate: string; effectiveFrom: string };

/** One problem in an imported CSV row; `code` is translated by the web admin. */
export type TTerImportError = { row: number; code: string; value: string };

/** All-or-nothing import outcome. */
export type TTerImportResult = { imported: number; effectiveFrom: string[]; errors: TTerImportError[] };

/** A stored TER table version. */
export type TTerVersion = { effectiveFrom: string; rows: number };

/**
 * Persistence port of the PPh 21 statutory tables (ERP-0138). Global
 * reference data: no tenant column, so no organization argument.
 */
export interface IPph21Repository {
	/** The PTKP row set with the latest effective_from on or before `date`. */
	listPtkpInForce(date: string): Promise<TPph21PtkpSelect[]>;
	/** The TER row set with the latest effective_from on or before `date`. */
	listTerInForce(date: string): Promise<TPph21TerRateSelect[]>;
	/** The bracket set with the latest effective_from on or before `date`. */
	listBracketsInForce(date: string): Promise<TPph21BracketSelect[]>;
	listTerVersions(): Promise<TTerVersion[]>;
	/** Soft-deletes the live rows of each effective_from present and inserts `rows`. */
	replaceTerRates(rows: TTerRateRow[], tx?: TTx): Promise<void>;
}

import type { DocumentType, ResetPolicy, TDocumentSequenceSelect } from '@drizzle/schemas/organization.schema';
import type { TTx } from '@drizzle/types';

/** The owner's override of a series; `null` keeps the code default. */
export type TDocumentSequenceSettings = {
	module: string;
	documentType: DocumentType;
	pattern: string | null;
	resetPolicy: ResetPolicy | null;
	updatedBy: string;
};

/** Persistence port for `organization.document_sequences`. */
export interface IDocumentSequenceRepository {
	/** Every live series row (types without a row use the code defaults). */
	findAll(): Promise<TDocumentSequenceSelect[]>;

	/** The live series row of one document type, if any. */
	findByType(documentType: DocumentType, tx?: TTx): Promise<TDocumentSequenceSelect | null>;

	/**
	 * Reserves the next number of a series for `periodKey` and returns it.
	 *
	 * @remarks
	 * One atomic statement: creates the row on first use, increments it in
	 * the same period, and starts again at 1 when the period changed.
	 * Concurrent callers never receive the same number.
	 */
	allocate(module: string, documentType: DocumentType, periodKey: string, tx?: TTx): Promise<number>;

	/** Saves the owner's pattern / reset policy override (creates the row if needed). */
	saveSettings(settings: TDocumentSequenceSettings, periodKey: string): Promise<TDocumentSequenceSelect>;
}

import { ImportFileError } from '../errors/hr.errors';
import { MAX_IMPORT_BYTES } from './spreadsheet';

/** One problem in an imported row; `code` is translated by the web admin. */
export type TRowError = { row: number; code: string; value: string };

/** Outcome of an all-or-nothing import. */
export type TImportResult = { imported: number; errors: TRowError[] };

/** The upload is an `.xlsx` or `.csv` of at most 2 MB. */
export function assertImportFile(file: unknown): File {
	if (!(file instanceof File)) throw new ImportFileError('type');
	const name = file.name.toLowerCase();
	if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) throw new ImportFileError('type');
	if (file.size > MAX_IMPORT_BYTES) throw new ImportFileError('size');
	if (file.size === 0) throw new ImportFileError('empty');
	return file;
}

/** The `file` field of a multipart body, if any. */
export function fileOf(body: unknown): unknown {
	return body && typeof body === 'object' && 'file' in body ? (body as { file: unknown }).file : undefined;
}

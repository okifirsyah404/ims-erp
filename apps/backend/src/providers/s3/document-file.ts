/**
 * Files attached to a registered document (signed scans, delivery proofs).
 *
 * @remarks
 * One rule set for every upload: PDF or a PNG/JPG/WebP image up to 10 MB,
 * stored under a fresh key so a re-upload never overwrites the file an issued
 * document pointed at.
 */
import { AppError } from '@http/errors';
import type { IObjectStorage } from './object-storage';

const FILE_TYPES: Record<string, string> = {
	'application/pdf': 'pdf',
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
};

export const MAX_DOCUMENT_FILE_MB = 10;

/** Not a file we accept, or too large. */
export class DocumentFileInvalidError extends AppError {
	constructor() {
		super(422, 'common.fileInvalid', 'Upload a PDF, PNG, JPG or WebP file', { max: MAX_DOCUMENT_FILE_MB });
	}
}

/** The multipart `file` field, or a 422 when it is missing or not allowed. */
export function documentFileFrom(body: unknown): File {
	const file = body && typeof body === 'object' ? (body as { file?: unknown }).file : undefined;
	if (
		!(file instanceof File) ||
		!FILE_TYPES[file.type] ||
		file.size === 0 ||
		file.size > MAX_DOCUMENT_FILE_MB * 1024 * 1024
	) {
		throw new DocumentFileInvalidError();
	}
	return file;
}

/** Stores the file under `<prefix>/<uuid>.<ext>` and returns the key. */
export async function storeDocumentFile(storage: IObjectStorage, prefix: string, file: File): Promise<string> {
	const key = `${prefix}/${crypto.randomUUID()}.${FILE_TYPES[file.type]}`;
	await storage.put(key, file, file.type);
	return key;
}

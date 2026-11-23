/**
 * Object storage port for domain files (lead attachments, later document
 * scans). Keys are opaque; downloads use short-lived presigned URLs, so the
 * database never stores an expiring URL.
 */
import type { InjectionToken } from 'tsyringe';
import { s3Client } from './s3';

export interface IObjectStorage {
	/**
	 * Writes an object. `data` accepts a `Blob`/`File` straight from a
	 * multipart upload or raw bytes — server-generated images (normalised
	 * WebP) are written as a `Uint8Array`/`Buffer`.
	 */
	put(key: string, data: Blob | Uint8Array, contentType: string): Promise<void>;
	/** Presigned GET URL; `attachment` (default) or `inline` disposition. */
	presignGet(key: string, options: { fileName: string; expiresIn?: number; inline?: boolean }): string;
	/**
	 * The object's bytes (ERP-0122: payslips bundled into one ZIP). Optional on
	 * the port so test doubles that never read objects need not implement it.
	 */
	get?(key: string): Promise<Uint8Array>;
}

export const OBJECT_STORAGE_TOKEN: InjectionToken<IObjectStorage> = Symbol('OBJECT_STORAGE');

export const s3ObjectStorage: IObjectStorage = {
	async put(key, data, contentType) {
		await s3Client.write(key, data, { type: contentType });
	},
	async get(key) {
		return new Uint8Array(await s3Client.file(key).arrayBuffer());
	},
	presignGet(key, { fileName, expiresIn = 300, inline = false }) {
		const safeName = fileName.replace(/["\\\r\n]/g, '_');
		return s3Client.presign(key, {
			method: 'GET',
			expiresIn,
			contentDisposition: `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
		});
	},
};

/**
 * Object storage port for domain files (lead attachments, later document
 * scans). Keys are opaque; downloads use short-lived presigned URLs, so the
 * database never stores an expiring URL.
 */
import type { InjectionToken } from 'tsyringe';
import { s3Client } from './s3';

export interface IObjectStorage {
	put(key: string, data: Blob, contentType: string): Promise<void>;
	/** Presigned GET URL; `attachment` (default) or `inline` disposition. */
	presignGet(key: string, options: { fileName: string; expiresIn?: number; inline?: boolean }): string;
}

export const OBJECT_STORAGE_TOKEN: InjectionToken<IObjectStorage> = Symbol('OBJECT_STORAGE');

export const s3ObjectStorage: IObjectStorage = {
	async put(key, data, contentType) {
		await s3Client.write(key, data, { type: contentType });
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

import { appConfig } from '@config/providers/config';
import { S3Client } from 'bun';

/**
 * Bun-native S3 client built from the S3_* environment variables already
 * loaded by the config layer, plus a generic presign helper. Domain-specific
 * object keys live with their owning module (user avatars:
 * `app/user/constants/avatar-keys.ts`); access happens through short-lived
 * presigned URLs, so the database never stores expiring URLs.
 */
export const s3Client = new S3Client({
	accessKeyId: appConfig.s3.accessKey,
	secretAccessKey: appConfig.s3.secretKey,
	region: appConfig.s3.region,
	bucket: appConfig.s3.bucket,
	endpoint: appConfig.s3.endpoint ?? undefined,
	// path-style when S3_USE_PATH_STYLE=true (MinIO); virtual-hosted otherwise
	virtualHostedStyle: !(appConfig.s3.usePathStyle ?? false),
});

/** Presigned GET URL for an arbitrary object key; short-lived. */
export function presignObjectUrl(key: string, expiresInSeconds = 300): string {
	return s3Client.presign(key, {
		method: 'GET',
		expiresIn: expiresInSeconds,
	});
}

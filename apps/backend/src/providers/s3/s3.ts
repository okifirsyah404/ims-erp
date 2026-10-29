import { appConfig } from '@config/providers/config';
import { S3Client } from 'bun';

/**
 * Bun-native S3 client built from the S3_* environment variables already
 * loaded by the config layer. Used for user avatars; storage keys are
 * stable (`user/<userId>/avatar.png`) while access happens through
 * short-lived presigned URLs, so the database never stores expiring URLs.
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

/** S3 key of the generated avatar PNG for a user. */
export function avatarObjectKey(userId: string): string {
	return `user/${userId}/avatar.png`;
}

/** Presigned GET URL for a user's avatar; short-lived by design. */
export function presignAvatarUrl(
	userId: string,
	expiresInSeconds = 300,
): string {
	return s3Client.presign(avatarObjectKey(userId), {
		method: 'GET',
		expiresIn: expiresInSeconds,
	});
}

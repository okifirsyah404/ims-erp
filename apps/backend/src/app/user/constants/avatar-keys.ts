/**
 * S3 object-key layout for user avatars.
 *
 * @remarks
 * Pure key builders — no S3 client, no imports — so any layer (services,
 * workers, tests) can agree on the layout without touching the provider.
 * Keys are stable while access happens through short-lived presigned URLs,
 * so the database never stores expiring URLs.
 */

/** S3 key of the generated avatar WebP for a user. */
export function avatarObjectKey(userId: string): string {
	return `users/${userId}/avatar.webp`;
}

/** S3 key of a user-uploaded avatar (extension from the sniffed type). */
export function avatarCustomObjectKey(userId: string, ext: string): string {
	return `users/${userId}/avatar-custom.${ext}`;
}

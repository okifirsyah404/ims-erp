/**
 * S3 object-key layout for the organization profile image.
 *
 * @remarks
 * Pure key builder — no S3 client, no imports — so services, controllers,
 * and tests agree on the layout without touching the provider. The key is
 * stable while access happens through short-lived presigned URLs, so the
 * database never stores an expiring URL (same convention as user avatars).
 */

/** S3 key of the organization profile image (WebP uploaded by the client). */
export function organizationImageObjectKey(organizationId: string): string {
	return `organizations/${organizationId}/logo.webp`;
}

/**
 * S3 key of the generated DiceBear fallback logo.
 *
 * @remarks
 * Deliberately distinct from {@link organizationImageObjectKey}: the worker
 * runs right after the organization is created, while the create form uploads
 * the picked logo a moment later. Sharing one key made a slow DiceBear fetch
 * overwrite a real upload (same key, last writer wins — observed live). With
 * separate keys the worker can only ever fill an empty slot, and the database
 * decides which object is current.
 */
export function organizationGeneratedImageObjectKey(organizationId: string): string {
	return `organizations/${organizationId}/logo-generated.webp`;
}

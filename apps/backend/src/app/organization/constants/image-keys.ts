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
	return `organization/${organizationId}/logo.webp`;
}

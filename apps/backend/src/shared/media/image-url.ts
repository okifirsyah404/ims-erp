/**
 * Image URL helper shared by the modules that render a stored object key.
 *
 * @remarks
 * `product` presigns the product photo for quotations and the catalog;
 * `inventory` presigns the same key on its stock rows. Both used to reach
 * through `ProductImageService`; after the split (ADR-0026) `inventory` may not
 * import a `product` service, and the helper is pure provider glue anyway, so
 * it lives here next to the audit writer and the numbering domain.
 */
import { documentImageUrl } from '@providers/s3/document-image';
import type { IObjectStorage } from '@providers/s3/object-storage';

/**
 * Turns a stored object key into a short-lived inline URL.
 *
 * @param storage - The object storage provider
 * @param objectKey - The stored key, or `null` when there is no image
 * @returns The signed URL, or `null`
 */
export function storedImageUrl(
	storage: Pick<IObjectStorage, 'presignGet'>,
	objectKey: string | null,
): string | null {
	return documentImageUrl(storage, objectKey);
}

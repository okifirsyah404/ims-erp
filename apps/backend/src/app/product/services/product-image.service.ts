import type { TProductSelect } from '@drizzle/schemas/product.schema';
import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { PRODUCT_REPOSITORY_TOKEN } from '../constants/di';
import type { IProductRepository } from '../contracts/product.repository.interface';
import { ProductNotFoundError } from '../errors/product.errors';

export type TProductWithImage = TProductSelect & { imageUrl: string | null };

/**
 * The one document photo of an item (printed in the quotation "Gambar"
 * column). The website catalog gallery is a separate M04 concern.
 *
 * @remarks
 * Every upload gets a fresh object key, so quotations that snapshotted the
 * previous key keep printing the picture they were issued with.
 */
@injectable()
export class ProductImageService {
	constructor(
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly items: Pick<IProductRepository, 'findById' | 'update'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	withImageUrl(item: TProductSelect): TProductWithImage {
		return { ...item, imageUrl: this.urlFor(item.imageObjectKey) };
	}

	/**
	 * Turns a stored object key into a short-lived URL.
	 *
	 * @param objectKey - The `image_object_key` column, or `null` for no photo
	 * @returns The signed URL, or `null`
	 * @remarks
	 * Shared with list projections that resolve many items at once (stock rows
	 * carry only the key).
	 */
	urlFor(objectKey: string | null): string | null {
		return documentImageUrl(this.storage, objectKey);
	}

	/**
	 * Replaces (or, with `null`, removes) the photo.
	 *
	 * @throws {ProductNotFoundError} When the item is absent or archived
	 */
	async setImage(id: string, file: File | null): Promise<TProductWithImage> {
		if (!(await this.items.findById(id))) throw new ProductNotFoundError();
		const key = file ? await storeDocumentImage(this.storage, `inventory/products/${id}`, file) : null;
		const updated = await this.items.update(id, { imageObjectKey: key });
		if (!updated) throw new ProductNotFoundError();
		return this.withImageUrl(updated);
	}
}

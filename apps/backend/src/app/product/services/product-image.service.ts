import type { TProductSelect } from '@drizzle/schemas/product.schema';
import { documentImageUrl } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { type IGalleryImageRepository, ImageGallery, type TGalleryImage } from '@shared/media';
import { inject, injectable } from 'tsyringe';
import { PRODUCT_IMAGE_REPOSITORY_TOKEN, PRODUCT_REPOSITORY_TOKEN } from '../constants/di';
import type { IProductRepository } from '../contracts/product.repository.interface';
import { ProductNotFoundError } from '../errors/product.errors';

export type TProductWithImage = TProductSelect & { imageUrl: string | null };
export type TProductWithImages = TProductWithImage & { images: TGalleryImage[] };

/**
 * The image gallery of a product, component or material (at most 10 images).
 *
 * @remarks
 * The first image is the cover: its key is mirrored into
 * `products.image_object_key`, which is what quotations snapshot and the
 * public catalog serves, so list rows only need `imageUrl`. Every upload gets
 * a fresh object key, so quotations that snapshotted the previous key keep
 * printing the picture they were issued with.
 */
@injectable()
export class ProductImageService {
	private readonly gallery: ImageGallery;

	constructor(
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly items: Pick<IProductRepository, 'findById' | 'update'>,
		@inject(PRODUCT_IMAGE_REPOSITORY_TOKEN)
		images: IGalleryImageRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {
		this.gallery = new ImageGallery(images, storage, 'inventory/products', async (id, key) => {
			await this.items.update(id, { imageObjectKey: key });
		});
	}

	withImageUrl(item: TProductSelect): TProductWithImage {
		return { ...item, imageUrl: this.urlFor(item.imageObjectKey) };
	}

	/** The item with its cover `imageUrl` and the full gallery. */
	async withImages(item: TProductSelect): Promise<TProductWithImages> {
		return { ...this.withImageUrl(item), images: await this.gallery.list(item.id) };
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

	private async assertExists(id: string): Promise<void> {
		if (!(await this.items.findById(id))) throw new ProductNotFoundError();
	}

	/** @throws {ProductNotFoundError} When the item is absent or archived */
	async list(id: string): Promise<TGalleryImage[]> {
		await this.assertExists(id);
		return this.gallery.list(id);
	}

	/** Appends an image (it becomes the cover when the gallery was empty). */
	async addImage(id: string, file: File, caption: string | null): Promise<TGalleryImage> {
		await this.assertExists(id);
		return this.gallery.add(id, file, caption);
	}

	async updateCaption(id: string, imageId: string, caption: string | null): Promise<TGalleryImage> {
		await this.assertExists(id);
		return this.gallery.updateCaption(id, imageId, caption);
	}

	async removeImage(id: string, imageId: string): Promise<void> {
		await this.assertExists(id);
		await this.gallery.remove(id, imageId);
	}

	/** Applies a full new order; the first id becomes the cover. */
	async reorder(id: string, imageIds: string[]): Promise<TGalleryImage[]> {
		await this.assertExists(id);
		return this.gallery.reorder(id, imageIds);
	}

	/**
	 * Single-photo compatibility: replaces (or, with `null`, removes) the cover.
	 *
	 * @throws {ProductNotFoundError} When the item is absent or archived
	 */
	async setImage(id: string, file: File | null): Promise<TProductWithImages> {
		const current = await this.items.findById(id);
		if (!current) throw new ProductNotFoundError();
		if (file) await this.gallery.replaceCover(id, file);
		else await this.gallery.removeCover(id);
		const updated = await this.items.findById(id);
		if (!updated) throw new ProductNotFoundError();
		return this.withImages(updated);
	}
}

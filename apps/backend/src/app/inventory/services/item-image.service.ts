import type { TItemSelect } from '@drizzle/schemas/inventory.schema';
import { documentImageUrl } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { type IGalleryImageRepository, ImageGallery, type TGalleryImage } from '@shared/media';
import { inject, injectable } from 'tsyringe';
import { ITEM_IMAGE_REPOSITORY_TOKEN, ITEM_REPOSITORY_TOKEN } from '../constants/di';
import type { IItemRepository } from '../contracts/item.repository.interface';
import { ItemNotFoundError } from '../errors/item.errors';

/** A row whose `imageUrl` is the signed URL of its cover photo (or `null`). */
export type TWithItemImage<T extends { imageObjectKey: string | null }> = Omit<T, 'imageUrl'> & {
	imageUrl: string | null;
};

/**
 * The image gallery of a physical asset (at most 10 images), shown on the
 * register card and detail.
 *
 * @remarks
 * The first image is the cover; its key is mirrored into
 * `items.image_object_key`. Every upload gets a fresh object key. The stored
 * `image_url` column is a legacy field and is never read: the response
 * `imageUrl` is always derived from `image_object_key`.
 */
@injectable()
export class ItemImageService {
	private readonly gallery: ImageGallery;

	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly items: Pick<IItemRepository, 'findById' | 'update'>,
		@inject(ITEM_IMAGE_REPOSITORY_TOKEN)
		images: IGalleryImageRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {
		this.gallery = new ImageGallery(images, storage, 'inventory/items', async (id, key) => {
			await this.items.update(id, { imageObjectKey: key });
		});
	}

	/** Replaces the row's `imageUrl` with the signed URL of its cover photo. */
	withImageUrl<T extends { imageObjectKey: string | null }>(row: T): TWithItemImage<T> {
		return { ...row, imageUrl: this.urlFor(row.imageObjectKey) };
	}

	/** The row with its cover `imageUrl` and the full gallery. */
	async withImages<T extends { id: string; imageObjectKey: string | null }>(
		row: T,
	): Promise<TWithItemImage<T> & { images: TGalleryImage[] }> {
		return { ...this.withImageUrl(row), images: await this.gallery.list(row.id) };
	}

	/** Turns a stored object key into a short-lived URL (`null` for no photo). */
	urlFor(objectKey: string | null): string | null {
		return documentImageUrl(this.storage, objectKey);
	}

	/** Another tenant's unit is "not found". */
	private async assertOwned(id: string, organizationId: string): Promise<TItemSelect> {
		const current = await this.items.findById(id);
		if (!current || current.organizationId !== organizationId) throw new ItemNotFoundError();
		return current;
	}

	/** @throws {ItemNotFoundError} When the unit is absent, archived or not the caller's */
	async list(id: string, organizationId: string): Promise<TGalleryImage[]> {
		await this.assertOwned(id, organizationId);
		return this.gallery.list(id);
	}

	/** Appends an image (it becomes the cover when the gallery was empty). */
	async addImage(id: string, organizationId: string, file: File, caption: string | null): Promise<TGalleryImage> {
		await this.assertOwned(id, organizationId);
		return this.gallery.add(id, file, caption);
	}

	async updateCaption(
		id: string,
		organizationId: string,
		imageId: string,
		caption: string | null,
	): Promise<TGalleryImage> {
		await this.assertOwned(id, organizationId);
		return this.gallery.updateCaption(id, imageId, caption);
	}

	async removeImage(id: string, organizationId: string, imageId: string): Promise<void> {
		await this.assertOwned(id, organizationId);
		await this.gallery.remove(id, imageId);
	}

	/** Applies a full new order; the first id becomes the cover. */
	async reorder(id: string, organizationId: string, imageIds: string[]): Promise<TGalleryImage[]> {
		await this.assertOwned(id, organizationId);
		return this.gallery.reorder(id, imageIds);
	}

	/**
	 * Single-photo compatibility: replaces (or, with `null`, removes) the cover.
	 *
	 * @param organizationId - The caller's tenant; another tenant's unit is "not found"
	 * @throws {ItemNotFoundError} When the unit is absent, archived or not the caller's
	 */
	async setImage(
		id: string,
		organizationId: string,
		file: File | null,
	): Promise<TWithItemImage<TItemSelect> & { images: TGalleryImage[] }> {
		await this.assertOwned(id, organizationId);
		if (file) await this.gallery.replaceCover(id, file);
		else await this.gallery.removeCover(id);
		return this.withImages(await this.assertOwned(id, organizationId));
	}
}

import type { TWarehouseSelect } from '@drizzle/schemas/warehouse.schema';
import { documentImageUrl } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { type IGalleryImageRepository, ImageGallery, type TGalleryImage } from '@shared/media';
import { inject, injectable } from 'tsyringe';
import { WAREHOUSE_IMAGE_REPOSITORY_TOKEN, WAREHOUSE_REPOSITORY_TOKEN } from '../constants/di';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import { WarehouseNotFoundError } from '../errors/warehouse.errors';

/** A warehouse row whose `imageUrl` is the signed URL of its cover photo (or `null`). */
export type TWithWarehouseImage<T extends { imageObjectKey: string | null }> = Omit<T, 'imageUrl'> & {
	imageUrl: string | null;
};

/**
 * The image gallery of a warehouse (at most 10 images), shown on the
 * warehouse card and detail page.
 *
 * @remarks
 * The first image is the cover; its key is mirrored into
 * `warehouses.image_object_key`. Every upload gets a fresh object key. The
 * stored `image_url` column is a legacy field and is never read: the response
 * `imageUrl` is always derived from `image_object_key`.
 */
@injectable()
export class WarehouseImageService {
	private readonly gallery: ImageGallery;

	constructor(
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouses: Pick<IWarehouseRepository, 'findById' | 'update'>,
		@inject(WAREHOUSE_IMAGE_REPOSITORY_TOKEN)
		images: IGalleryImageRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {
		this.gallery = new ImageGallery(images, storage, 'warehouse/warehouses', async (id, key) => {
			await this.warehouses.update(id, { imageObjectKey: key });
		});
	}

	/** Replaces the row's `imageUrl` with the signed URL of its cover photo. */
	withImageUrl<T extends { imageObjectKey: string | null }>(row: T): TWithWarehouseImage<T> {
		return { ...row, imageUrl: documentImageUrl(this.storage, row.imageObjectKey) };
	}

	/** The row with its cover `imageUrl` and the full gallery. */
	async withImages<T extends { id: string; imageObjectKey: string | null }>(
		row: T,
	): Promise<TWithWarehouseImage<T> & { images: TGalleryImage[] }> {
		return { ...this.withImageUrl(row), images: await this.gallery.list(row.id) };
	}

	private async assertExists(id: string): Promise<void> {
		if (!(await this.warehouses.findById(id))) throw new WarehouseNotFoundError();
	}

	/** @throws {WarehouseNotFoundError} When the warehouse is absent or archived */
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
	 * @throws {WarehouseNotFoundError} When the warehouse is absent or archived
	 */
	async setImage(
		id: string,
		file: File | null,
	): Promise<TWithWarehouseImage<TWarehouseSelect> & { images: TGalleryImage[] }> {
		await this.assertExists(id);
		if (file) await this.gallery.replaceCover(id, file);
		else await this.gallery.removeCover(id);
		const updated = await this.warehouses.findById(id);
		if (!updated) throw new WarehouseNotFoundError();
		return this.withImages(updated);
	}
}

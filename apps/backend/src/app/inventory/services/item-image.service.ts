import type { TItemSelect } from '@drizzle/schemas/inventory.schema';
import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { ITEM_REPOSITORY_TOKEN } from '../constants/di';
import type { IItemRepository } from '../contracts/item.repository.interface';
import { ItemNotFoundError } from '../errors/item.errors';

/** A row whose `imageUrl` is the signed URL of its photo (or `null`). */
export type TWithItemImage<T extends { imageObjectKey: string | null }> = Omit<T, 'imageUrl'> & {
	imageUrl: string | null;
};

/**
 * The one photo of a physical asset, shown on the register card and detail.
 *
 * @remarks
 * Every upload gets a fresh object key. The stored `image_url` column is a
 * legacy field and is never read: the response `imageUrl` is always derived
 * from `image_object_key`.
 */
@injectable()
export class ItemImageService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly items: Pick<IItemRepository, 'findById' | 'update'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	/** Replaces the row's `imageUrl` with the signed URL of its photo. */
	withImageUrl<T extends { imageObjectKey: string | null }>(row: T): TWithItemImage<T> {
		return { ...row, imageUrl: this.urlFor(row.imageObjectKey) };
	}

	/** Turns a stored object key into a short-lived URL (`null` for no photo). */
	urlFor(objectKey: string | null): string | null {
		return documentImageUrl(this.storage, objectKey);
	}

	/**
	 * Replaces (or, with `null`, removes) the photo.
	 *
	 * @param organizationId - The caller's tenant; another tenant's unit is "not found"
	 * @throws {ItemNotFoundError} When the unit is absent, archived or not the caller's
	 */
	async setImage(
		id: string,
		organizationId: string,
		file: File | null,
	): Promise<TWithItemImage<TItemSelect>> {
		const current = await this.items.findById(id);
		if (!current || current.organizationId !== organizationId) throw new ItemNotFoundError();
		const key = file ? await storeDocumentImage(this.storage, `inventory/items/${id}`, file) : null;
		const updated = await this.items.update(id, { imageObjectKey: key });
		if (!updated) throw new ItemNotFoundError();
		return this.withImageUrl(updated);
	}
}

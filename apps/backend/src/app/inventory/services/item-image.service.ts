import type { TItemSelect } from '@drizzle/schemas/inventory.schema';
import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { ITEM_REPOSITORY_TOKEN } from '../constants/di';
import type { IItemRepository } from '../contracts/item.repository.interface';
import { ItemNotFoundError } from '../errors/inventory.errors';

export type TItemWithImage = TItemSelect & { imageUrl: string | null };

/**
 * The one document photo of an item (printed in the quotation "Gambar"
 * column). The website catalog gallery is a separate M04 concern.
 *
 * @remarks
 * Every upload gets a fresh object key, so quotations that snapshotted the
 * previous key keep printing the picture they were issued with.
 */
@injectable()
export class ItemImageService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly items: Pick<IItemRepository, 'findById' | 'update'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	withImageUrl(item: TItemSelect): TItemWithImage {
		return { ...item, imageUrl: documentImageUrl(this.storage, item.imageObjectKey) };
	}

	/**
	 * Replaces (or, with `null`, removes) the photo.
	 *
	 * @throws {ItemNotFoundError} When the item is absent or archived
	 */
	async setImage(id: string, file: File | null): Promise<TItemWithImage> {
		if (!(await this.items.findById(id))) throw new ItemNotFoundError();
		const key = file ? await storeDocumentImage(this.storage, `inventory/items/${id}`, file) : null;
		const updated = await this.items.update(id, { imageObjectKey: key });
		if (!updated) throw new ItemNotFoundError();
		return this.withImageUrl(updated);
	}
}

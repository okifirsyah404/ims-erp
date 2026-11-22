import type { TWarehouseSelect } from '@drizzle/schemas/warehouse.schema';
import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { WAREHOUSE_REPOSITORY_TOKEN } from '../constants/di';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import { WarehouseNotFoundError } from '../errors/warehouse.errors';

/** A warehouse row whose `imageUrl` is the signed URL of its photo (or `null`). */
export type TWithWarehouseImage<T extends { imageObjectKey: string | null }> = Omit<T, 'imageUrl'> & {
	imageUrl: string | null;
};

/**
 * The one photo of a warehouse, shown on the warehouse card and detail page.
 *
 * @remarks
 * Every upload gets a fresh object key. The stored `image_url` column is a
 * legacy field and is never read: the response `imageUrl` is always derived
 * from `image_object_key`.
 */
@injectable()
export class WarehouseImageService {
	constructor(
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouses: Pick<IWarehouseRepository, 'findById' | 'update'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	/** Replaces the row's `imageUrl` with the signed URL of its photo. */
	withImageUrl<T extends { imageObjectKey: string | null }>(row: T): TWithWarehouseImage<T> {
		return { ...row, imageUrl: documentImageUrl(this.storage, row.imageObjectKey) };
	}

	/**
	 * Replaces (or, with `null`, removes) the photo.
	 *
	 * @throws {WarehouseNotFoundError} When the warehouse is absent or archived
	 */
	async setImage(id: string, file: File | null): Promise<TWithWarehouseImage<TWarehouseSelect>> {
		if (!(await this.warehouses.findById(id))) throw new WarehouseNotFoundError();
		const key = file ? await storeDocumentImage(this.storage, `warehouse/warehouses/${id}`, file) : null;
		const updated = await this.warehouses.update(id, { imageObjectKey: key });
		if (!updated) throw new WarehouseNotFoundError();
		return this.withImageUrl(updated);
	}
}

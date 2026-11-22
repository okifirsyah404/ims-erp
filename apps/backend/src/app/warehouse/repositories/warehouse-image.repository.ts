import { DRIZZLE_TOKEN } from '@di/provider';
import { warehouseImages } from '@drizzle/schemas/warehouse.schema';
import { GalleryRepositoryBase } from '@shared/media';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** Gallery rows of `warehouse.warehouse_images`. */
@injectable()
export class WarehouseImageRepository extends GalleryRepositoryBase {
	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database, warehouseImages, 'warehouseId');
	}
}

import { DRIZZLE_TOKEN } from '@di/provider';
import { itemImages } from '@drizzle/schemas/inventory.schema';
import { GalleryRepositoryBase } from '@shared/media';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** Gallery rows of `inventory.item_images` (physical assets / equipment). */
@injectable()
export class ItemImageRepository extends GalleryRepositoryBase {
	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database, itemImages, 'itemId');
	}
}

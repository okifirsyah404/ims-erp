import { DRIZZLE_TOKEN } from '@di/provider';
import { productImages } from '@drizzle/schemas/product.schema';
import { GalleryRepositoryBase } from '@shared/media';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** Gallery rows of `product.product_images` (products, components, materials). */
@injectable()
export class ProductImageRepository extends GalleryRepositoryBase {
	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database, productImages, 'productId');
	}
}

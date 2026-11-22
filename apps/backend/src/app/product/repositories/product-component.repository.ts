import { DRIZZLE_TOKEN } from '@di/provider';
import { productComponents, products } from '@drizzle/schemas/product.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IProductComponentRepository,
	TComponentCandidate,
	TProductComponentLine,
	TProductComponentRow,
} from '../contracts/product-component.repository.interface';

/** Drizzle implementation of {@link IProductComponentRepository}. */
@injectable()
export class ProductComponentRepository implements IProductComponentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async list(productId: string): Promise<TProductComponentRow[]> {
		const rows = await this.database
			.select({
				id: productComponents.id,
				componentId: productComponents.componentId,
				code: products.code,
				name: products.name,
				productKind: products.productKind,
				unitLabel: products.unitLabel,
				quantity: productComponents.quantity,
				sortOrder: productComponents.sortOrder,
				componentDeletedAt: products.deletedAt,
			})
			.from(productComponents)
			.innerJoin(products, eq(products.id, productComponents.componentId))
			.where(and(eq(productComponents.productId, productId), isNull(productComponents.deletedAt)))
			.orderBy(asc(productComponents.sortOrder), asc(productComponents.createdAt));
		return rows.map(({ componentDeletedAt, ...row }) => ({
			...row,
			productKind: row.productKind as TProductComponentRow['productKind'],
			isArchived: componentDeletedAt !== null,
		}));
	}

	async findLiveByIds(ids: string[]): Promise<TComponentCandidate[]> {
		if (!ids.length) return [];
		const rows = await this.database
			.select({ id: products.id, organizationId: products.organizationId, productKind: products.productKind })
			.from(products)
			.where(and(inArray(products.id, ids), isNull(products.deletedAt)));
		return rows.map((row) => ({
			...row,
			productKind: row.productKind as TComponentCandidate['productKind'],
		}));
	}

	async replace(productId: string, lines: TProductComponentLine[]): Promise<void> {
		await this.database.transaction(async (tx) => {
			const now = new Date();
			await tx
				.update(productComponents)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(productComponents.productId, productId), isNull(productComponents.deletedAt)));
			if (!lines.length) return;
			await tx.insert(productComponents).values(
				lines.map((line, index) => ({
					productId,
					componentId: line.componentId,
					quantity: line.quantity.toFixed(3),
					sortOrder: index,
					createdAt: now,
				})),
			);
		});
	}
}

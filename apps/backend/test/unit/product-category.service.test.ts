/**
 * Product category service unit tests (ADR-0011): one level, company-wide;
 * slugs unique among live rows; a category with live products is not archived.
 *
 * ADR-0026 moved both the category and its service to `@app/product`.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TProductCategorySelect } from '@drizzle/schemas/product.schema';
import {
	createProductCategorySchema,
	type TProductCategoryCreateInput,
	type TProductCategoryUpdateInput,
} from '../../src/app/product/contracts/product-category.contract';
import type { IProductCategoryRepository } from '../../src/app/product/contracts/product-category.repository.interface';
import {
	ProductCategoryHasProductsError,
	ProductCategoryNotFoundError,
	ProductCategorySlugTakenError,
} from '../../src/app/product/errors/product.errors';
import { ProductCategoryService } from '../../src/app/product/services/product-category.service';
import type { ExportedProductService } from '../../src/app/product/services/exported-product.service';

class FakeCategories implements IProductCategoryRepository {
	rows: TProductCategorySelect[] = [];
	liveItems = new Map<string, number>();

	async list(includeInactive: boolean) {
		return this.rows.filter((r) => !r.deletedAt && (includeInactive || r.isActive));
	}
	async findById(id: string) {
		return this.rows.find((r) => r.id === id && !r.deletedAt) ?? null;
	}
	async findBySlug(slug: string) {
		return this.rows.find((r) => r.slug === slug && !r.deletedAt) ?? null;
	}
	async create(data: TProductCategoryCreateInput) {
		const row = {
			...data,
			id: crypto.randomUUID(),
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
		};
		this.rows.push(row);
		return row;
	}
	async update(id: string, data: TProductCategoryUpdateInput) {
		const row = await this.findById(id);
		return row ? Object.assign(row, data) : null;
	}
	async archive(id: string) {
		const row = await this.findById(id);
		return row ? Object.assign(row, { deletedAt: new Date() }) : null;
	}
	async countLiveProducts(id: string) {
		return this.liveItems.get(id) ?? 0;
	}
}

/**
 * The module's export facade answers the cross-module slug question.
 *
 * @remarks
 * `ProductCategoryService.create` delegates the "slug is free" rule to
 * `ExportedProductService.assertCategorySlugFree`, so the fake here is the
 * smallest possible slice of that facade around the same repository.
 */
function fakeExported(repository: FakeCategories): Pick<ExportedProductService, 'assertCategorySlugFree'> {
	return {
		async assertCategorySlugFree(slug: string) {
			if (await repository.findBySlug(slug)) throw new ProductCategorySlugTakenError();
		},
	};
}

const input = (slug: string) =>
	createProductCategorySchema.parse({ slug, name: slug.toUpperCase() });

describe('ProductCategoryService', () => {
	let repository: FakeCategories;
	let service: ProductCategoryService;

	beforeEach(() => {
		repository = new FakeCategories();
		service = new ProductCategoryService(repository, fakeExported(repository) as never);
	});

	test('slugs are kebab-case and unique among live categories', async () => {
		expect(input('Access-Controllers').slug).toBe('access-controllers');
		expect(() => input('access controllers')).toThrow();
		await service.create(input('accessories'));
		await expect(service.create(input('accessories'))).rejects.toBeInstanceOf(
			ProductCategorySlugTakenError,
		);
	});

	test('inactive categories are hidden from pickers unless asked for', async () => {
		const hidden = await service.create(input('old-range'));
		await service.update(hidden.id, { isActive: false });
		await service.create(input('accessories'));
		expect((await service.list()).map((category) => category.slug)).toEqual([
			'accessories',
		]);
		expect(await service.list(true)).toHaveLength(2);
	});

	test('a category with live products cannot be archived; an empty one can, and its slug frees up', async () => {
		const used = await service.create(input('tools'));
		repository.liveItems.set(used.id, 3);
		const error = await service
			.archive(used.id)
			.catch((caught: ProductCategoryHasProductsError) => caught);
		expect(error).toBeInstanceOf(ProductCategoryHasProductsError);
		expect((error as ProductCategoryHasProductsError).params).toEqual({
			count: 3,
		});

		const empty = await service.create(input('spare'));
		await service.archive(empty.id);
		await expect(service.archive(empty.id)).rejects.toBeInstanceOf(
			ProductCategoryNotFoundError,
		);
		await expect(service.create(input('spare'))).resolves.toBeDefined();
	});

	test('updating a missing category is a 404', async () => {
		await expect(
			service.update('01920000-0000-7000-8000-00000000ffff', { name: 'x' }),
		).rejects.toBeInstanceOf(ProductCategoryNotFoundError);
	});
});

import { LICENSING_SERVICE_TOKEN } from '@app/project/constants/di';
import type { LicensingService } from '@app/project/services/licensing.service';
import { appConfig } from '@config/providers/config';
import { isUniqueViolation } from '@drizzle/errors';
import type { TProductCategorySelect, TProductSelect } from '@drizzle/schemas/product.schema';
import { inject, injectable } from 'tsyringe';
import {
	PRODUCT_CATEGORY_REPOSITORY_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
} from '../constants/di';
import { EXPORTED_INVENTORY_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ExportedInventoryService } from '@app/inventory/services/exported-inventory.service';
import type { TListingBody, TProductQuery } from '../contracts/product-listing.contract';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';
import type { IProductRepository } from '../contracts/product.repository.interface';

import { CatalogNotFoundError, ListingConflictError } from '../errors/listing.errors';
import { queryProducts, stockStatus, toRupiah, type TWebProduct } from '../utils/product-listing';
import type { ProductImageService } from './product-image.service';
import { PRODUCT_IMAGE_SERVICE_TOKEN } from '../constants/di';

/** A listing as the admin screen shows it: the product with its listing columns. */
export type TListingView = Pick<
	TProductSelect,
	| 'id'
	| 'sku'
	| 'name'
	| 'sellingPrice'
	| 'slug'
	| 'isPublished'
	| 'publishedAt'
	| 'listingSpecs'
	| 'priceMode'
	| 'priceCaption'
	| 'outOfStockMode'
	| 'leadTimeLabel'
	| 'applications'
	| 'popularity'
	| 'updatedAt'
>;

export type TSolution = { slug: string; name: string; description: string; tags: string[] };

const toView = (row: TProductSelect): TListingView => ({
	id: row.id,
	sku: row.sku,
	name: row.name,
	sellingPrice: row.sellingPrice,
	slug: row.slug,
	isPublished: row.isPublished,
	publishedAt: row.publishedAt,
	listingSpecs: row.listingSpecs,
	priceMode: row.priceMode,
	priceCaption: row.priceCaption,
	outOfStockMode: row.outOfStockMode,
	leadTimeLabel: row.leadTimeLabel,
	applications: row.applications,
	popularity: row.popularity,
	updatedAt: row.updatedAt,
});

/**
 * The website catalog (M04 stage 1), now a part of inventory.
 *
 * @remarks
 * A listing is a set of columns on `inventory.products` (ADR-0024 Q14): a slug,
 * the specs line, list price or quotation, what to show when nothing is in
 * stock, use-case tags and popularity. Name, category, price, photo and stock
 * are read from the product and its stock every time, so the website never shows
 * stale master data. Only published listings of active, live products are
 * public. Software solutions are the company's own, active licensable
 * applications (M03).
 */
@injectable()
export class ProductListingService {
	constructor(
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly products: Pick<
			IProductRepository,
			'findById' | 'update' | 'listListed' | 'listPublished' | 'findBySlug' | 'findPublishedBySlug'
		>,
		@inject(PRODUCT_CATEGORY_REPOSITORY_TOKEN)
		private readonly categories: Pick<IProductCategoryRepository, 'list'>,
		/**
		 * Availability comes from the `inventory` module (ADR-0026): the
		 * balances and units are its tables, so the website stock status is
		 * computed from its facade instead of a join into `inventory.*`.
		 */
		@inject(EXPORTED_INVENTORY_SERVICE_TOKEN)
		private readonly stocks: Pick<ExportedInventoryService, 'availableByProducts'>,
		@inject(PRODUCT_IMAGE_SERVICE_TOKEN)
		private readonly images: Pick<ProductImageService, 'urlFor'>,
		@inject(LICENSING_SERVICE_TOKEN)
		private readonly licensing: Pick<LicensingService, 'listApplications'>,
	) {}

	// Admin -------------------------------------------------------------------

	async listListings(): Promise<TListingView[]> {
		return (await this.products.listListed()).map(toView);
	}

	/** The product must be live and active, and a list price needs a selling price. */
	private async assertListable(
		productId: string,
		priceMode: TListingBody['priceMode'],
	): Promise<TProductSelect> {
		const product = await this.products.findById(productId);
		if (!product || !product.isActive) throw new ListingConflictError('itemUnavailable');
		if (priceMode === 'list' && product.sellingPrice <= 0) throw new ListingConflictError('noPrice');
		return product;
	}

	private conflict(error: unknown): never {
		if (isUniqueViolation(error)) throw new ListingConflictError('slug');
		throw error;
	}

	/** Creates or replaces the listing of a product; a first save stays unpublished. */
	async saveListing(productId: string, body: TListingBody): Promise<TListingView> {
		await this.assertListable(productId, body.priceMode);
		const owner = await this.products.findBySlug(body.slug);
		if (owner && owner.id !== productId) throw new ListingConflictError('slug');
		try {
			const updated = await this.products.update(productId, {
				slug: body.slug,
				listingSpecs: body.specs,
				priceMode: body.priceMode,
				priceCaption: body.priceCaption,
				outOfStockMode: body.outOfStockMode,
				leadTimeLabel: body.leadTimeLabel,
				applications: body.applications,
				popularity: body.popularity,
			});
			if (!updated) throw new CatalogNotFoundError('listing');
			return toView(updated);
		} catch (error) {
			this.conflict(error);
		}
	}

	async setPublished(productId: string, published: boolean): Promise<TListingView> {
		const current = await this.products.findById(productId);
		if (!current?.slug) throw new CatalogNotFoundError('listing');
		if (published) await this.assertListable(productId, current.priceMode as TListingBody['priceMode']);
		const updated = await this.products.update(productId, {
			isPublished: published,
			// The first publication is the "listed at" date of the website.
			publishedAt: published ? (current.publishedAt ?? new Date()) : current.publishedAt,
		});
		if (!updated) throw new CatalogNotFoundError('listing');
		return toView(updated);
	}

	/** Removes the listing (the product stays): the slug is cleared and it is hidden. */
	async removeListing(productId: string): Promise<void> {
		const current = await this.products.findById(productId);
		if (!current?.slug) throw new CatalogNotFoundError('listing');
		await this.products.update(productId, { slug: null, isPublished: false });
	}

	// Public (website) --------------------------------------------------------

	/** Absolute URL of the photo redirect, only where the website accepts it (https). */
	private imageLink(slug: string): string | undefined {
		const base = appConfig.app.url;
		return base?.startsWith('https://')
			? `${base.replace(/\/$/, '')}/products/public/v1/catalog/products/${encodeURIComponent(slug)}/image`
			: undefined;
	}

	/** Every published product, built from the product row and its stock. */
	private async published(): Promise<TWebProduct[]> {
		const rows = await this.products.listPublished();
		const [categories, available] = await Promise.all([
			this.categories.list(true),
			this.stocks.availableByProducts(rows.map((row) => row.id)),
		]);
		const categoryById = new Map<string, TProductCategorySelect>(
			categories.map((category) => [category.id, category]),
		);
		const stockById = new Map(available.map((row) => [row.productId, row.available]));
		return rows.flatMap((row) => {
			if (!row.slug) return [];
			const category = row.productCategoryId ? categoryById.get(row.productCategoryId) : undefined;
			const live = category?.isActive ? category : undefined;
			const image = row.imageObjectKey ? this.imageLink(row.slug) : undefined;
			return [
				{
					slug: row.slug,
					name: row.name,
					categorySlug: live?.slug ?? 'lainnya',
					category: live?.name ?? 'Lainnya',
					shortCategory: live?.shortName ?? live?.name ?? 'Lainnya',
					specs: (row.listingSpecs ?? row.specification ?? row.description ?? '').slice(0, 400),
					stock: stockStatus(
						row.isStockTracked,
						stockById.get(row.id) ?? 0,
						row.outOfStockMode as 'out' | 'preorder' | 'request',
					),
					priceCaption: row.priceCaption ?? '',
					price: row.priceMode === 'list' ? toRupiah(row.sellingPrice) : null,
					rating: 0,
					applications: row.applications,
					popularity: row.popularity,
					listedAt: (row.publishedAt ?? row.createdAt).toISOString(),
					...(image ? { image } : {}),
				},
			];
		});
	}

	async listProducts(query: TProductQuery) {
		return queryProducts(await this.published(), query);
	}

	async getProduct(slug: string): Promise<TWebProduct> {
		const product = (await this.published()).find((row) => row.slug === slug);
		if (!product) throw new CatalogNotFoundError('product');
		return product;
	}

	/** Categories that have published products, with their counts. */
	async listCategories(): Promise<{ slug: string; name: string; productCount: number }[]> {
		const [products, categories] = await Promise.all([this.published(), this.categories.list(false)]);
		const counts = new Map<string, number>();
		for (const product of products) counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1);
		return categories
			.filter((category) => counts.has(category.slug))
			.map((category) => ({ slug: category.slug, name: category.name, productCount: counts.get(category.slug) ?? 0 }));
	}

	async getFacets(): Promise<{
		total: number;
		categories: Record<string, number>;
		availability: Record<string, number>;
	}> {
		const products = await this.published();
		const categories: Record<string, number> = {};
		const availability: Record<string, number> = {};
		for (const product of products) {
			categories[product.categorySlug] = (categories[product.categorySlug] ?? 0) + 1;
			availability[product.stock] = (availability[product.stock] ?? 0) + 1;
		}
		return { total: products.length, categories, availability };
	}

	async getStock(slugs: string[]) {
		const wanted = new Set(slugs);
		const [rows, products] = await Promise.all([this.products.listPublished(), this.published()]);
		return products
			.filter((product) => wanted.has(product.slug))
			.map((product) => {
				const row = rows.find((candidate) => candidate.slug === product.slug);
				return {
					slug: product.slug,
					status: product.stock,
					...(row?.leadTimeLabel ? { leadTimeLabel: row.leadTimeLabel } : {}),
				};
			});
	}

	async getPricing(slugs: string[]) {
		const wanted = new Set(slugs);
		return (await this.published())
			.filter((product) => wanted.has(product.slug))
			.map((product) => ({ slug: product.slug, price: product.price, currency: 'IDR' as const }));
	}

	async listSolutions(): Promise<TSolution[]> {
		const applications = await this.licensing.listApplications(false);
		return applications
			.filter((application) => application.source === 'own')
			.map((application) => ({
				slug: application.code.toLowerCase(),
				name: application.name,
				description: application.description ?? '',
				tags: [],
			}));
	}

	async search(q: string, limit: number) {
		const needle = q.toLowerCase();
		const [products, categories, solutions] = await Promise.all([
			this.published(),
			this.listCategories(),
			this.listSolutions(),
		]);
		const hit = (text: string) => !needle || text.toLowerCase().includes(needle);
		return {
			products: products
				.filter((product) => hit(`${product.name} ${product.category} ${product.specs}`))
				.sort((a, b) => b.popularity - a.popularity)
				.slice(0, limit)
				.map(({ slug, name, category, price, image }) => ({
					slug,
					name,
					category,
					price,
					...(image ? { image } : {}),
				})),
			categories: categories.filter((category) => hit(category.name)).slice(0, limit),
			solutions: solutions.filter((solution) => hit(`${solution.name} ${solution.description}`)).slice(0, limit),
		};
	}

	/**
	 * Published products sharing the most words with a customer's message, for the
	 * WhatsApp assistant (M04 stage 2). Prices are whole rupiah; `null` = quotation only.
	 */
	async matchProducts(
		words: string[],
		limit: number,
	): Promise<{ name: string; category: string; price: number | null; stock: string }[]> {
		if (words.length === 0) return [];
		const products = await this.published();
		return products
			.map((product) => {
				const text = `${product.name} ${product.category} ${product.specs} ${product.applications.join(' ')}`.toLowerCase();
				return { product, score: words.filter((word) => text.includes(word)).length };
			})
			.filter(({ score }) => score > 0)
			.sort((a, b) => b.score - a.score || b.product.popularity - a.product.popularity)
			.slice(0, limit)
			.map(({ product }) => ({
				name: product.name,
				category: product.category,
				price: product.price,
				stock: product.stock,
			}));
	}

	/** Server-side cart pricing: unknown, unpublished or quotation lines cost nothing and are flagged. */
	async priceCart(lines: { productSlug: string; quantity: number }[]) {
		const products = new Map((await this.published()).map((product) => [product.slug, product]));
		const priced = lines.map((line) => {
			const product = products.get(line.productSlug);
			const unitPrice = product?.price ?? null;
			return {
				productSlug: line.productSlug,
				quantity: line.quantity,
				unitPrice,
				lineTotal: unitPrice === null ? 0 : unitPrice * line.quantity,
				available: !!product && product.stock !== 'out' && unitPrice !== null,
			};
		});
		return { lines: priced, subtotal: priced.reduce((sum, line) => sum + line.lineTotal, 0) };
	}

	/** Short-lived URL of a published product's photo (the public image redirect). */
	async imageUrl(slug: string): Promise<string> {
		const product = await this.products.findPublishedBySlug(slug);
		const url = product ? this.images.urlFor(product.imageObjectKey) : null;
		if (!url) throw new CatalogNotFoundError('product');
		return url;
	}
}

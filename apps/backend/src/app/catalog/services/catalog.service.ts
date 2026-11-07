import { ITEM_CATALOG_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ItemCatalogService, TCatalogItem } from '@app/inventory/services/item-catalog.service';
import { LICENSING_SERVICE_TOKEN } from '@app/licensing/constants/di';
import type { LicensingService } from '@app/licensing/services/licensing.service';
import { appConfig } from '@config/providers/config';
import { isUniqueViolation } from '@drizzle/errors';
import type { TWebListingSelect } from '@drizzle/schemas/catalog.schema';
import { inject, injectable } from 'tsyringe';
import { LISTING_REPOSITORY_TOKEN } from '../constants/di';
import type { IListingRepository, TListingBody, TProductQuery } from '../contracts/catalog.contract';
import { CatalogNotFoundError, ListingConflictError } from '../errors/catalog.errors';
import { queryProducts, stockStatus, type TCatalogProduct, toRupiah } from '../utils/catalog';

/** A listing as the admin screen shows it: with its item. */
export type TListingView = TWebListingSelect & { item: Pick<TCatalogItem, 'id' | 'sku' | 'name' | 'sellingPrice'> | null };

export type TSolution = { slug: string; name: string; description: string; tags: string[] };

/**
 * The website catalog (M04 stage 1).
 *
 * @remarks
 * A listing says that an inventory item is on the public website, under
 * which slug and how (specs line, list price or quotation, what to show when
 * nothing is in stock, use-case tags, popularity). Name, category, price,
 * photo and stock are read from inventory every time, through its catalog
 * contract, so the website never shows stale master data. Only published
 * listings of active items are public. Software solutions are the
 * company's own, active licensable applications (M03).
 */
@injectable()
export class CatalogService {
	constructor(
		@inject(LISTING_REPOSITORY_TOKEN) private readonly listings: IListingRepository,
		@inject(ITEM_CATALOG_SERVICE_TOKEN) private readonly inventory: Pick<ItemCatalogService, 'items' | 'available' | 'listCategories' | 'imageUrl'>,
		@inject(LICENSING_SERVICE_TOKEN) private readonly licensing: Pick<LicensingService, 'listApplications'>,
	) {}

	// Admin -------------------------------------------------------------------

	async listListings(): Promise<TListingView[]> {
		const rows = await this.listings.listAll();
		const items = new Map((await this.inventory.items(rows.map((row) => row.itemId))).map((item) => [item.id, item]));
		return rows.map((row) => {
			const item = items.get(row.itemId);
			return { ...row, item: item ? { id: item.id, sku: item.sku, name: item.name, sellingPrice: item.sellingPrice } : null };
		});
	}

	private async assertItem(itemId: string, priceMode: TListingBody['priceMode']) {
		const [item] = await this.inventory.items([itemId]);
		if (!item) throw new ListingConflictError('itemUnavailable');
		if (priceMode === 'list' && item.sellingPrice <= 0) throw new ListingConflictError('noPrice');
	}

	private conflict(error: unknown): never {
		if (isUniqueViolation(error)) {
			let constraint = '';
			for (let current: unknown = error, depth = 0; current && depth < 5; depth += 1) {
				constraint ||= String((current as { constraint?: unknown }).constraint ?? '');
				current = (current as { cause?: unknown }).cause;
			}
			throw new ListingConflictError(constraint.includes('item') ? 'item' : 'slug');
		}
		throw error;
	}

	async create(actorUserId: string, body: TListingBody): Promise<TWebListingSelect> {
		await this.assertItem(body.itemId, body.priceMode);
		try {
			return await this.listings.create({ ...body, isPublished: false, createdBy: actorUserId });
		} catch (error) {
			this.conflict(error);
		}
	}

	async update(id: string, body: TListingBody): Promise<TWebListingSelect> {
		const current = await this.listings.findById(id);
		if (!current) throw new CatalogNotFoundError('listing');
		await this.assertItem(body.itemId, body.priceMode);
		try {
			const updated = await this.listings.update(id, body);
			if (!updated) throw new CatalogNotFoundError('listing');
			return updated;
		} catch (error) {
			this.conflict(error);
		}
	}

	async setPublished(id: string, published: boolean): Promise<TWebListingSelect> {
		const current = await this.listings.findById(id);
		if (!current) throw new CatalogNotFoundError('listing');
		if (published) await this.assertItem(current.itemId, current.priceMode);
		const updated = await this.listings.update(id, {
			isPublished: published,
			// The first publication is the "listed at" date of the website.
			publishedAt: published ? (current.publishedAt ?? new Date()) : current.publishedAt,
		});
		if (!updated) throw new CatalogNotFoundError('listing');
		return updated;
	}

	async remove(id: string): Promise<void> {
		if (!(await this.listings.remove(id))) throw new CatalogNotFoundError('listing');
	}

	// Public (website) --------------------------------------------------------

	/** Absolute URL of the photo redirect, only where the website accepts it (https). */
	private imageLink(slug: string): string | undefined {
		const base = appConfig.app.url;
		return base?.startsWith('https://') ? `${base.replace(/\/$/, '')}/public/v1/catalog/products/${encodeURIComponent(slug)}/image` : undefined;
	}

	/** Every published product, built from the listings and inventory. */
	private async products(): Promise<TCatalogProduct[]> {
		const rows = await this.listings.listPublished();
		const ids = rows.map((row) => row.itemId);
		const [items, available] = await Promise.all([this.inventory.items(ids), this.inventory.available(ids)]);
		const byId = new Map(items.map((item) => [item.id, item]));
		return rows.flatMap((row) => {
			const item = byId.get(row.itemId);
			if (!item) return [];
			const category = item.category;
			const image = item.imageObjectKey ? this.imageLink(row.slug) : undefined;
			return [
				{
					slug: row.slug,
					name: item.name,
					categorySlug: category?.slug ?? 'lainnya',
					category: category?.name ?? 'Lainnya',
					shortCategory: category?.shortName ?? category?.name ?? 'Lainnya',
					specs: (row.specs ?? item.specification ?? item.description ?? '').slice(0, 400),
					stock: stockStatus(item.isStockTracked, available.get(item.id) ?? 0, row.outOfStockMode),
					priceCaption: row.priceCaption ?? '',
					price: row.priceMode === 'list' ? toRupiah(item.sellingPrice) : null,
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
		return queryProducts(await this.products(), query);
	}

	async getProduct(slug: string): Promise<TCatalogProduct> {
		const product = (await this.products()).find((row) => row.slug === slug);
		if (!product) throw new CatalogNotFoundError('product');
		return product;
	}

	/** Categories that have published products, with their counts. */
	async listCategories(): Promise<{ slug: string; name: string; productCount: number }[]> {
		const [products, categories] = await Promise.all([this.products(), this.inventory.listCategories()]);
		const counts = new Map<string, number>();
		for (const product of products) counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1);
		return categories
			.filter((category) => counts.has(category.slug))
			.map((category) => ({ slug: category.slug, name: category.name, productCount: counts.get(category.slug) ?? 0 }));
	}

	async getFacets(): Promise<{ total: number; categories: Record<string, number>; availability: Record<string, number> }> {
		const products = await this.products();
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
		const rows = await this.listings.listPublished();
		const products = (await this.products()).filter((product) => wanted.has(product.slug));
		return products.map((product) => {
			const listing = rows.find((row) => row.slug === product.slug);
			return { slug: product.slug, status: product.stock, ...(listing?.leadTimeLabel ? { leadTimeLabel: listing.leadTimeLabel } : {}) };
		});
	}

	async getPricing(slugs: string[]) {
		const wanted = new Set(slugs);
		return (await this.products())
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
		const [products, categories, solutions] = await Promise.all([this.products(), this.listCategories(), this.listSolutions()]);
		const hit = (text: string) => !needle || text.toLowerCase().includes(needle);
		return {
			products: products
				.filter((product) => hit(`${product.name} ${product.category} ${product.specs}`))
				.sort((a, b) => b.popularity - a.popularity)
				.slice(0, limit)
				.map(({ slug, name, category, price, image }) => ({ slug, name, category, price, ...(image ? { image } : {}) })),
			categories: categories.filter((category) => hit(category.name)).slice(0, limit),
			solutions: solutions.filter((solution) => hit(`${solution.name} ${solution.description}`)).slice(0, limit),
		};
	}

	/** Server-side cart pricing: unknown, unpublished or quotation lines cost nothing and are flagged. */
	async priceCart(lines: { productSlug: string; quantity: number }[]) {
		const products = new Map((await this.products()).map((product) => [product.slug, product]));
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
		const listing = await this.listings.findPublishedBySlug(slug);
		const [item] = listing ? await this.inventory.items([listing.itemId]) : [];
		const url = item ? this.inventory.imageUrl(item.imageObjectKey) : null;
		if (!url) throw new CatalogNotFoundError('product');
		return url;
	}
}

/**
 * Website catalog (M04 stage 1, ADR-0024 Q14): the listing is a set of columns
 * on `inventory.products`. Only published listings of active products are
 * public; name, category, price, stock and photo come from the product row and
 * its stock; stock status, filters, sorts, pages, whole-rupiah prices,
 * quotation pricing, cart pricing, and the listing rules (no list price without
 * a selling price, unique slug).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TProductCategorySelect, TProductSelect } from '@drizzle/schemas/inventory.schema';
import { listingBodySchema, productQuerySchema } from '../../src/app/inventory/contracts/product-listing.contract';
import { CatalogNotFoundError, ListingConflictError } from '../../src/app/inventory/errors/listing.errors';
import { ProductListingService } from '../../src/app/inventory/services/product-listing.service';
import { stockStatus, toRupiah } from '../../src/app/inventory/utils/product-listing';

const CAM = '0190a1b2-0000-7000-8000-0000000000c1';
const GATE = '0190a1b2-0000-7000-8000-0000000000c2';
const CABLE = '0190a1b2-0000-7000-8000-0000000000c3';
const INSTALL = '0190a1b2-0000-7000-8000-0000000000c4';

let products: TProductSelect[];
let stock: Map<string, number>;
let service: ProductListingService;

const category = (id: string, slug: string, name: string, shortName: string | null, sortOrder: number) =>
	({ id, slug, name, shortName, sortOrder, isActive: true }) as TProductCategorySelect;

const CATEGORIES = [
	category('cat-sec', 'security', 'Keamanan', 'Keamanan', 1),
	category('cat-gate', 'gate', 'Gerbang Otomatis', 'Gerbang', 2),
	category('cat-empty', 'empty', 'Kosong', null, 3),
];

const product = (id: string, name: string, price: number, extra: Partial<TProductSelect> = {}) =>
	({
		id,
		sku: name.slice(0, 3).toUpperCase(),
		name,
		description: null,
		specification: `${name} spec`,
		unitLabel: 'unit',
		sellingPrice: price,
		isStockTracked: true,
		isActive: true,
		imageObjectKey: null,
		productCategoryId: 'cat-sec',
		slug: null,
		isPublished: false,
		publishedAt: null,
		listingSpecs: null,
		priceMode: 'list',
		priceCaption: null,
		outOfStockMode: 'request',
		leadTimeLabel: null,
		applications: [],
		popularity: 0,
		createdAt: new Date('2026-11-01T00:00:00Z'),
		updatedAt: new Date('2026-11-01T00:00:00Z'),
		deletedAt: null,
		...extra,
	}) as TProductSelect;

beforeEach(() => {
	products = [
		product(CAM, 'Kamera CCTV', 1_500_000_00),
		product(GATE, 'Swing Gate', 12_000_000_00, { productCategoryId: 'cat-gate' }),
		product(CABLE, 'Kabel UTP', 4_500_050),
		product(INSTALL, 'Jasa Instalasi', 0, { isStockTracked: false }),
	];
	stock = new Map([
		[CAM, 5],
		[GATE, 0],
	]);
	const live = () => products.filter((row) => !row.deletedAt);
	service = new ProductListingService(
		{
			findById: async (id: string) => live().find((row) => row.id === id) ?? null,
			update: async (id: string, data: Partial<TProductSelect>) => {
				const row = live().find((item) => item.id === id);
				if (!row) return null;
				const slug = data.slug;
				if (slug && live().some((other) => other.id !== id && other.slug === slug)) {
					throw Object.assign(new Error('dup'), { code: '23505', constraint: 'products_slug_uq' });
				}
				return Object.assign(row, data);
			},
			listListed: async () => live().filter((row) => row.slug),
			listPublished: async () => live().filter((row) => row.slug && row.isPublished && row.isActive),
			findBySlug: async (slug: string) => live().find((row) => row.slug === slug) ?? null,
			findPublishedBySlug: async (slug: string) =>
				live().find((row) => row.slug === slug && row.isPublished && row.isActive) ?? null,
		},
		{ list: async (includeInactive: boolean) => CATEGORIES.filter(() => includeInactive || true) },
		{ availableByProducts: async (ids: string[]) => ids.map((id) => ({ productId: id, available: stock.get(id) ?? 0 })) },
		{ urlFor: (key: string | null) => (key ? `https://storage.local/${key}` : null) },
		{
			listApplications: async () =>
				[
					{ code: 'ECLOUD', name: 'Entragate Cloud', description: 'Akses kontrol berbasis cloud', source: 'own' },
					{ code: 'ZK', name: 'ZKBio', description: null, source: 'third_party' },
				] as never,
		},
	);
});

async function list(productId: string, slug: string, extra: Record<string, unknown> = {}) {
	await service.saveListing(productId, listingBodySchema.parse({ slug, ...extra }));
	await service.setPublished(productId, true);
}

describe('catalog rules', () => {
	test('stock status and whole rupiah', () => {
		expect(stockStatus(true, 3, 'request')).toBe('ready');
		expect(stockStatus(true, 0, 'preorder')).toBe('preorder');
		expect(stockStatus(false, 0, 'out')).toBe('request');
		expect(toRupiah(4_500_050)).toBe(45_001);
	});
});

describe('listings', () => {
	test('a list price needs a selling price; a slug is unique; a product keeps one listing it can edit', async () => {
		await expect(service.saveListing(INSTALL, listingBodySchema.parse({ slug: 'instalasi' }))).rejects.toMatchObject({
			key: 'catalog.listing.noPrice',
		});
		await service.saveListing(INSTALL, listingBodySchema.parse({ slug: 'instalasi', priceMode: 'rfq' }));
		await expect(service.saveListing(CAM, listingBodySchema.parse({ slug: 'instalasi' }))).rejects.toMatchObject({
			key: 'catalog.listing.slug',
		});
		// the owner may keep or change its own slug (replace, not conflict)
		await service.saveListing(INSTALL, listingBodySchema.parse({ slug: 'jasa', priceMode: 'rfq' }));
		expect(products.find((row) => row.id === INSTALL)?.slug).toBe('jasa');
		expect(() => listingBodySchema.parse({ slug: 'Bad Slug' })).toThrow();
		await expect(service.saveListing('missing', listingBodySchema.parse({ slug: 'xx', priceMode: 'rfq' }))).rejects.toBeInstanceOf(ListingConflictError);
	});

	test('an inactive product cannot be listed or published; a first save is unpublished', async () => {
		products.find((row) => row.id === CAM)!.isActive = false;
		await expect(service.saveListing(CAM, listingBodySchema.parse({ slug: 'kamera' }))).rejects.toMatchObject({
			key: 'catalog.listing.itemUnavailable',
		});
		const saved = await service.saveListing(GATE, listingBodySchema.parse({ slug: 'swing-gate' }));
		expect(saved).toMatchObject({ slug: 'swing-gate', isPublished: false });
		await expect(service.setPublished(CABLE, true)).rejects.toBeInstanceOf(CatalogNotFoundError);
	});

	test('removing a listing clears the slug and hides the product', async () => {
		await list(CAM, 'kamera-cctv');
		await service.removeListing(CAM);
		expect(products.find((row) => row.id === CAM)).toMatchObject({ slug: null, isPublished: false });
		await expect(service.removeListing(CAM)).rejects.toBeInstanceOf(CatalogNotFoundError);
		expect(await service.listListings()).toEqual([]);
	});
});

describe('public catalog', () => {
	beforeEach(async () => {
		await list(CAM, 'kamera-cctv', { popularity: 10, applications: ['Perkantoran'] });
		await list(GATE, 'swing-gate', { outOfStockMode: 'preorder', leadTimeLabel: '2 minggu' });
		await list(INSTALL, 'jasa-instalasi', { priceMode: 'rfq', priceCaption: 'Harga sesuai survei' });
		// Listed but not published: never public.
		await service.saveListing(CABLE, listingBodySchema.parse({ slug: 'kabel-utp' }));
	});

	test('products come from the product row; only published ones', async () => {
		const page = await service.listProducts(productQuerySchema.parse({}));
		expect(page.meta.total).toBe(3);
		expect(page.data[0]).toMatchObject({ slug: 'kamera-cctv', name: 'Kamera CCTV', price: 1_500_000, stock: 'ready', categorySlug: 'security', specs: 'Kamera CCTV spec' });
		await expect(service.getProduct('kabel-utp')).rejects.toBeInstanceOf(CatalogNotFoundError);
		expect(await service.getProduct('jasa-instalasi')).toMatchObject({ price: null, stock: 'request', priceCaption: 'Harga sesuai survei' });
	});

	test('filters, sorts and pages like the website asks', async () => {
		const query = (raw: Record<string, unknown>) => service.listProducts(productQuerySchema.parse(raw));
		expect((await query({ category: 'gate' })).data.map((p) => p.slug)).toEqual(['swing-gate']);
		expect((await query({ availability: ['preorder', 'request'] })).meta.total).toBe(2);
		expect((await query({ application: 'Perkantoran' })).data.map((p) => p.slug)).toEqual(['kamera-cctv']);
		expect((await query({ sort: 'price-desc' })).data.map((p) => p.slug)).toEqual(['swing-gate', 'kamera-cctv', 'jasa-instalasi']);
		expect((await query({ min: '2000000' })).data.map((p) => p.slug)).toEqual(['swing-gate']);
		expect((await query({ limit: '2', page: '2' })).meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
		expect((await query({ q: 'gate' })).meta.total).toBe(1);
	});

	test('categories, facets, stock, pricing, solutions and search', async () => {
		expect(await service.listCategories()).toEqual([
			{ slug: 'security', name: 'Keamanan', productCount: 2 },
			{ slug: 'gate', name: 'Gerbang Otomatis', productCount: 1 },
		]);
		expect(await service.getFacets()).toEqual({ total: 3, categories: { security: 2, gate: 1 }, availability: { ready: 1, preorder: 1, request: 1 } });
		expect(await service.getStock(['swing-gate', 'kabel-utp'])).toEqual([{ slug: 'swing-gate', status: 'preorder', leadTimeLabel: '2 minggu' }]);
		expect(await service.getPricing(['kamera-cctv', 'jasa-instalasi'])).toEqual([
			{ slug: 'kamera-cctv', price: 1_500_000, currency: 'IDR' },
			{ slug: 'jasa-instalasi', price: null, currency: 'IDR' },
		]);
		expect(await service.listSolutions()).toEqual([{ slug: 'ecloud', name: 'Entragate Cloud', description: 'Akses kontrol berbasis cloud', tags: [] }]);
		expect((await service.search('kamera', 5)).products.map((p) => p.slug)).toEqual(['kamera-cctv']);
		expect(await service.matchProducts(['gate'], 3)).toEqual([{ name: 'Swing Gate', category: 'Gerbang Otomatis', price: 12_000_000, stock: 'preorder' }]);
	});

	test('cart pricing on the server: quotation and unknown lines are flagged and free', async () => {
		expect(
			await service.priceCart([
				{ productSlug: 'kamera-cctv', quantity: 2 },
				{ productSlug: 'jasa-instalasi', quantity: 1 },
				{ productSlug: 'kabel-utp', quantity: 3 },
			]),
		).toEqual({
			lines: [
				{ productSlug: 'kamera-cctv', quantity: 2, unitPrice: 1_500_000, lineTotal: 3_000_000, available: true },
				{ productSlug: 'jasa-instalasi', quantity: 1, unitPrice: null, lineTotal: 0, available: false },
				{ productSlug: 'kabel-utp', quantity: 3, unitPrice: null, lineTotal: 0, available: false },
			],
			subtotal: 3_000_000,
		});
	});

	test('the photo redirect needs a published product with a photo', async () => {
		products.find((row) => row.id === CAM)!.imageObjectKey = 'inventory/products/cam.webp';
		expect(await service.imageUrl('kamera-cctv')).toBe('https://storage.local/inventory/products/cam.webp');
		await expect(service.imageUrl('swing-gate')).rejects.toBeInstanceOf(CatalogNotFoundError);
		await expect(service.imageUrl('kabel-utp')).rejects.toBeInstanceOf(CatalogNotFoundError);
	});

	test('hiding a listing removes it from the website at once', async () => {
		await service.setPublished(CAM, false);
		expect((await service.listProducts(productQuerySchema.parse({}))).meta.total).toBe(2);
		expect(products.find((row) => row.id === CAM)?.publishedAt).not.toBeNull();
	});
});

/**
 * Website catalog (M04 stage 1): only published listings of active items
 * are public; name, category, price, stock and photo come from inventory;
 * stock status, filters, sorts, pages, whole-rupiah prices, quotation
 * pricing, cart pricing, and the listing rules (no list price without a
 * selling price, unique slug / item).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TWebListingSelect } from '@drizzle/schemas/catalog.schema';
import type { TCatalogItem } from '../../src/app/inventory/services/item-catalog.service';
import { listingBodySchema, productQuerySchema } from '../../src/app/catalog/contracts/catalog.contract';
import { CatalogNotFoundError, ListingConflictError } from '../../src/app/catalog/errors/catalog.errors';
import { CatalogService } from '../../src/app/catalog/services/catalog.service';
import { stockStatus, toRupiah } from '../../src/app/catalog/utils/catalog';

const CAM = '0190a1b2-0000-7000-8000-0000000000c1';
const GATE = '0190a1b2-0000-7000-8000-0000000000c2';
const CABLE = '0190a1b2-0000-7000-8000-0000000000c3';
const INSTALL = '0190a1b2-0000-7000-8000-0000000000c4';

let listings: TWebListingSelect[];
let items: TCatalogItem[];
let stock: Map<string, number>;
let service: CatalogService;

const item = (id: string, name: string, price: number, extra: Partial<TCatalogItem> = {}) =>
	({
		id,
		sku: name.slice(0, 3).toUpperCase(),
		name,
		description: null,
		specification: `${name} spec`,
		brand: null,
		unitLabel: 'unit',
		sellingPrice: price,
		isStockTracked: true,
		imageObjectKey: null,
		category: { id: 'cat-sec', slug: 'security', name: 'Keamanan', shortName: 'Keamanan' },
		...extra,
	}) as TCatalogItem;

beforeEach(() => {
	items = [
		item(CAM, 'Kamera CCTV', 1_500_000_00),
		item(GATE, 'Swing Gate', 12_000_000_00, { category: { id: 'cat-gate', slug: 'gate', name: 'Gerbang Otomatis', shortName: 'Gerbang' } }),
		item(CABLE, 'Kabel UTP', 4_500_050),
		item(INSTALL, 'Jasa Instalasi', 0, { isStockTracked: false }),
	];
	stock = new Map([
		[CAM, 5],
		[GATE, 0],
	]);
	listings = [];
	service = new CatalogService(
		{
			listAll: async () => listings,
			listPublished: async () => listings.filter((row) => row.isPublished),
			findById: async (id) => listings.find((row) => row.id === id) ?? null,
			findPublishedBySlug: async (slug) => listings.find((row) => row.slug === slug && row.isPublished) ?? null,
			create: async (data) => {
				if (listings.some((row) => row.slug === data.slug)) throw Object.assign(new Error('dup'), { code: '23505', constraint: 'web_listings_slug_uq' });
				if (listings.some((row) => row.itemId === data.itemId)) throw Object.assign(new Error('dup'), { code: '23505', constraint: 'web_listings_item_uq' });
				const row = { ...data, id: crypto.randomUUID(), createdAt: new Date('2026-11-01T00:00:00Z'), publishedAt: null } as TWebListingSelect;
				listings.push(row);
				return row;
			},
			update: async (id, data) => {
				const row = listings.find((item) => item.id === id);
				return row ? Object.assign(row, data) : null;
			},
			remove: async () => true,
		},
		{
			items: async (ids) => items.filter((row) => ids.includes(row.id)),
			available: async (ids) => new Map(ids.map((id) => [id, stock.get(id) ?? 0])),
			listCategories: async () => [
				{ id: 'cat-sec', slug: 'security', name: 'Keamanan', shortName: 'Keamanan', sortOrder: 1 },
				{ id: 'cat-gate', slug: 'gate', name: 'Gerbang Otomatis', shortName: 'Gerbang', sortOrder: 2 },
				{ id: 'cat-empty', slug: 'empty', name: 'Kosong', shortName: null, sortOrder: 3 },
			],
			imageUrl: (key) => (key ? `https://storage.local/${key}` : null),
		},
		{
			listApplications: async () =>
				[
					{ code: 'ECLOUD', name: 'Entragate Cloud', description: 'Akses kontrol berbasis cloud', source: 'own' },
					{ code: 'ZK', name: 'ZKBio', description: null, source: 'third_party' },
				] as never,
		},
	);
});

async function list(itemId: string, slug: string, extra: Record<string, unknown> = {}) {
	const created = await service.create('u', listingBodySchema.parse({ itemId, slug, ...extra }));
	await service.setPublished(created.id, true);
	return created;
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
	test('a list price needs a selling price; slug and item are unique', async () => {
		await expect(service.create('u', listingBodySchema.parse({ itemId: INSTALL, slug: 'instalasi' }))).rejects.toMatchObject({ key: 'catalog.listing.noPrice' });
		await service.create('u', listingBodySchema.parse({ itemId: INSTALL, slug: 'instalasi', priceMode: 'rfq' }));
		await expect(service.create('u', listingBodySchema.parse({ itemId: CAM, slug: 'instalasi' }))).rejects.toMatchObject({ key: 'catalog.listing.slug' });
		await expect(service.create('u', listingBodySchema.parse({ itemId: INSTALL, slug: 'jasa' }))).rejects.toBeInstanceOf(ListingConflictError);
		expect(() => listingBodySchema.parse({ itemId: CAM, slug: 'Bad Slug' })).toThrow();
	});
});

describe('public catalog', () => {
	beforeEach(async () => {
		await list(CAM, 'kamera-cctv', { popularity: 10, applications: ['Perkantoran'] });
		await list(GATE, 'swing-gate', { outOfStockMode: 'preorder', leadTimeLabel: '2 minggu' });
		await list(INSTALL, 'jasa-instalasi', { priceMode: 'rfq', priceCaption: 'Harga sesuai survei' });
		// Listed but not published: never public.
		await service.create('u', listingBodySchema.parse({ itemId: CABLE, slug: 'kabel-utp' }));
	});

	test('products come from inventory; only published ones', async () => {
		const page = await service.listProducts(productQuerySchema.parse({}));
		expect(page.total).toBe(3);
		expect(page.items[0]).toMatchObject({ slug: 'kamera-cctv', name: 'Kamera CCTV', price: 1_500_000, stock: 'ready', categorySlug: 'security', specs: 'Kamera CCTV spec' });
		await expect(service.getProduct('kabel-utp')).rejects.toBeInstanceOf(CatalogNotFoundError);
		expect(await service.getProduct('jasa-instalasi')).toMatchObject({ price: null, stock: 'request', priceCaption: 'Harga sesuai survei' });
	});

	test('filters, sorts and pages like the website asks', async () => {
		const query = (raw: Record<string, unknown>) => service.listProducts(productQuerySchema.parse(raw));
		expect((await query({ category: 'gate' })).items.map((p) => p.slug)).toEqual(['swing-gate']);
		expect((await query({ availability: ['preorder', 'request'] })).total).toBe(2);
		expect((await query({ application: 'Perkantoran' })).items.map((p) => p.slug)).toEqual(['kamera-cctv']);
		expect((await query({ sort: 'price-desc' })).items.map((p) => p.slug)).toEqual(['swing-gate', 'kamera-cctv', 'jasa-instalasi']);
		expect((await query({ min: '2000000' })).items.map((p) => p.slug)).toEqual(['swing-gate']);
		expect(await query({ pageSize: '2', page: '2' })).toMatchObject({ page: 2, pageCount: 2, total: 3 });
		expect((await query({ q: 'gate' })).total).toBe(1);
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
		const found = await service.search('kamera', 5);
		expect(found.products.map((p) => p.slug)).toEqual(['kamera-cctv']);
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

	test('hiding a listing removes it from the website at once', async () => {
		const camera = listings.find((row) => row.slug === 'kamera-cctv')!;
		await service.setPublished(camera.id, false);
		expect((await service.listProducts(productQuerySchema.parse({}))).total).toBe(2);
		expect(camera.publishedAt).not.toBeNull();
	});
});

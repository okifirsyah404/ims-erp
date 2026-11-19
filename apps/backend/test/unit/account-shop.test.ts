/**
 * Website account cart and wishlist (ERP-0074).
 *
 * Covers: merge keeps the larger quantity per product + options (options in
 * any order are the same line), replace overwrites, unpublished/unknown
 * slugs are dropped, the line and item caps, the wishlist merge/replace with
 * stable ids, hidden unpublished products, and removal scoped to the owner.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TCatalogProduct } from '@app/catalog/utils/catalog';
import type { TCartItemSelect, TWishlistItemSelect } from '@drizzle/schemas/commerce.schema';
import { CART_MAX_LINES, type IAccountShopRepository, type TCartLineWrite } from '../../src/app/commerce/contracts/account-shop.contract';
import { WishlistItemNotFoundError } from '../../src/app/commerce/errors/commerce.errors';
import { AccountShopService, optionsKey } from '../../src/app/commerce/services/account-shop.service';

let carts: Map<string, TCartLineWrite[]>;
let wishlist: (TWishlistItemSelect & { live: boolean })[];
let published: Set<string>;
let service: AccountShopService;

const product = (slug: string) => ({ slug, name: slug.toUpperCase(), category: 'Gates', price: 1000, priceCaption: '', stock: 'ready' }) as unknown as TCatalogProduct;

beforeEach(() => {
	carts = new Map();
	wishlist = [];
	published = new Set(['gate-a', 'gate-b', 'reader-c']);
	const repository: IAccountShopRepository = {
		listCart: async (customerId) => (carts.get(customerId) ?? []).map((line, index) => ({ ...line, id: `${index}`, customerId, createdAt: new Date() }) as unknown as TCartItemSelect),
		writeCart: async (customerId, lines) => void carts.set(customerId, lines.map((line) => ({ ...line }))),
		listWishlist: async (customerId) => wishlist.filter((row) => row.customerId === customerId && row.live),
		writeWishlist: async (customerId, slugs) => {
			for (const row of wishlist) if (row.customerId === customerId && row.live && !slugs.includes(row.productSlug)) row.live = false;
			for (const slug of slugs) {
				if (!wishlist.some((row) => row.customerId === customerId && row.live && row.productSlug === slug)) {
					wishlist.push({ id: crypto.randomUUID(), customerId, productSlug: slug, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, live: true });
				}
			}
		},
		removeWishlistItem: async (customerId, id) => {
			const row = wishlist.find((entry) => entry.id === id && entry.customerId === customerId && entry.live);
			if (row) row.live = false;
			return Boolean(row);
		},
	};
	service = new AccountShopService(repository, { productsBySlugs: async (slugs) => slugs.filter((slug) => published.has(slug)).map(product) });
});

describe('account cart', () => {
	test('options in any order are the same line', () => {
		expect(optionsKey({ color: 'black', finish: 'matte' })).toBe(optionsKey({ finish: 'matte', color: 'black' }));
		expect(optionsKey(undefined)).toBe('');
	});

	test('merge keeps the larger quantity, so repeating it is harmless', async () => {
		await service.syncCart('c1', { mode: 'replace', lines: [{ productSlug: 'gate-a', quantity: 3, options: { color: 'black' } }] });
		const merged = await service.syncCart('c1', {
			mode: 'merge',
			lines: [
				{ productSlug: 'gate-a', quantity: 1, options: { color: 'black' } },
				{ productSlug: 'gate-a', quantity: 2, options: { color: 'white' } },
				{ productSlug: 'gate-b', quantity: 5 },
			],
		});
		expect(merged).toEqual([
			{ productSlug: 'gate-a', quantity: 3, options: { color: 'black' } },
			{ productSlug: 'gate-a', quantity: 2, options: { color: 'white' } },
			{ productSlug: 'gate-b', quantity: 5 },
		]);
		expect(await service.syncCart('c1', { mode: 'merge', lines: [{ productSlug: 'gate-b', quantity: 5 }] })).toEqual(merged);
	});

	test('replace overwrites; unknown or unpublished products are dropped, also on read', async () => {
		await service.syncCart('c1', { mode: 'replace', lines: [{ productSlug: 'gate-a', quantity: 1 }, { productSlug: 'nope', quantity: 1 }] });
		expect(await service.getCart('c1')).toEqual([{ productSlug: 'gate-a', quantity: 1 }]);
		published.delete('gate-a');
		expect(await service.getCart('c1')).toEqual([]);
		expect(await service.getCart('c2')).toEqual([]);
	});

	test(`at most ${CART_MAX_LINES} lines`, async () => {
		for (let index = 0; index < 60; index += 1) published.add(`p-${index}`);
		const lines = Array.from({ length: 50 }, (_, index) => ({ productSlug: `p-${index}`, quantity: 1 }));
		await service.syncCart('c1', { mode: 'replace', lines });
		const more = await service.syncCart('c1', { mode: 'merge', lines: Array.from({ length: 10 }, (_, index) => ({ productSlug: `p-${50 + index}`, quantity: 1 })) });
		expect(more).toHaveLength(CART_MAX_LINES);
	});
});

describe('wishlist', () => {
	test('merge adds, replace removes the rest; kept rows keep their id', async () => {
		expect(await service.syncWishlist('c1', { mode: 'merge', slugs: ['gate-a', 'gate-b', 'unknown'] })).toEqual(['gate-a', 'gate-b']);
		const firstId = (await service.listWishlist('c1')).find((entry) => entry.productSlug === 'gate-a')!.id;
		expect(await service.syncWishlist('c1', { mode: 'merge', slugs: ['reader-c'] })).toEqual(['gate-a', 'gate-b', 'reader-c']);
		expect(await service.syncWishlist('c1', { mode: 'replace', slugs: ['gate-a'] })).toEqual(['gate-a']);
		const list = await service.listWishlist('c1');
		expect(list.map((entry) => entry.productSlug)).toEqual(['gate-a']);
		expect(list[0]!.id).toBe(firstId);
		expect(list[0]!.product.name).toBe('GATE-A');
	});

	test('an unpublished product is hidden; removal is scoped to the owner', async () => {
		await service.syncWishlist('c1', { mode: 'replace', slugs: ['gate-a', 'gate-b'] });
		published.delete('gate-b');
		const [entry, ...rest] = await service.listWishlist('c1');
		expect(rest).toEqual([]);
		await expect(service.removeWishlistItem('c2', entry!.id)).rejects.toBeInstanceOf(WishlistItemNotFoundError);
		await service.removeWishlistItem('c1', entry!.id);
		await expect(service.removeWishlistItem('c1', entry!.id)).rejects.toBeInstanceOf(WishlistItemNotFoundError);
		expect(await service.listWishlist('c1')).toEqual([]);
	});
});

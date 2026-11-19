import { CATALOG_SERVICE_TOKEN } from '@app/catalog/constants/di';
import type { CatalogService } from '@app/catalog/services/catalog.service';
import type { TCatalogProduct } from '@app/catalog/utils/catalog';
import { inject, injectable } from 'tsyringe';
import { ACCOUNT_SHOP_REPOSITORY_TOKEN } from '../constants/di';
import {
	CART_MAX_LINES,
	type IAccountShopRepository,
	type TCartLine,
	type TCartLineWrite,
	type TCartSync,
	type TWishlistSync,
	WISHLIST_MAX_ITEMS,
} from '../contracts/account-shop.contract';
import { WishlistItemNotFoundError } from '../errors/commerce.errors';

/** A saved product with its catalog data (only published products are shown). */
export type TWishlistEntry = { id: string; productSlug: string; addedAt: Date; product: TCatalogProduct };

/** Sorted `name=value` pairs: the same options in any order are the same line. */
export function optionsKey(options: Record<string, string> | undefined): string {
	return Object.entries(options ?? {})
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, value]) => `${name}=${value}`)
		.join('&')
		.slice(0, 500);
}

const toLine = (row: { productSlug: string; quantity: number; options: Record<string, string> }): TCartLine => ({
	productSlug: row.productSlug,
	quantity: row.quantity,
	...(Object.keys(row.options).length > 0 ? { options: row.options } : {}),
});

/**
 * The website's account cart and wishlist (ERP-0074, company-wide, one per
 * customer — every login of the customer shares them).
 *
 * @remarks
 * Lines are kept by the catalog's published slug. A product that is no
 * longer published drops out of the cart on the next sync and is hidden
 * from the wishlist; unknown slugs sent by the website are ignored. Callers
 * pass the customer id the portal guard resolved, never one from a request.
 */
@injectable()
export class AccountShopService {
	constructor(
		@inject(ACCOUNT_SHOP_REPOSITORY_TOKEN) private readonly repository: IAccountShopRepository,
		@inject(CATALOG_SERVICE_TOKEN) private readonly catalog: Pick<CatalogService, 'productsBySlugs'>,
	) {}

	private async published(slugs: string[]): Promise<Map<string, TCatalogProduct>> {
		if (slugs.length === 0) return new Map();
		return new Map((await this.catalog.productsBySlugs([...new Set(slugs)])).map((product) => [product.slug, product]));
	}

	/** The account cart, published products only. */
	async getCart(customerId: string): Promise<TCartLine[]> {
		const rows = await this.repository.listCart(customerId);
		const known = await this.published(rows.map((row) => row.productSlug));
		return rows.filter((row) => known.has(row.productSlug)).map(toLine);
	}

	/**
	 * `merge` folds the device cart in (same product + options keep the larger
	 * quantity, so repeating it is harmless); `replace` makes the account cart
	 * the device cart. At most {@link CART_MAX_LINES} lines.
	 */
	async syncCart(customerId: string, input: TCartSync): Promise<TCartLine[]> {
		const lines = new Map<string, TCartLineWrite>();
		const add = (line: TCartLine) => {
			const options = line.options ?? {};
			const key = `${line.productSlug}|${optionsKey(options)}`;
			const current = lines.get(key);
			if (current) current.quantity = Math.max(current.quantity, line.quantity);
			else lines.set(key, { productSlug: line.productSlug, quantity: line.quantity, options, optionsKey: optionsKey(options) });
		};
		if (input.mode === 'merge') (await this.repository.listCart(customerId)).forEach((row) => add(toLine(row)));
		input.lines.forEach(add);
		const known = await this.published([...lines.values()].map((line) => line.productSlug));
		const kept = [...lines.values()].filter((line) => known.has(line.productSlug)).slice(0, CART_MAX_LINES);
		await this.repository.writeCart(customerId, kept);
		return kept.map(toLine);
	}

	/** The saved products that are still published, oldest first. */
	async listWishlist(customerId: string): Promise<TWishlistEntry[]> {
		const rows = await this.repository.listWishlist(customerId);
		const known = await this.published(rows.map((row) => row.productSlug));
		return rows.flatMap((row) => {
			const product = known.get(row.productSlug);
			return product ? [{ id: row.id, productSlug: row.productSlug, addedAt: row.createdAt, product }] : [];
		});
	}

	/** `merge` adds the device's saved products; `replace` makes the account match. Returns the saved slugs. */
	async syncWishlist(customerId: string, input: TWishlistSync): Promise<string[]> {
		const current = input.mode === 'merge' ? (await this.repository.listWishlist(customerId)).map((row) => row.productSlug) : [];
		const wanted = [...new Set([...current, ...input.slugs])];
		const known = await this.published(wanted);
		const kept = wanted.filter((slug) => known.has(slug)).slice(0, WISHLIST_MAX_ITEMS);
		await this.repository.writeWishlist(customerId, kept);
		return kept;
	}

	/** @throws {WishlistItemNotFoundError} when the saved product is not the customer's or already removed */
	async removeWishlistItem(customerId: string, id: string): Promise<void> {
		if (!(await this.repository.removeWishlistItem(customerId, id))) throw new WishlistItemNotFoundError();
	}
}

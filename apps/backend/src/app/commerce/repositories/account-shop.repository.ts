import { DRIZZLE_TOKEN } from '@di/provider';
import { cartItems, type TCartItemSelect, type TWishlistItemSelect, wishlistItems } from '@drizzle/schemas/commerce.schema';
import { and, asc, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IAccountShopRepository, TCartLineWrite } from '../contracts/account-shop.contract';

/** Drizzle persistence of the website account cart and wishlist (ERP-0074). */
@injectable()
export class AccountShopRepository implements IAccountShopRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listCart(customerId: string): Promise<TCartItemSelect[]> {
		return this.database
			.select()
			.from(cartItems)
			.where(and(eq(cartItems.customerId, customerId), isNull(cartItems.deletedAt)))
			.orderBy(asc(cartItems.createdAt), asc(cartItems.id));
	}

	async writeCart(customerId: string, lines: TCartLineWrite[]): Promise<void> {
		await this.database.transaction(async (tx) => {
			const now = new Date();
			await tx
				.update(cartItems)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(cartItems.customerId, customerId), isNull(cartItems.deletedAt)));
			if (lines.length > 0) {
				await tx.insert(cartItems).values(lines.map((line) => ({ ...line, customerId, createdAt: now, updatedAt: now })));
			}
		});
	}

	listWishlist(customerId: string): Promise<TWishlistItemSelect[]> {
		return this.database
			.select()
			.from(wishlistItems)
			.where(and(eq(wishlistItems.customerId, customerId), isNull(wishlistItems.deletedAt)))
			.orderBy(asc(wishlistItems.createdAt), asc(wishlistItems.id));
	}

	async writeWishlist(customerId: string, slugs: string[]): Promise<void> {
		await this.database.transaction(async (tx) => {
			const now = new Date();
			const live = and(eq(wishlistItems.customerId, customerId), isNull(wishlistItems.deletedAt));
			await tx
				.update(wishlistItems)
				.set({ deletedAt: now, updatedAt: now })
				.where(slugs.length > 0 ? and(live, notInArray(wishlistItems.productSlug, slugs)) : live);
			const kept = slugs.length > 0 ? await tx.select({ slug: wishlistItems.productSlug }).from(wishlistItems).where(and(live, inArray(wishlistItems.productSlug, slugs))) : [];
			const have = new Set(kept.map((row) => row.slug));
			const added = slugs.filter((slug) => !have.has(slug));
			if (added.length > 0) {
				await tx.insert(wishlistItems).values(added.map((productSlug) => ({ customerId, productSlug, createdAt: now, updatedAt: now })));
			}
		});
	}

	async removeWishlistItem(customerId: string, id: string): Promise<boolean> {
		const now = new Date();
		const rows = await this.database
			.update(wishlistItems)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(wishlistItems.id, id), eq(wishlistItems.customerId, customerId), isNull(wishlistItems.deletedAt)))
			.returning({ id: wishlistItems.id });
		return rows.length > 0;
	}
}

import type { TCartItemSelect, TWishlistItemSelect } from '@drizzle/schemas/commerce.schema';
import { z } from 'zod';

/** Account cart and wishlist of the public website (ERP-0074). */

export const CART_MAX_LINES = 50;
export const WISHLIST_MAX_ITEMS = 100;

const slug = z.string().trim().min(1).max(120);
const options = z.record(z.string().trim().min(1).max(60), z.string().trim().max(120));

/** A cart line as the website sends and receives it (`CartLine`). */
export const cartLineSchema = z.object({
	productSlug: slug,
	quantity: z.number().int().min(1).max(999),
	options: options.optional(),
});

export const cartSyncSchema = z.object({
	lines: z.array(cartLineSchema).max(CART_MAX_LINES),
	/** `merge` folds a guest cart in (larger quantity wins); `replace` overwrites it. */
	mode: z.enum(['merge', 'replace']),
});

export const wishlistSyncSchema = z.object({
	slugs: z.array(slug).max(WISHLIST_MAX_ITEMS),
	/** `merge` adds the device's saved products; `replace` makes the account match the device. */
	mode: z.enum(['merge', 'replace']),
});

export type TCartLine = z.output<typeof cartLineSchema>;
export type TCartSync = z.output<typeof cartSyncSchema>;
export type TWishlistSync = z.output<typeof wishlistSyncSchema>;

/** A desired cart line with its canonical options key. */
export type TCartLineWrite = { productSlug: string; quantity: number; options: Record<string, string>; optionsKey: string };

export interface IAccountShopRepository {
	listCart(customerId: string): Promise<TCartItemSelect[]>;
	/** Makes the customer's live cart exactly these lines (one transaction). */
	writeCart(customerId: string, lines: TCartLineWrite[]): Promise<void>;
	listWishlist(customerId: string): Promise<TWishlistItemSelect[]>;
	/** Adds the missing slugs and soft-deletes the live rows not listed (ids of kept rows stay). */
	writeWishlist(customerId: string, slugs: string[]): Promise<void>;
	/** Soft-deletes one of the customer's saved products; `false` when it is not theirs or gone. */
	removeWishlistItem(customerId: string, id: string): Promise<boolean>;
}

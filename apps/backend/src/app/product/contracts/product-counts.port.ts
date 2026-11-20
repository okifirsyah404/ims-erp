/**
 * Port the product module resolves a `useFactory` token for.
 *
 * @remarks
 * ADR-0026 crosses two module boundaries in both directions once each:
 *
 * - `inventory` → `product`: read the product kind of a unit
 *   (`ExportedProductService.productKinds`);
 * - `product` → `inventory`: read the serial count of a product
 *   (`ExportedInventoryService.countSerials`).
 *
 * tsyringe cannot construct that pair: `ExportedProductService` depends on
 * `ExportedInventoryService`, which depends back on it. The cycle is cut here
 * with a factory token parameterised by who is being wired:
 *
 * - when the container builds `ExportedInventoryService` (a consumer of
 *   product), the token resolves to the real `ExportedProductService`;
 * - when it builds anything on the product side, the token resolves to
 *   `UNWIRED_PRODUCT_COUNTS`, which throws a wiring error if the dependency is
 *   ever asked for (the product side never asks).
 *
 * Registration is ordered so the "consumer of product" flag is set first
 * (`registerInventory` runs after `registerProduct` but the token is resolved
 * lazily, on first construction of a facade).
 */
import type { ExportedProductService } from '../services/exported-product.service';

/** What the product module needs from the inventory module, nothing more. */
export type TProductSerialCounts = {
	/** Live serial units of one product (archive guard). */
	countSerials(productId: string): Promise<number>;
};

/**
 * Placeholder for the product side of the graph.
 *
 * @remarks
 * Registered with `useValue` so tsyringe stops: nothing on the product side
 * reads serial counts (the facade only exposes `countSerials`, which is
 * expressed as this port and implemented by inventory), so asking for it is a
 * wiring bug and says so.
 */
export const UNWIRED_PRODUCT_COUNTS: TProductSerialCounts = {
	countSerials(): Promise<number> {
		return Promise.reject(
			new Error(
				'TProductSerialCounts is only wired for the inventory side of the graph (ADR-0026)',
			),
		);
	},
};

/** Port implemented by `ExportedProductService` for the inventory module. */
export type TProductKindLookup = Pick<ExportedProductService, 'productKinds'>;

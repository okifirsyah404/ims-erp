/**
 * Contract fragments shared by the inventory, product and warehouse routes.
 *
 * @remarks
 * The three modules were one until ADR-0026 and their HTTP contracts still
 * share two primitives: the pagination query and the id path param. They live
 * in this provider-neutral file (imported with a relative path by each module's
 * contract file) rather than in one module's `contracts/`, so no module has to
 * import another module's HTTP layer.
 */
import { z } from 'zod';

/**
 * Request/response schemas shared by every list endpoint of the stock, product
 * and warehouse routes.
 *
 * @remarks
 * Parsed at the controller boundary; the service refines. Pagination follows
 * `api-conventions.md`: 1-based `page`, `limit` capped at 100.
 */
export const inventoryPaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Path params carrying a single resource id. */
export const idParamSchema = z.object({ id: z.uuid() });

/**
 * Query-string boolean: accepts real booleans and the strings `'true'`/`'false'`.
 *
 * @remarks
 * A bare `z.coerce.boolean()` would treat the string `'false'` as `true`.
 */
export const booleanQuerySchema = z
	.union([z.boolean(), z.enum(['true', 'false'])])
	.transform((value) => value === true || value === 'true');

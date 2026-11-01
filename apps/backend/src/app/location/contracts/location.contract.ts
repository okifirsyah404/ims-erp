import { z } from 'zod';

/**
 * Shared pagination + filter query schemas for the location selection API.
 *
 * @remarks
 * Parsed at the controller boundary before any service call; filter
 * fields map 1:1 onto the repository pagination contracts. All filters
 * are case-insensitive partial matches except the parent `*Id` fields,
 * which are exact.
 */

/** Pagination envelope request: 1-based page with a capped page size. */
export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Parsed pagination query: 1-based page with a page size capped at 100.
 */
export type TPaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Pagination plus optional `code`/`name` search filters for provinces.
 */
export const provinceQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
});

/** Parsed {@link provinceQuerySchema}. */
export type TProvinceQuery = z.infer<typeof provinceQuerySchema>;

/**
 * Pagination plus optional `code`/`name` filters and an exact parent
 * province id for regencies.
 */
export const regencyQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	provinceId: z.uuid().optional(),
});

/** Parsed {@link regencyQuerySchema}. */
export type TRegencyQuery = z.infer<typeof regencyQuerySchema>;

/**
 * Pagination plus optional `code`/`name` filters and an exact parent
 * regency id for districts.
 */
export const districtQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	regencyId: z.uuid().optional(),
});

/** Parsed {@link districtQuerySchema}. */
export type TDistrictQuery = z.infer<typeof districtQuerySchema>;

/**
 * Pagination plus optional `code`/`name` filters and an exact parent
 * district id for villages.
 */
export const villageQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	districtId: z.uuid().optional(),
});

/** Parsed {@link villageQuerySchema}. */
export type TVillageQuery = z.infer<typeof villageQuerySchema>;

/**
 * Response envelope schemas mirroring {@link TApiResponse} and
 * {@link TApiPaginatedResponse} from `@ims-erp/common`, for runtime
 * validation and OpenAPI documentation.
 */
export const apiMetaSchema = z.object({
	requestId: z.string(),
	status: z.number(),
	message: z.string(),
	timestamp: z.number(),
});

/** One per-field (or per-constraint) validation failure inside a response. */
export const apiErrorSchema = z.object({
	field: z.string().nullable().optional(),
	message: z.string(),
});

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

export type TPaginationQuery = z.infer<typeof paginationQuerySchema>;

export const provinceQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
});

export type TProvinceQuery = z.infer<typeof provinceQuerySchema>;

export const regencyQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	provinceId: z.uuid().optional(),
});

export type TRegencyQuery = z.infer<typeof regencyQuerySchema>;

export const districtQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	regencyId: z.uuid().optional(),
});

export type TDistrictQuery = z.infer<typeof districtQuerySchema>;

export const villageQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	districtId: z.uuid().optional(),
});

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

export const apiErrorSchema = z.object({
	field: z.string().nullable().optional(),
	message: z.string(),
});

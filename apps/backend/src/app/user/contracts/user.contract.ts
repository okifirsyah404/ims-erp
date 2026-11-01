import { z } from 'zod';

/**
 * Request/response contracts for the user module's first-party admin API.
 *
 * @remarks
 * Parsed at the controller boundary before any service call. Users are
 * Better Auth–owned identity rows (`auth.users`); mutations flow through
 * the Better Auth admin API while `deletedAt` is soft-delete state owned
 * by the user repository.
 */

/** Pagination envelope request: 1-based page with a capped page size. */
export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TPaginationQuery = z.infer<typeof paginationQuerySchema>;

export const userQuerySchema = paginationQuerySchema.extend({
	email: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	username: z.string().min(1).optional(),
	role: z.string().min(1).optional(),
	banned: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.optional(),
});

export type TUserQuery = z.infer<typeof userQuerySchema>;

/** Body for creating a user through the Better Auth admin API. */
export const createUserSchema = z.object({
	email: z.email(),
	password: z.string().min(8).max(72),
	name: z.string().min(1).max(120),
	username: z.string().min(3).max(30).optional(),
	role: z.string().min(1).optional(),
	bio: z.string().max(1000).optional(),
});

export type TCreateUser = z.infer<typeof createUserSchema>;

/** Body for updating profile fields (never `role` — use the role endpoint). */
export const updateUserSchema = z.object({
	name: z.string().min(1).max(120).optional(),
	username: z.string().min(3).max(30).optional(),
	bio: z.string().max(1000).optional(),
	image: z.string().min(1).optional(),
});

export type TUpdateUser = z.infer<typeof updateUserSchema>;

/**
 * Body for self-service profile updates (`PATCH /users/me`).
 *
 * @remarks
 * Deliberately excludes `image` — the avatar flows through the dedicated
 * multipart upload endpoint so content can be validated — and never
 * carries `role`, email, or ban state (Better Auth–owned, admin domain).
 */
export const updateSelfUserSchema = z.object({
	name: z.string().min(1).max(120).optional(),
	username: z.string().min(3).max(30).optional(),
	bio: z.string().max(1000).optional(),
});

export type TUpdateSelfUser = z.infer<typeof updateSelfUserSchema>;

/** Body for banning a user; Better Auth owns all ban columns. */
export const banUserSchema = z.object({
	banReason: z.string().min(1).max(500).optional(),
	banExpiresIn: z.number().int().min(0).optional(),
});

export type TBanUser = z.infer<typeof banUserSchema>;

/** Path parameter shared by all id-targeted user routes. */
export const userIdParamsSchema = z.object({
	userId: z.string().min(1),
});

export type TUserIdParams = z.infer<typeof userIdParamsSchema>;

/** Body for the role change endpoint; Better Auth owns the `role` column. */
export const setUserRoleSchema = z.object({
	role: z.string().min(1).max(50),
});

export type TSetUserRole = z.infer<typeof setUserRoleSchema>;

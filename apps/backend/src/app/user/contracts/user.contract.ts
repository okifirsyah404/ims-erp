import { z } from 'zod';
import { globalRoles } from '@providers/better-auth/ac/admin-ac';

/**
 * Allowed application roles on `user.role` (ADR-0018).
 *
 * @remarks
 * One closed list, shared by create and set-role, so an admin cannot write an
 * arbitrary string into `user.role` (the column is free text and every role
 * check reads it). Multi-role values (`"admin,investor"`) are still stored by
 * Better Auth, but a write through this API sets exactly one role.
 */
const globalRoleSchema = z.enum(globalRoles);

/**
 * Request/response contracts for the user module's first-party admin API.
 *
 * @remarks
 * Parsed at the controller boundary before any service call. Users are
 * Better Auth–owned identity rows (`auth.users`); mutations flow through
 * the Better Auth admin API while `deletedAt` is soft-delete state owned
 * by the user repository.
 *
 * The `userQuerySchema`/`TUserQuery` pair that used to live here was dead
 * (no consumer) and is gone; the live listing query is `userQuerySchema` in
 * `admin.contract.ts`, which is what `GET /admin/users` parses.
 */

/** Body for creating a user through the Better Auth admin API. */
export const createUserSchema = z.object({
	email: z.email(),
	password: z.string().min(8).max(72),
	name: z.string().min(1).max(120),
	username: z.string().min(3).max(30).optional(),
	role: globalRoleSchema.optional(),
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
	role: globalRoleSchema,
});

export type TSetUserRole = z.infer<typeof setUserRoleSchema>;

import {
	erpGuard,
	sessionGuard,
	type ErpContext,
} from '@authorization/elysia-auth';
import { Elysia } from 'elysia';
import { ZodError } from 'zod';
import { container } from 'tsyringe';
import type {
	TApiErrorMessage,
	TApiResponse,
	TApiPaginatedResponse,
} from '@ims-erp/common';
import type { TPaginationResult } from '@ims-erp/common';
import {
	banUserSchema,
	createUserSchema,
	setUserRoleSchema,
	updateSelfUserSchema,
	updateUserSchema,
	userIdParamsSchema,
	userQuerySchema,
} from '../contracts/user.contract';
import { USER_SERVICE_TOKEN } from '../constants/di';
import { UserService, AVATAR_MAX_BYTES, sniffAvatarType } from '../services/user.service';
import {
	InvalidAvatarError,
	UserEmailTakenError,
	UserNotFoundError,
} from '../services/user.errors';

/**
 * Builds the response envelope metadata shared by all user endpoints.
 */
function buildMeta(status: number, message: string) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
	};
}

/**
 * Wraps a single row in the standard API response envelope.
 */
function ok<T>(data: T): TApiResponse<T> {
	return { ...buildMeta(200, 'OK'), data };
}

/**
 * Wraps a paginated result in the standard API paginated envelope.
 */
function okPaginated<T>(
	result: TPaginationResult<T>,
): TApiPaginatedResponse<T> {
	return {
		...buildMeta(200, 'OK'),
		pagination: result.meta,
		data: result.data,
	};
}

/**
 * Builds the standard error envelope for a failed request.
 */
function errorEnvelope(
	status: number,
	message: string,
	errors: TApiErrorMessage[],
): TApiResponse<null> {
	return { ...buildMeta(status, message), errors, data: null };
}

/**
 * Server-side global-admin check for user administration routes.
 *
 * @remarks
 * User administration is Better Auth's global admin domain, not
 * organization-scoped ERP access control (there is no `user` resource in
 * the permission catalog). The caller's role comes from the
 * guard-resolved session, never from client input. Mutating endpoints
 * additionally rely on the admin plugin's own `requireHeaders`
 * authorization inside Better Auth.
 */
function requireGlobalAdmin({ erp }: { erp: ErpContext }): void {
	if (erp.session.user.role !== 'admin') {
		throw new NotGlobalAdminError();
	}
}

/**
 * Module-private sentinel thrown by {@link requireGlobalAdmin} and mapped
 * to `403` by the controller's error hook.
 */
class NotGlobalAdminError extends Error {
	constructor() {
		super('Global administrator role required');
		this.name = 'NotGlobalAdminError';
	}
}

/**
 * REST controller exposing first-party user administration endpoints.
 *
 * @remarks
 * Layered architecture boundary: this class owns HTTP concerns only —
 * parsing, envelope mapping, status mapping — and delegates all business
 * logic to {@link UserService}. The service is resolved from the tsyringe
 * container here (the HTTP boundary), never deeper. All mutations require
 * a Better Auth global admin session (see {@link requireGlobalAdmin});
 * Better Auth re-checks admin authorization inside its own endpoints.
 * All responses use the `TApiResponse` / `TApiPaginatedResponse` envelope
 * from `@ims-erp/common`.
 *
 * @throws 400 When query/path/body parameters fail validation
 * @throws 401 When unauthenticated (erp guard)
 * @throws 403 When the caller is not a global admin (mutations)
 * @throws 404 When an id-targeted lookup finds no alive row
 * @throws 409 When creating a user with a taken email/username
 */
export class UserController {
	/**
	 * Builds the Elysia plugin mounting all user routes.
	 *
	 * @remarks
	 * Resolves {@link UserService} from the tsyringe container once at
	 * plugin build time. The local `onError` hook maps validation failures
	 * to `400` and the module's domain errors onto their HTTP statuses
	 * (404/409/403); see the class-level `@throws` list for the full
	 * mapping.
	 *
	 * @returns An Elysia instance with the `/users` route group mounted
	 */
	static plugin() {
		const userService = container.resolve<UserService>(USER_SERVICE_TOKEN);

		return new Elysia({ prefix: '/users', name: 'users', tags: ['Users'] })
			.use(erpGuard())
			.use(sessionGuard())
			.onError({ as: 'local' }, ({ code, error, set }) => {
				if (code === 'VALIDATION') {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{
							field: error.value ? String(error.value) : null,
							message: error.message,
						},
					]);
				}
				if (code === 'PARSE' || error instanceof ZodError) {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ field: null, message: String(error) },
					]);
				}
				if (error instanceof UserNotFoundError) {
					set.status = 404;
					return errorEnvelope(404, 'Not found', [
						{ message: 'User not found' },
					]);
				}
				if (error instanceof UserEmailTakenError) {
					set.status = 409;
					return errorEnvelope(409, 'Conflict', [
						{ field: 'email', message: 'Email already in use' },
					]);
				}
				if (error instanceof InvalidAvatarError) {
					set.status = 415;
					return errorEnvelope(415, 'Unsupported media type', [
						{ field: 'file', message: error.message },
					]);
				}
				if (error instanceof NotGlobalAdminError) {
					set.status = 403;
					return errorEnvelope(403, error.message, []);
				}
				return undefined;
			})
			.get(
				'/',
				async ({ query }) =>
					okPaginated(
						await userService.paginateUsers(userQuerySchema.parse(query)),
					),
				{ erp: {} },
			)
			.get(
				/**
				 * Self profile. Declared before `/:userId` so `me` is never
				 * captured as an id parameter. The caller's id comes from the
				 * guard-resolved session (server-side), never client input;
				 * any authenticated member may read their own profile.
				 */
				'/me',
				async ({ erp, status }) => {
					const profile = await userService.getUser(erp.session.user.id);					if (!profile) {
						return status(
							404,
							errorEnvelope(404, 'Not found', [
								{ message: 'User not found' },
							]),
						);
					}
					return ok(profile);
				},
				// session-only guard: identity is not organization-scoped data.
				// A fresh login has no activeOrganizationId yet, so the full
				// erpGuard would 403 here (see sessionGuard's docstring).
				// Enabled with `true` (object-form macro) — an empty option
				// object would drop the macro's resolved `erp` context from
				// handler types.
				{ erpSession: { session: true } },
			)
			.patch(
				/**
				 * Self-service profile update. Same session-only guard as
				 * `/me`; the caller's id comes from the guard-resolved
				 * session, never client input. Flows through Better Auth's
				 * session-authenticated `/update-user` (NOT the admin API).
				 */
				'/me',
				async ({ body, request, erp }) => {
					await userService.updateSelf(
						erp.session.user.id,
						updateSelfUserSchema.parse(body),
						request.headers,
					);
					return ok(null);
				},
				{ erpSession: { session: true } },
			)
			.post(
				/**
				 * Self-service avatar upload (multipart, field `file`).
				 * Validates type by magic bytes (never the declared
				 * Content-Type) and enforces the 2 MiB cap; writes to S3 and
				 * points `users.image` at the uploaded key. Returns the
				 * refreshed profile with a fresh presigned URL.
				 */
				'/me/avatar',
				async ({ request, erp, status }) => {
					const form = await request.formData();
					const file = form.get('file');
					if (!(file instanceof File)) {
						return status(
							400,
							errorEnvelope(400, 'Validation failed', [
								{ field: 'file', message: 'Expected a multipart file field' },
							]),
						);
					}
					if (file.size > AVATAR_MAX_BYTES) {
						return status(
							413,
							errorEnvelope(413, 'Payload too large', [
								{ field: 'file', message: 'Avatar must be 2 MiB or smaller' },
							]),
						);
					}
					const bytes = new Uint8Array(await file.arrayBuffer());
					const sniffed = sniffAvatarType(bytes.subarray(0, 12));
					if (!sniffed) {
						return status(
							415,
							errorEnvelope(415, 'Unsupported media type', [
								{
									field: 'file',
									message: 'Avatar must be a PNG, JPEG, or WebP image',
								},
							]),
						);
					}
					const profile = await userService.setSelfAvatar(erp.session.user.id, {
						data: bytes.buffer as ArrayBuffer,
						type: sniffed,
					});
					return ok(profile);
				},
				{ erpSession: { session: true } },
			)
			.get(
				'/:userId',
				async ({ params, status }) => {
					const profile = await userService.getUser(
						userIdParamsSchema.parse(params).userId,
					);
					if (!profile) {
						return status(
							404,
							errorEnvelope(404, 'Not found', [
								{ message: 'User not found' },
							]),
						);
					}
					return ok(profile);
				},
				{ erp: {} },
			)
			.post(
				'/',
				async ({ body, request, set }) => {
					const created = await userService.createUser(
						createUserSchema.parse(body),
						request.headers,
					);
					set.status = 201;
					return ok(created);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.patch(
				'/:userId',
				async ({ body, params, request }) => {
					await userService.updateUser(
						userIdParamsSchema.parse(params).userId,
						updateUserSchema.parse(body),
						request.headers,
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.patch(
				'/:userId/role',
				async ({ body, params, request }) => {
					await userService.setUserRole(
						userIdParamsSchema.parse(params).userId,
						setUserRoleSchema.parse(body),
						request.headers,
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.post(
				'/:userId/ban',
				async ({ body, params, request }) => {
					await userService.banUser(
						userIdParamsSchema.parse(params).userId,
						banUserSchema.parse(body),
						request.headers,
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.post(
				'/:userId/unban',
				async ({ params, request }) => {
					await userService.unbanUser(
						userIdParamsSchema.parse(params).userId,
						request.headers,
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.delete(
				'/:userId',
				async ({ params, request }) => {
					await userService.softDeleteUser(
						userIdParamsSchema.parse(params).userId,
						request.headers,
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.post(
				'/:userId/restore',
				async ({ params, request }) => {
					await userService.restoreUser(
						userIdParamsSchema.parse(params).userId,
						request.headers,
					);
					return ok(null);
				},
				{ erp: { policy: requireGlobalAdmin } },
			);
	}
}

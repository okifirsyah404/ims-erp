import { type ErpContext } from '@authorization/elysia-auth';
import { container } from 'tsyringe';
import {
	banUserSchema,
	createUserSchema,
	setUserRoleSchema,
	updateSelfUserSchema,
	updateUserSchema,
	userIdParamsSchema,
} from '../contracts/user.contract';
import { USER_SERVICE_TOKEN } from '../constants/di';
import { UserService, AVATAR_MAX_BYTES } from '../services/user.service';
import { sniffImageType, UnsupportedImageError } from '@utils/image.util';
import {
	InvalidAvatarError,
	UserEmailTakenError,
	UserNotFoundError,
} from '../errors/user.errors';
import { translator } from '@providers/i18n/translator';
import { NotGlobalAdminError } from '@http/errors';
import { domainPlugin } from '@http/plugin';
import { created, errorEnvelope, noContent, ok } from '@http/response';

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
 * The multipart `file` field from Elysia's already-parsed body.
 *
 * @remarks
 * Reading `request.formData()` a second time throws `Body already used`, so the
 * parsed `body` is the only safe source.
 */
function avatarFileFrom(body: unknown): File | null {
	const file =
		body && typeof body === 'object' ? (body as { file?: unknown }).file : undefined;
	return file instanceof File ? file : null;
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
 * @throws 415 When an uploaded avatar is not an accepted image type
 */
export class UserController {
	/**
	 * Builds the Elysia plugin mounting all user routes.
	 *
	 * @remarks
	 * Resolves {@link UserService} from the tsyringe container once at
	 * plugin build time. Validation failures are mapped by the shared
	 * {@link domainPlugin} hook; the module's own domain errors
	 * (404/409/415) and the global-admin `403` are mapped by the local
	 * `onError` arm below.
	 *
	 * @returns An Elysia instance with the `/users` route group mounted
	 */
	static plugin() {
		const userService = container.resolve<UserService>(USER_SERVICE_TOKEN);

		return domainPlugin({
			name: 'users',
			prefix: '/users',
			tags: ['Users'],
			guards: 'erp+session',
		})
			.onError({ as: 'local' }, (ctx) => {
				const { error, set } = ctx;
				const t = translator(ctx);
				if (error instanceof UserNotFoundError) {
					set.status = 404;
					return errorEnvelope(404, t('common.notFound'), [
						{ message: t('user.notFound') },
					]);
				}
				if (error instanceof UserEmailTakenError) {
					set.status = 409;
					return errorEnvelope(409, t('common.conflict'), [
						{ field: 'email', message: t('user.emailInUse') },
					]);
				}
				if (error instanceof InvalidAvatarError) {
					set.status = 415;
					return errorEnvelope(415, t('common.unsupportedMediaType'), [
						{ field: 'file', message: error.message },
					]);
				}
				return undefined;
			})
			// NOTE: the user directory (list) is NOT defined here. It lives on
			// `UserAdminController` (`GET /admin/users`, gated on `member:read`,
			// returning memberships alongside each account). Keeping a second
			// list handler here registered `/users/` — a distinct Elysia route
			// from `/users` — which shadowed the admin listing for the bare
			// path and returned rows without `organizations`. One owner per
			// resource avoids that whole class of routing surprise.
			.get(
				/**
				 * Self profile. Declared before `/:userId` so `me` is never
				 * captured as an id parameter. The caller's id comes from the
				 * guard-resolved session (server-side), never client input;
				 * any authenticated member may read their own profile.
				 */
				'/me',
				async (ctx) => {
					const { erp, status } = ctx;
					const t = translator(ctx);
					const profile = await userService.getUser(erp.session.user.id);
					if (!profile) {
						return status(
							404,
							errorEnvelope(404, t('common.notFound'), [
								{ message: t('user.notFound') },
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
					return noContent();
				},
				{ erpSession: { session: true } },
			)
			.post(
				/**
				 * Self-service avatar upload (multipart, field `file`).
				 * Accepts any image the server can decode (PNG, JPG, WebP,
				 * GIF, BMP, TIFF, HEIC, AVIF — sniffed by magic bytes, never
				 * the declared Content-Type), enforces the 2 MiB cap, and
				 * normalises the bytes to WebP server-side. Writes to S3 and
				 * points `users.image` at the uploaded key. Returns the
				 * refreshed profile with a fresh presigned URL.
				 */
				'/me/avatar',
				async (ctx) => {
					const { body, erp, status } = ctx;
					const t = translator(ctx);
					// Elysia already parsed the multipart body; reading
					// `request.formData()` again throws "Body already used".
					const file = avatarFileFrom(body);
					if (!file) {
						return status(
							400,
							errorEnvelope(400, t('common.validationFailed'), [
								{ field: 'file', message: t('user.fileFieldExpected') },
							]),
						);
					}
					if (file.size > AVATAR_MAX_BYTES) {
						return status(
							413,
							errorEnvelope(413, t('common.payloadTooLarge'), [
								{ field: 'file', message: t('user.avatarTooLarge') },
							]),
						);
					}
					const bytes = new Uint8Array(await file.arrayBuffer());
					try {
						if (!sniffImageType(bytes.subarray(0, 16))) {
							throw new InvalidAvatarError(t('user.avatarUnsupportedType'));
						}
						return ok(await userService.setSelfAvatar(erp.session.user.id, bytes));
					} catch (error) {
						// A sniffable header with an undecodable payload (truncated
						// upload) lands here too; `onError` maps both to 415.
						if (error instanceof UnsupportedImageError) {
							throw new InvalidAvatarError(t('user.avatarUnsupportedType'));
						}
						throw error;
					}
				},
				{ erpSession: { session: true } },
			)
			.get(
				/**
				 * Read one user profile by id.
				 *
				 * Global-admin gated: the profile row is not tenant-scoped
				 * (`auth.users` is Better Auth-owned and carries no
				 * organization column), so a bare `erp: {}` guard let ANY
				 * authenticated member read ANY user's profile across
				 * tenants. The org-scoped listing lives on
				 * `GET /admin/users` (`member:read`); this id lookup is the
				 * Better Auth global-admin domain, same as every other
				 * route on this controller.
				 */
				'/:userId',
				async (ctx) => {
					const { params, status } = ctx;
					const t = translator(ctx);
					const profile = await userService.getUser(
						userIdParamsSchema.parse(params).userId,
					);
					if (!profile) {
						return status(
							404,
							errorEnvelope(404, t('common.notFound'), [
								{ message: t('user.notFound') },
							]),
						);
					}
					return ok(profile);
				},
				{ erp: { policy: requireGlobalAdmin } },
			)
			.post(
				'/',
				async ({ body, request, status }) => {
					const row = await userService.createUser(
						createUserSchema.parse(body),
						request.headers,
					);
					return status(201, created(row));
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
					return noContent();
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
					return noContent();
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
					return noContent();
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
					return noContent();
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
					return noContent();
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
					return noContent();
				},
				{ erp: { policy: requireGlobalAdmin } },
			);
	}
}

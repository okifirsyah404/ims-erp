import { erpGuard } from '@authorization/elysia-auth';
import Elysia from 'elysia';
import { z } from 'zod';
import { container } from 'tsyringe';
import { USER_SERVICE_TOKEN } from '../constants/di';
import { UserService, AvatarNotFoundError } from '../services/user.service';
function envelope(status: number, message: string) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
		data: null,
		errors: [{ message }],
	};
}

/**
 * User routes. The avatar endpoint lives outside Better Auth routes so the
 * server can mint a fresh presigned S3 URL per request; it is still guarded
 * by the same session-based ERP guard (any authenticated member may view
 * avatars; no organization-scoped permission needed).
 */
export class UserController {
	static plugin() {
		const userService = container.resolve<UserService>(USER_SERVICE_TOKEN);

		return new Elysia({ prefix: '/users', name: 'users', tags: ['Users'] })
			.use(erpGuard())
			.onError({ as: 'local' }, ({ error, set }) => {
				if (error instanceof AvatarNotFoundError) {
					set.status = 404;
					return envelope(404, 'Avatar not found');
				}
				return undefined;
			})
			.get(
				'/:userId/avatar',
				async ({ params, set }) => {
					const url = await userService.getAvatarUrl(params.userId);
					// 302 to the short-lived presigned URL; never expose the key.
					set.status = 302;
					set.headers.location = url;
					return null;
				},
				{ erp: {}, params: z.object({ userId: z.string().min(1) }) },
			);
	}
}

/**
 * Public entry point of the user module.
 *
 * @remarks
 * Re-exports the composition-root registration plus the avatar queue surface
 * (producer hook + worker handle) so `src/index.ts` imports `@app/user`
 * instead of reaching into `queues/` internals. Mirrors `@app/audit`.
 */
export * from './container';
export {
	type AvatarWorkerHandle,
	startAvatarWorker,
} from './queues/avatar.worker';
export { avatarUserCreateHook } from './queues/avatar.queue';

export * from './controllers/invitation.controller';

import Elysia from 'elysia';

import { InvitationClaimController, InvitationController, UsernameCheckController } from './controllers/invitation.controller';
import { PortalAccountController } from './controllers/portal-account.controller';
import { UserAdminController } from './controllers/user-admin.controller';
import { UserController } from './controllers/user.controller';

/**
 * Elysia instance mounting every user controller, in route order.
 *
 * @remarks
 * `UserAdminController` mounts before `UserController`: admin surfaces share
 * the `/admin` prefix, so their routes no longer overlap the self-service
 * `/users/*` routes — mount order is irrelevant (before the split, both
 * modules registered `GET /users` and the first registration silently won),
 * but this order keeps the intent obvious.
 */
export function userModule() {
	return new Elysia({ name: 'user' })
		.use(UserAdminController.plugin())
		.use(PortalAccountController.plugin())
		.use(UserController.plugin())
		.use(InvitationController.plugin())
		// Public, sessionless claim flow: token-gated, deliberately outside
		// `/admin`, so it must not inherit the admin guard.
		.use(InvitationClaimController.plugin())
		.use(UsernameCheckController.plugin());
}

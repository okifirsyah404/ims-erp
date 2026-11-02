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

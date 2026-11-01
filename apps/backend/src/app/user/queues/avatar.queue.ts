import { Queue } from 'bullmq';
import type { BetterAuthOptions } from 'better-auth';
import { queueConnection } from '@providers/queue/queue.connection';

/** BullMQ queue name shared by the avatar queue and its worker. */
export const AVATAR_QUEUE_NAME = 'avatar';

/** Payload for an avatar-generation job. */
export type AvatarJobData = {
	userId: string;
	/** Display name; seed for the initials avatar. */
	name: string;
};

/**
 * Avatar generation queue. Dispatched from Better Auth's
 * `databaseHooks.user.create.after` hook on every user creation.
 *
 * Deterministic job id (`avatar:<userId>`) deduplicates replays/retries:
 * a user's avatar is generated at most once per attempt cycle.
 */
export const avatarQueue = new Queue<AvatarJobData>(AVATAR_QUEUE_NAME, {
	connection: queueConnection,
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: 'exponential', delay: 2_000 },
		removeOnComplete: { age: 3_600, count: 1_000 },
		removeOnFail: { age: 86_400 },
	},
});

/** Enqueue avatar generation; fire-and-forget (never blocks user creation). */
export async function dispatchAvatarGeneration(
	user: { id: string; name?: string | null },
): Promise<void> {
	await avatarQueue.add(
		'generate',
		{ userId: user.id, name: user.name ?? '' },
		// NOTE: BullMQ reserves ':' in custom job ids (repeatable-job key
		// delimiter), so the id uses a dash, not a colon.
		{ jobId: `avatar-${user.id}` },
	);
}

/**
 * Better Auth `databaseHooks.user.create.after` hook. Errors are logged and
 * swallowed so a queue outage can never fail sign-up.
 */
export function avatarUserCreateHook(): NonNullable<
	NonNullable<
		NonNullable<BetterAuthOptions['databaseHooks']>['user']
	>['create']
>['after'] {
	return async (user) => {
		try {
			await dispatchAvatarGeneration(user);
		} catch (error) {
			console.error('[avatar-queue] enqueue failed for user', user.id, error);
		}
	};
}

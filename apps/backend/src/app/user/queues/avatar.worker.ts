import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from '@config/providers/config';
import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { avatarObjectKey, s3Client } from '@providers/s3/s3';
import { USER_REPOSITORY_TOKEN } from '../constants/di';
import type { IUserRepository } from '../contracts/user.repository.interface';
import {
	AVATAR_QUEUE_NAME,
	type AvatarJobData,
} from './avatar.queue';

/** Rendered avatar size in pixels (square). */
const AVATAR_SIZE = 72;
/** DiceBear HTTP API style, format, and major version used for every avatar. */
const AVATAR_STYLE_PATH = '10.x/initials/webp';
/** Per-request ceiling so a hung API socket cannot pin a worker slot. */
const AVATAR_REQUEST_TIMEOUT_MS = 10_000;
/** ponytail: repo-local temp dir; move to OS temp / env when multi-node. */
const TMP_DIR = path.resolve(process.cwd(), '.tmp/avatars');

/**
 * Builds the DiceBear HTTP API URL for one avatar.
 *
 * @remarks
 * Pure and deterministic: the seed is the only variable, so the same seed
 * always yields the same avatar. The DiceBear v10 API validates
 * `backgroundColor` against a hex-color pattern and REJECTS the legacy
 * `transparent` value with a 400 (verified 2026-11-03), so no background
 * parameter is sent at all — the style's seed-derived default applies. The
 * API's size bounds (1-256) are validated on the server side.
 */
export function avatarApiUrl(
	apiBaseUrl: string,
	seed: string,
	size: number = AVATAR_SIZE,
): string {
	const base = apiBaseUrl.replace(/\/+$/, '');
	const query = new URLSearchParams({
		seed,
		size: String(size),
	});
	return `${base}/${AVATAR_STYLE_PATH}?${query.toString()}`;
}

/** Seed used for a user's avatar: the display name, else the user id. */
export function avatarSeed(userId: string, name: string): string {
	return name.trim().length > 0 ? name : userId;
}

/**
 * Renders the deterministic 72x72 initials WebP for a user by calling the
 * DiceBear HTTP API. No S3, no DB. Falls back to the user id as seed when the
 * name is blank.
 *
 * @throws When the API answers with a non-2xx status or times out; BullMQ
 * retries the job with exponential backoff.
 */
export async function generateAvatarWebp(
	userId: string,
	name: string,
): Promise<Buffer> {
	const url = avatarApiUrl(appConfig.app.avatarApiUrl, avatarSeed(userId, name));

	const response = await fetch(url, {
		signal: AbortSignal.timeout(AVATAR_REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(
			`avatar API responded ${response.status} ${response.statusText} for ${url}`,
		);
	}

	return Buffer.from(await response.arrayBuffer());
}

/**
 * Generates the avatar WebP, uploads it to S3 as `user/<userId>/avatar.webp`,
 * and stores the object key (NOT a URL - URLs are presigned per request) in
 * `auth.users.image` through the user repository (cache invalidation and
 * soft-delete filtering included; a job arriving after the user was
 * soft-deleted no-ops). The WebP is written to `.tmp/avatars/` first so the
 * upload goes from a file; the temp file is always removed.
 */
export async function processAvatarJob(
	userRepository: IUserRepository,
	job: { data: AvatarJobData },
): Promise<void> {
	const { userId, name } = job.data;
	const buffer = await generateAvatarWebp(userId, name);

	await mkdir(TMP_DIR, { recursive: true });
	const tmpPath = path.join(TMP_DIR, `${userId}.webp`);
	try {
		await writeFile(tmpPath, buffer);
		await s3Client.write(avatarObjectKey(userId), Bun.file(tmpPath));
	} finally {
		await rm(tmpPath, { force: true });
	}

	await userRepository.update(userId, { image: avatarObjectKey(userId) });
}

/**
 * Handle the composition root uses to supervise the avatar worker.
 *
 * @remarks
 * Structurally the shared `QueueWorker` contract from
 * `@providers/queue/worker-registry`, so the avatar worker can be handed to
 * `startWorkers()` without the registry importing this module. Deliberately
 * narrow: the caller needs to know when the worker fails and how to stop it,
 * nothing else. The BullMQ event names, the shutdown sequence and the `Worker`
 * type stay inside this module, so `src/index.ts` does not depend on BullMQ.
 * Same spirit as `plugin()` for controllers — the module owns its lifecycle,
 * the composition root only starts and stops it.
 */
export type AvatarWorkerHandle = QueueWorker;

/**
 * Starts the avatar worker. Call once at bootstrap.
 *
 * @remarks
 * The repository is resolved once at the bootstrap boundary (same spirit
 * as controller `plugin()` factories): the worker outlives the request
 * lifecycle. Processes up to 2 jobs concurrently.
 *
 * Queue shutdown (`closeQueueConnection`) is intentionally *not* wired here:
 * the connection is a shared provider, not this module's to close.
 */
export function startAvatarWorker(): AvatarWorkerHandle {
	// Resolved once at the bootstrap boundary (same spirit as controller
	// plugin() factories): the worker outlives the request lifecycle.
	const userRepository = container.resolve<IUserRepository>(
		USER_REPOSITORY_TOKEN,
	);

	const worker = new Worker<AvatarJobData>(
		AVATAR_QUEUE_NAME,
		async (job) => processAvatarJob(userRepository, job),
		{
			connection: queueConnection,
			concurrency: 2,
		},
	);

	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}

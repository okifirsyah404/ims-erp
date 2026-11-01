import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toPng } from '@dicebear/converter';
import { Avatar, Style } from '@dicebear/core';
import initials from '@dicebear/styles/initials.json' with { type: 'json' };
import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import { avatarObjectKey, s3Client } from '@providers/s3/s3';
import { USER_REPOSITORY_TOKEN } from '../constants/di';
import type { IUserRepository } from '../contracts/user.repository.interface';
import {
	AVATAR_QUEUE_NAME,
	type AvatarJobData,
} from './avatar.queue';

/** Rendered avatar size in pixels (square). */
const AVATAR_SIZE = 72;
/** ponytail: repo-local temp dir; move to OS temp / env when multi-node. */
const TMP_DIR = path.resolve(process.cwd(), '.tmp/avatars');

/** Shared DiceBear initials style used for every avatar. */
const initialsStyle = new Style(initials);

/**
 * Generates the deterministic 72x72 initials PNG for a user. Pure: no S3,
 * no DB. Falls back to the user id as seed when the name is blank.
 */
export async function generateAvatarPng(
	userId: string,
	name: string,
): Promise<Buffer> {
	const seed = name.trim().length > 0 ? name : userId;
	const avatar = new Avatar(initialsStyle, {
		seed,
		size: AVATAR_SIZE,
	});
	const png = toPng(avatar, { size: AVATAR_SIZE });
	return Buffer.from(await png.toArrayBuffer());
}

/**
 * Generates the avatar PNG, uploads it to S3 as `user/<userId>/avatar.png`,
 * and stores the object key (NOT a URL — URLs are presigned per request) in
 * `auth.users.image` through the user repository (cache invalidation and
 * soft-delete filtering included; a job arriving after the user was
 * soft-deleted no-ops). The PNG is written to `.tmp/avatars/` first so the
 * upload goes from a file; the temp file is always removed.
 */
export async function processAvatarJob(
	userRepository: IUserRepository,
	job: { data: AvatarJobData },
): Promise<void> {
	const { userId, name } = job.data;
	const buffer = await generateAvatarPng(userId, name);

	await mkdir(TMP_DIR, { recursive: true });
	const tmpPath = path.join(TMP_DIR, `${userId}.png`);
	try {
		await writeFile(tmpPath, buffer);
		await s3Client.write(avatarObjectKey(userId), Bun.file(tmpPath));
	} finally {
		await rm(tmpPath, { force: true });
	}

	await userRepository.update(userId, { image: avatarObjectKey(userId) });
}

/**
 * Starts the avatar worker. Call once at bootstrap.
 *
 * @remarks
 * The repository is resolved once at the bootstrap boundary (same spirit
 * as controller `plugin()` factories): the worker outlives the request
 * lifecycle. Processes up to 2 jobs concurrently.
 */
export function startAvatarWorker(): Worker<AvatarJobData> {
	// Resolved once at the bootstrap boundary (same spirit as controller
	// plugin() factories): the worker outlives the request lifecycle.
	const userRepository = container.resolve<IUserRepository>(
		USER_REPOSITORY_TOKEN,
	);

	return new Worker<AvatarJobData>(
		AVATAR_QUEUE_NAME,
		async (job) => processAvatarJob(userRepository, job),
		{
			connection: queueConnection,
			concurrency: 2,
		},
	);
}

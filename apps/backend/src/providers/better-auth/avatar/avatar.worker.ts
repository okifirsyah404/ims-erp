import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toPng } from '@dicebear/converter';
import { Avatar, Style } from '@dicebear/core';
import initials from '@dicebear/styles/initials.json' with { type: 'json' };
import { eq } from 'drizzle-orm';
import { Worker } from 'bullmq';
import { drizzleDB } from '@drizzle/db';
import { users } from '@drizzle/schemas/auth.schema';
import { queueConnection } from '@providers/queue/queue.connection';
import { avatarObjectKey, s3Client } from '@providers/s3/s3';
import {
	AVATAR_QUEUE_NAME,
	type AvatarJobData,
} from './avatar.queue';

const AVATAR_SIZE = 72;
/** ponytail: repo-local temp dir; move to OS temp / env when multi-node. */
const TMP_DIR = path.resolve(process.cwd(), '.tmp/avatars');

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
 * `auth.users.image`. The PNG is written to `.tmp/avatars/` first so the
 * upload goes from a file; the temp file is always removed.
 */
export async function processAvatarJob(job: {
	data: AvatarJobData;
}): Promise<void> {
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

	await drizzleDB
		.update(users)
		.set({ image: avatarObjectKey(userId) })
		.where(eq(users.id, userId));
}

/** Starts the avatar worker. Call once at bootstrap. */
export function startAvatarWorker(): Worker<AvatarJobData> {
	return new Worker<AvatarJobData>(
		AVATAR_QUEUE_NAME,
		async (job) => processAvatarJob(job),
		{
			connection: queueConnection,
			concurrency: 2,
		},
	);
}

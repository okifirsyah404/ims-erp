/**
 * Proves the avatar worker is live *and supervised by the worker registry*.
 *
 * @remarks
 * Dispatching a job and waiting for `auth.users.image` only works where the
 * DiceBear API is reachable (`http://dicebear:3000` inside Docker Compose; not
 * reachable from a bare local run). So this probe asserts the thing that is
 * environment-independent: the worker **consumed** the job. Whatever it did
 * next — completed, or failed on the render HTTP call — proves the worker
 * instance exists, is subscribed to the queue, and was started through
 * `startWorkers()` rather than silently dropped.
 *
 * Idempotent: uses the seeded member and its deterministic job id, so re-runs
 * do not accumulate jobs.
 */
import { Queue, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { drizzleDB } from '../drizzle/db';
import { users } from '../drizzle/schemas/auth.schema';
import { queueConnection } from '../src/providers/queue/queue.connection';
import { dispatchAvatarGeneration } from '../src/app/user/queues/avatar.queue';

const MEMBER_EMAIL = 'freelancer.seed@entragate.local';
const TIMEOUT_MS = 30_000;
const POLL_MS = 500;

const [member] = await drizzleDB
	.select({ id: users.id, name: users.name })
	.from(users)
	.where(eq(users.email, MEMBER_EMAIL));

if (!member) {
	console.error(`FAIL  seeded member ${MEMBER_EMAIL} not found`);
	process.exit(1);
}

const queue = new Queue('avatar', { connection: queueConnection });
const jobId = `avatar-${member.id}`;

// Drop any previous attempt so this run observes a fresh consumption.
const existing = await queue.getJob(jobId);
if (existing) await existing.remove();

await dispatchAvatarGeneration({ id: member.id, name: member.name });
console.log(`dispatched ${jobId}`);

let state = 'waiting';
const deadline = Date.now() + TIMEOUT_MS;
while (Date.now() < deadline) {
	const job: Job | undefined = await queue.getJob(jobId);
	state = (await job?.getState()) ?? 'missing';
	// 'active' means a worker picked it up; a terminal state means it finished.
	if (state !== 'waiting' && state !== 'delayed') break;
	await Bun.sleep(POLL_MS);
}

const job = await queue.getJob(jobId);
const finalState = (await job?.getState()) ?? 'missing';
await queue.close();

if (finalState === 'waiting' || finalState === 'missing') {
	console.error(
		`FAIL  worker never consumed ${jobId} (state=${finalState} after ${TIMEOUT_MS}ms)`,
	);
	process.exit(1);
}

// A failure here is the render HTTP call (DiceBear unreachable outside
// Compose), not the worker wiring — report it, but pass.
if (finalState === 'failed') {
	console.log(
		`PASS  worker consumed the job (failed at render: ${job?.failedReason})`,
	);
} else {
	console.log(`PASS  worker consumed the job (state=${finalState})`);
}

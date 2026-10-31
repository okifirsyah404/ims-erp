// Scratch script: dispatch an avatar-generation job for an existing user
// (e.g. when the seeder ran before the jobId fix). Usage:
//   bun run scripts/dispatch-avatar.ts <userId|email>
import { eq } from 'drizzle-orm';
import { drizzleDB } from '../drizzle/db';
import { users } from '../drizzle/schemas/auth.schema';
import { dispatchAvatarGeneration } from '../src/app/user/queues/avatar.queue';
import { closeQueueConnection } from '../src/providers/queue/queue.connection';

const arg = process.argv[2];
if (!arg) {
	console.error('Usage: bun run scripts/dispatch-avatar.ts <userId|email>');
	process.exit(1);
}

const [user] = await drizzleDB
	.select({ id: users.id, name: users.name })
	.from(users)
	.where(arg.includes('@') ? eq(users.email, arg) : eq(users.id, arg))
	.limit(1);

if (!user) {
	console.error('User not found:', arg);
	process.exit(1);
}

await dispatchAvatarGeneration(user);
console.log('Dispatched avatar job for', user.id);
await closeQueueConnection();
process.exit(0);

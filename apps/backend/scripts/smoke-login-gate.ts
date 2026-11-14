/**
 * Live login-gate check (ADR-0017 §8, amended by ADR-0018).
 *
 * Runs the real Better Auth instance in-process against the disposable
 * database, so `session.create.before` fires exactly as it does in production.
 * Creates its own throwaway users and removes them at the end.
 *
 * Run from `apps/backend` with `POSTGRES_URL` pointing at a disposable
 * database:
 *   bun run scripts/gate-check.ts
 */
import { SQL } from 'bun';
import { inArray } from 'drizzle-orm';
import { auth } from '../src/providers/better-auth/auth';
import { drizzleDB } from '../drizzle/db';
import { members, organizations, users } from '../drizzle/schemas/auth.schema';

const PASSWORD = 'gate-check-123456';
const ORG_ID = 'org-gate-check';
const PREFIX = 'gate-check';

type Case = {
	role: string;
	membership: string | null;
	expectAllowed: boolean;
};

const CASES: Case[] = [
	{ role: 'admin', membership: null, expectAllowed: true },
	{ role: 'admin,investor', membership: null, expectAllowed: true },
	{ role: 'investor', membership: null, expectAllowed: false },
	{ role: 'customer', membership: null, expectAllowed: false },
	{ role: 'user', membership: null, expectAllowed: false },
	{ role: 'investor', membership: 'sales', expectAllowed: true },
	{ role: 'customer', membership: 'sales', expectAllowed: true },
	{ role: 'user', membership: 'warehouse', expectAllowed: true },
];

const ids = CASES.map((_, i) => `${PREFIX}-${i}`);

const cleanup = async () => {
	await drizzleDB.delete(members).where(inArray(members.userId, ids));
	await drizzleDB.delete(users).where(inArray(users.id, ids));
	const raw = new SQL(process.env.POSTGRES_URL!);
	await raw.unsafe(`DELETE FROM auth.accounts WHERE user_id = ANY($1)`, [ids]);
	await raw.close();
};

await drizzleDB
	.insert(organizations)
	.values({ id: ORG_ID, name: 'Gate check org', slug: 'gate-check-org', createdAt: new Date() })
	.onConflictDoNothing();

await cleanup();

const context = await auth.$context;
const hash = await context.password.hash(PASSWORD);
const raw = new SQL(process.env.POSTGRES_URL!);

for (const [index, testCase] of CASES.entries()) {
	const id = `${PREFIX}-${index}`;
	const email = `${id}@example.test`;

	await drizzleDB.insert(users).values({
		id,
		name: `gate check ${index}`,
		email,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		role: testCase.role,
	});
	await raw.unsafe(
		`INSERT INTO auth.accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
		 VALUES ($1, $2, 'credential', $3, $4, now(), now())`,
		[`acc-${id}`, id, id, hash],
	);
	if (testCase.membership) {
		await drizzleDB.insert(members).values({
			id: `member-${id}`,
			organizationId: ORG_ID,
			userId: id,
			role: testCase.membership,
			createdAt: new Date(),
		});
	}

	const response = await auth.api
		.signInEmail({ body: { email, password: PASSWORD }, asResponse: true })
		.catch((error: unknown) => ({ status: 500, error } as unknown as Response));

	const status = (response as Response).status;
	const allowed = status === 200;
	const verdict = allowed === testCase.expectAllowed ? 'OK  ' : 'FAIL';
	console.log(
		`${verdict} role=${JSON.stringify(testCase.role)} membership=${JSON.stringify(testCase.membership)} status=${status} expected=${testCase.expectAllowed ? 'allowed' : 'denied'}`,
	);
}

await raw.close();
await cleanup();
console.log('cleaned up');

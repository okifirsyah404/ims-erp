/**
 * Live proof of the W7 cache-invalidation fix.
 *
 * Run from `apps/backend` against a live server:
 *   bun run scripts/smoke-cache-invalidation.ts
 *
 * Background: `UserRepository` caches `auth.users` rows in Redis for 300s
 * under `user:id:<id>` and `user:all`. `UserManagementRepository` (the admin
 * lifecycle path) writes `status`/`deletedAt` to the same table. Before W7 it
 * did not evict those keys, so an admin deactivate/restore/delete left the
 * self-service read path serving a stale row for up to 5 minutes.
 *
 * This script asserts the read path reflects an admin write immediately.
 * It cleans up after itself (restore the account) and never leaves the seed
 * user modified.
 */

// Top-level await below requires this file to be a module.
export {};

const BASE = 'http://localhost:3001';
/** Same seeded organization the admin smoke test uses. */
const ORG = 'JPgGGmy8ILDftfleMx1JtSgAOdLIZ5cE';
const ADMIN_EMAIL = 'admin@local.com';
const ADMIN_PASSWORD = 'admin123456';
const MEMBER_EMAIL = 'freelancer.seed@entragate.local';
const MEMBER_PASSWORD = 'freelancer123456';

type TSignIn = { token: string; cookie: string };

async function signIn(email: string, password: string): Promise<TSignIn> {
	const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	if (!response.ok) {
		throw new Error(`sign-in failed for ${email}: ${response.status}`);
	}
	const body = (await response.json()) as { token?: string };
	const cookie = response.headers
		.getSetCookie()
		.map((entry) => entry.split(';')[0])
		.join('; ');
	return { token: body.token ?? '', cookie };
}

async function call(
	auth: TSignIn,
	method: string,
	path: string,
	body?: unknown,
	organizationId?: string,
) {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${auth.token}`,
		Cookie: auth.cookie,
	};
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	if (organizationId) headers['x-organization-id'] = organizationId;
	const response = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	let json: unknown = null;
	try {
		json = await response.json();
	} catch {
		// 200 with an empty body is fine for these routes.
	}
	return { status: response.status, json };
}

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail: string) {
	if (condition) {
		passed += 1;
		console.log(`PASS  ${name}`);
	} else {
		failed += 1;
		console.log(`FAIL  ${name}  (${detail})`);
	}
}

const admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

// Resolve the target user through the admin surface.
const organizationId = ORG;

const users = await call(
	admin,
	'GET',
	`/admin/users?limit=100`,
	undefined,
	organizationId,
);
const rows =
	(users.json as { data?: Array<{ id: string; email: string; status: string }> })
		?.data ?? [];
const target = rows.find((row) => row.email === MEMBER_EMAIL);
if (!target) throw new Error(`seed member ${MEMBER_EMAIL} not found in /admin/users`);

// Warm both cache entries on the self-service read path.
await call(admin, 'GET', `/users/${target.id}`);
await call(admin, 'GET', '/admin/users?limit=100', undefined, organizationId);

// ---- deactivate -> read path must not serve the cached active row ---------
const deactivated = await call(
	admin,
	'POST',
	`/admin/users/${target.id}/deactivate`,
	undefined,
	organizationId,
);
check('deactivate succeeds (200)', deactivated.status === 200, `${deactivated.status}`);

const afterDeactivate = await call(admin, 'GET', `/users/${target.id}`);
const deactivatedStatus = (afterDeactivate.json as { data?: { status?: string } })
	?.data?.status;
check(
	'GET /users/:id reflects the deactivation immediately (cache evicted)',
	deactivatedStatus === 'deactivated',
	`status=${deactivatedStatus}`,
);

// ---- restore -> read path must see the reactivation ----------------------
const restored = await call(
	admin,
	'POST',
	`/admin/users/${target.id}/restore`,
	undefined,
	organizationId,
);
check('restore succeeds (200)', restored.status === 200, `${restored.status}`);

const afterRestore = await call(admin, 'GET', `/users/${target.id}`);
const restoredStatus = (afterRestore.json as { data?: { status?: string } })?.data
	?.status;
check(
	'GET /users/:id reflects the restore immediately (cache evicted)',
	restoredStatus === 'active',
	`status=${restoredStatus}`,
);

// ---- soft delete -> read path must 404, not serve the cached row ---------
const deleted = await call(
	admin,
	'DELETE',
	`/admin/users/${target.id}`,
	undefined,
	organizationId,
);
check('soft delete succeeds (200)', deleted.status === 200, `${deleted.status}`);

const afterDelete = await call(admin, 'GET', `/users/${target.id}`);
check(
	'GET /users/:id 404s immediately after soft delete (cache evicted)',
	afterDelete.status === 404,
	`${afterDelete.status}`,
);

// ---- clean up: restore so the seed fixture stays usable ------------------
const cleanup = await call(
	admin,
	'POST',
	`/admin/users/${target.id}/restore`,
	undefined,
	organizationId,
);
check('fixture restored after the probe (200)', cleanup.status === 200, `${cleanup.status}`);

const finalRead = await call(admin, 'GET', `/users/${target.id}`);
check(
	'fixture is readable again at the end of the probe (200)',
	finalRead.status === 200,
	`${finalRead.status}`,
);

// Sanity: the member login still works after the whole cycle.
try {
	await signIn(MEMBER_EMAIL, MEMBER_PASSWORD);
	check('seed member can still sign in', true, '');
} catch (error) {
	check('seed member can still sign in', false, String(error));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

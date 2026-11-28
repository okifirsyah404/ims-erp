/**
 * Phase-4 live smoke test: users / audit / invitations.
 *
 * Run from `apps/backend` (config loads only there):
 *   bun run scripts/smoke-admin-api.ts
 *
 * Uses the seeded admin (app admin + org owner) so every surface is
 * reachable, and the seeded member to prove the guard denies the same calls.
 */

const BASE = 'http://localhost:3001';
const ORG = 'JPgGGmy8ILDftfleMx1JtSgAOdLIZ5cE';

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
	// Better Auth returns the session token in the body AND as a cookie;
	// the API routes need both (bearer alone yields 401).
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
) {
	const response = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${auth.token}`,
			cookie: auth.cookie,
			'x-organization-id': ORG,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = (await response.json().catch(() => null)) as
		| { data?: unknown; message?: string }
		| null;
	return { status: response.status, json };
}

const results: string[] = [];
function check(label: string, ok: boolean, detail: string) {
	results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — ${detail}`}`);
}

const admin = await signIn('admin@local.com', 'admin123456');

// ---- users ---------------------------------------------------------------
const users = await call(admin, 'GET', '/admin/users?limit=5');
check(
	'GET /admin/users as admin',
	users.status === 200,
	`${users.status} ${users.json?.message ?? ''}`,
);
const userRows = (users.json as { data?: Array<{ email: string }> } | null)?.data;
check('GET /admin/users returns rows', (userRows?.length ?? 0) > 0, 'empty');

// The admin UI reads `user.organizations.length`. A listing served by a
// handler that doesn't join memberships omits the field and crashes the whole
// users table, so assert the projection really includes it on every row.
const missingOrgs = (userRows ?? []).filter(
	(row) => !Array.isArray((row as { organizations?: unknown }).organizations),
);
check(
	'every /admin/users row carries an organizations array',
	(userRows?.length ?? 0) > 0 && missingOrgs.length === 0,
	`${missingOrgs.length} row(s) missing organizations`,
);

// ---- closed role enum: dynamic role CRUD is gone -------------------------
const removedRoles = await call(admin, 'GET', '/admin/roles');
check(
	'GET /admin/roles is gone (404)',
	removedRoles.status === 404,
	`${removedRoles.status}`,
);

// ---- audit ---------------------------------------------------------------
const audit = await call(admin, 'GET', '/admin/audit?limit=5');
check(
	'GET /admin/audit as owner',
	audit.status === 200,
	`${audit.status} ${audit.json?.message ?? ''}`,
);

// ---- invitations ---------------------------------------------------------
const invitations = await call(admin, 'GET', '/admin/invitations');
check(
	'GET /admin/invitations as admin',
	invitations.status === 200,
	`${invitations.status} ${invitations.json?.message ?? ''}`,
);

// ---- org invite with an invalid role is rejected -------------------------
const invalidRole = await call(admin, 'POST', '/admin/invitations', {
	email: `smoke-invalid-role-${Date.now()}@entragate.test`,
	organizationId: ORG,
	organizationRole: 'not_a_role',
});
check(
	'org invite with unknown organizationRole is rejected (4xx)',
	invalidRole.status >= 400 && invalidRole.status < 500,
	`${invalidRole.status} ${invalidRole.json?.message ?? ''}`,
);

// ---- member is denied the admin surfaces --------------------------------
const member = await signIn('freelancer.seed@entragate.local', 'freelancer123456');
const memberUsers = await call(member, 'GET', '/admin/users');
check(
	'member denied GET /admin/users (403)',
	memberUsers.status === 403,
	`${memberUsers.status}`,
);
const memberAudit = await call(member, 'GET', '/admin/audit');
check(
	'member denied GET /admin/audit (403)',
	memberAudit.status === 403,
	`${memberAudit.status}`,
);

// ---- id lookup is global-admin only -------------------------------------
// `auth.users` is not tenant-scoped, so a bare `erp: {}` guard on
// `GET /users/:userId` let any authenticated member read any profile across
// tenants. The org-scoped listing above is the supported member surface.
const targetUserId = (userRows ?? [])[0] as { id?: string } | undefined;
const memberProfile = await call(
	member,
	'GET',
	`/users/${targetUserId?.id ?? 'unknown'}`,
);
check(
	'member denied GET /users/:userId (403)',
	memberProfile.status === 403,
	`${memberProfile.status}`,
);
const adminProfile = await call(admin, 'GET', `/users/${targetUserId?.id}`);
check(
	'admin allowed GET /users/:userId (200)',
	adminProfile.status === 200,
	`${adminProfile.status}`,
);

console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

export {};

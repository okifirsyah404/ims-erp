/**
 * Phase-4 live smoke test: users / roles / audit / invitations.
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
const users = await call(admin, 'GET', '/users?limit=5');
check(
	'GET /users as admin',
	users.status === 200,
	`${users.status} ${users.json?.message ?? ''}`,
);
const userRows = (users.json as { data?: Array<{ email: string }> } | null)?.data;
check('GET /users returns rows', (userRows?.length ?? 0) > 0, 'empty');

// The admin UI reads `user.organizations.length`. A listing served by a
// handler that doesn't join memberships omits the field and crashes the whole
// users table, so assert the projection really includes it on every row.
const missingOrgs = (userRows ?? []).filter(
	(row) => !Array.isArray((row as { organizations?: unknown }).organizations),
);
check(
	'every /users row carries an organizations array',
	(userRows?.length ?? 0) > 0 && missingOrgs.length === 0,
	`${missingOrgs.length} row(s) missing organizations`,
);

// ---- roles ---------------------------------------------------------------
const roles = await call(admin, 'GET', `/roles?organizationId=${ORG}`);
check(
	'GET /roles as owner',
	roles.status === 200,
	`${roles.status} ${roles.json?.message ?? ''}`,
);
const roleRows = (roles.json as { data?: Array<{ name: string; rank: number }> } | null)
	?.data;
const ownerRank = roleRows?.find((role) => role.name === 'owner')?.rank;
check('seed owner role present (rank 100)', ownerRank === 100, String(ownerRank));

const catalog = await call(admin, 'GET', '/roles/permissions');
const catalogRows = (catalog.json as { data?: Array<{ resource: string }> } | null)
	?.data;
check(
	'GET /roles/permissions',
	catalog.status === 200 && (catalogRows?.length ?? 0) > 0,
	`${catalog.status}`,
);

const memberRoleId = (
	roles.json as { data?: Array<{ id: string; name: string }> } | null
)?.data?.find((role) => role.name === 'member')?.id;

// ---- audit ---------------------------------------------------------------
const audit = await call(admin, 'GET', '/audit?limit=5');
check(
	'GET /audit as owner',
	audit.status === 200,
	`${audit.status} ${audit.json?.message ?? ''}`,
);

// ---- invitations ---------------------------------------------------------
const invitations = await call(admin, 'GET', '/invitations');
check(
	'GET /invitations as admin',
	invitations.status === 200,
	`${invitations.status} ${invitations.json?.message ?? ''}`,
);

// ---- rank guard: owner cannot grant rank 100 -----------------------------
const escalation = await call(admin, 'POST', '/roles', {
	organizationId: ORG,
	name: 'smoke_escalation',
	rank: 100,
	permissions: { quotation: ['read'] },
});
check(
	'escalation guard rejects rank 100 (owner ceiling)',
	escalation.status === 403,
	`${escalation.status} ${escalation.json?.message ?? ''}`,
);

// ---- create + delete a custom role ---------------------------------------
// Make the run repeatable: a leftover role from a previous aborted run would
// otherwise make this POST a 409 and mask the real assertions.
const existingRoles = (
	roles.json as { data?: Array<{ id: string; name: string }> } | null
)?.data;
for (const stale of existingRoles ?? []) {
	if (stale.name.startsWith('smoke_')) {
		await call(admin, 'DELETE', `/roles/${stale.id}`);
	}
}

const created = await call(admin, 'POST', '/roles', {
	organizationId: ORG,
	name: 'smoke_temp_role',
	rank: 20,
	permissions: { quotation: ['read'] },
});
check(
	'POST /roles creates a low-rank custom role',
	created.status === 201,
	`${created.status} ${created.json?.message ?? ''}`,
);
const createdId = (created.json as { data?: { id: string } } | null)?.data?.id;

if (createdId) {
	const removed = await call(admin, 'DELETE', `/roles/${createdId}`);
	check(
		'DELETE /roles/:id soft-deletes an unused custom role',
		removed.status === 200,
		`${removed.status} ${removed.json?.message ?? ''}`,
	);
}

// ---- system role cannot be deleted --------------------------------------
const ownerRoleId = (
	roles.json as { data?: Array<{ id: string; name: string }> } | null
)?.data?.find((role) => role.name === 'member')?.id;
if (ownerRoleId) {
	const systemDelete = await call(admin, 'DELETE', `/roles/${ownerRoleId}`);
	check(
		'system role delete is refused (409)',
		systemDelete.status === 409,
		`${systemDelete.status} ${systemDelete.json?.message ?? ''}`,
	);
}

// ---- member is denied the admin surfaces --------------------------------
const member = await signIn('member.seed@entragate.local', 'member123456');
const memberUsers = await call(member, 'GET', '/users');
check(
	'member denied GET /users (403)',
	memberUsers.status === 403,
	`${memberUsers.status}`,
);
const memberAudit = await call(member, 'GET', '/audit');
check(
	'member denied GET /audit (403)',
	memberAudit.status === 403,
	`${memberAudit.status}`,
);
const memberRoles = await call(member, 'GET', '/roles');
check(
	'member denied GET /roles (403)',
	memberRoles.status === 403,
	`${memberRoles.status}`,
);

// ---- fixture sanity ------------------------------------------------------
check(
	'role master data resolves (member role id)',
	Boolean(memberRoleId),
	String(memberRoleId),
);

console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

export {};

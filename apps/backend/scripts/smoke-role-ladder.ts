/**
 * Live smoke test: organization role-assignment ladder.
 *
 * Run from `apps/backend` with the dev server on :3001:
 *   bun run scripts/smoke-role-ladder.ts
 *
 * Proves the backend rejects the role assignments the dialog no longer offers:
 * no invitation may carry `owner` for anyone, an org admin may not invite
 * `admin`, org HR may not invite `admin`/`hr`, and the employee form cannot
 * smuggle a privileged role in either. Uses the seeded role accounts
 * (`<role>.seed@entragate.local` / `<role>123456`).
 */

const BASE = 'http://localhost:3001';

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
	organizationId: string,
	body?: unknown,
) {
	const response = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${auth.token}`,
			cookie: auth.cookie,
			'x-organization-id': organizationId,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = (await response.json().catch(() => null)) as
		| { data?: unknown; message?: string; errors?: { message: string }[] }
		| null;
	return { status: response.status, json };
}

/**
 * The envelope's own `status` is authoritative for the result, while the HTTP
 * status stays 200 on this API (only the envelope carries 201/403).
 */
function envelopeStatus(result: {
	status: number;
	json: { status?: number; data?: unknown } | null;
}) {
	return result.json?.status ?? result.status;
}

const results: string[] = [];
function check(label: string, ok: boolean, detail: string) {
	results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` - ${detail}`}`);
}

const admin = await signIn('admin@local.com', 'admin123456');

// Resolve the seeded admin's own organization instead of hardcoding an id:
// the guard resolves the caller's membership from `x-organization-id`, so a
// stale id is a 403 "Organization membership required".
const mineResponse = await fetch(`${BASE}/organizations/mine`, {
	headers: {
		authorization: `Bearer ${admin.token}`,
		cookie: admin.cookie,
	},
});
const mine = (await mineResponse.json().catch(() => null)) as
	| { data?: Array<{ id: string; role: string; name: string }> }
	| null;
const ownedOrg =
	mine?.data?.find((org) => org.role.includes('owner')) ?? mine?.data?.[0];
if (!ownedOrg) {
	console.error('No organization membership found for the seeded admin.');
	process.exit(1);
}
const ORG = ownedOrg.id;
console.log(`Using organization ${ownedOrg.name} (${ORG})\n`);

const uniqueEmail = (label: string) =>
	`${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

// ---- owner is never invitable, even for a platform admin + org owner ------
const ownerInvite = await call(admin, 'POST', `/admin/invitations`, ORG, {
	email: uniqueEmail('owner'),
	name: 'Owner Attempt',
	organizationId: ORG,
	organizationRoles: ['owner'],
});
check(
	'owner caller: /admin/invitations with owner -> 403',
	envelopeStatus(ownerInvite) === 403,
	`${envelopeStatus(ownerInvite)} ${ownerInvite.json?.message ?? ''}`,
);

const orgOwnerInvite = await call(
	admin,
	'POST',
	`/organizations/${ORG}/invitations`,
	ORG,
	{
		email: uniqueEmail('owner2'),
		name: 'Owner Attempt Org',
		organizationRoles: ['owner'],
	},
);
check(
	'owner caller: org invitation with owner -> 403',
	envelopeStatus(orgOwnerInvite) === 403,
	`${envelopeStatus(orgOwnerInvite)} ${orgOwnerInvite.json?.message ?? ''}`,
);

const employeeOwner = await call(admin, 'POST', '/human-resources/employees', ORG, {
	fullName: 'Owner Employee',
	email: uniqueEmail('owner-emp'),
	organizationId: ORG,
	organizationRoles: ['owner'],
	employmentType: 'permanent',
});
check(
	'owner caller: employee invite with owner -> 403',
	envelopeStatus(employeeOwner) === 403,
	`${envelopeStatus(employeeOwner)} ${employeeOwner.json?.message ?? ''}`,
);

// ---- a legal invite still works, and carries the employment type ----------
const legalEmail = uniqueEmail('legal');
const legalInvite = await call(admin, 'POST', `/organizations/${ORG}/invitations`, ORG, {
	email: legalEmail,
	name: 'Legal Invitee',
	organizationRoles: ['member'],
	employmentType: 'contract',
});
check(
	'owner caller: legal invite (member, contract) -> 201',
	envelopeStatus(legalInvite) === 201,
	`${envelopeStatus(legalInvite)} ${legalInvite.json?.message ?? ''}`,
);
if (envelopeStatus(legalInvite) === 201) {
	const employees = await call(
		admin,
		'GET',
		`/human-resources/employees?search=${encodeURIComponent(legalEmail)}&limit=5`,
		ORG,
	);
	const rows = (employees.json as { data?: Array<Record<string, unknown>> } | null)
		?.data;
	const row = rows?.find((candidate) => candidate.email === legalEmail);
	check(
		'invited employee stores the email (was always NULL)',
		row?.email === legalEmail,
		`email=${String(row?.email)}`,
	);
	check(
		'invited employee stores employmentType=contract',
		row?.employmentType === 'contract',
		`employmentType=${String(row?.employmentType)}`,
	);
}

// ---- org admin: may invite member/hr, may not invite admin or owner ------
const adminMember = await signIn('admin.seed@entragate.local', 'admin123456');
const adminInvitesAdmin = await call(
	adminMember,
	'POST',
	`/organizations/${ORG}/invitations`,
	ORG,
	{
		email: uniqueEmail('byadmin'),
		name: 'Admin Invited By Admin',
		organizationRoles: ['admin'],
	},
);
check(
	'org admin: invitation with admin -> 403',
	envelopeStatus(adminInvitesAdmin) === 403,
	`${envelopeStatus(adminInvitesAdmin)} ${adminInvitesAdmin.json?.message ?? ''}`,
);

const adminInvitesHr = await call(
	adminMember,
	'POST',
	`/organizations/${ORG}/invitations`,
	ORG,
	{
		email: uniqueEmail('hradmin'),
		name: 'HR Invited By Admin',
		organizationRoles: ['hr'],
	},
);
check(
	'org admin: invitation with hr -> 201',
	envelopeStatus(adminInvitesHr) === 201,
	`${envelopeStatus(adminInvitesHr)} ${adminInvitesHr.json?.message ?? ''}`,
);

// ---- org HR: may invite member, may not invite admin or hr ---------------
const hrMember = await signIn('hr.seed@entragate.local', 'hr123456');
for (const role of ['admin', 'hr', 'owner']) {
	const attempt = await call(
		hrMember,
		'POST',
		`/organizations/${ORG}/invitations`,
		ORG,
		{
			email: uniqueEmail(`byhr-${role}`),
			name: `Invited by HR as ${role}`,
			organizationRoles: [role],
		},
	);
	check(
		`org hr: invitation with ${role} -> 403`,
		envelopeStatus(attempt) === 403,
		`${envelopeStatus(attempt)} ${attempt.json?.message ?? ''}`,
	);
}

const hrInvitesMember = await call(
	hrMember,
	'POST',
	`/organizations/${ORG}/invitations`,
	ORG,
	{
		email: uniqueEmail('bymember'),
		name: 'Member Invited By HR',
		organizationRoles: ['member'],
	},
);
check(
	'org hr: invitation with member -> 201',
	envelopeStatus(hrInvitesMember) === 201,
	`${envelopeStatus(hrInvitesMember)} ${hrInvitesMember.json?.message ?? ''}`,
);

console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${results.length - failed} passed / ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

export {};

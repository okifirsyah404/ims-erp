/**
 * Dev-only live smoke for the phase-3 dynamic permission guard.
 *
 * Checks, against the running dev server:
 *  1. owner  -> member:read      (200, dynamic row grants)
 *  2. member -> quotation:read   (403, dynamic deny)
 */
const BASE = 'http://localhost:3001';
const ORG = 'JPgGGmy8ILDftfleMx1JtSgAOdLIZ5cE';

export {};

async function login(email: string, password: string) {
	const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	const body = (await res.json()) as { token?: string; message?: string };
	if (!body.token) throw new Error(`login failed (${res.status}): ${body.message}`);
	// Better Auth keeps the session in cookies; forward them to the API.
	const cookie = (res.headers.getSetCookie?.() ?? [])
		.map((c) => c.split(';')[0])
		.join('; ');
	return { token: body.token, cookie };
}

async function check(
	label: string,
	session: { token: string; cookie: string },
	path: string,
	expected: number,
) {
	const res = await fetch(`${BASE}${path}`, {
		headers: {
			authorization: `Bearer ${session.token}`,
			cookie: session.cookie,
			'x-organization-id': ORG,
		},
	});
	const ok = res.status === expected;
	console.log(
		`${ok ? 'PASS' : 'FAIL'} ${label}: ${res.status} (expected ${expected})`,
	);
	if (!ok) console.log('   body:', (await res.text()).slice(0, 300));
}

const owner = await login('admin@local.com', 'admin123456');
await check('owner -> GET /organizations/:id/members', owner,
	`/organizations/${ORG}/members`, 200);

const member = await login('member.seed@entragate.local', 'member123456');
await check('member -> GET /sales/quotations', member, '/sales/quotations', 403);

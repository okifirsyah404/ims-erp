/**
 * Dev-only live proof of the static-catalog fallback: temporarily soft-deletes
 * the org's `owner` role row so the guard has NO live dynamic row for that
 * member and must fall back to the static shared catalog. Restores the row
 * afterwards (try/finally).
 */
import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';

const BASE = 'http://localhost:3001';
const ORG = 'JPgGGmy8ILDftfleMx1JtSgAOdLIZ5cE';

const sql = new SQL(appConfig.database.url!);

async function login(email: string, password: string) {
	const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	const body = (await res.json()) as { token?: string; message?: string };
	if (!body.token) throw new Error(`login failed (${res.status}): ${body.message}`);
	const cookie = (res.headers.getSetCookie?.() ?? [])
		.map((c) => c.split(';')[0])
		.join('; ');
	return { token: body.token, cookie };
}

async function check(label: string, session: { token: string; cookie: string }, path: string, expected: number) {
	const res = await fetch(`${BASE}${path}`, {
		headers: {
			authorization: `Bearer ${session.token}`,
			cookie: session.cookie,
			'x-organization-id': ORG,
		},
	});
	const ok = res.status === expected;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${res.status} (expected ${expected})`);
	if (!ok) console.log('   body:', (await res.text()).slice(0, 300));
}

const owner = await login('admin@local.com', 'admin123456');

try {
	await sql`update auth.roles set deleted_at = now() where organization_id = ${ORG} and name = 'owner' and deleted_at is null`;
	console.log('owner role row soft-deleted (fallback active)');

	await check('owner (no live row) -> GET /sales/quotations', owner, '/sales/quotations', 200);
	await check('owner (no live row) -> GET /organizations/:id/members', owner, `/organizations/${ORG}/members`, 200);
} finally {
	await sql`update auth.roles set deleted_at = null where organization_id = ${ORG} and name = 'owner' and deleted_at is not null`;
	console.log('owner role row restored');
	await sql.end();
}

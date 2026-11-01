/**
 * Dev-only live proof that the DYNAMIC grant set is authoritative: narrows the
 * org's `owner` role row to a single grant, expects the request to be denied
 * even though the static catalog grants it, then restores the row.
 */
import { SQL } from 'bun';
import { appConfig } from '../config/providers/config';
import { erpRoleGrants } from '@ims-erp/common';

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
	await sql`
		update auth.roles
		set permissions = ${JSON.stringify({ dashboard: ['read'] })}::jsonb
		where organization_id = ${ORG} and name = 'owner' and deleted_at is null`;
	console.log('owner role row narrowed to dashboard:read');

	await check('owner (narrowed live row) -> GET /sales/quotations', owner, '/sales/quotations', 403);
} finally {
	await sql`
		update auth.roles
		set permissions = ${JSON.stringify(erpRoleGrants.owner)}::jsonb
		where organization_id = ${ORG} and name = 'owner' and deleted_at is null`;
	console.log('owner role row restored to catalog grants');
	await sql.end();
}

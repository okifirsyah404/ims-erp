/**
 * Live smoke test for the monthly report archive + statement exports
 * (M12 T30).
 *
 * Run from `apps/backend` with the dev server on :3001 and a seeded database:
 *   bun run scripts/smoke-report-archives.ts
 *
 * Writes one archive only when a period is already `closed`, and never closes
 * a period itself, so the posting state of the dev database is not changed by
 * running it. The refusal path (an open month must answer 409) is exercised
 * whenever an open period exists.
 */

const BASE = 'http://localhost:3001';

type TSignIn = { token: string; cookie: string };

type TCallResult = {
	status: number;
	contentType: string;
	disposition: string;
	text: string;
	json: Record<string, unknown> | null;
};

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
	organizationId: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<TCallResult> {
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
	const text = await response.text();
	return {
		status: response.status,
		contentType: response.headers.get('content-type') ?? '',
		disposition: response.headers.get('content-disposition') ?? '',
		text,
		json: (() => {
			try {
				return JSON.parse(text) as Record<string, unknown>;
			} catch {
				return null;
			}
		})(),
	};
}

const results: string[] = [];
function check(label: string, ok: boolean, detail: string) {
	results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` - ${detail}`}`);
}

async function main() {
	const admin = await signIn('admin@local.com', 'admin123456');

	const mine = await call(admin, '', 'GET', '/organizations/mine');
	const organizations = (mine.json?.data ?? []) as Array<{
		id: string;
		name: string;
	}>;
	if (organizations.length === 0) {
		throw new Error('no organization for the seed admin');
	}
	const org = organizations[0]!.id;
	console.log(`organization: ${organizations[0]!.name} (${org})`);

	// ---- archives list ---------------------------------------------------
	const list = await call(admin, org, 'GET', '/reports/archives?page=1&limit=10');
	check('GET /reports/archives', list.status === 200, `${list.status}`);
	const rows = (list.json?.data ?? []) as Array<{ reportType: string }>;
	check(
		'archive rows are an array',
		Array.isArray(list.json?.data),
		JSON.stringify(list.json?.data)?.slice(0, 80) ?? 'null',
	);
	console.log(`archived statements: ${rows.length}`);

	// ---- statement exports -----------------------------------------------
	const start = '2026-01-01';
	const end = '2026-12-31';
	const pl = await call(
		admin,
		org,
		'GET',
		`/reports/profit-and-loss.csv?startDate=${start}&endDate=${end}`,
	);
	check('GET /reports/profit-and-loss.csv', pl.status === 200, `${pl.status}`);
	check('P&L CSV is text/csv', pl.contentType.includes('text/csv'), pl.contentType);
	check(
		'P&L CSV has the header row',
		pl.text.replace(/^\uFEFF/, '').startsWith('statement,period_start,period_end'),
		pl.text.slice(0, 60),
	);
	check(
		'P&L CSV is an attachment',
		pl.disposition.includes('attachment; filename="profit-and-loss-'),
		pl.disposition,
	);

	const bs = await call(
		admin,
		org,
		'GET',
		`/reports/balance-sheet.csv?asOfDate=${end}`,
	);
	check('GET /reports/balance-sheet.csv', bs.status === 200, `${bs.status}`);
	check(
		'balance sheet CSV carries an unexplained row',
		bs.text.includes('unexplained'),
		'missing',
	);

	const cf = await call(
		admin,
		org,
		'GET',
		`/reports/cash-flow.csv?startDate=${start}&endDate=${end}`,
	);
	check('GET /reports/cash-flow.csv', cf.status === 200, `${cf.status}`);
	check(
		'cash flow CSV carries net_change_in_cash',
		cf.text.includes('net_change_in_cash'),
		'missing',
	);

	// ---- archive write path ----------------------------------------------
	const periods = await call(admin, org, 'GET', '/periods?page=1&limit=100');
	const periodRows = (periods.json?.data ?? []) as Array<{
		periodYear: number;
		periodMonth: number;
		status: string;
	}>;

	const openPeriod = periodRows.find((row) => row.status === 'open');
	if (openPeriod) {
		const refused = await call(admin, org, 'POST', '/reports/archives', {
			periodYear: openPeriod.periodYear,
			periodMonth: openPeriod.periodMonth,
		});
		check(
			`POST /reports/archives refuses open ${openPeriod.periodYear}-${openPeriod.periodMonth}`,
			refused.status === 409,
			`${refused.status}`,
		);
	} else {
		console.log('no open period to test the refusal path against; skipped');
	}

	const closedPeriod = periodRows.find((row) => row.status !== 'open');
	if (closedPeriod) {
		const archived = await call(admin, org, 'POST', '/reports/archives', {
			periodYear: closedPeriod.periodYear,
			periodMonth: closedPeriod.periodMonth,
		});
		check(
			`POST /reports/archives accepts closed ${closedPeriod.periodYear}-${closedPeriod.periodMonth}`,
			archived.status === 201,
			`${archived.status}`,
		);
		const created = (archived.json?.data ?? []) as unknown[];
		console.log(
			`statements written this run: ${created.length} (0 means already archived)`,
		);
	} else {
		console.log('no closed period yet; close one to exercise the write path');
	}

	console.log('');
	for (const line of results) console.log(line);
	const failed = results.filter((line) => line.startsWith('FAIL')).length;
	console.log(`\n${results.length - failed} pass / ${failed} fail`);
	return failed === 0;
}

/**
 * Runs the checks, then exits with the pass/fail code.
 *
 * @remarks
 * `main()` is invoked through `.then()` rather than a top-level `await` so the
 * file stays a plain script (no `export {}` needed to make it a module), which
 * is what the other `scripts/*.ts` smoke tests rely on.
 */
main()
	.then((ok) => process.exit(ok ? 0 : 1))
	.catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});

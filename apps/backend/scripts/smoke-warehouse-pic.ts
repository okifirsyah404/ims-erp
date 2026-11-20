/**
 * Live person-in-charge check (ERP-0051 Phase 5, ADR-0017).
 *
 * Runs against a **running backend** over a freshly seeded disposable
 * database, so every case exercises the real Better Auth login gate, the real
 * `warehouseGuard`, and real `inventory.warehouse_managers` rows:
 *
 *   # once: push schema + seed into a throwaway database
 *   POSTGRES_DB=ims_erp_pic_check bun run drizzle:push --force
 *   POSTGRES_DB=ims_erp_pic_check bun run drizzle:seed
 *
 *   # server
 *   POSTGRES_DB=ims_erp_pic_check APP_PORT=3011 SCHEDULER_ENABLED=false \
 *     bun run src/index.ts
 *
 *   # this script
 *   POSTGRES_DB=ims_erp_pic_check bun run scripts/smoke-warehouse-pic.ts <organizationId>
 *
 * Cases map one-to-one to the Phase 5 checklist in
 * `docs/plan/plans/side-nav-role-based.md`. This script proves **enforcement**
 * (status codes and payloads); the browser pass covers rendering.
 *
 * It creates its own accounts and PIC grants and removes them at the end. The
 * seeded rows are only read, never modified — the one archive case creates and
 * archives its own warehouse.
 */
import { SQL } from 'bun';
import { inArray } from 'drizzle-orm';
import { drizzleDB } from '../drizzle/db';
import { members, users } from '../drizzle/schemas/auth.schema';
import {
	warehouseManagers,
	warehouseOrganizations,
	warehouses,
} from '../drizzle/schemas/warehouse.schema';

const BASE = `http://localhost:${process.env.APP_PORT ?? 3011}`;
const ORG_ID = process.argv[2];
if (!ORG_ID) {
	throw new Error('usage: bun run scripts/smoke-warehouse-pic.ts <organizationId>');
}

const PASSWORD = 'pic-check-123456';
const PREFIX = 'pic-check';

/**
 * Accounts the script creates, one per Phase 5 role scenario.
 *
 * @remarks
 * `appAdmin` has **no** membership (decision 3/10: an app admin passes the
 * login gate on the global role alone). `multiOrg` is `investor` at the app
 * level with an internal `sales` membership in the organization — the
 * "investor + internal in another org" case. `noGrant` is an internal member
 * with no PIC row: signed in, wrong role.
 */
const ACCOUNTS = [
	{ key: 'appAdmin', role: 'admin', membership: null },
	{ key: 'investorOnly', role: 'investor', membership: null },
	{ key: 'customerOnly', role: 'customer', membership: null },
	{ key: 'multiOrg', role: 'investor', membership: 'sales' },
	/** Internal member who holds a grant on one warehouse. */
	{ key: 'pic', role: 'user', membership: 'warehouse' },
	/** Internal member with no grant: signed in, wrong role. */
	{ key: 'noGrant', role: 'user', membership: 'warehouse' },
] as const;

type TAccount = (typeof ACCOUNTS)[number];
const userIdOf = (account: TAccount) => `${PREFIX}-${account.key}`;
// Lowercase on purpose: Better Auth normalizes addresses, and a mixed-case
// fixture would never match its lookup (the probe answered 401 for
// `pic-check-appAdmin@example.test` while the lowercase form works).
const emailOf = (account: TAccount) => `${userIdOf(account)}@example.test`.toLowerCase();

type TAuth = { token: string; cookie: string };

async function signIn(email: string): Promise<TAuth> {
	const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: PASSWORD }),
	});
	if (!response.ok) throw new Error(`sign-in failed for ${email}: ${response.status}`);
	const body = (await response.json()) as { token?: string };
	// Better Auth returns the token in the body AND as a cookie; API routes
	// need both (a bearer alone yields 401 — same note as smoke-admin-api.ts).
	const cookie = response.headers
		.getSetCookie()
		.map((entry) => entry.split(';')[0])
		.join('; ');
	return { token: body.token ?? '', cookie };
}

async function signInStatus(email: string): Promise<number> {
	const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: PASSWORD }),
	});
	return response.status;
}

async function call(
	auth: TAuth | null,
	method: string,
	path: string,
	options: { body?: unknown; organizationId?: string } = {},
) {
	const headers: Record<string, string> = {};
	if (auth) {
		headers.authorization = `Bearer ${auth.token}`;
		headers.cookie = auth.cookie;
	}
	if (options.organizationId) headers['x-organization-id'] = options.organizationId;
	if (options.body !== undefined) headers['Content-Type'] = 'application/json';

	const response = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	});
	const json = (await response.json().catch(() => null)) as
		| { data?: unknown; message?: string; code?: string }
		| null;
	return { status: response.status, json };
}

const results: string[] = [];
function check(label: string, ok: boolean, detail: string) {
	results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — ${detail}`}`);
}
function section(title: string) {
	results.push(`\n--- ${title} ${'-'.repeat(Math.max(0, 58 - title.length))}`);
}

const createdUserIds = ACCOUNTS.map(userIdOf);
const ownedWarehouseIds: string[] = [];

async function cleanup() {
	const raw = new SQL(process.env.POSTGRES_URL!);
	await raw.unsafe(`DELETE FROM inventory.warehouse_managers WHERE user_id = ANY($1)`, [
		createdUserIds,
	]);
	if (ownedWarehouseIds.length > 0) {
		await raw.unsafe(
			`DELETE FROM inventory.warehouse_organizations WHERE warehouse_id = ANY($1)`,
			[ownedWarehouseIds],
		);
		await raw.unsafe(`DELETE FROM inventory.warehouse_storages WHERE warehouse_id = ANY($1)`, [
			ownedWarehouseIds,
		]);
		await raw.unsafe(`DELETE FROM inventory.warehouse_addresses WHERE warehouse_id = ANY($1)`, [
			ownedWarehouseIds,
		]);
		await raw.unsafe(`DELETE FROM inventory.warehouses WHERE id = ANY($1)`, [
			ownedWarehouseIds,
		]);
	}
	await raw.close();
	await drizzleDB.delete(members).where(inArray(members.userId, createdUserIds));
	await drizzleDB.delete(users).where(inArray(users.id, createdUserIds));
}

// ---- fixtures -------------------------------------------------------------
await cleanup();

// Same hashing the seeder uses, so a credential sign-in behaves identically.
const { auth: betterAuth } = await import('../src/providers/better-auth/auth');
const context = await betterAuth.$context;
const passwordHash = await context.password.hash(PASSWORD);

const raw = new SQL(process.env.POSTGRES_URL!);
for (const account of ACCOUNTS) {
	const id = userIdOf(account);
	await drizzleDB.insert(users).values({
		id,
		name: id,
		email: emailOf(account),
		emailVerified: false,
		role: account.role,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await raw.unsafe(
		`INSERT INTO auth.accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
		 VALUES ($1, $2, 'credential', $3, $4, now(), now())`,
		[`acc-${id}`, id, id, passwordHash],
	);
	if (account.membership) {
		await drizzleDB.insert(members).values({
			id: `member-${id}`,
			organizationId: ORG_ID,
			userId: id,
			role: account.membership,
			createdAt: new Date(),
		});
	}
}

// Two seeded warehouses: one the PIC manages, one it must not reach.
const liveWarehouses = await drizzleDB
	.select({ id: warehouses.id, name: warehouses.name })
	.from(warehouses);
if (liveWarehouses.length < 2) throw new Error('need at least 2 seeded warehouses');
const [owned, other] = liveWarehouses;

// The PIC: an internal member holding a grant on exactly one warehouse.
const picUser = ACCOUNTS.find((a) => a.key === 'pic')!;
const appAdminUser = ACCOUNTS.find((a) => a.key === 'appAdmin')!;
const grant = await drizzleDB
	.insert(warehouseManagers)
	.values({
		warehouseId: owned.id,
		userId: userIdOf(picUser),
		assignedBy: userIdOf(appAdminUser),
		createdAt: new Date(),
	})
	.returning({ id: warehouseManagers.id });

await raw.close();

console.log(`base=${BASE}  org=${ORG_ID}`);
console.log(`warehouse(owned)=${owned.id}  warehouse(other)=${other.id}`);
console.log(`seed grant=${grant[0].id}`);

// ---- 1. login gate (Phase 3, re-checked here for the role scenarios) ------
section('Login gate');

check(
	'app admin with no membership signs in',
	(await signInStatus(emailOf(ACCOUNTS[0]))) === 200,
	`status ${await signInStatus(emailOf(ACCOUNTS[0]))}`,
);
check(
	'investor-only is rejected at login',
	(await signInStatus(emailOf(ACCOUNTS[1]))) === 403,
	`status ${await signInStatus(emailOf(ACCOUNTS[1]))}`,
);
check(
	'customer-only is rejected at login',
	(await signInStatus(emailOf(ACCOUNTS[2]))) === 403,
	`status ${await signInStatus(emailOf(ACCOUNTS[2]))}`,
);
check(
	'investor + internal membership signs in',
	(await signInStatus(emailOf(ACCOUNTS[3]))) === 200,
	`status ${await signInStatus(emailOf(ACCOUNTS[3]))}`,
);

// ---- 2. unauthenticated access -------------------------------------------
section('No session');

check(
	'GET /warehouses/mine without a session is 401',
	(await call(null, 'GET', '/warehouses/mine')).status === 401,
	'did not answer 401',
);
check(
	'GET /warehouses/:id without a session is 401',
	(await call(null, 'GET', `/warehouses/${owned.id}`)).status === 401,
	'did not answer 401',
);

// ---- 3. app admin (no membership) ---------------------------------------
section('App admin, no membership');

const appAdmin = await signIn(emailOf(ACCOUNTS[0]));

const adminMine = await call(appAdmin, 'GET', '/warehouses/mine');
const adminMineRows = (adminMine.json as { data?: unknown[] } | null)?.data ?? [];
check('GET /warehouses/mine is 200', adminMine.status === 200, `status ${adminMine.status}`);
check(
	'lists every live warehouse',
	adminMineRows.length >= liveWarehouses.length,
	`${adminMineRows.length} of ${liveWarehouses.length}`,
);
check(
	'GET /warehouses/:id (any warehouse) is 200',
	(await call(appAdmin, 'GET', `/warehouses/${other.id}`)).status === 200,
	`status ${(await call(appAdmin, 'GET', `/warehouses/${other.id}`)).status}`,
);
check(
	'GET /warehouses/:id/managers is 200',
	(await call(appAdmin, 'GET', `/warehouses/${owned.id}/managers`)).status === 200,
	'did not answer 200',
);
const candidates = await call(appAdmin, 'GET', '/warehouses/manager-candidates?limit=5');
check(
	'GET /warehouses/manager-candidates is 200 with rows',
	((candidates.json as { data?: unknown[] } | null)?.data ?? []).length > 0,
	`status ${candidates.status}`,
);

// ---- 4. PIC with an org link (seeded warehouse) -------------------------
section('Person in charge');

// `ACCOUNTS[4]` is the PIC: the seeded grant below points at that user.
const picAccount = ACCOUNTS[4];
const pic = await signIn(emailOf(picAccount));

const picMine = await call(pic, 'GET', '/warehouses/mine');
const picMineRows = ((picMine.json as { data?: Array<{ id: string }> } | null)?.data ?? []);
check('GET /warehouses/mine is 200', picMine.status === 200, `status ${picMine.status}`);
check(
	'returns exactly the granted warehouse',
	picMineRows.length === 1 && picMineRows[0].id === owned.id,
	`${picMineRows.map((row) => row.id).join(',')}`,
);
check(
	'rows carry their binaries (`storages`)',
	Array.isArray((picMineRows[0] as unknown as { storages?: unknown[] })?.storages),
	'no storages field',
);
check(
	'GET own warehouse is 200',
	(await call(pic, 'GET', `/warehouses/${owned.id}`)).status === 200,
	'denied own warehouse',
);
check(
	"GET another warehouse is 404 (existence not leaked)",
	(await call(pic, 'GET', `/warehouses/${other.id}`)).status === 404,
	'expected 404',
);
check(
	'the admin listing stays 403',
	(await call(pic, 'GET', '/warehouses')).status === 403,
	'expected 403',
);
check(
	'POST /warehouses (create) stays 403',
	(await call(pic, 'POST', '/warehouses', { body: { name: 'pic-forbidden' } })).status === 403,
	'expected 403',
);
check(
	'assigning a manager stays 403',
	(
		await call(pic, 'POST', `/warehouses/${owned.id}/managers`, {
			body: { userId: userIdOf(ACCOUNTS[4]) },
		})
	).status === 403,
	'expected 403',
);
check(
	'the managers list stays 403',
	(await call(pic, 'GET', `/warehouses/${owned.id}/managers`)).status === 403,
	'expected 403',
);
check(
	'organization links stay 403',
	(await call(pic, 'GET', `/warehouses/${owned.id}/organizations`)).status === 403,
	'expected 403',
);

// ---- 5. internal member with no grant ------------------------------------
section('Internal member, no PIC grant');

const noGrant = await signIn(emailOf(ACCOUNTS[5]));
const noGrantMine = await call(noGrant, 'GET', '/warehouses/mine');
check(
	'GET /warehouses/mine is 200 and empty (not 403)',
	noGrantMine.status === 200 &&
		((noGrantMine.json as { data?: unknown[] } | null)?.data ?? []).length === 0,
	`status ${noGrantMine.status}`,
);
check(
	'GET a warehouse is 403',
	(await call(noGrant, 'GET', `/warehouses/${owned.id}`)).status === 403,
	'expected 403',
);

// ---- 6. investor + internal membership (multi-org) -----------------------
section('Investor app role, internal membership');

const multi = await signIn(emailOf(ACCOUNTS[3]));
const multiMine = await call(multi, 'GET', '/warehouses/mine');
check(
	'GET /warehouses/mine is 200 (no warehouse, no grant)',
	multiMine.status === 200 &&
		((multiMine.json as { data?: unknown[] } | null)?.data ?? []).length === 0,
	`status ${multiMine.status}`,
);
const multiOrgs = await call(multi, 'GET', '/organizations/mine', { organizationId: ORG_ID });
const multiOrgRows =
	(multiOrgs.json as { data?: Array<{ id: string; role: string }> } | null)?.data ?? [];
check('GET /organizations/mine is 200', multiOrgs.status === 200, `status ${multiOrgs.status}`);
check(
	'the switcher list holds only internal-role organizations',
	multiOrgRows.every((org) => org.role !== 'investor' && org.role !== 'customer'),
	JSON.stringify(multiOrgRows),
);

// ---- 7. direct call to an admin-only route ------------------------------
section('Direct call without permission');

check(
	'internal member is refused the admin warehouse list (403)',
	(await call(noGrant, 'GET', '/warehouses')).status === 403,
	'expected 403',
);
check(
	'internal member is refused the admin warehouse list count route (403)',
	(await call(noGrant, 'GET', '/warehouses?limit=1')).status === 403,
	'expected 403',
);
// `/items` is intentionally **not** asserted here: item reads ride the active
// organization's permissions, and every web-admin account holds some internal
// org role, so a 200 is legitimate. The warehouse UI hides those tabs for a PIC
// because the grant confers no stock access — a UX rule, not a route denial.

// ---- 8. assign / unassign round trip (app admin) ------------------------
section('Manager assignment (app admin)');

const assignStatus = (
	await call(appAdmin, 'POST', `/warehouses/${other.id}/managers`, {
		body: { userId: userIdOf(picUser) },
	})
).status;
check('POST /:id/managers is 201', assignStatus === 201, `status ${assignStatus}`);
check(
	'duplicate assign is 409',
	(
		await call(appAdmin, 'POST', `/warehouses/${other.id}/managers`, {
			body: { userId: userIdOf(picUser) },
		})
	).status === 409,
	'expected 409',
);
check(
	'unknown user is 404',
	(
		await call(appAdmin, 'POST', `/warehouses/${other.id}/managers`, {
			body: { userId: 'no-such-user' },
		})
	).status === 404,
	'expected 404',
);

// The new grant must widen the PIC's view, which is the point of the
// round trip: enforcement follows the table, not a cached role.
const picMineAfter = await call(pic, 'GET', '/warehouses/mine');
check(
	'the second warehouse now appears in /warehouses/mine',
	((picMineAfter.json as { data?: Array<{ id: string }> } | null)?.data ?? []).some(
		(row) => row.id === other.id,
	),
	'grant did not take effect',
);
check(
	'the second warehouse is now reachable',
	(await call(pic, 'GET', `/warehouses/${other.id}`)).status === 200,
	'still denied',
);

const unassignStatus = (
	await call(appAdmin, 'DELETE', `/warehouses/${other.id}/managers/${userIdOf(picUser)}`)
).status;
check('DELETE /:id/managers/:userId is 200', unassignStatus === 200, `status ${unassignStatus}`);
check(
	'unassign is idempotent (200, removed=false)',
	(
		await call(appAdmin, 'DELETE', `/warehouses/${other.id}/managers/${userIdOf(picUser)}`)
	).status === 200,
	'expected 200',
);
check(
	'the warehouse is refused again (404)',
	(await call(pic, 'GET', `/warehouses/${other.id}`)).status === 404,
	'expected 404',
);

// ---- 9. a PIC of an unlinked warehouse ----------------------------------
// Decision 3: the grant works without the active organization being linked.
section('PIC whose warehouse is not linked to the active organization');

const created = await call(appAdmin, 'POST', '/warehouses', {
	body: { name: `${PREFIX} unlinked`, isActive: true },
});
const createdId = (created.json as { data?: { id: string } } | null)?.data?.id;
check('app admin can create a warehouse (201)', created.status === 201, `status ${created.status}`);
if (createdId) {
	ownedWarehouseIds.push(createdId);
	// A freshly created warehouse with no `organizationId` is global and has no
	// row in `inventory.warehouse_organizations` — exactly the case decision 3
	// carves out of ADR-0010 §5.
	const links = await drizzleDB
		.select({ warehouseId: warehouseOrganizations.warehouseId })
		.from(warehouseOrganizations);
	check(
		'the new warehouse has no organization link',
		!links.some((link) => link.warehouseId === createdId),
		'it was linked somehow',
	);

	const assignNew = await call(appAdmin, 'POST', `/warehouses/${createdId}/managers`, {
		body: { userId: userIdOf(picUser) },
	});
	check('assigning the PIC to it succeeds (201)', assignNew.status === 201, `status ${assignNew.status}`);

	const unlinkedRead = await call(pic, 'GET', `/warehouses/${createdId}`);
	check(
		'PIC reaches a warehouse with no organization link (200)',
		unlinkedRead.status === 200,
		`status ${unlinkedRead.status}`,
	);
	check(
		'and it appears in /warehouses/mine',
		((await call(pic, 'GET', '/warehouses/mine')).json as {
			data?: Array<{ id: string }>;
		} | null)?.data?.some((row) => row.id === createdId) === true,
		'missing from /mine',
	);

	// The grant's write rights, exercised on this script's own warehouse so the
	// seeded rows stay untouched.
	const picPatch = await call(pic, 'PATCH', `/warehouses/${createdId}`, {
		body: { name: `${PREFIX} renamed by pic` },
	});
	check('PATCH is 200 (update right)', picPatch.status === 200, `status ${picPatch.status}`);
	const picAddress = await call(pic, 'PUT', `/warehouses/${createdId}/address`, {
		body: { street: `${PREFIX} street` },
	});
	check('PUT address is 200 (update right)', picAddress.status === 200, `status ${picAddress.status}`);
	check(
		'GET address is 200 (read right)',
		(await call(pic, 'GET', `/warehouses/${createdId}/address`)).status === 200,
		'denied',
	);
	const picStorage = await call(pic, 'POST', `/warehouses/${createdId}/storages`, {
		body: { code: `${PREFIX}-BIN` },
	});
	check(
		'POST storage is 2xx (update right)',
		picStorage.status === 200 || picStorage.status === 201,
		`status ${picStorage.status}`,
	);
	check(
		'PUT another address is 404',
		(await call(pic, 'PUT', `/warehouses/${other.id}/address`, { body: { street: 'x' } })).status ===
			404,
		'expected 404',
	);

	check(
		'archive is a PIC right (200)',
		(await call(pic, 'DELETE', `/warehouses/${createdId}`)).status === 200,
		'archive refused',
	);
}

// ---- report --------------------------------------------------------------
await cleanup();

console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
const passed = results.filter((line) => line.startsWith('PASS')).length;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

export {};

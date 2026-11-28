/**
 * Stock + adjustment authorization integration tests.
 *
 * Exercises the REAL Elysia pipeline (`erpGuard` + controller + service) for the
 * S3 routes through `app.handle()`, with the auth and repository seams mocked.
 *
 * What is being pinned:
 * - every `stock:*` and `stock_adjustment:*` route requires a session (401) and
 *   the right permission (403);
 * - **tenant scope is never taken from the request**: a caller passing another
 *   organization's id in `scope` or `organizationId` still reads only its own;
 * - the one legitimate cross-tenant read is `scope=global`, because a global
 *   warehouse's balance is shared by design;
 * - `POST /stock/adjustments/:id/approve` refuses a self-approval for a user
 *   without `stock_adjustment:approve`.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
} from './test-app';
import type {
	IStockAdjustmentSelectLike,
	TAdjustmentCapture,
} from './stock-test-doubles';
import {
	capture,
	installStockDoubles,
	resetCapture,
} from './stock-test-doubles';

let app: Elysia<any, any, any, any, any, any>;

const WAREHOUSE_ID = '01920000-0000-7000-8000-0000000000aa';
const ITEM_ID = '01920000-0000-7000-8000-000000000001';
const ADJUSTMENT_ID = '01920000-0000-7000-8000-0000000000ad';

const jsonRequest = (
	method: string,
	path: string,
	session?: string,
	body?: unknown,
): Request => {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (session) headers.set('x-test-session', session);
	return new Request(`http://localhost${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
};

/** Every S3 route, with the permission each one is expected to require. */
const ROUTES: ReadonlyArray<{
	method: string;
	path: string;
	body?: unknown;
}> = [
	{ method: 'GET', path: '/stock/balances' },
	{ method: 'GET', path: '/stock/movements' },
	{
		method: 'POST',
		path: '/stock/receipts',
		body: { warehouseId: WAREHOUSE_ID, itemId: ITEM_ID, quantity: 5 },
	},
	{
		method: 'POST',
		path: '/stock/issues',
		body: { warehouseId: WAREHOUSE_ID, itemId: ITEM_ID, quantity: 1 },
	},
	{ method: 'POST', path: `/stock/movements/${ADJUSTMENT_ID}/reverse` },
	{
		method: 'POST',
		path: '/stock/balances/recompute',
		body: { scope: 'global' },
	},
	{ method: 'GET', path: '/stock/adjustments' },
	{ method: 'GET', path: `/stock/adjustments/${ADJUSTMENT_ID}` },
	{
		method: 'POST',
		path: '/stock/adjustments',
		body: {
			warehouseId: WAREHOUSE_ID,
			adjustmentType: 'recount',
			lines: [{ itemId: ITEM_ID, quantityAfter: 5 }],
		},
	},
	{
		method: 'PUT',
		path: `/stock/adjustments/${ADJUSTMENT_ID}/lines`,
		body: { lines: [{ itemId: ITEM_ID, quantityAfter: 1 }] },
	},
	{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/submit` },
	{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/approve` },
	{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/reject` },
	{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/cancel` },
	{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/post` },
];

/**
 * The role used for the grants matrix.
 *
 * @remarks
 * `warehouse` is the interesting one: it holds every `stock:*` grant and
 * `stock_adjustment:read|create|submit`, but **not** `stock_adjustment:approve`
 * or `:post`. That single role therefore proves both halves of the wall — the
 * writes it should reach succeed, and the approval it should not reach is 403.
 */
const WAREHOUSE_USER = 'warehouse';

/**
 * A role with only read grants, for the "reads are allowed" half.
 *
 * @remarks
 * `finance` holds `stock:read` and no `stock_adjustment` grant at all, so it can
 * read the ledger and balances but not the adjustment documents.
 */
const READ_ONLY_USER = 'finance';

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();
	installStockDoubles();

	const { StockController } = await import(
		'../../src/app/inventory/controllers/stock.controller'
	);
	const { AdjustmentController } = await import(
		'../../src/app/inventory/controllers/adjustment.controller'
	);
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	app = new Elysia()
		.use(erpGuard())
		.use(StockController.plugin())
		.use(AdjustmentController.plugin());
});

beforeEach(() => {
	resetFixture();
	resetCapture();
});

describe('stock routes — authentication', () => {
	test.each(ROUTES)(
		'$method $path without a session returns 401',
		async ({ method, path, body }) => {
			const response = await app.handle(jsonRequest(method, path, undefined, body));
			expect(response.status).toBe(401);
		},
	);
});

describe('stock routes — grants decide access', () => {
	/** Routes a `warehouse` user holds the grant for. */
	const ALLOWED_FOR_WAREHOUSE = [
		{ method: 'GET', path: '/stock/balances' },
		{ method: 'GET', path: '/stock/movements' },
		{
			method: 'POST',
			path: '/stock/receipts',
			body: { warehouseId: WAREHOUSE_ID, itemId: ITEM_ID, quantity: 5 },
		},
		{
			method: 'POST',
			path: '/stock/issues',
			body: { warehouseId: WAREHOUSE_ID, itemId: ITEM_ID, quantity: 1 },
		},
		{
			method: 'POST',
			path: '/stock/adjustments',
			body: {
				warehouseId: WAREHOUSE_ID,
				adjustmentType: 'recount',
				lines: [{ itemId: ITEM_ID, quantityAfter: 5 }],
			},
		},
		{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/submit` },
	];

	test.each(ALLOWED_FOR_WAREHOUSE)(
		'a warehouse user reaches $method $path',
		async ({ method, path, body }) => {
			const response = await app.handle(
				jsonRequest(method, path, WAREHOUSE_USER, body),
			);
			// Not 403: the permission wall let it through. A 4xx beyond that is a
			// domain refusal (e.g. issuing from an empty balance), which is
			// correct behaviour and not what this test is about.
			expect(response.status).not.toBe(403);
			expect(response.status).not.toBe(401);
		},
	);

	/** Routes needing `stock_adjustment:approve` or `:post`. */
	const DENIED_FOR_WAREHOUSE = [
		{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/approve` },
		{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/reject` },
		{ method: 'POST', path: `/stock/adjustments/${ADJUSTMENT_ID}/post` },
		{ method: 'POST', path: `/stock/movements/${ADJUSTMENT_ID}/reverse` },
		{
			method: 'POST',
			path: '/stock/balances/recompute',
			body: { scope: 'global' },
		},
	];

	test.each(DENIED_FOR_WAREHOUSE)(
		'a warehouse user is refused $method $path (no approve/post grant)',
		async ({ method, path, body }) => {
			const response = await app.handle(
				jsonRequest(method, path, WAREHOUSE_USER, body),
			);
			expect(response.status).toBe(403);
		},
	);

	test('a finance user may read balances but not write stock', async () => {
		const read = await app.handle(
			jsonRequest('GET', '/stock/balances', READ_ONLY_USER),
		);
		expect(read.status).toBe(200);

		const write = await app.handle(
			jsonRequest('POST', '/stock/receipts', READ_ONLY_USER, {
				warehouseId: WAREHOUSE_ID,
				productId: ITEM_ID,
				quantity: 5,
			}),
		);
		expect(write.status).toBe(403);
	});

	test('B-29: the project picker of the manual issue screen needs stock:issue, not project:read', async () => {
		const warehouse = await app.handle(jsonRequest('GET', '/stock/project-options', WAREHOUSE_USER));
		expect(warehouse.status).not.toBe(403);
		const finance = await app.handle(jsonRequest('GET', '/stock/project-options', READ_ONLY_USER));
		expect(finance.status).toBe(403);
	});

	test('a finance user may not read adjustment documents (no grant at all)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/stock/adjustments', READ_ONLY_USER),
		);
		expect(response.status).toBe(403);
	});
});

describe('stock routes — scope is never taken from the request', () => {
	test('a tenant caller asking for another organization still sees its own', async () => {
		const response = await app.handle(
			jsonRequest(
				'GET',
				`/stock/balances?scope=${fixture.orgB}`,
				WAREHOUSE_USER,
			),
		);

		expect(response.status).toBe(200);
		expect(capture.balanceScope).toBe(fixture.orgA);
	});

	test('a tenant caller with no scope filter is pinned to its own organization', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/stock/balances', WAREHOUSE_USER),
		);

		expect(response.status).toBe(200);
		expect(capture.balanceScope).toBe(fixture.orgA);
	});

	test('a tenant caller may ask for the shared (global) scope', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/stock/balances?scope=global', WAREHOUSE_USER),
		);

		// A global warehouse is one shared physical space, so its balances are
		// not tenant data — `null` (shared rows) is allowed for everyone.
		expect(response.status).toBe(200);
		expect(capture.balanceScope).toBeNull();
	});

	test('the ledger read applies the same narrowing', async () => {
		const response = await app.handle(
			jsonRequest('GET', `/stock/movements?scope=${fixture.orgB}`, WAREHOUSE_USER),
		);

		expect(response.status).toBe(200);
		expect(capture.movementScope).toBe(fixture.orgA);
	});

	test('a receipt records the caller organization, and the body cannot set it', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/stock/receipts', WAREHOUSE_USER, {
				warehouseId: WAREHOUSE_ID,
				productId: ITEM_ID,
				quantity: 5,
				// Not part of the schema: stripped by parse, never trusted.
				organizationId: fixture.orgB,
			}),
		);

		expect(response.status).toBe(201);
		expect(capture.movementActorOrganizationId).toBe(fixture.orgA);
	});
});

describe('adjustment routes — self-approval', () => {
	/** Seeds a submitted org-A document requested by `requestedBy`. */
	function seedSubmitted(requestedBy: string): void {
		capture.adjustment = {
			id: ADJUSTMENT_ID,
			organizationId: fixture.orgA,
			code: 'ADJ-1',
			warehouseId: WAREHOUSE_ID,
			adjustmentType: 'recount',
			status: 'submitted',
			reasonCode: null,
			notes: null,
			requestedBy,
			requestedAt: new Date(0),
			approvedBy: null,
			approvedAt: null,
			postedAt: null,
			createdAt: new Date(0),
			updatedAt: null,
			deletedAt: null,
		} satisfies IStockAdjustmentSelectLike;
	}

	test('a requester holding stock_adjustment:approve may approve their own', async () => {
		// `owner` holds every stock_adjustment grant, so the approval step is not
		// a separate person's control for them: the documented bypass.
		seedSubmitted(fixture.users.owner.id);

		const response = await app.handle(
			jsonRequest('POST', `/stock/adjustments/${ADJUSTMENT_ID}/approve`, 'owner'),
		);

		expect(response.status).toBeLessThan(400);
		expect(capture.adjustment?.approvedBy).toBe(fixture.users.owner.id);
	});

	test('a user without the approve grant cannot reach the route at all', async () => {
		// `warehouse` can create and submit but cannot approve — not even
		// someone else's document, so the self-approval rule is never reached.
		seedSubmitted(fixture.users.owner.id);

		const response = await app.handle(
			jsonRequest(
				'POST',
				`/stock/adjustments/${ADJUSTMENT_ID}/approve`,
				WAREHOUSE_USER,
			),
		);

		expect(response.status).toBe(403);
	});

	test('a requester with the grant who is NOT the requester still approves', async () => {
		seedSubmitted('someone-else');

		const response = await app.handle(
			jsonRequest('POST', `/stock/adjustments/${ADJUSTMENT_ID}/approve`, 'owner'),
		);

		expect(response.status).toBeLessThan(400);
		expect(capture.adjustment?.approvedBy).toBe(fixture.users.owner.id);
	});

	test("approving another organization's adjustment is a 404", async () => {
		capture.adjustment = {
			id: ADJUSTMENT_ID,
			organizationId: fixture.orgB,
			code: 'ADJ-2',
			warehouseId: WAREHOUSE_ID,
			adjustmentType: 'recount',
			status: 'submitted',
			reasonCode: null,
			notes: null,
			requestedBy: 'someone-else',
			requestedAt: new Date(0),
			approvedBy: null,
			approvedAt: null,
			postedAt: null,
			createdAt: new Date(0),
			updatedAt: null,
			deletedAt: null,
		} satisfies IStockAdjustmentSelectLike;

		const response = await app.handle(
			jsonRequest('POST', `/stock/adjustments/${ADJUSTMENT_ID}/approve`, 'owner'),
		);

		// Not 403: the caller must not learn that the id exists.
		expect(response.status).toBe(404);
	});
});

/** Re-exported for type-narrowing assertions above. */
export type { TAdjustmentCapture };

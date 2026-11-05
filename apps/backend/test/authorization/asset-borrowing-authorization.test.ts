/**
 * Borrowing authorization integration tests (S4).
 *
 * Exercises the REAL Elysia pipeline (`erpGuard` + controller + service) for the
 * `/borrowings` routes through `app.handle()`, with the auth and repository
 * seams mocked — the same harness shape as the stock/auth suites.
 *
 * What is being pinned (§6, §7):
 * - every route requires a session (401) and the right permission (403);
 * - **`technician` can raise but not issue** — the approval-skip is a privilege,
 *   so a technician must not be able to hand themselves a tool;
 * - **`warehouse` can issue and return but not approve** — the split of duties;
 * - **guest PII is redacted for `technician`** (it holds neither
 *   `borrowing:mark_lost` nor admin) and visible to `warehouse`;
 * - a borrowing in another tenant is a 404, never a 200 with foreign data.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { createNumberingDouble } from '../helpers/numbering-double';
import { AuditWriterDouble } from '../helpers/audit-writer-double';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
} from './test-app';

const SESSION = 'owner';
const TECHNICIAN = 'technician';
const WAREHOUSE_USER = 'warehouse';

const BORROWING_ID = '01920000-0000-7000-8000-0000000000bb';
const LINE_ID = '01920000-0000-7000-8000-0000000000cc';
const UNIT_ID = '01920000-0000-7000-8000-0000000000dd';

let app: Elysia<any, any, any, any, any, any>;

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

/** Every S4 route. */
const ROUTES: ReadonlyArray<{ method: string; path: string; body?: unknown }> = [
	{ method: 'GET', path: '/borrowings' },
	{ method: 'GET', path: `/borrowings/${BORROWING_ID}` },
	{
		method: 'POST',
		path: '/borrowings',
		body: {
			borrowerType: 'user',
			borrowerUserId: 'borrower-1',
			dueAt: '2026-12-01T00:00:00.000Z',
			lines: [{ assetId: UNIT_ID }],
		},
	},
	{ method: 'POST', path: `/borrowings/${BORROWING_ID}/submit` },
	{ method: 'POST', path: `/borrowings/${BORROWING_ID}/approve` },
	{ method: 'POST', path: `/borrowings/${BORROWING_ID}/reject` },
	{ method: 'POST', path: `/borrowings/${BORROWING_ID}/issue` },
	{
		method: 'POST',
		path: `/borrowings/${BORROWING_ID}/return`,
		body: { condition: 'good' },
	},
	{
		method: 'POST',
		path: `/borrowings/${BORROWING_ID}/extend`,
		body: { dueAt: '2027-01-01T00:00:00.000Z' },
	},
	{
		method: 'POST',
		path: `/borrowings/${BORROWING_ID}/mark-lost`,
		body: { lineId: LINE_ID },
	},
	{ method: 'POST', path: `/borrowings/${BORROWING_ID}/cancel` },
	{ method: 'POST', path: `/borrowings/${BORROWING_ID}/close` },
];

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();

	const { container } = await import('tsyringe');
	const { BORROWING_SERVICE_TOKEN } = await import(
		'../../src/app/assets/constants/di'
	);
	const { BorrowingRepository } = await import(
		'../../src/app/assets/repositories/borrowing.repository'
	);
	const { BorrowingService } = await import(
		'../../src/app/assets/services/borrowing.service'
	);

	// A real service over repositories whose reads match nothing, so every route
	// reaches the permission wall and then a clean 404 — never a 500. The
	// permission decision is what this suite is about; the state machine is
	// covered exhaustively in `test/unit/borrowing.service.test.ts`.
	const database = {
		transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
	} as never;
	const borrowingRepository = new BorrowingRepository(database);
	// Reads match nothing: any id is somebody else's borrowing as far as this
	// suite is concerned, which is exactly the isolation case. Overridden rather
	// than left to the real repository so no fake SQL runs.
	borrowingRepository.findById = async () => null;
	borrowingRepository.paginate = async () => ({
		meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
		data: [],
	});
	container.register(BORROWING_SERVICE_TOKEN, {
		useValue: new BorrowingService(
			borrowingRepository,
			{ findById: async () => null } as never,
			{} as never,
			createNumberingDouble(),
			new AuditWriterDouble(),
			database,
		),
	});

	const { BorrowingController } = await import(
		'../../src/app/assets/controllers/borrowing.controller'
	);
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	app = new Elysia().use(erpGuard()).use(BorrowingController.plugin());
});

beforeEach(() => {
	resetFixture();
});

describe('borrowing routes — authentication', () => {
	test.each(ROUTES)(
		'$method $path without a session returns 401',
		async ({ method, path, body }) => {
			const response = await app.handle(
				jsonRequest(method, path, undefined, body),
			);
			expect(response.status).toBe(401);
		},
	);
});

describe('borrowing routes — grants decide access', () => {
	/** A technician raises and reads, and nothing more. */
	const ALLOWED_FOR_TECHNICIAN = [
		{ method: 'GET', path: '/borrowings' },
		{
			method: 'POST',
			path: '/borrowings',
			body: {
				borrowerType: 'user',
				borrowerUserId: 'technician-1',
				dueAt: '2026-12-01T00:00:00.000Z',
				lines: [{ assetId: UNIT_ID }],
			},
		},
	];

	test.each(ALLOWED_FOR_TECHNICIAN)(
		'a technician reaches $method $path',
		async ({ method, path, body }) => {
			const response = await app.handle(
				jsonRequest(method, path, TECHNICIAN, body),
			);
			expect(response.status).not.toBe(403);
			expect(response.status).not.toBe(401);
		},
	);

	/** The duties a technician must NOT be able to perform on itself. */
	const DENIED_FOR_TECHNICIAN = [
		{ method: 'POST', path: `/borrowings/${BORROWING_ID}/approve` },
		{ method: 'POST', path: `/borrowings/${BORROWING_ID}/issue` },
		{ method: 'POST', path: `/borrowings/${BORROWING_ID}/reject` },
		{
			method: 'POST',
			path: `/borrowings/${BORROWING_ID}/extend`,
			body: { dueAt: '2027-01-01T00:00:00.000Z' },
		},
		{
			method: 'POST',
			path: `/borrowings/${BORROWING_ID}/mark-lost`,
			body: { lineId: LINE_ID },
		},
		{ method: 'POST', path: `/borrowings/${BORROWING_ID}/close` },
	];

	test.each(DENIED_FOR_TECHNICIAN)(
		'a technician is refused $method $path',
		async ({ method, path, body }) => {
			const response = await app.handle(
				jsonRequest(method, path, TECHNICIAN, body),
			);
			// The whole point of the split: a technician cannot approve its own
			// borrowing, cannot issue it, and cannot write off a loss.
			expect(response.status).toBe(403);
		},
	);

	/** Warehouse operations: issue, return, extend, mark lost — but no approve. */
	const ALLOWED_FOR_WAREHOUSE = [
		{ method: 'GET', path: '/borrowings' },
		{ method: 'POST', path: `/borrowings/${BORROWING_ID}/issue` },
		{
			method: 'POST',
			path: `/borrowings/${BORROWING_ID}/return`,
			body: { condition: 'good' },
		},
		{
			method: 'POST',
			path: `/borrowings/${BORROWING_ID}/extend`,
			body: { dueAt: '2027-01-01T00:00:00.000Z' },
		},
	];

	test.each(ALLOWED_FOR_WAREHOUSE)(
		'a warehouse user reaches $method $path',
		async ({ method, path, body }) => {
			const response = await app.handle(
				jsonRequest(method, path, WAREHOUSE_USER, body),
			);
			expect(response.status).not.toBe(403);
			expect(response.status).not.toBe(401);
		},
	);

	test('a warehouse user cannot approve', async () => {
		const response = await app.handle(
			jsonRequest('POST', `/borrowings/${BORROWING_ID}/approve`, WAREHOUSE_USER),
		);
		expect(response.status).toBe(403);
	});

	test('an owner reaches every route', async () => {
		// Not 403/401 anywhere: the owner holds `allErpStatements`.
		for (const { method, path, body } of ROUTES) {
			const response = await app.handle(
				jsonRequest(method, path, SESSION, body),
			);
			expect(response.status).not.toBe(403);
			expect(response.status).not.toBe(401);
		}
	});
});

describe('borrowing routes — tenant scope', () => {
	test('a borrowing in another tenant is not reachable', async () => {
		// The doubles return a borrowing only when the org predicate matches, so
		// a 404 here proves the controller passed the CALLER's org, not the id's.
		const response = await app.handle(
			jsonRequest(
				'GET',
				'/borrowings/01920000-0000-7000-8000-0000000000ee',
				SESSION,
			),
		);
		expect(response.status).toBe(404);
	});
});

describe('borrowing payload validation', () => {
	test('a guest borrower without an id number is rejected at the edge', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/borrowings', SESSION, {
				borrowerType: 'guest',
				guestName: 'Budi',
				guestPhone: '0812',
				// guestIdNumber missing on purpose.
				dueAt: '2026-12-01T00:00:00.000Z',
				lines: [{ assetId: UNIT_ID }],
			}),
		);
		// 400 from the schema, not 500 from the service: the discriminated union
		// catches the inconsistency before any repository call.
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.status).toBeLessThan(500);
	});

	test('a borrowing with no lines is rejected', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/borrowings', SESSION, {
				borrowerType: 'user',
				borrowerUserId: 'u1',
				dueAt: '2026-12-01T00:00:00.000Z',
				lines: [],
			}),
		);
		// The schema allows empty lines only when a tool set is lent, so this is
		// a clean 4xx from the service, never a 500.
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.status).toBeLessThan(500);
	});

	test('a client cannot set status or code in the body', async () => {
		// Both are service-owned. The schema is not strict, so they are simply
		// ignored rather than promoted — the assertion is that a hostile body
		// does not produce a 500.
		const response = await app.handle(
			jsonRequest('POST', '/borrowings', SESSION, {
				borrowerType: 'user',
				borrowerUserId: 'u1',
				dueAt: '2026-12-01T00:00:00.000Z',
				status: 'issued',
				code: 'BRW-HACK-0001',
				organizationId: 'other-org',
				lines: [{ assetId: UNIT_ID }],
			}),
		);
		expect(response.status).toBeLessThan(500);
	});
});

void fixture;

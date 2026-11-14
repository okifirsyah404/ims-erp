/**
 * Web-admin login gate wiring (ADR-0017 §8, amended by ADR-0018).
 *
 * `sessionGuard` re-checks the gate on every request, so sessions created before
 * the gate existed cannot keep working. These tests drive the real guard over
 * the real Elysia pipeline; only the gate itself is a stubbed seam, because the
 * harness has no database.
 *
 * The gate's own rule (`isWebAdminAllowed`) is unit-tested in
 * `test/unit/login-gate.test.ts`.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { fixture, installAuthMock, resetFixture, setLoginGateAllowed } from './test-app';

let app: Elysia<any, any, any, any, any, any>;

const request = (session?: string): Request => {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (session) headers.set('x-test-session', session);
	return new Request('http://localhost/probe', { method: 'GET', headers });
};

beforeAll(async () => {
	installAuthMock();
	const { sessionGuard } = await import('../../src/authorization/elysia-auth');
	app = new Elysia()
		.use(sessionGuard())
		.get('/probe', ({ erp }) => ({ userId: erp.session.user.id }), {
			erpSession: { session: true },
		});
});

beforeEach(() => {
	resetFixture();
});

describe('sessionGuard — login gate', () => {
	test('an open gate lets an authenticated session through', async () => {
		const response = await app.handle(request('globalAdmin'));
		expect(response.status).toBe(200);
	});

	test('a closed gate answers 403, not 401 — the caller is authenticated', async () => {
		setLoginGateAllowed(false);
		const response = await app.handle(request('globalAdmin'));
		expect(response.status).toBe(403);
	});

	test('a closed gate still answers 401 when there is no session at all', async () => {
		setLoginGateAllowed(false);
		const response = await app.handle(request());
		expect(response.status).toBe(401);
	});

	test('closing the gate affects every fixture user, application admin included', async () => {
		setLoginGateAllowed(false);
		for (const key of Object.keys(fixture.users)) {
			const response = await app.handle(request(key));
			expect({ key, status: response.status }).toEqual({ key, status: 403 });
		}
	});
});

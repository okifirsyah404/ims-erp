/**
 * Code-numbering route authorization (`{prefix}/code-numberings`).
 *
 * Exercises the REAL Elysia pipeline (`adminOrErpGuard` + the shared
 * `codeNumberingController`) with the auth seam and the numbering services
 * mocked:
 * - no session is 401; a closed web-admin login gate is 403;
 * - an organization member needs `code_number:read` to list/preview and
 *   `code_number:update` to save (org `admin` holds both, `sales` neither);
 * - an application admin passes with or without an organization context;
 * - an `appAdminOnly` series (warehouse) refuses even the organization owner.
 */
import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
	setLoginGateAllowed,
} from './test-app';

type TCall = { method: string; args: unknown[] };

function fakeService(calls: TCall[]) {
	const record =
		(method: string, result: unknown) =>
		async (...args: unknown[]) => {
			calls.push({ method, args });
			return result;
		};
	return {
		listSettings: record('listSettings', []),
		previewSetting: record('previewSetting', { nextNumber: 'QT-001', sampleContext: {}, maxLength: null }),
		updateSetting: record('updateSetting', { codeType: 'quotation' }),
	};
}

let app: Elysia<any, any, any, any, any, any>;
const calls: TCall[] = [];

const request = (method: string, path: string, session?: string, body?: unknown): Request => {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (session) headers.set('x-test-session', session);
	return new Request(`http://localhost${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
};

const SETTING = { pattern: '{TYPE}-{SEQ:3}', resetPolicy: 'yearly' };

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();
	// Import after mocks are installed (bun mock.module is hoist-sensitive).
	const { codeNumberingController } = await import('../../src/shared/numbering/controller');
	app = new Elysia()
		.use(
			codeNumberingController({
				name: 'test-sale-code-numbering',
				prefix: '/sales',
				tag: 'Sales',
				service: fakeService(calls) as never,
			}),
		)
		.use(
			codeNumberingController({
				name: 'test-warehouse-code-numbering',
				prefix: '/warehouses',
				tag: 'Warehouse',
				service: fakeService(calls) as never,
				appAdminOnly: true,
			}),
		);
});

beforeEach(() => {
	resetFixture();
	calls.length = 0;
});

describe('code numbering: organization members', () => {
	test('no session is 401', async () => {
		const res = await app.handle(request('GET', '/sales/code-numberings'));
		expect(res.status).toBe(401);
	});

	test('a role without code_number is 403 on every route', async () => {
		for (const [method, path, body] of [
			['GET', '/sales/code-numberings', undefined],
			['POST', '/sales/code-numberings/quotation/preview', SETTING],
			['PUT', '/sales/code-numberings/quotation', SETTING],
		] as const) {
			const res = await app.handle(request(method, path, 'sales', body));
			expect(res.status).toBe(403);
		}
		expect(calls).toHaveLength(0);
	});

	test('org admin lists, previews and saves with its organization', async () => {
		const list = await app.handle(request('GET', '/sales/code-numberings', 'admin'));
		expect(list.status).toBe(200);
		const preview = await app.handle(
			request('POST', '/sales/code-numberings/quotation/preview', 'admin', SETTING),
		);
		expect(preview.status).toBe(200);
		// P7-5: the preview also says which sample values it used and the limit.
		expect((await preview.json()).data).toMatchObject({ nextNumber: 'QT-001' });
		const save = await app.handle(request('PUT', '/sales/code-numberings/quotation', 'admin', SETTING));
		expect(save.status).toBe(200);
		expect(calls.map((call) => call.method)).toEqual(['listSettings', 'previewSetting', 'updateSetting']);
		expect(calls[0].args).toEqual(['org-a']);
		expect(calls[2].args).toEqual(['quotation', SETTING, 'user-org-admin', 'org-a']);
	});

	test('an invalid body is 400 before the service runs', async () => {
		const res = await app.handle(
			request('PUT', '/sales/code-numberings/quotation', 'admin', { pattern: '', resetPolicy: 'daily' }),
		);
		expect(res.status).toBe(400);
		expect(calls).toHaveLength(0);
	});

	test('a closed web-admin login gate is 403', async () => {
		setLoginGateAllowed(false);
		const res = await app.handle(request('GET', '/sales/code-numberings', 'admin'));
		expect(res.status).toBe(403);
	});
});

describe('code numbering: application admins', () => {
	test('an app admin without an organization passes, organization null', async () => {
		const res = await app.handle(request('PUT', '/sales/code-numberings/quotation', 'globalAdmin', SETTING));
		expect(res.status).toBe(200);
		expect(calls[0].args).toEqual(['quotation', SETTING, 'user-global-admin', null]);
	});

	test('the warehouse series refuses the organization owner', async () => {
		const res = await app.handle(request('GET', '/warehouses/code-numberings', 'owner'));
		expect(res.status).toBe(403);
		expect(calls).toHaveLength(0);
	});

	test('the warehouse series accepts an app admin', async () => {
		const res = await app.handle(request('GET', '/warehouses/code-numberings', 'globalAdmin'));
		expect(res.status).toBe(200);
	});
});

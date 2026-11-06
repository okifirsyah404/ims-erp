/**
 * Tax route authorization integration tests (ERP-0016).
 *
 * Exercises the REAL Elysia pipeline (erpGuard + TaxController) with the auth
 * seam and the TaxService mocked, in the same shape as the other suites:
 * - every route requires a session (401) and the right permission (403);
 * - `finance` (read + export only) can view and export but cannot edit,
 *   verify, or delete;
 * - `sales` (no tax grants) is 403 on everything;
 * - `accountant` (full tax:*) passes the guard for all of them.
 */
import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
	setRoleGrants,
} from './test-app';

const ACCOUNTANT = 'warehouse'; // fixture user; its role grants are overridden below to full tax:*
const FINANCE = 'finance';
const SALES = 'sales';

const TAX_TYPE_ID = '01920000-0000-7000-8000-0000000000aa';
const TAX_RECORD_ID = '01920000-0000-7000-8000-0000000000ab';
const WITHHOLDING_ID = '01920000-0000-7000-8000-0000000000ac';

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

/** Every `/tax` route with a representative body where one is required. */
const ROUTES: ReadonlyArray<{
	method: string;
	path: string;
	body?: unknown;
}> = [
	{ method: 'GET', path: '/tax/types' },
	{ method: 'GET', path: `/tax/types/${TAX_TYPE_ID}` },
	{
		method: 'POST',
		path: '/tax/types',
		body: {
			code: 'PPN',
			name: 'PPN',
			taxType: 'vat',
			rate: '11',
			effectiveFrom: '2026-01-01',
		},
	},
	{ method: 'PATCH', path: `/tax/types/${TAX_TYPE_ID}`, body: { name: 'PPN' } },
	{ method: 'DELETE', path: `/tax/types/${TAX_TYPE_ID}` },
	{ method: 'GET', path: '/tax/recap', body: undefined },
	{ method: 'GET', path: '/tax/export.csv' },
	{ method: 'GET', path: '/tax/export.xlsx' },
	{ method: 'GET', path: '/tax/records' },
	{ method: 'GET', path: `/tax/records/${TAX_RECORD_ID}` },
	{
		method: 'POST',
		path: '/tax/records',
		body: { taxTypeId: TAX_TYPE_ID, periodYear: 2026, periodMonth: 1, taxableBase: 1 },
	},
	{
		method: 'POST',
		path: '/tax/records/preview',
		body: { taxTypeId: TAX_TYPE_ID, taxableBase: 1, date: '2026-01-01' },
	},
	{
		method: 'PATCH',
		path: `/tax/records/${TAX_RECORD_ID}`,
		body: { taxableBase: 1 },
	},
	{
		method: 'POST',
		path: `/tax/records/${TAX_RECORD_ID}/transition`,
		body: { to: 'verified' },
	},
	{
		method: 'POST',
		path: `/tax/records/${TAX_RECORD_ID}/corrections`,
		body: { amount: 0, reason: 'x' },
	},
	{ method: 'GET', path: `/tax/records/${TAX_RECORD_ID}/corrections` },
	{ method: 'GET', path: '/tax/withholding' },
	{
		method: 'POST',
		path: '/tax/withholding',
		body: { code: 'WHT-1', taxTypeId: TAX_TYPE_ID, baseAmount: 1, taxAmount: 0 },
	},
	{
		method: 'PATCH',
		path: `/tax/withholding/${WITHHOLDING_ID}`,
		body: { taxAmount: 0 },
	},
	{
		method: 'POST',
		path: `/tax/withholding/${WITHHOLDING_ID}/transition`,
		body: { to: 'verified' },
	},
];

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();
	// A role holding the full `tax` grant set, mirroring the catalog's
	// `accountant` role (no accountant fixture user exists, so the warehouse
	// user's role grants are overridden instead).
	setRoleGrants('warehouse', {
		tax: ['read', 'create', 'update', 'verify', 'export'],
	});

	const { container } = await import('tsyringe');
	const { TAX_SERVICE_TOKEN } = await import(
		'../../src/app/accounting/constants/di'
	);

	const noop = async () => ({});
	const serviceStub = {
		listTaxTypes: mock(async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })),
		getTaxType: noop,
		createTaxType: noop,
		updateTaxType: noop,
		removeTaxType: noop,
		recap: mock(async () => ({ lines: [], totalNetPayable: 0 })),
		listTaxRecords: mock(async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })),
		getTaxRecord: noop,
		createTaxRecord: noop,
		updateDraftTaxRecord: noop,
		transitionTaxRecord: noop,
		addCorrection: noop,
		listCorrections: mock(async () => []),
		previewTax: noop,
		listWithholding: mock(async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })),
		getWithholding: noop,
		createWithholding: noop,
		updateWithholding: noop,
		transitionWithholding: noop,
	};
	container.register(TAX_SERVICE_TOKEN, {
		useValue: serviceStub as never,
	});

	const { TaxController } = await import(
		'../../src/app/accounting/controllers/tax.controller'
	);
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	app = new Elysia().use(erpGuard()).use(TaxController.plugin());
});

beforeEach(() => {
	resetFixture();
});

describe('tax routes — authentication', () => {
	test.each(ROUTES)(
		'$method $path without a session returns 401',
		async ({ method, path, body }) => {
			const response = await app.handle(jsonRequest(method, path, undefined, body));
			expect(response.status).toBe(401);
		},
	);
});

describe('tax routes — finance can read and export only', () => {
	test.each(ROUTES)(
		'$method $path as finance returns 200/2xx or a validation 4xx — never 403 for read/export routes',
		async ({ method, path, body }) => {
			const response = await app.handle(jsonRequest(method, path, FINANCE, body));
			expect(response.status).not.toBe(401);
			if (method === 'GET' || path === '/tax/records/preview') {
				// read + export are granted to finance; preview persists nothing
				// and is deliberately guarded by tax:read.
				expect(response.status).not.toBe(403);
			} else {
				// write routes must be denied
				expect(response.status).toBe(403);
			}
		},
	);
});

describe('tax routes — sales has no tax grants at all', () => {
	test.each(ROUTES)(
		'$method $path as sales returns 403',
		async ({ method, path, body }) => {
			const response = await app.handle(jsonRequest(method, path, SALES, body));
			expect(response.status).toBe(403);
		},
	);
});

describe('tax routes — full tax:* passes the guard', () => {
	beforeEach(() => {
		// resetFixture() cleared role grants; restore the full-grant role.
		setRoleGrants('warehouse', {
			tax: ['read', 'create', 'update', 'verify', 'export'],
		});
	});
	test.each(ROUTES)(
		'$method $path as accountant reaches the service (no 401/403)',
		async ({ method, path, body }) => {
			const response = await app.handle(jsonRequest(method, path, ACCOUNTANT, body));
			expect([401, 403]).not.toContain(response.status);
		},
	);
});

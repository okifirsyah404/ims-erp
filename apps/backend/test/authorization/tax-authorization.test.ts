/**
 * Tax route authorization integration tests (ERP-0016).
 *
 * Exercises the REAL Elysia pipeline (erpGuard + TaxController) with the auth
 * seam and the TaxService mocked, in the same shape as the other suites:
 * - every route requires a session (401) and the right permission (403);
 * - `finance` (read + export only) can view and export but cannot edit,
 *   verify, or delete;
 * - `sales` (no tax grants) is 403 on everything;
 * - `accountant`/owner (full tax:*) passes the guard for all of them.
 */
import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
	fixture,
	installAuthMock,
	installPermissionResolverMock,
	resetFixture,
} from './test-app';

void fixture;

const ACCOUNTANT = 'owner'; // fixture user with full grants (owner); proves the full tax:* grant set passes the guard
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
	{ method: 'GET', path: '/taxes' },
	{ method: 'GET', path: `/taxes/${TAX_TYPE_ID}` },
	{
		method: 'POST',
		path: '/taxes',
		body: {
			code: 'PPN',
			name: 'PPN',
			taxType: 'vat',
			rate: '11',
			effectiveFrom: '2026-01-01',
		},
	},
	{ method: 'PATCH', path: `/taxes/${TAX_TYPE_ID}`, body: { name: 'PPN' } },
	{ method: 'DELETE', path: `/taxes/${TAX_TYPE_ID}` },
	{ method: 'GET', path: '/taxes/recap', body: undefined },
	{ method: 'GET', path: '/taxes/export.csv' },
	{ method: 'GET', path: '/taxes/export.xlsx' },
	{ method: 'GET', path: '/taxes/records' },
	{ method: 'GET', path: `/taxes/records/${TAX_RECORD_ID}` },
	{
		method: 'POST',
		path: '/taxes/records',
		body: { taxTypeId: TAX_TYPE_ID, periodYear: 2026, periodMonth: 1, taxableBase: 1 },
	},
	{
		method: 'POST',
		path: '/taxes/records/preview',
		body: { taxTypeId: TAX_TYPE_ID, taxableBase: 1, date: '2026-01-01' },
	},
	{
		method: 'PATCH',
		path: `/taxes/records/${TAX_RECORD_ID}`,
		body: { taxableBase: 1 },
	},
	{
		method: 'POST',
		path: `/taxes/records/${TAX_RECORD_ID}/transition`,
		body: { to: 'verified' },
	},
	{
		method: 'POST',
		path: `/taxes/records/${TAX_RECORD_ID}/corrections`,
		body: { amount: 0, reason: 'x' },
	},
	{ method: 'GET', path: `/taxes/records/${TAX_RECORD_ID}/corrections` },
	{ method: 'GET', path: '/taxes/withholding' },
	{
		method: 'POST',
		path: '/taxes/withholdings',
		body: { code: 'WHT-1', taxTypeId: TAX_TYPE_ID, baseAmount: 1, taxAmount: 0 },
	},
	{
		method: 'PATCH',
		path: `/taxes/withholdings/${WITHHOLDING_ID}`,
		body: { taxAmount: 0 },
	},
	{
		method: 'POST',
		path: `/taxes/withholdings/${WITHHOLDING_ID}/transition`,
		body: { to: 'verified' },
	},
	{ method: 'GET', path: '/taxes/coretax/faktur.xml?year=2026&month=11' },
	{ method: 'GET', path: '/taxes/coretax/bupot.xml?year=2026&month=11' },
	{
		method: 'PATCH',
		path: `/taxes/withholdings/${WITHHOLDING_ID}/coretax`,
		body: { coretaxStatus: 'uploaded' },
	},
];

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();

	const { container } = await import('tsyringe');
	const { CORETAX_EXPORT_SERVICE_TOKEN, TAX_SERVICE_TOKEN } = await import(
		'../../src/app/tax/constants/di'
	);
	container.register(CORETAX_EXPORT_SERVICE_TOKEN, {
		useValue: {
			fakturXml: async () => ({ xml: '<TaxInvoiceBulk/>', count: 0 }),
			bupotXml: async () => ({ xml: '<BpuBulk/>', count: 0 }),
			updateCoretax: async () => ({}),
		} as never,
	});

	const noop = async () => ({});
	const serviceStub = {
		listTaxTypes: mock(async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })),
		getTaxType: noop,
		createTaxType: noop,
		updateTaxType: noop,
		removeTaxType: noop,
		recap: mock(async () => ({ lines: [], totalNetPayable: 0 })),
		listTaxRecords: mock(async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })),		getTaxRecord: noop,
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
		'../../src/app/tax/controllers/tax.controller'
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
			if (method === 'GET' || path === '/taxes/records/preview') {
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
	test.each(ROUTES)(
		'$method $path as owner reaches the service (no 401/403)',
		async ({ method, path, body }) => {
			const response = await app.handle(jsonRequest(method, path, ACCOUNTANT, body));
			expect([401, 403]).not.toContain(response.status);
		},
	);
});

/**
 * Guard wiring for the dashboard aggregates (ERP-0055; ERP-0111 cash summary).
 *
 * Exercises the REAL Elysia pipeline (`erpGuard` + controller) over stubbed
 * services, so the permission strings on `GET /invoices/summary` and
 * `GET /projects/stats` are pinned: a caller without the source module's
 * permission is refused server-side, not merely hidden in the UI (M01).
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { fixture, installAuthMock, installPermissionResolverMock, resetFixture } from './test-app';

const ORG = fixture.orgA;

let app: Elysia<any, any, any, any, any, any>;

const jsonRequest = (path: string, session?: string, org = ORG): Request => {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (session) headers.set('x-test-session', session);
	headers.set('x-organization-id', org);
	return new Request(`http://localhost${path}`, { method: 'GET', headers });
};

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();
	// Import after the module mocks are installed (bun mock.module is hoist-sensitive).
	const { INVOICE_SERVICE_TOKEN, INVOICE_BILLING_SERVICE_TOKEN } = await import(
		'../../src/app/sale/constants/ar-di'
	);
	const { InvoiceController } = await import('../../src/app/sale/controllers/invoice.controller');
	const { PROJECT_SERVICE_TOKEN, HANDOVER_SERVICE_TOKEN } = await import(
		'../../src/app/project/constants/di'
	);
	const { ProjectController } = await import('../../src/app/project/controllers/project.controller');
	const finance = await import('../../src/app/finance/constants/di');
	const { LedgerController } = await import('../../src/app/finance/controllers/ledger.controller');
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	// The ledger controller resolves five services at plugin build time; only
	// the cash/bank summary is exercised, so the rest are empty stubs.
	container.register(finance.ACCOUNT_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.PERIOD_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.POSTING_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.OPENING_BALANCE_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.CASH_BANK_SERVICE_TOKEN, {
		useValue: {
			summary: async (organizationId: string, range: { groupBy: string }) => ({
				from: '2026-11-01',
				to: '2026-11-23',
				groupBy: range.groupBy,
				totalIn: 0,
				totalOut: 0,
				net: 0,
				buckets: [],
				organizationId,
			}),
		} as never,
	});

	container.register(INVOICE_SERVICE_TOKEN, {
		useValue: {
			summary: async (organizationId: string) => ({
				from: '2026-06-01',
				to: '2026-11-30',
				groupBy: 'month',
				totalInvoiced: 0,
				invoiceCount: 0,
				buckets: [],
				organizationId,
			}),
		} as never,
	});
	// The merged controller also resolves the billing service at plugin build
	// time (for /invoices/orders/:orderId/summary); this suite only exercises
	// the summary guard, so an empty stub is enough.
	container.register(INVOICE_BILLING_SERVICE_TOKEN, { useValue: {} as never });
	container.register(PROJECT_SERVICE_TOKEN, {
		useValue: {
			stats: async () => ({
				active: 0,
				closed: 0,
				cancelled: 0,
				overdue: 0,
				byStage: [],
			}),
		} as never,
	});
	container.register(HANDOVER_SERVICE_TOKEN, { useValue: {} as never });

	app = new Elysia()
		.use(erpGuard())
		.use(InvoiceController.plugin())
		.use(ProjectController.plugin())
		.use(LedgerController.plugin());
});

beforeEach(() => resetFixture());

describe('dashboard aggregates authorization', () => {
	test('invoices summary: 401 without a session', async () => {
		const response = await app.handle(jsonRequest('/sales/invoices/summary?from=2026-06-01&to=2026-11-30'));
		expect(response.status).toBe(401);
	});

	test('invoices summary: 403 for a role without invoice:read', async () => {
		// `technician` holds project:read but no invoice permission.
		const response = await app.handle(
			jsonRequest('/sales/invoices/summary?from=2026-06-01&to=2026-11-30', 'technician'),
		);
		expect(response.status).toBe(403);
	});

	test('invoices summary: 200 for finance and the organization id comes from the guard', async () => {
		const response = await app.handle(
			jsonRequest('/sales/invoices/summary?from=2026-06-01&to=2026-11-30', 'finance'),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { data: { organizationId: string } };
		expect(body.data.organizationId).toBe(ORG);
	});

	test('invoices summary: an inverted window is rejected', async () => {
		const response = await app.handle(
			jsonRequest('/sales/invoices/summary?from=2026-11-30&to=2026-06-01', 'finance'),
		);
		expect(response.status).toBe(400);
	});

	test('projects stats: 403 for a role without project:read', async () => {
		// `member` holds neither project:read nor any project grant.
		const response = await app.handle(jsonRequest('/projects/stats', 'member'));
		expect(response.status).toBe(403);
	});

	test('projects stats: 200 for a technician (project:read, narrow visibility)', async () => {
		const response = await app.handle(jsonRequest('/projects/stats', 'technician'));
		expect(response.status).toBe(200);
	});

	const cashSummary = '/finance/cash-bank-transactions/summary?from=2026-11-01&to=2026-11-23';

	test('cash summary: 401 without a session', async () => {
		const response = await app.handle(jsonRequest(cashSummary));
		expect(response.status).toBe(401);
	});

	test('cash summary: 403 for roles without cash_bank:read', async () => {
		for (const role of ['sales', 'technician', 'warehouse', 'member']) {
			const response = await app.handle(jsonRequest(cashSummary, role));
			expect(response.status).toBe(403);
		}
	});

	test('cash summary: 200 for finance and owner, scoped to the guard organization', async () => {
		for (const role of ['finance', 'owner']) {
			const response = await app.handle(jsonRequest(`${cashSummary}&groupBy=day`, role));
			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				data: { organizationId: string; groupBy: string };
			};
			expect(body.data.organizationId).toBe(ORG);
			expect(body.data.groupBy).toBe('day');
		}
	});

	test('cash summary: a global admin without membership is refused', async () => {
		const response = await app.handle(jsonRequest(cashSummary, 'globalAdmin'));
		expect(response.status).toBe(403);
	});

	test('cash summary: an inverted window is rejected', async () => {
		const response = await app.handle(
			jsonRequest('/finance/cash-bank-transactions/summary?from=2026-11-23&to=2026-11-01', 'finance'),
		);
		expect(response.status).toBe(400);
	});
});

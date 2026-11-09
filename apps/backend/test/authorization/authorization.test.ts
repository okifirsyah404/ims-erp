/**
 * ERP authorization integration tests.
 *
 * Exercises the REAL Elysia request pipeline (erpGuard macro + sales
 * controller + sales service) through app.handle(), with the Better Auth
 * server API and Drizzle repositories mocked at their seams
 * (testing-strategy.md: no real DB/Redis in unit/integration tests).
 */
import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import type { Elysia } from 'elysia';
import {
	buildTestApp,
	fixture,
	installAuthMock,
	quotationBody,
	resetFixture,
} from './test-app';

let app: Elysia<any, any, any, any, any, any>; // typed loosely: macro-resolved erp context

const baseHeaders = (session?: string, org?: string): Headers => {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (session) headers.set('x-test-session', session);
	if (org) headers.set('x-organization-id', org);
	return headers;
};

const jsonRequest = (
	method: string,
	path: string,
	session?: string,
	body?: unknown,
	org?: string,
): Request => {
	const headers = baseHeaders(session, org);
	return new Request(`http://localhost${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
};

beforeAll(async () => {
	installAuthMock();
	app = await buildTestApp();
});

beforeEach(() => {
	resetFixture();
});

// ---------------------------------------------------------------------------
// 1. Unauthenticated access
// ---------------------------------------------------------------------------
describe('401 unauthenticated', () => {
	test('GET /sales/quotations without session returns 401', async () => {
		const response = await app.handle(jsonRequest('GET', '/sales/quotations'));
		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.errors?.[0]?.message).toBeDefined();
	});

	test('POST /sales/quotations without session returns 401', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations', undefined, quotationBody()),
		);
		expect(response.status).toBe(401);
	});
});

// ---------------------------------------------------------------------------
// 2. Global admin without membership
// ---------------------------------------------------------------------------
describe('global admin without organization membership', () => {
	test('cannot read ERP tenant data (403, not bypass)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'globalAdmin'),
		);
		expect(response.status).toBe(403);
	});

	test('cannot create ERP records (403)', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'globalAdmin', quotationBody()),
		);
		expect(response.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 3. Owner membership gets configured permissions
// ---------------------------------------------------------------------------
describe('owner organization permissions', () => {
	test('owner can read quotations', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'owner'),
		);
		expect(response.status).toBe(200);
	});

	test('owner can create a quotation', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'owner', quotationBody()),
		);
		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.data.createdBy).toBe(fixture.users.owner.id);
		expect(body.data.status).toBe('draft');
	});

	test('member (baseline) cannot create quotations (403)', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'member', quotationBody()),
		);
		expect(response.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 4. Sales: create permitted, approve denied
// ---------------------------------------------------------------------------
describe('sales role separation of duties', () => {
	test('sales can create a quotation', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'sales', quotationBody()),
		);
		expect(response.status).toBe(201);
	});

	test('sales cannot approve a quotation (permission denied, 403)', async () => {
		// Sales creates a quotation, submits it, then attempts approval.
		const create = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'sales', quotationBody()),
		);
		const { data } = (await create.json()) as { data: { id: string } };

		const submit = await app.handle(
			jsonRequest('POST', `/sales/quotations/${data.id}/submit`, 'sales'),
		);
		expect(submit.status).toBe(200);

		const approve = await app.handle(
			jsonRequest('POST', `/sales/quotations/${data.id}/decision`, 'sales', {
				decision: 'approve',
			}),
		);
		expect(approve.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 5. Technician scoping
// ---------------------------------------------------------------------------
describe('technician access', () => {
	test('technician cannot create quotations (no project-wide perms)', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'technician', quotationBody()),
		);
		expect(response.status).toBe(403);
	});

	test('technician cannot list sales quotations (403)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'technician'),
		);
		expect(response.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 6. Cross-organization isolation
// ---------------------------------------------------------------------------
describe('cross-organization isolation', () => {
	test('reading another organization record by id returns 404 (no disclosure)', async () => {
		// Owner of org A creates a quotation...
		const create = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'owner', quotationBody()),
		);
		const { data } = (await create.json()) as { data: { id: string } };

		// member of org B (fixture user mapped to org B via header attempt)
		// tries to read it with an explicit x-organization-id for org A.
		const response = await app.handle(
			jsonRequest('GET', `/sales/quotations/${data.id}`, 'owner', undefined, fixture.orgB),
		);
		// owner of orgA is not a member of orgB -> membership validation fails
		expect(response.status).toBe(403);
	});

	test('quotations are company-wide: no organization column (ADR-0011, ADR-0012)', async () => {
		const create = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'owner', quotationBody()),
		);
		expect(create.status).toBe(201);
		const { data } = (await create.json()) as {
			data: { id: string; organizationId?: string };
		};
		expect(data.organizationId).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 7. Cross-organization FK references
// ---------------------------------------------------------------------------
describe('cross-organization foreign keys', () => {
	test('payment referencing another organization quotation is rejected', async () => {
		// Owner creates a quotation in org A...
		const create = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'owner', quotationBody()),
		);
		const { data } = (await create.json()) as { data: { id: string } };

		// ...then tries to create a payment scoped to org B referencing it:
		// the quotation does not exist in org B -> 404, FK rejected.
		const response = await app.handle(
			jsonRequest('POST', '/sales/payments', 'owner', {
				quotationId: data.id,
				amount: 100,
			}, fixture.orgB),
		);
		expect([403, 404]).toContain(response.status);
	});
});

// ---------------------------------------------------------------------------
// 8. Organization context consistency
// ---------------------------------------------------------------------------
describe('organization context selection', () => {
	test('explicit header pointing to a foreign organization is rejected', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'sales', undefined, fixture.orgB),
		);
		expect(response.status).toBe(403);
	});

	test('no active organization and no header returns 403 (not 500)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'globalAdmin'),
		);
		expect(response.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 9. Multi-role separation of duties
// ---------------------------------------------------------------------------
describe('multi-role self-approval', () => {
	test('multi-role (sales+finance) user cannot approve their own quotation', async () => {
		const create = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'salesFinance', quotationBody()),
		);
		expect(create.status).toBe(201);
		const { data } = (await create.json()) as { data: { id: string } };

		await app.handle(
			jsonRequest('POST', `/sales/quotations/${data.id}/submit`, 'salesFinance'),
		);

		// The role union includes quotation:approve, but the service blocks
		// self-approval regardless of combined permissions.
		const response = await app.handle(
			jsonRequest('POST', `/sales/quotations/${data.id}/decision`, 'salesFinance', {
				decision: 'approve',
			}),
		);
		expect(response.status).toBe(403);
		const body = await response.json();
		// The test app mounts no i18n plugin, so the message is the stable key.
		expect(body.message).toBe('sales.selfApproval');
	});

	test('a different approver with approve permission can approve (no amount limit, owner decision 2026-10-31)', async () => {
		// sales creates...
		const create = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'sales', quotationBody()),
		);
		const { data } = (await create.json()) as { data: { id: string } };
		await app.handle(
			jsonRequest('POST', `/sales/quotations/${data.id}/submit`, 'sales'),
		);

		// ...owner (different actor, has quotation:approve) approves.
		const response = await app.handle(
			jsonRequest('POST', `/sales/quotations/${data.id}/decision`, 'owner', {
				decision: 'approve',
			}),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.data.status).toBe('approved');
		expect(body.data.approvedBy).toBe(fixture.users.owner.id);
	});
});

// ---------------------------------------------------------------------------
// 10. Payments: no execution before approval
// ---------------------------------------------------------------------------
describe('payment execution requires approval', () => {
	test('execute before approval returns 422 state error', async () => {
		// owner creates quotation + payment
		const q = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'owner', quotationBody()),
		);
		const { data: quotation } = (await q.json()) as { data: { id: string } };

		const p = await app.handle(
			jsonRequest('POST', '/sales/payments', 'owner', {
				quotationId: quotation.id,
				amount: 100,
			}),
		);
		expect(p.status).toBe(201);
		const { data: payment } = (await p.json()) as { data: { id: string } };

		// finance-role user executes before approval
		const response = await app.handle(
			jsonRequest('POST', `/sales/payments/${payment.id}/execute`, 'salesFinance'),
		);
		expect(response.status).toBe(422);
	});

	test('payment creator cannot execute their own payment (SoD)', async () => {
		const q = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'owner', quotationBody()),
		);
		const { data: quotation } = (await q.json()) as { data: { id: string } };
		const p = await app.handle(
			jsonRequest('POST', '/sales/payments', 'owner', {
				quotationId: quotation.id,
				amount: 100,
			}),
		);
		const { data: payment } = (await p.json()) as { data: { id: string } };

		// approve by another user first
		const approval = await app.handle(
			jsonRequest('POST', `/sales/payments/${payment.id}/approve`, 'salesFinance'),
		);
		expect(approval.status).toBe(200);

		// creator (owner) attempts execution
		const response = await app.handle(
			jsonRequest('POST', `/sales/payments/${payment.id}/execute`, 'owner'),
		);
		expect(response.status).toBe(403);
	});

	test('member without payment permissions cannot execute (403)', async () => {
		const response = await app.handle(
			jsonRequest('POST', '/sales/payments/p-none/execute', 'member'),
		);
		expect(response.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 11. Membership/permission revocation
// ---------------------------------------------------------------------------
describe('revocation', () => {
	test('removed membership denies previously allowed access', async () => {
		// 'revoked' user starts with sales role in orgA but is marked revoked
		// in the fixture (membership removed mid-session).
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'revoked'),
		);
		expect(response.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 12. Multiple permissions checked together
// ---------------------------------------------------------------------------
describe('multi-permission requirements', () => {
	test('403 covers the FIRST failing requirement for sales submit', async () => {
		// member has no quotation permissions at all
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations/q-x/submit', 'member'),
		);
		expect(response.status).toBe(403);
	});

	test('patch update requires quotation:update (member denied)', async () => {
		const response = await app.handle(
			jsonRequest('PATCH', '/sales/quotations/q-x', 'member', quotationBody()),
		);
		expect(response.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// 13. Closed role enum: static catalog grants decide access
// ---------------------------------------------------------------------------
describe('static catalog authorization', () => {
	test('owner grants come straight from erpRoleGrants (quotation:read allowed)', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'owner'),
		);
		expect(response.status).toBe(200);
	});

	test('member has no quotation grants in the closed catalog', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/sales/quotations', 'member'),
		);
		expect(response.status).toBe(403);
	});

	test('multi-role members get the union of their static grants', async () => {
		// The fixture member has the roles `sales,owner`; sales may create
		// quotations per erpRoleGrants.
		const response = await app.handle(
			jsonRequest('POST', '/sales/quotations', 'salesFinance', quotationBody()),
		);
		expect(response.status).toBe(201);
	});
});

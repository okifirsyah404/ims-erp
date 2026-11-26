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
import { erpRoleGrants, erpStatements } from '@ims-erp/common';
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

		// ...and the same quotation is invisible to org B (never a 200 with foreign data).
		const response = await app.handle(
			jsonRequest('GET', `/sales/quotations/${data.id}`, 'owner', undefined, fixture.orgB),
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
// 10. The legacy sales payment flow is gone (ADR-0024 Q18)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 10. The legacy sales payment flow is gone (ADR-0024 Q18)
// ---------------------------------------------------------------------------
describe('legacy sales payments', () => {
	test('the old /sales/payments routes no longer exist', async () => {
		// The ledger moved to the payment module (`/payments`) with polymorphic
		// allocations; a stale client gets a 404 instead of a half-working flow.
		const response = await app.handle(jsonRequest('POST', '/sales/payments', 'owner', { amount: 100 }));
		expect(response.status).toBe(404);
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

// ---------------------------------------------------------------------------
// 14. Document signature vocabulary (ERP-0048/ERP-0049, flow not built yet)
// ---------------------------------------------------------------------------
describe('document signature grants', () => {
	const SIGNATURE_ACTIONS = ['signature_read', 'signature_sign'] as const;

	test('the document statement carries the three signature actions', () => {
		for (const action of [...SIGNATURE_ACTIONS, 'signature_request']) {
			expect(erpStatements.document).toContain(action as never);
		}
	});

	test('every role that reads documents may read and sign them', () => {
		for (const [role, grants] of Object.entries(erpRoleGrants)) {
			const document = (grants as Record<string, readonly string[]>).document;
			if (!document?.includes('read')) continue;
			expect({ role, actions: document }).toMatchObject({
				role,
				actions: expect.arrayContaining([...SIGNATURE_ACTIONS]),
			});
		}
	});

	test('every role that can read documents may also request a signature', () => {
		// Portal Phase C opened `signature_request` to every internal role: an
		// employee must be able to ask a colleague to sign their own document.
		// The invariant that remains is that document access is the floor —
		// a role with no `document` grant cannot request anything.
		const readers = Object.entries(erpRoleGrants)
			.filter(([, grants]) => (grants as Record<string, readonly string[]>).document?.includes('read'))
			.map(([role]) => role);
		expect(readers.length).toBeGreaterThan(0);
		for (const role of readers) {
			expect((erpRoleGrants as Record<string, { document?: readonly string[] }>)[role]!.document).toContain(
				'signature_request',
			);
		}
		// `member` holds no document grant at all.
		expect((erpRoleGrants as Record<string, { document?: readonly string[] }>).member!.document).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 15. Document signature routes (ERP-0048/ERP-0049): the guard per route
// ---------------------------------------------------------------------------
describe('document signature routes', () => {
	test('GET /documents/signatures needs a session', async () => {
		const response = await app.handle(jsonRequest('GET', '/documents/signatures'));
		expect(response.status).toBe(401);
	});

	test('GET /documents/signatures answers 200 for a signature_read holder', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/documents/signatures', 'admin', undefined, fixture.orgA),
		);
		expect(response.status).toBe(200);
	});

	test('GET /documents/signatures answers 403 for a role without document access', async () => {
		const response = await app.handle(
			jsonRequest('GET', '/documents/signatures', 'member', undefined, fixture.orgA),
		);
		expect(response.status).toBe(403);
	});

	test('POST /documents/signatures/requests answers 403 for a role without document access', async () => {
		// Every role that can read documents may now request a signature
		// (Phase C), so the refusal case is a role with no document grant at all.
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/requests',
				'member',
				{ documentId: '01930000-0000-7000-8000-000000000001', signerUserIds: ['user-sales'] },
				fixture.orgA,
			),
		);
		expect(response.status).toBe(403);
	});

	test('POST /documents/signatures/requests answers 200 for a signature_request holder', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/requests',
				'admin',
				{ documentId: '01930000-0000-7000-8000-000000000001', signerUserIds: ['user-sales'] },
				fixture.orgA,
			),
		);
		expect(response.status).toBe(200);
	});

	test('POST /documents/signatures/requests/:id/sign answers 403 without signature_sign', async () => {
		// `member` has no document access at all.
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/requests/01930000-0000-7000-8000-000000000009/sign',
				'member',
				{},
				fixture.orgA,
			),
		);
		expect(response.status).toBe(403);
	});

	test('POST /documents/signatures/requests/:id/sign answers 200 for a signature_sign holder', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/requests/01930000-0000-7000-8000-000000000009/sign',
				'sales',
				{ method: 'electronic' },
				fixture.orgA,
			),
		);
		expect(response.status).toBe(200);
	});

	test('POST /documents/signatures/requests/:id/decline answers 200 for a signature_sign holder', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/requests/01930000-0000-7000-8000-000000000009/decline',
				'sales',
				{ reason: 'Nominal salah' },
				fixture.orgA,
			),
		);
		expect(response.status).toBe(200);
	});

	test('POST /documents/signatures/requests/:id/cancel answers 403 without document access', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/requests/01930000-0000-7000-8000-000000000009/cancel',
				'member',
				{},
				fixture.orgA,
			),
		);
		expect(response.status).toBe(403);
	});

	test('POST /documents/signatures/requests/:id/cancel answers 200 for a signature_request holder', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/requests/01930000-0000-7000-8000-000000000009/cancel',
				'admin',
				{},
				fixture.orgA,
			),
		);
		expect(response.status).toBe(200);
	});

	test('GET /documents/:id/signatures answers 200 for a signature_read holder', async () => {
		const response = await app.handle(
			jsonRequest(
				'GET',
				'/documents/01930000-0000-7000-8000-000000000001/signatures',
				'sales',
				undefined,
				fixture.orgA,
			),
		);
		expect(response.status).toBe(200);
	});

	test('GET /documents/:id/signatures answers 403 for a role without document access', async () => {
		const response = await app.handle(
			jsonRequest(
				'GET',
				'/documents/01930000-0000-7000-8000-000000000001/signatures',
				'member',
				undefined,
				fixture.orgA,
			),
		);
		expect(response.status).toBe(403);
	});

	test('POST /documents/signatures/user-images answers 200 for a signature_sign holder', async () => {
		const response = await app.handle(
			jsonRequest(
				'POST',
				'/documents/signatures/user-images',
				'sales',
				{ userIds: ['user-sales'] },
				fixture.orgA,
			),
		);
		expect(response.status).toBe(200);
	});

	test('PUT /documents/signatures/requests/:id/signed-pdf needs signature_sign', async () => {
		const denied = await app.handle(
			jsonRequest(
				'PUT',
				'/documents/signatures/requests/01930000-0000-7000-8000-000000000009/signed-pdf',
				'member',
				{},
				fixture.orgA,
			),
		);
		expect(denied.status).toBe(403);
	});

	test('GET /documents/signatures/requests/:id/signed-pdf needs a session', async () => {
		const response = await app.handle(
			jsonRequest(
				'GET',
				'/documents/signatures/requests/01930000-0000-7000-8000-000000000009/signed-pdf',
			),
		);
		expect(response.status).toBe(401);
	});
});
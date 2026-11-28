/**
 * P7-4 (RO1, RO4): accounting period transitions through the REAL Elysia
 * pipeline (`erpGuard` + `LedgerController`) over a stubbed period service.
 *
 * Finance prepares and closes periods; moving a period back to `open`
 * (reopen) needs `accounting_period:reopen`, which only the owner holds. The
 * old route carried an `ownership: { reopen: 'owner' }` option the guard
 * never read, so this pins the server-side refusal.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { fixture, installAuthMock, installPermissionResolverMock, resetFixture } from './test-app';

const PERIOD_ID = '01920000-0000-7000-8000-0000000000f1';
const transitions: string[] = [];

let app: Elysia<any, any, any, any, any, any>;

const transition = (session: string, to: string): Request => {
	const headers = new Headers({ 'content-type': 'application/json' });
	headers.set('x-test-session', session);
	headers.set('x-organization-id', fixture.orgA);
	return new Request(`http://localhost/finance/periods/${PERIOD_ID}/transition`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ to, reason: 'koreksi' }),
	});
};

beforeAll(async () => {
	installAuthMock();
	installPermissionResolverMock();
	const finance = await import('../../src/app/finance/constants/di');
	const { LedgerController } = await import('../../src/app/finance/controllers/ledger.controller');
	const { erpGuard } = await import('../../src/authorization/elysia-auth');

	container.register(finance.ACCOUNT_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.POSTING_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.OPENING_BALANCE_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.OPENING_SUBLEDGER_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.MANUAL_JOURNAL_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.CASH_BANK_SERVICE_TOKEN, { useValue: {} as never });
	container.register(finance.PERIOD_SERVICE_TOKEN, {
		useValue: {
			transition: async (_organizationId: string, id: string, to: string) => {
				transitions.push(to);
				return { id, status: to };
			},
		} as never,
	});

	app = new Elysia().use(erpGuard()).use(LedgerController.plugin());
});

beforeEach(() => {
	resetFixture();
	transitions.length = 0;
});

describe('accounting period transitions (RO1, RO4)', () => {
	test('finance closes and locks a period', async () => {
		expect((await app.handle(transition('finance', 'closed'))).status).toBe(200);
		expect((await app.handle(transition('finance', 'locked'))).status).toBe(200);
		expect(transitions).toEqual(['closed', 'locked']);
	});

	test('finance may not reopen a period (owner only)', async () => {
		const response = await app.handle(transition('finance', 'open'));
		expect(response.status).toBe(403);
		expect(transitions).toEqual([]);
	});

	test('the owner reopens a period', async () => {
		const response = await app.handle(transition('owner', 'open'));
		expect(response.status).toBe(200);
		expect(transitions).toEqual(['open']);
	});

	test('a role without accounting_period:close is refused before the policy', async () => {
		const response = await app.handle(transition('sales', 'closed'));
		expect(response.status).toBe(403);
		expect(transitions).toEqual([]);
	});
});

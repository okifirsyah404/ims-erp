/**
 * License API (M03 stage 2): the clock-injected state at each boundary (end
 * date, end + 7 grace days), machine authentication (401 / 429), keys of
 * another application looking unknown, refusals, seats (idempotent per
 * installation, limit enforced, release) and the call log.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TApplicationApiKeySelect, TLicenseActivationSelect, TLicenseKeySelect } from '@drizzle/schemas/licensing.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TKeyWithContract } from '../../src/app/licensing/contracts/license-api.contract';
import type { TContractRow } from '../../src/app/licensing/contracts/licensing.contract';
import { ApiKeyIssueError, LicenseApiAuthError, LicenseRefusedError } from '../../src/app/licensing/errors/licensing.errors';
import { LicenseApiService, type TApiClient } from '../../src/app/licensing/services/license-api.service';
import { addDays, GRACE_DAYS, licenseState } from '../../src/app/licensing/utils/license';

const APP = '0190a1b2-0000-7000-8000-00000000a002';
const OTHER_APP = '0190a1b2-0000-7000-8000-00000000a009';
const today = businessDateOf();

let found: Record<string, TKeyWithContract>;
let activations: TLicenseActivationSelect[];
let events: { eventType: string; result: string; licenseKeyId?: string | null }[];
let apiKeys: TApplicationApiKeySelect[];
let renewalsActivated: number;
let issuerCalls: { kind: 'issue' | 'disable'; userId: string }[];
let refuseIssuer: boolean;
let service: LicenseApiService;
const client: TApiClient = { applicationApiKeyId: 'ak-1', applicationId: APP };

function entry(value: string, contract: Partial<TContractRow>, key: Partial<TLicenseKeySelect> = {}): TKeyWithContract {
	return {
		key: { id: `key-${value}`, licenseKey: value, status: 'active', expiresOn: null, maxActivations: 2, ...key } as TLicenseKeySelect,
		contract: {
			id: `contract-${value}`,
			licensableApplicationId: APP,
			applicationCode: 'ECL',
			applicationName: 'Entragate Cloud',
			customerName: 'PT Pelanggan',
			packageName: 'Pro',
			status: 'active',
			startDate: addDays(today, -300),
			endDate: addDays(today, 30),
			...contract,
		} as TContractRow,
	};
}

beforeEach(() => {
	found = {
		GOOD: entry('GOOD', {}),
		GRACE: entry('GRACE', { endDate: addDays(today, -3) }),
		OLD: entry('OLD', { endDate: addDays(today, -(GRACE_DAYS + 1)) }),
		SUSP: entry('SUSP', { status: 'suspended' }),
		REVOKED: entry('REVOKED', {}, { status: 'revoked' }),
		FOREIGN: entry('FOREIGN', { licensableApplicationId: OTHER_APP }),
	};
	activations = [];
	events = [];
	apiKeys = [{ id: 'ak-1', apiKeyId: 'ba-1', licensableApplicationId: APP, status: 'active' } as TApplicationApiKeySelect];
	renewalsActivated = 0;
	issuerCalls = [];
	refuseIssuer = false;
	service = new LicenseApiService(
		{
			listApiKeys: async () => apiKeys,
			findApiKey: async (id) => apiKeys.find((row) => row.id === id) ?? null,
			findApiKeyByAuthId: async (id) => apiKeys.find((row) => row.apiKeyId === id) ?? null,
			createApiKey: async (data) => ({ ...data, id: 'ak-new', status: 'active' }) as TApplicationApiKeySelect,
			revokeApiKey: async (id) => Object.assign(apiKeys.find((row) => row.id === id)!, { status: 'revoked' }),
			touchApiKey: async () => {},
			findKeyWithContract: async (value) => found[value] ?? null,
			findActiveActivation: async (keyId, instanceId) =>
				activations.find((row) => row.licenseKeyId === keyId && row.instanceId === instanceId && row.status === 'active') ?? null,
			listActivations: async (keyIds) => activations.filter((row) => keyIds.includes(row.licenseKeyId)),
			async createActivationLocked(data, max) {
				if (activations.filter((row) => row.licenseKeyId === data.licenseKeyId && row.status === 'active').length >= max) return null;
				const row = { ...data, id: crypto.randomUUID(), status: 'active' } as TLicenseActivationSelect;
				activations.push(row);
				return row;
			},
			touchActivation: async () => {},
			async deactivate(id) {
				const row = activations.find((item) => item.id === id && item.status === 'active');
				return row ? Object.assign(row, { status: 'deactivated' }) : null;
			},
			insertEvent: async (data) => {
				events.push(data);
			},
			paginateEvents: async () => ({ meta: { page: 1, limit: 50, total: 0, totalPages: 0 }, data: [] }),
		},
		{
			activatePaidRenewals: async () => renewalsActivated,
			getApplication: async (id: string) => ({ id, source: id === APP ? 'own' : 'third_party', status: 'active' }) as never,
			contractKeyIds: async (id: string) => Object.values(found).filter((item) => item.contract.id === id).map((item) => item.key.id),
		},
		{
			issue: async (input) => {
				issuerCalls.push({ kind: 'issue', userId: input.issuerUserId });
				if (refuseIssuer) throw Object.assign(new Error('forbidden'), { body: { code: 'INSUFFICIENT_API_KEY_PERMISSIONS' } });
				return { id: 'ba-new', key: 'elk_secret', start: 'elk_se' };
			},
			disable: async (input) => {
				issuerCalls.push({ kind: 'disable', userId: input.actorUserId });
			},
			verify: async (key) => (key === 'elk_good' ? { id: 'ba-1' } : key === 'elk_busy' ? 'rateLimited' : null),
		},
		{
			listMembers: async () =>
				({
					meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
					data: [
						{ userId: 'owner-1', role: 'owner', user: { name: 'Owner' } },
						{ userId: 'u1', role: 'sales_manager', user: { name: 'Sari Sales' } },
					],
				}) as never,
		},
	);
});

describe('license state at each boundary', () => {
	const contract = { status: 'active', startDate: '2026-01-01', endDate: '2026-12-31' };
	const key = { status: 'active', expiresOn: null };

	test('ok up to the end date, grace for 7 days, then expired', () => {
		expect(licenseState(contract, key, '2026-12-31')).toMatchObject({ result: 'ok', valid: true, daysLeft: 0 });
		expect(licenseState(contract, key, '2027-01-01')).toMatchObject({ result: 'grace', valid: true, graceEndsOn: '2027-01-07' });
		expect(licenseState(contract, key, '2027-01-07').result).toBe('grace');
		expect(licenseState(contract, key, '2027-01-08')).toMatchObject({ result: 'expired', valid: false });
	});

	test('the earlier of the key expiry and the contract end counts; perpetual never ends', () => {
		expect(licenseState(contract, { status: 'active', expiresOn: '2026-06-30' }, '2026-07-01').result).toBe('grace');
		expect(licenseState({ ...contract, endDate: null }, key, '2030-01-01')).toMatchObject({ result: 'ok', endsOn: null });
	});

	test('refusals: revoked key, suspended, terminated, renewed, draft, before the start', () => {
		expect(licenseState(contract, { status: 'revoked', expiresOn: null }, '2026-05-01').result).toBe('revoked');
		expect(licenseState({ ...contract, status: 'suspended' }, key, '2026-05-01').result).toBe('suspended');
		expect(licenseState({ ...contract, status: 'terminated' }, key, '2026-05-01').result).toBe('terminated');
		expect(licenseState({ ...contract, status: 'renewed' }, key, '2026-05-01').result).toBe('expired');
		expect(licenseState({ ...contract, status: 'draft' }, key, '2026-05-01').result).toBe('not_started');
		expect(licenseState(contract, key, '2025-12-31').result).toBe('not_started');
	});
});

describe('machine authentication', () => {
	test('missing, invalid, revoked and rate-limited keys are refused', async () => {
		await expect(service.authenticate(null)).rejects.toMatchObject({ status: 401, key: 'licensing.api.missing' });
		await expect(service.authenticate('Bearer elk_wrong')).rejects.toMatchObject({ status: 401, key: 'licensing.api.invalid' });
		await expect(service.authenticate('Bearer elk_busy')).rejects.toMatchObject({ status: 429 });
		expect(await service.authenticate('Bearer elk_good')).toEqual({ applicationApiKeyId: 'ak-1', applicationId: APP });
		apiKeys[0].status = 'revoked';
		await expect(service.authenticate('Bearer elk_good')).rejects.toBeInstanceOf(LicenseApiAuthError);
	});
});

describe('validate', () => {
	test('ok, grace with a warning, expired; every call logged', async () => {
		expect(await service.validate(client, { licenseKey: 'GOOD' }, null)).toMatchObject({ valid: true, status: 'ok', warning: false, licenseKey: '••••-GOOD' });
		expect(await service.validate(client, { licenseKey: 'GRACE' }, null)).toMatchObject({ valid: true, status: 'grace', warning: true });
		expect(await service.validate(client, { licenseKey: 'OLD' }, null)).toMatchObject({ valid: false, status: 'expired' });
		expect(await service.validate(client, { licenseKey: 'SUSP' }, null)).toMatchObject({ valid: false, status: 'suspended' });
		expect(events.map((event) => event.result)).toEqual(['ok', 'grace', 'expired', 'suspended']);
	});

	test("another application's key and an unknown key look the same", async () => {
		for (const licenseKey of ['FOREIGN', 'NOPE']) {
			expect(await service.validate(client, { licenseKey }, null)).toMatchObject({ valid: false, status: 'unknown', customerName: null });
		}
		expect(events.every((event) => event.licenseKeyId === null)).toBe(true);
	});

	test('with an instance id, the installation must hold a seat', async () => {
		expect(await service.validate(client, { licenseKey: 'GOOD', instanceId: 'pc-1' }, null)).toMatchObject({ valid: false, status: 'not_activated' });
		await service.activate(client, { licenseKey: 'GOOD', instanceId: 'pc-1' }, '10.0.0.1');
		expect(await service.validate(client, { licenseKey: 'GOOD', instanceId: 'pc-1' }, null)).toMatchObject({ valid: true, activation: { instanceId: 'pc-1' } });
	});
});

describe('activate and deactivate', () => {
	test('seats: idempotent per installation, limited, released', async () => {
		await service.activate(client, { licenseKey: 'GOOD', instanceId: 'pc-1' }, null);
		await service.activate(client, { licenseKey: 'GOOD', instanceId: 'pc-1' }, null);
		await service.activate(client, { licenseKey: 'GOOD', instanceId: 'pc-2' }, null);
		expect(activations).toHaveLength(2);
		await expect(service.activate(client, { licenseKey: 'GOOD', instanceId: 'pc-3' }, null)).rejects.toMatchObject({ status: 409, key: 'licensing.refused.seat_limit' });
		expect(await service.deactivate(client, { licenseKey: 'GOOD', instanceId: 'pc-1' }, null)).toEqual({ released: true });
		await service.activate(client, { licenseKey: 'GOOD', instanceId: 'pc-3' }, null);
		await expect(service.deactivate(client, { licenseKey: 'GOOD', instanceId: 'pc-1' }, null)).rejects.toMatchObject({ status: 404 });
	});

	test('grace still activates; expired, suspended, revoked and unknown keys do not', async () => {
		expect(await service.activate(client, { licenseKey: 'GRACE', instanceId: 'pc-1' }, null)).toMatchObject({ status: 'grace', warning: true });
		for (const [licenseKey, status] of [['OLD', 403], ['SUSP', 403], ['REVOKED', 403], ['FOREIGN', 404]] as const) {
			await expect(service.activate(client, { licenseKey, instanceId: 'pc-9' }, null)).rejects.toMatchObject({ status });
		}
		expect(events.filter((event) => event.eventType === 'activated').map((event) => event.result)).toEqual([
			'grace',
			'expired',
			'suspended',
			'revoked',
			'unknown',
		]);
	});

	test('a paid renewal is applied before the key is judged', async () => {
		renewalsActivated = 1;
		found.OLD = entry('OLD', { endDate: addDays(today, 365) });
		expect((await service.validate(client, { licenseKey: 'OLD' }, null)).status).toBe('ok');
	});
});

describe('application keys', () => {
	test('only own, active applications get one; revoking disables it', async () => {
		const issued = await service.issueApiKey({ actorUserId: 'u1', organizationId: 'org' }, APP, 'Pilot server');
		expect(issued).toMatchObject({ secret: 'elk_secret', apiKey: { apiKeyId: 'ba-new', keyStart: 'elk_se', createdBy: 'u1' } });
		await expect(service.issueApiKey({ actorUserId: 'u1', organizationId: 'org' }, OTHER_APP, 'x')).rejects.toBeInstanceOf(ApiKeyIssueError);
		expect((await service.revokeApiKey({ actorUserId: 'u1', organizationId: 'org' }, APP, 'ak-1')).status).toBe('revoked');
		await expect(service.revokeApiKey({ actorUserId: 'u1', organizationId: 'org' }, APP, 'ak-1')).rejects.toBeInstanceOf(ApiKeyIssueError);
	});

	test('issued and revoked as the acting member, never as the owner (PR #100 review)', async () => {
		await service.issueApiKey({ actorUserId: 'u1', organizationId: 'org' }, APP, 'Pilot server');
		await service.revokeApiKey({ actorUserId: 'u1', organizationId: 'org' }, APP, 'ak-1');
		expect(issuerCalls).toEqual([
			{ kind: 'issue', userId: 'u1' },
			{ kind: 'disable', userId: 'u1' },
		]);
	});

	test('a member Better Auth refuses gets a 403, not a 500', async () => {
		refuseIssuer = true;
		const refused = service.issueApiKey({ actorUserId: 'u9', organizationId: 'org' }, APP, 'x');
		await expect(refused).rejects.toBeInstanceOf(ApiKeyIssueError);
		await expect(refused).rejects.toMatchObject({ status: 403 });
	});

	test('the list names who issued and who revoked each key', async () => {
		apiKeys[0] = { ...apiKeys[0]!, createdBy: 'u1', revokedBy: 'owner-1' } as TApplicationApiKeySelect;
		const [row] = await service.listApiKeys('org', APP);
		expect(row).toMatchObject({ createdByName: 'Sari Sales', revokedByName: 'Owner' });
	});
});

test('refusal errors carry their status', () => {
	expect(new LicenseRefusedError('unknown').status).toBe(404);
	expect(new LicenseRefusedError('seat_limit').status).toBe(409);
	expect(new LicenseRefusedError('expired').status).toBe(403);
});

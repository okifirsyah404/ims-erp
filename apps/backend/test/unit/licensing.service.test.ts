/**
 * License register (M03 stage 1): references checked on a draft, the state
 * machine, renewal (next period, old contract renewed on activation), keys
 * (generated for own applications, typed for third-party ones, unique,
 * masked without `license:read_key`) and the pure date rules.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TLicensableApplicationSelect, TLicenseContractSelect, TLicenseKeySelect } from '@drizzle/schemas/licensing.schema';
import { businessDateOf } from '@utils/business-date.util';
import { contractBodySchema, keyBodySchema, type TContractRow } from '../../src/app/licensing/contracts/licensing.contract';
import { ContractInvalidError, ContractStateError, LicenseKeyError } from '../../src/app/licensing/errors/licensing.errors';
import { LicensingService, type TLicenseContext } from '../../src/app/licensing/services/licensing.service';
import { addDays, contractTiming, generateLicenseKey, maskLicenseKey, renewalPeriod } from '../../src/app/licensing/utils/license';

const CUSTOMER = '0190a1b2-0000-7000-8000-00000000c001';
const OTHER = '0190a1b2-0000-7000-8000-00000000c002';
const VENDOR_APP = '0190a1b2-0000-7000-8000-00000000a001';
const OWN_APP = '0190a1b2-0000-7000-8000-00000000a002';
const RETIRED_APP = '0190a1b2-0000-7000-8000-00000000a003';
const ORDER = '0190a1b2-0000-7000-8000-00000000d001';
const RENEWAL_ORDER = '0190a1b2-0000-7000-8000-00000000d002';

const manager: TLicenseContext = { actorUserId: 'manager', canReadKeys: true };
const finance: TLicenseContext = { actorUserId: 'finance', canReadKeys: false };

let applications: TLicensableApplicationSelect[];
let contracts: TLicenseContractSelect[];
let keys: TLicenseKeySelect[];
let numbers: number;
let paid: Record<string, number>;
let events: { eventType: string; licenseContractId?: string | null; actorUserId?: string | null; description?: string | null }[];
let service: LicensingService;

const app = (id: string, source: 'own' | 'third_party', status: 'active' | 'retired' = 'active') =>
	({ id, code: id.slice(-4), name: `App ${id.slice(-4)}`, source, status }) as TLicensableApplicationSelect;

const row = (contract: TLicenseContractSelect): TContractRow => {
	const application = applications.find((item) => item.id === contract.licensableApplicationId)!;
	return { ...contract, applicationCode: application.code, applicationName: application.name, applicationSource: application.source };
};

beforeEach(() => {
	applications = [app(VENDOR_APP, 'third_party'), app(OWN_APP, 'own'), app(RETIRED_APP, 'third_party', 'retired')];
	contracts = [];
	keys = [];
	numbers = 0;
	paid = {};
	events = [];
	service = new LicensingService(
		{
			listApplications: async () => applications,
			findApplication: async (id) => applications.find((item) => item.id === id) ?? null,
			createApplication: async () => {
				throw new Error('unused');
			},
			updateApplication: async () => null,
			paginateContracts: async () => ({ meta: { page: 1, limit: 20, total: contracts.length, totalPages: 1 }, data: contracts.map(row) }),
			findContract: async (id) => {
				const found = contracts.find((item) => item.id === id);
				return found ? row(found) : null;
			},
			async createContract(data) {
				const created = { ...data, id: crypto.randomUUID(), renewedFromContractId: data.renewedFromContractId ?? null } as TLicenseContractSelect;
				contracts.push(created);
				return created;
			},
			async updateDraft(id, data) {
				const found = contracts.find((item) => item.id === id && item.status === 'draft');
				return found ? Object.assign(found, data) : null;
			},
			async transition(id, from, data) {
				const found = contracts.find((item) => item.id === id);
				return found && from.includes(found.status) ? Object.assign(found, data) : null;
			},
			findOpenRenewal: async (id) =>
				contracts.find((item) => item.renewedFromContractId === id && ['draft', 'active'].includes(item.status)) ?? null,
			countDue: async () => ({ endingSoon: 0, ended: 0 }),
			listKeys: async (id) => keys.filter((key) => key.licenseContractId === id),
			findKeyByValue: async (value) => keys.find((key) => key.licenseKey === value) ?? null,
			async createKey(data) {
				const created = { ...data, id: crypto.randomUUID(), status: 'active' } as TLicenseKeySelect;
				keys.push(created);
				return created;
			},
			listRenewalCandidates: async (from) =>
				contracts.filter(
					(item) =>
						item.status === 'draft' &&
						item.renewedFromContractId &&
						(!from || item.renewedFromContractId === from) &&
						item.salesOrderId &&
						item.startDate,
				),
			async moveKeys(from, to, oldEnd, newEnd) {
				const moved = keys.filter((key) => key.licenseContractId === from);
				for (const key of moved) {
					if (oldEnd && key.expiresOn === oldEnd) key.expiresOn = newEnd;
					key.licenseContractId = to;
				}
				return moved.map((key) => key.id);
			},
			async revokeKey(contractId, keyId, actor, reason) {
				const found = keys.find((key) => key.id === keyId && key.licenseContractId === contractId && key.status === 'active');
				return found ? Object.assign(found, { status: 'revoked', revokedBy: actor, revokeReason: reason }) : null;
			},
		},
		{ getActiveCustomer: async (id: string) => (id === CUSTOMER || id === OTHER ? ({ id, name: `Customer ${id.slice(-4)}` } as never) : null) },
		{
			getLiveOrder: async (id: string) =>
				id === ORDER || id === RENEWAL_ORDER ? ({ id, code: `SO-${id.slice(-4)}`, customerId: CUSTOMER, grandTotal: 1_000_000_00 } as never) : null,
		},
		{ next: async () => `${String(++numbers).padStart(4, '0')}/LIC/IMS/XI/26` },
		{ run: (work) => work({} as never) },
		{
			insertEvent: async (data) => {
				events.push(data);
			},
			listActivations: async () => [],
			paginateEvents: async () => ({ meta: { page: 1, limit: 30, total: 0, totalPages: 0 }, data: [] }),
		},
		{ paidTotal: async (orderId: string) => paid[orderId] ?? 0 },
	);
});

const draft = (extra: Record<string, unknown> = {}) =>
	service.create(
		manager,
		contractBodySchema.parse({
			customerId: CUSTOMER,
			licensableApplicationId: VENDOR_APP,
			startDate: '2026-01-01',
			endDate: '2026-12-31',
			billingCycle: 'annual',
			contractValue: 1_200_000_00,
			...extra,
		}),
	);

describe('license contracts', () => {
	test('a draft is numbered and keeps the customer name', async () => {
		const contract = await draft({ salesOrderId: ORDER });
		expect(contract).toMatchObject({ code: '0001/LIC/IMS/XI/26', status: 'draft', customerName: 'Customer c001', salesOrderId: ORDER });
	});

	test('references are checked', async () => {
		await expect(draft({ customerId: '0190a1b2-0000-7000-8000-00000000c0ff' })).rejects.toBeInstanceOf(ContractInvalidError);
		await expect(draft({ licensableApplicationId: RETIRED_APP })).rejects.toBeInstanceOf(ContractInvalidError);
		await expect(draft({ customerId: OTHER, salesOrderId: ORDER })).rejects.toBeInstanceOf(ContractInvalidError);
		await expect(draft({ startDate: '2026-02-01', endDate: '2026-01-01' })).rejects.toBeInstanceOf(ContractInvalidError);
	});

	test('draft → active → suspended → active → terminated; only drafts are edited', async () => {
		const { id } = await draft();
		expect((await service.activate(manager, id)).status).toBe('active');
		await expect(service.update(id, contractBodySchema.parse({ customerId: CUSTOMER, licensableApplicationId: VENDOR_APP, billingCycle: 'annual', contractValue: 0 }))).rejects.toBeInstanceOf(ContractStateError);
		await expect(service.activate(manager, id)).rejects.toBeInstanceOf(ContractStateError);
		expect((await service.suspend(manager, id, 'Unpaid')).status).toBe('suspended');
		await expect(service.suspend(manager, id, null)).rejects.toBeInstanceOf(ContractStateError);
		expect((await service.reactivate(manager, id)).status).toBe('active');
		const terminated = await service.terminate(manager, id, 'Customer stopped');
		expect(terminated).toMatchObject({ status: 'terminated', terminationReason: 'Customer stopped' });
		await expect(service.terminate(manager, id, 'again')).rejects.toBeInstanceOf(ContractStateError);
		// Every staff override is logged with the actor.
		expect(events.map((event) => [event.eventType, event.actorUserId, event.description])).toEqual([
			['suspended', 'manager', 'Unpaid'],
			['reactivated', 'manager', null],
			['terminated', 'manager', 'Customer stopped'],
		]);
	});

	test('a renewal paid in full activates by itself, once, and takes the keys over', async () => {
		const old = await draft();
		await service.addKey(manager, old.id, keyBodySchema.parse({ licenseKey: 'VENDOR-KEY-0009' }));
		await service.activate(manager, old.id);
		const renewal = await service.renew(manager, old.id);
		await service.update(
			renewal.id,
			contractBodySchema.parse({
				customerId: CUSTOMER,
				licensableApplicationId: VENDOR_APP,
				salesOrderId: RENEWAL_ORDER,
				startDate: renewal.startDate,
				endDate: renewal.endDate,
				billingCycle: 'annual',
				contractValue: 1_000_000_00,
			}),
		);
		paid[RENEWAL_ORDER] = 400_000_00; // DP only
		expect(await service.activatePaidRenewals()).toBe(0);
		expect(contracts.find((item) => item.id === renewal.id)?.status).toBe('draft');
		paid[RENEWAL_ORDER] = 1_000_000_00;
		const detail = await service.get(manager, old.id); // reading the register runs the check
		expect(detail.status).toBe('renewed');
		expect(contracts.find((item) => item.id === renewal.id)).toMatchObject({ status: 'active', activatedBy: null });
		expect(keys[0]).toMatchObject({ licenseContractId: renewal.id, expiresOn: '2027-12-31' });
		expect(await service.activatePaidRenewals()).toBe(0);
		expect(events.filter((event) => event.eventType === 'renewed')).toHaveLength(1);
	});

	test('activation needs a start date', async () => {
		const { id } = await draft({ startDate: null, endDate: null });
		await expect(service.activate(manager, id)).rejects.toBeInstanceOf(ContractInvalidError);
	});

	test('renewal drafts the next period once; activating it marks the old contract renewed', async () => {
		const { id } = await draft();
		await expect(service.renew(manager, id)).rejects.toBeInstanceOf(ContractStateError);
		await service.activate(manager, id);
		const renewal = await service.renew(manager, id);
		expect(renewal).toMatchObject({ status: 'draft', startDate: '2027-01-01', endDate: '2027-12-31', renewedFromContractId: id, contractValue: 1_200_000_00 });
		await expect(service.renew(manager, id)).rejects.toBeInstanceOf(ContractStateError);
		await service.activate(manager, renewal.id);
		expect(contracts.find((item) => item.id === id)?.status).toBe('renewed');
		const detail = await service.get(manager, renewal.id);
		expect(detail.renewedFrom?.id).toBe(id);
	});
});

describe('license keys', () => {
	test('third-party keys are typed in; own keys are generated', async () => {
		const vendor = await draft();
		await expect(service.addKey(manager, vendor.id, keyBodySchema.parse({}))).rejects.toBeInstanceOf(LicenseKeyError);
		const typed = await service.addKey(manager, vendor.id, keyBodySchema.parse({ licenseKey: 'VENDOR-KEY-0001' }));
		expect(typed).toMatchObject({ licenseKey: 'VENDOR-KEY-0001', keySource: 'vendor', expiresOn: '2026-12-31', masked: false });
		await expect(service.addKey(manager, vendor.id, keyBodySchema.parse({ licenseKey: 'VENDOR-KEY-0001' }))).rejects.toBeInstanceOf(LicenseKeyError);

		const own = await draft({ licensableApplicationId: OWN_APP });
		const generated = await service.addKey(manager, own.id, keyBodySchema.parse({ maxActivations: 5 }));
		expect(generated.keySource).toBe('generated');
		expect(generated.licenseKey).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
	});

	test('masked without license:read_key; revoked with a reason; none on a terminated contract', async () => {
		const contract = await draft();
		const key = await service.addKey(manager, contract.id, keyBodySchema.parse({ licenseKey: 'VENDOR-KEY-0002' }));
		const seen = await service.get(finance, contract.id);
		expect(seen.keys[0]).toMatchObject({ licenseKey: '••••-0002', masked: true });
		expect((await service.revokeKey(manager, contract.id, key.id, 'Leaked')).status).toBe('revoked');
		await service.terminate(manager, contract.id, 'Cancelled');
		await expect(service.addKey(manager, contract.id, keyBodySchema.parse({ licenseKey: 'VENDOR-KEY-0003' }))).rejects.toBeInstanceOf(ContractStateError);
	});
});

describe('license rules', () => {
	test('renewal period keeps the length; perpetual renews a year from today', () => {
		expect(renewalPeriod({ startDate: '2026-03-01', endDate: '2026-05-31' }, '2026-05-20')).toEqual({ startDate: '2026-06-01', endDate: '2026-08-31' });
		expect(renewalPeriod({ startDate: '2026-01-01', endDate: null }, '2026-11-06')).toEqual({ startDate: '2026-11-06', endDate: '2027-11-05' });
	});

	test('timing: due within the window, expired after the end, only when active', () => {
		const today = businessDateOf();
		expect(contractTiming({ status: 'active', endDate: addDays(today, 10) }, today)).toEqual({ isExpired: false, isDue: true, daysLeft: 10 });
		expect(contractTiming({ status: 'active', endDate: addDays(today, 40) }, today).isDue).toBe(false);
		expect(contractTiming({ status: 'active', endDate: addDays(today, -1) }, today)).toEqual({ isExpired: true, isDue: true, daysLeft: -1 });
		expect(contractTiming({ status: 'renewed', endDate: addDays(today, -1) }, today).isExpired).toBe(false);
		expect(contractTiming({ status: 'active', endDate: null }, today).daysLeft).toBeNull();
	});

	test('generated keys avoid look-alike characters; masking keeps the last four', () => {
		for (let i = 0; i < 50; i++) expect(generateLicenseKey()).not.toMatch(/[01OI]/);
		expect(maskLicenseKey('ABCDE-FGHJK-LMNPQ-RSTUV')).toBe('••••-STUV');
	});
});

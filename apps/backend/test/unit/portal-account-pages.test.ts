/**
 * Customer portal account pages (ERP-0075).
 *
 * Covers: installation sites (first is primary, an update keeps the flag,
 * one primary per customer, removing the primary promotes the oldest,
 * another customer's site is 404, the 30-site cap), login preferences
 * (defaults, partial saves), and the portal composition (role gates on
 * sites and onboarding, personal data split between login and contact,
 * onboarding adds a site only when there is none and keeps going past a
 * failed invite, documents newest first with project file links).
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { PortalContext } from '@authorization/portal-auth';
import type { TCustomerAddressSelect } from '@drizzle/schemas/crm.schema';
import { CUSTOMER_SITE_MAX, type ICustomerAddressRepository } from '../../src/app/crm/contracts/customer-address.contract';
import { CustomerAddressNotFoundError, CustomerSiteLimitError } from '../../src/app/crm/errors/crm.errors';
import { CustomerAddressService } from '../../src/app/crm/services/customer-address.service';
import { PortalRoleForbiddenError } from '../../src/app/portal/errors/portal.errors';
import { PortalAccountPagesService } from '../../src/app/portal/services/portal-account-pages.service';
import type { IUserPreferenceRepository } from '../../src/app/user/repositories/user-preference.repository';
import { UserPreferenceService } from '../../src/app/user/services/user-preference.service';

let rows: TCustomerAddressSelect[];
let clock: number;

const repository: ICustomerAddressRepository = {
	list: async (customerId, kind) =>
		rows
			.filter((row) => row.customerId === customerId && !row.deletedAt && (!kind || row.kind === kind))
			.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt.getTime() - b.createdAt.getTime()),
	create: async (customerId, data) => {
		const row = { ...data, id: crypto.randomUUID(), customerId, createdAt: new Date(clock++), updatedAt: new Date(), deletedAt: null } as TCustomerAddressSelect;
		if (data.isPrimary) rows.forEach((other) => other.customerId === customerId && other.kind === data.kind && (other.isPrimary = false));
		rows.push(row);
		return row;
	},
	update: async (customerId, id, data) => {
		const row = rows.find((entry) => entry.id === id && entry.customerId === customerId && !entry.deletedAt);
		if (!row) return null;
		if (data.isPrimary) rows.forEach((other) => other.customerId === customerId && other.kind === data.kind && other.id !== id && (other.isPrimary = false));
		return Object.assign(row, data);
	},
	softDelete: async (customerId, id) => {
		const row = rows.find((entry) => entry.id === id && entry.customerId === customerId && !entry.deletedAt);
		if (row) row.deletedAt = new Date();
		return Boolean(row);
	},
};
const site = (name: string, primary?: boolean) => ({ name, address: `Jl. ${name}`, picName: 'Sari', picPhone: '0812 3456 7890', ...(primary === undefined ? {} : { primary }) });
const primaries = async (service: CustomerAddressService, customerId = 'c1') => (await service.listSites(customerId)).filter((row) => row.isPrimary).map((row) => row.label);

beforeEach(() => {
	rows = [];
	clock = 1_000;
});

describe('CustomerAddressService (sites)', () => {
	test('the first site is primary; an update keeps the flag; one primary per customer', async () => {
		const service = new CustomerAddressService(repository);
		const a = await service.saveSite('c1', site('A'));
		expect(a.isPrimary).toBe(true);
		const b = await service.saveSite('c1', site('B'));
		expect(b.isPrimary).toBe(false);
		await service.saveSite('c1', site('A2'), a.id);
		expect(await primaries(service)).toEqual(['A2']);
		await service.saveSite('c1', site('B', true), b.id);
		expect(await primaries(service)).toEqual(['B']);
	});

	test('removing the primary promotes the oldest remaining site', async () => {
		const service = new CustomerAddressService(repository);
		await service.saveSite('c1', site('A'));
		await service.saveSite('c1', site('B'));
		const c = await service.saveSite('c1', site('C', true));
		await service.removeSite('c1', c.id);
		expect(await primaries(service)).toEqual(['A']);
	});

	test("another customer's site is not found; the cap holds", async () => {
		const service = new CustomerAddressService(repository);
		const a = await service.saveSite('c1', site('A'));
		await expect(service.saveSite('c2', site('X'), a.id)).rejects.toBeInstanceOf(CustomerAddressNotFoundError);
		await expect(service.removeSite('c2', a.id)).rejects.toBeInstanceOf(CustomerAddressNotFoundError);
		for (let index = 1; index < CUSTOMER_SITE_MAX; index += 1) await service.saveSite('c1', site(`S${index}`));
		await expect(service.saveSite('c1', site('one too many'))).rejects.toBeInstanceOf(CustomerSiteLimitError);
	});
});

describe('UserPreferenceService (portal settings)', () => {
	test('defaults until saved; a partial save keeps the rest', async () => {
		const store = new Map<string, string>();
		const preferences: IUserPreferenceRepository = {
			get: async (_userId, keys) => new Map(keys.filter((key) => store.has(key)).map((key) => [key, store.get(key)!])),
			set: async (_userId, entries) => Object.entries(entries).forEach(([key, value]) => store.set(key, value)),
		};
		const service = new UserPreferenceService(preferences);
		expect(await service.portal('u1')).toEqual({ notifications: { email: true, whatsapp: false, push: false }, language: null, twoStep: false });
		expect(await service.setPortal('u1', { notifications: { whatsapp: true } })).toEqual({
			notifications: { email: true, whatsapp: true, push: false },
			language: null,
			twoStep: false,
		});
		// ERP-0081: two-step sign-in is a per-login preference.
		expect((await service.setPortal('u1', { twoStep: true })).twoStep).toBe(true);
		expect((await service.setPortal('u1', { language: 'id' })).notifications.whatsapp).toBe(true);
		expect((await service.portal('u1')).language).toBe('id');
	});
});

describe('PortalAccountPagesService', () => {
	const portal = (role: PortalContext['role'], contactId: string | null = 'contact-1') =>
		({ customerId: 'c1', userId: 'u1', identityId: 'i1', contactId, role, user: { id: 'u1', name: 'Dewi', email: 'dewi@example.com' } }) as PortalContext;
	let calls: string[];
	let invites: string[];
	let pages: PortalAccountPagesService;

	beforeEach(() => {
		calls = [];
		invites = [];
		const addresses = new CustomerAddressService(repository);
		pages = new PortalAccountPagesService(
			{
				customer: async () => ({ name: 'PT Maju', phone: '021-555', createdAt: new Date('2026-01-01') }) as never,
				members: async () => [],
				inviteMember: async (_portal, invite) => {
					if (invite.email.startsWith('taken')) throw new Error('exists');
					invites.push(invite.email);
					return {} as never;
				},
				listProjects: async () => [{ id: 'p1' }] as never,
				getProject: async () =>
					({ files: [{ id: 'f1', fileName: 'denah.dwg', createdAt: new Date('2026-11-10'), url: 'https://storage.example/denah' }] }) as never,
				listTickets: async () => [],
				listDevices: async () => [],
			},
			{
				listOrders: async () => [],
				listInvoices: async () => [{ id: 'inv1', code: 'INV-1', issueDate: '2026-11-12', grandTotal: 100_00, paidTotal: 0, status: 'issued' }] as never,
				listQuotations: async () =>
					[
						{ id: 'q-draft', code: 'QT-0', status: 'draft', createdAt: new Date('2026-11-15'), grandTotal: 1 },
						{ id: 'q1', code: 'QT-1', status: 'sent', sentAt: new Date('2026-11-14'), createdAt: new Date('2026-11-13'), grandTotal: 5_00 },
					] as never,
			},
			{
				get: async () => ({ contacts: [] }) as never,
				updateContact: async (_customerId, contactId, patch) => {
					calls.push(`contact:${contactId}:${JSON.stringify(patch)}`);
					return {} as never;
				},
			},
			addresses,
			{ updateSelf: async (_userId, input) => void calls.push(`user:${JSON.stringify(input)}`) },
			{ portal: async () => ({ notifications: { email: true, whatsapp: false, push: false }, language: null, twoStep: false }), setPortal: async () => ({}) as never },
			{
				request: async (_customerId, actor, input) => {
					calls.push(`change:${actor.name}:${input.name}`);
					return {} as never;
				},
				pending: async () => null,
			},
		);
	});

	test('finance and viewer logins cannot manage sites or finish onboarding', async () => {
		for (const role of ['finance', 'viewer'] as const) {
			expect(() => pages.saveSite(portal(role), site('A'))).toThrow(PortalRoleForbiddenError);
			expect(() => pages.removeSite(portal(role), 'x')).toThrow(PortalRoleForbiddenError);
			await expect(pages.completeOnboarding(portal(role), { siteAddress: 'Jl. A', invites: [] })).rejects.toBeInstanceOf(PortalRoleForbiddenError);
		}
		expect((await pages.saveSite(portal('approver'), site('A'))).label).toBe('A');
	});

	test('personal data: the name on the login, phone and job title on the contact', async () => {
		await pages.updatePersonal(portal('viewer'), { name: 'Dewi P', phone: '0812', jobTitle: 'Facility' }, new Headers());
		expect(calls).toEqual(['user:{"name":"Dewi P"}', 'contact:contact-1:{"name":"Dewi P","phone":"0812","position":"Facility"}']);
		calls = [];
		await pages.updatePersonal(portal('viewer', null), { name: 'Dewi', phone: '0812' }, new Headers());
		expect(calls).toEqual(['user:{"name":"Dewi"}']);
	});

	test('onboarding adds the first site only once and keeps going past a failed invite', async () => {
		const result = await pages.completeOnboarding(portal('owner'), {
			siteAddress: 'Jl. Industri 1',
			invites: [
				{ email: 'taken@example.com', role: 'viewer' },
				{ email: 'budi@example.com', role: 'approver' },
			],
		});
		expect(result).toEqual({ invited: 1, failed: ['taken@example.com'] });
		expect(invites).toEqual(['budi@example.com']);
		await pages.completeOnboarding(portal('owner'), { siteAddress: 'Jl. Lain', invites: [] });
		const sites = await pages.listSites(portal('owner'));
		expect(sites.map((row) => [row.label, row.addressLine, row.isPrimary])).toEqual([['PT Maju', 'Jl. Industri 1', true]]);
	});

	test('only the owner may ask to change company data', async () => {
		for (const role of ['approver', 'finance', 'viewer'] as const) {
			await expect(pages.requestCompanyChange(portal(role), { name: 'PT Baru', industry: null })).rejects.toBeInstanceOf(PortalRoleForbiddenError);
		}
		await pages.requestCompanyChange(portal('owner'), { name: 'PT Baru', industry: null });
		expect(calls).toEqual(['change:Dewi:PT Baru']);
	});

	test('documents: newest first, drafts left out, each with its portal download link', async () => {
		const documents = await pages.documents(portal('viewer'));
		expect(documents.map((entry) => [entry.folder, entry.name])).toEqual([
			['quotations', 'QT-1'],
			['invoices', 'INV-1'],
			['drawings', 'denah.dwg'],
		]);
		expect(documents.find((entry) => entry.folder === 'drawings')).toMatchObject({ kind: 'dwg', url: '/documents/file/file/f1' });
		expect(documents.find((entry) => entry.folder === 'invoices')!.url).toBe('/documents/file/invoice/inv1');
		expect(documents.find((entry) => entry.folder === 'quotations')!.url).toBe('/documents/file/quotation/q1');
	});
});

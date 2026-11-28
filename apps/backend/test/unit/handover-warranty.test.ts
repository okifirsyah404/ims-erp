/**
 * BAST and warranty certificate (M07, ADR-0011 step 6b): several BASTs per
 * project, numbered on creation, frozen once the project is no longer
 * active; one warranty per project starting at an issued BAST's date, ending
 * the day before the same date `months` later, numbered with the customer
 * code; texts from the profile or the sample's defaults; serials in the items.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TWarrantySelect } from '@drizzle/schemas/project.schema';
import type { THandoverSelect, TProjectSelect } from '@drizzle/schemas/project.schema';
import { WarrantyBastRequiredError, WarrantyProjectCancelledError } from '../../src/app/project/errors/warranty.errors';
import { WarrantyService } from '../../src/app/project/services/warranty.service';
import { DEFAULT_WARRANTY_EXCLUSIONS, customerNumberCode, warrantyEndDate } from '../../src/app/project/utils/warranty';
import { BastNotFoundError, ProjectNotActiveError } from '../../src/app/project/errors/project.errors';
import { HandoverService } from '../../src/app/project/services/handover.service';
import type { TProjectContext } from '../../src/app/project/services/project.service';

const ctx: TProjectContext = { organizationId: 'org', actorUserId: 'pm', canViewAll: true, canSeeCost: true, canAssignTasks: true, canManage: true };
const PROJECT = '0190a1b2-0000-7000-8000-00000000b001';

let project: TProjectSelect;
let basts: THandoverSelect[];
let certificates: TWarrantySelect[];
let numbers: { type: string; context?: unknown }[];
let handover: HandoverService;
let warranty: WarrantyService;
let profileTexts: { warrantyCoverage: string | null };
/** Registry calls made by the two services (ERP-0044). */
let registered: { code: string; sourceId: string; documentType: string }[];
let voided: string[];
/** B-30: units known to inventory (serial → product and own warranty date). */
let units: Map<string, { productId: string | null; warrantyExpiresOn: string | null }>;
/** B-30: standard warranty months per product. */
let productMonths: Map<string, number | null>;

const bastBody = (date = '2025-12-24') => ({
	bastDate: date,
	firstPartyCompany: 'PT ADHI PERSADA PROPERTI',
	firstPartyName: 'Aris',
	firstPartyTitle: 'Team Leader',
	secondPartyCompany: 'CV INTI MULTI SOLUSI',
	secondPartyName: 'Agus',
	secondPartyTitle: 'Project Manager',
	contractNumber: '014-11/DIR-SPP/2025',
	workTitle: 'PEKERJAAN PENGADAAN & PEMASANGAN SYSTEM BARIER SWING GATE',
	projectName: 'Proyek BM OIKN',
	items: [{ description: 'Swing Gate 1 Channel', volume: '2 Unit', remarks: 'Telah selesai terpasang dan berfungsi dengan baik' }],
	scope: ['Instalasi Swing Gate'],
});

beforeEach(() => {
	project = { id: PROJECT, status: 'active', orderId: 'so-1', customerId: 'cust-1', customerName: 'PT ADHI', title: 'Swing gate & parkir', siteName: 'OIKN', picUserId: 'pm' } as TProjectSelect;
	basts = [];
	certificates = [];
	numbers = [];
	profileTexts = { warrantyCoverage: null };
	registered = [];
	voided = [];
	units = new Map();
	productMonths = new Map();
	const numbering = {
		// The project numbering service is `next(type, tx, date, context)`.
		async next(type: string, _tx?: unknown, _date?: unknown, context?: unknown) {
			numbers.push({ type, context });
			return `${String(numbers.length).padStart(3, '0')}/${type}`;
		},
	};
	handover = new HandoverService(
		{
			list: async () => basts,
			paginate: async () => ({ meta: { page: 1, limit: 20, total: basts.length, totalPages: 1 }, data: [] }),
			find: async (projectId, id) => basts.find((row) => row.id === id && row.projectId === projectId) ?? null,
			async create(projectId, code, actor, data) {
				const row = { ...data, id: crypto.randomUUID(), projectId, code, status: 'issued', createdBy: actor } as THandoverSelect;
				basts.push(row);
				return row;
			},
			async update(id, data) {
				const row = basts.find((bast) => bast.id === id && bast.status === 'issued');
				return row ? Object.assign(row, data) : null;
			},
			async cancel(id) {
				const row = basts.find((bast) => bast.id === id && bast.status === 'issued');
				return row ? Object.assign(row, { status: 'cancelled' }) : null;
			},
		},
		{ require: async () => project },
		{
			getOrder: async () => ({ attention: 'Pak Aris', customerPoNumber: 'PO-77' }) as never,
			orderLines: async () => [{ name: 'Swing Gate', quantity: '2.000', unit: 'unit' }] as never,
		},
		{ get: async () => ({ legalName: 'CV Inti Multi Solusi', ...profileTexts }) as never },
		{ getUser: async () => ({ id: 'pm', name: 'Agus Supriyadi' }) as never },
		numbering as never,
		{
			// ERP-0044: registry side effects are asserted through `registered` / `voided`.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
			voidBySource: async (module, sourceType, sourceId) => {
				voided.push(`${module}/${sourceType}/${sourceId}`);
				return 1;
			},
		},
	);
	warranty = new WarrantyService(
		{
			findByProject: async (projectId) => certificates.find((row) => row.projectId === projectId) ?? null,
			listByCustomer: async (customerId) => certificates.filter((row) => row.customerId === customerId),
			async create(code, actor, data) {
				const row = { ...data, id: crypto.randomUUID(), code, createdBy: actor } as TWarrantySelect;
				certificates.push(row);
				return row;
			},
			async update(id, data) {
				return Object.assign(certificates.find((row) => row.id === id)!, data);
			},
			paginate: async () => {
				throw new Error('not used in this suite');
			},
		},
		handover,
		{
			shippedLines: async () =>
				[
					{ orderItemId: 'l1', name: 'Swing Gate', unit: 'unit', quantity: '1.000', serialNumbers: ['SG-1'] },
					{ orderItemId: 'l1', name: 'Swing Gate', unit: 'unit', quantity: '1.000', serialNumbers: ['SG-2'] },
				] as never,
			orderLines: async () => [] as never,
			findShipmentBySerial: async (serial: string) => {
				if (serial.startsWith('SG-')) return { orderId: 'so-1', customerId: 'cust-1', description: 'Swing Gate', deliveryNoteCode: 'SJ-1', shippedAt: new Date() };
				// B-30: a plain sales order (no project), shipped on 10 March 2026 (Jakarta).
				if (serial.startsWith('RD-')) return { orderId: 'so-plain', customerId: 'cust-2', description: 'Card reader', deliveryNoteCode: 'SJ-9', shippedAt: new Date('2026-03-10T05:00:00Z') };
				return null;
			},
		},
		{ getSnapshot: async () => ({ code: 'app' }) as never },
		{ get: async () => ({ ...profileTexts }) as never },
		numbering as never,
		{
			liveProjectOfOrder: async (orderId: string) => (orderId === project.orderId ? project : null),
			getProject: async (id: string) => (id === PROJECT ? project : null),
		},
		{
			// ERP-0044: an issued certificate is registered.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
		},
		undefined,
		{ serialWarranty: async (serial: string) => units.get(serial) ?? null },
		{
			productsById: async (ids: string[]) =>
				new Map(ids.map((id) => [id, { warrantyMonths: productMonths.get(id) ?? null }])) as never,
		},
	);
});

describe('warranty period', () => {
	test('the day before the same date months later, clamped to the month end', () => {
		expect(warrantyEndDate('2025-12-24', 12)).toBe('2026-12-23');
		expect(warrantyEndDate('2026-01-31', 1)).toBe('2026-02-27');
		expect(customerNumberCode('a-p.p')).toBe('APP');
		expect(customerNumberCode(null)).toBe('CUS');
	});
});

describe('BAST', () => {
	test('several per project, numbered on creation, prefilled from the order', async () => {
		const draft = await handover.draft(ctx, PROJECT);
		expect(draft).toMatchObject({ firstPartyName: 'Pak Aris', secondPartyName: 'Agus Supriyadi', contractNumber: 'PO-77', secondPartyCompany: 'CV Inti Multi Solusi' });
		expect(draft.items[0]).toMatchObject({ description: 'Swing Gate', volume: '2 unit' });
		const first = await handover.create(ctx, PROJECT, bastBody());
		const second = await handover.create(ctx, PROJECT, { ...bastBody(), contractNumber: '015-11/DIR-SPP/2025' });
		expect([first.code, second.code]).toEqual(['001/bast', '002/bast']);
		await handover.update(ctx, PROJECT, first.id, { ...bastBody(), firstPartyTitle: 'Manager' });
		expect(first.code).toBe('001/bast');
		await handover.cancel(ctx, PROJECT, second.id);
		// ERP-0044: every BAST is registered on create, and cancelling voids it.
		expect(registered.filter((row) => row.documentType === 'bast').map((row) => row.code)).toEqual(['001/bast', '002/bast']);
		expect(voided).toEqual([`projects/bast/${second.id}`]);
		await expect(handover.update(ctx, PROJECT, second.id, bastBody())).rejects.toBeInstanceOf(BastNotFoundError);
		project.status = 'closed';
		await expect(handover.create(ctx, PROJECT, bastBody())).rejects.toBeInstanceOf(ProjectNotActiveError);
	});
});

describe('warranty certificate', () => {
	test('needs an issued BAST; starts at its date; numbered with the customer code; serials listed', async () => {
		const draft = await warranty.draft(ctx, PROJECT);
		expect(draft.items).toEqual([{ description: 'Swing Gate', volume: '2 unit', remarks: 'SN: SG-1, SG-2' }]);
		expect(draft.exclusions).toBe(DEFAULT_WARRANTY_EXCLUSIONS);
		const body = { ...draft, handoverId: crypto.randomUUID() };
		await expect(warranty.save(ctx, PROJECT, body)).rejects.toBeInstanceOf(WarrantyBastRequiredError);
		const bast = await handover.create(ctx, PROJECT, bastBody('2025-12-24'));
		const certificate = await warranty.save(ctx, PROJECT, { ...body, handoverId: bast.id });
		expect(certificate).toMatchObject({ startDate: '2025-12-24', endDate: '2026-12-23', months: 12 });
		expect(numbers[numbers.length - 1]).toMatchObject({ type: 'warranty', context: { customer: 'APP' } });
		// ERP-0044: the certificate is registered once, on create.
		expect(registered.filter((row) => row.documentType === 'warranty')).toEqual([
			expect.objectContaining({ code: certificate.code, sourceId: certificate.id }),
		]);
		// Saving again updates the same certificate (still editable after closing).
		project.status = 'closed';
		const again = await warranty.save(ctx, PROJECT, { ...body, handoverId: bast.id, months: 24 });
		expect(again).toMatchObject({ id: certificate.id, code: certificate.code, endDate: '2027-12-23' });
		project.status = 'cancelled';
		await expect(warranty.save(ctx, PROJECT, { ...body, handoverId: bast.id })).rejects.toBeInstanceOf(WarrantyProjectCancelledError);
	});

	test('the company profile texts replace the defaults', async () => {
		profileTexts.warrantyCoverage = 'Cacat pabrik\no Termasuk modul';
		expect((await warranty.draft(ctx, PROJECT)).coverage).toBe('Cacat pabrik\no Termasuk modul');
	});
});

describe('warranty check', () => {
	test('serial → shipment → project → certificate; in warranty up to the end date', async () => {
		const bast = await handover.create(ctx, PROJECT, bastBody('2025-12-24'));
		const draft = await warranty.draft(ctx, PROJECT);
		await warranty.save(ctx, PROJECT, { ...draft, handoverId: bast.id });
		expect(await warranty.check({ serialNumber: 'SG-1' }, '2026-12-23')).toMatchObject({
			customerId: 'cust-1',
			projectId: PROJECT,
			deviceDescription: 'Swing Gate',
			inWarranty: true,
			warrantyEndsOn: '2026-12-23',
		});
		expect((await warranty.check({ serialNumber: 'SG-1' }, '2026-12-24')).inWarranty).toBe(false);
		expect(await warranty.check({ serialNumber: 'XX-9' }, '2026-01-01')).toMatchObject({ projectId: null, inWarranty: false });
		expect((await warranty.check({ projectId: PROJECT }, '2026-06-01')).inWarranty).toBe(true);
	});

	test('B-30: a serial sold on an order without a project: delivery date + product months', async () => {
		units.set('RD-1', { productId: 'reader', warrantyExpiresOn: null });
		productMonths.set('reader', 12);
		expect(await warranty.check({ serialNumber: 'RD-1' }, '2027-03-09')).toMatchObject({
			customerId: 'cust-2',
			projectId: null,
			deviceDescription: 'Card reader',
			inWarranty: true,
			warrantyEndsOn: '2027-03-09',
			warrantyCode: null,
			warrantySource: 'product',
			serialKnown: true,
		});
		expect(await warranty.check({ serialNumber: 'RD-1' }, '2027-03-10')).toMatchObject({ inWarranty: false, warrantyEndsOn: '2027-03-09' });
		// A product without a standard warranty gives none.
		productMonths.set('reader', null);
		expect(await warranty.check({ serialNumber: 'RD-1' }, '2026-04-01')).toMatchObject({ inWarranty: false, warrantySource: null, serialKnown: true });
	});

	test("B-30: the unit's own warranty date wins over the product months", async () => {
		units.set('RD-2', { productId: 'reader', warrantyExpiresOn: '2026-09-30' });
		productMonths.set('reader', 24);
		expect(await warranty.check({ serialNumber: 'RD-2' }, '2026-09-30')).toMatchObject({ inWarranty: true, warrantyEndsOn: '2026-09-30', warrantySource: 'serial' });
		expect((await warranty.check({ serialNumber: 'RD-2' }, '2026-10-01')).inWarranty).toBe(false);
	});

	test('B-30: a project sale without a certificate does not fall back to the product months', async () => {
		units.set('SG-1', { productId: 'gate', warrantyExpiresOn: null });
		productMonths.set('gate', 12);
		expect(await warranty.check({ serialNumber: 'SG-1' }, '2026-06-01')).toMatchObject({ projectId: PROJECT, inWarranty: false, warrantySource: null });
	});

	test('B-30 (FU10): an unknown serial is out of warranty and flagged unknown', async () => {
		expect(await warranty.check({ serialNumber: 'XX-404' }, '2026-06-01')).toMatchObject({
			customerId: null,
			inWarranty: false,
			warrantyEndsOn: null,
			warrantySource: null,
			serialKnown: false,
		});
		// A serial registered in stock but never shipped is known, still out of warranty.
		units.set('ST-1', { productId: 'reader', warrantyExpiresOn: null });
		expect(await warranty.check({ serialNumber: 'ST-1' }, '2026-06-01')).toMatchObject({ inWarranty: false, serialKnown: true });
	});
});


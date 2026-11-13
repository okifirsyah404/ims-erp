/**
 * BAST and warranty certificate (M07, ADR-0011 step 6b): several BASTs per
 * project, numbered on creation, frozen once the project is no longer
 * active; one warranty per project starting at an issued BAST's date, ending
 * the day before the same date `months` later, numbered with the customer
 * code; texts from the profile or the sample's defaults; serials in the items.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TWarrantyCertificateSelect } from '@drizzle/schemas/aftersales.schema';
import type { TProjectHandoverSelect, TProjectSelect } from '@drizzle/schemas/projects.schema';
import { WarrantyBastRequiredError, WarrantyProjectCancelledError } from '../../src/app/aftersales/errors/warranty.errors';
import { WarrantyService } from '../../src/app/aftersales/services/warranty.service';
import { DEFAULT_WARRANTY_EXCLUSIONS, customerNumberCode, warrantyEndDate } from '../../src/app/aftersales/utils/warranty';
import { BastNotFoundError, ProjectNotActiveError } from '../../src/app/projects/errors/project.errors';
import { HandoverService } from '../../src/app/projects/services/handover.service';
import type { TProjectContext } from '../../src/app/projects/services/project.service';

const ctx: TProjectContext = { organizationId: 'org', actorUserId: 'pm', canViewAll: true, canSeeCost: true, canAssignTasks: true, canManage: true };
const PROJECT = '0190a1b2-0000-7000-8000-00000000b001';

let project: TProjectSelect;
let basts: TProjectHandoverSelect[];
let certificates: TWarrantyCertificateSelect[];
let numbers: { type: string; context?: unknown }[];
let handover: HandoverService;
let warranty: WarrantyService;
let profileTexts: { warrantyCoverage: string | null };
/** Registry calls made by the two services (ERP-0044). */
let registered: { code: string; sourceId: string; documentType: string }[];
let voided: string[];

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
	project = { id: PROJECT, status: 'active', salesOrderId: 'so-1', customerId: 'cust-1', customerName: 'PT ADHI', title: 'Swing gate & parkir', siteName: 'OIKN', picUserId: 'pm' } as TProjectSelect;
	basts = [];
	certificates = [];
	numbers = [];
	profileTexts = { warrantyCoverage: null };
	registered = [];
	voided = [];
	const numbering = {
		async next(type: string, options?: { context?: unknown }) {
			numbers.push({ type, context: options?.context });
			return `${String(numbers.length).padStart(3, '0')}/${type}`;
		},
	};
	handover = new HandoverService(
		{
			list: async () => basts,
			paginateAll: async () => ({ meta: { page: 1, limit: 20, total: basts.length, totalPages: 1 }, data: [] }),
			find: async (projectId, id) => basts.find((row) => row.id === id && row.projectId === projectId) ?? null,
			async create(projectId, code, actor, data) {
				const row = { ...data, id: crypto.randomUUID(), projectId, code, status: 'issued', createdBy: actor } as TProjectHandoverSelect;
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
		numbering,
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
			async create(code, actor, data) {
				const row = { ...data, id: crypto.randomUUID(), code, createdBy: actor } as TWarrantyCertificateSelect;
				certificates.push(row);
				return row;
			},
			async update(id, data) {
				return Object.assign(certificates.find((row) => row.id === id)!, data);
			},
		},
		handover,
		{
			shippedLines: async () =>
				[
					{ salesOrderItemId: 'l1', name: 'Swing Gate', unit: 'unit', quantity: '1.000', serialNumbers: ['SG-1'] },
					{ salesOrderItemId: 'l1', name: 'Swing Gate', unit: 'unit', quantity: '1.000', serialNumbers: ['SG-2'] },
				] as never,
			orderLines: async () => [] as never,
			findShipmentBySerial: async (serial: string) =>
				serial.startsWith('SG-') ? { salesOrderId: 'so-1', customerId: 'cust-1', description: 'Swing Gate', deliveryNoteCode: 'SJ-1', shippedAt: new Date() } : null,
		},
		{ get: async () => ({ code: 'app' }) as never },
		{ get: async () => ({ ...profileTexts }) as never },
		numbering,
		{
			liveProjectOfOrder: async (orderId: string) => (orderId === project.salesOrderId ? project : null),
			getProject: async (id: string) => (id === PROJECT ? project : null),
		},
		{
			// ERP-0044: an issued certificate is registered.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
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
		const body = { ...draft, bastId: crypto.randomUUID() };
		await expect(warranty.save(ctx, PROJECT, body)).rejects.toBeInstanceOf(WarrantyBastRequiredError);
		const bast = await handover.create(ctx, PROJECT, bastBody('2025-12-24'));
		const certificate = await warranty.save(ctx, PROJECT, { ...body, bastId: bast.id });
		expect(certificate).toMatchObject({ startDate: '2025-12-24', endDate: '2026-12-23', months: 12 });
		expect(numbers[numbers.length - 1]).toEqual({ type: 'warranty', context: { customer: 'APP' } });
		// ERP-0044: the certificate is registered once, on create.
		expect(registered.filter((row) => row.documentType === 'warranty')).toEqual([
			expect.objectContaining({ code: certificate.code, sourceId: certificate.id }),
		]);
		// Saving again updates the same certificate (still editable after closing).
		project.status = 'closed';
		const again = await warranty.save(ctx, PROJECT, { ...body, bastId: bast.id, months: 24 });
		expect(again).toMatchObject({ id: certificate.id, code: certificate.code, endDate: '2027-12-23' });
		project.status = 'cancelled';
		await expect(warranty.save(ctx, PROJECT, { ...body, bastId: bast.id })).rejects.toBeInstanceOf(WarrantyProjectCancelledError);
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
		await warranty.save(ctx, PROJECT, { ...draft, bastId: bast.id });
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
});


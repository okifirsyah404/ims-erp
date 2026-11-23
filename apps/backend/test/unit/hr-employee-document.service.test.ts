/**
 * ERP-0121 employee documents: one live employment agreement per employee
 * (opened on invite, reused, re-opened after a void), other types as drafts,
 * documents of another employee or outside the ERP-0034 scope not found, the
 * PDF queued after the claim and on "regenerate"; the claim adapter stores
 * the personal data (village checked first) and never throws after the
 * claim; the render data needs a valid render token.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TSourceDocument } from '../../src/app/document/contracts/document.contract';
import type { TDocumentSelect } from '@drizzle/schemas/document.schema';
import type { TEmployeeAddressSelect, TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import { createRenderToken } from '@providers/pdf/render-token';
import { InvitationClaimAdapter } from '../../src/app/human-resource/adapters/invitation-claim';
import type { THrScope } from '../../src/app/human-resource/contracts/hr-records.contract';
import { EmployeeDocumentError, HrNotFoundError } from '../../src/app/human-resource/errors/hr.errors';
import { AGREEMENT_RENDER_KIND, AgreementPdfService } from '../../src/app/human-resource/services/agreement-pdf.service';
import { EmployeeDocumentService } from '../../src/app/human-resource/services/employee-document.service';
import { HrPeopleService } from '../../src/app/human-resource/services/people.service';

const E1 = '0190a1b2-0000-7000-8000-0000000000e1';
const E2 = '0190a1b2-0000-7000-8000-0000000000e2';
const E3 = '0190a1b2-0000-7000-8000-0000000000e3';
const VILLAGE = '0190a1b2-0000-7000-8000-0000000000aa';
const scope: THrScope = { organizationId: 'org-sales', all: false };

let staff: TEmployeeSelect[];
let docs: TDocumentSelect[];
let queued: string[];

const person = (id: string, organizationId: string | null, extra: Partial<TEmployeeSelect> = {}) =>
	({ id, organizationId, fullName: `Person ${id.slice(-2)}`, employmentStatus: 'active', userId: `user-${id.slice(-2)}`, ...extra }) as TEmployeeSelect;

const documents = {
	createDraft: async (input: { documentType: string; title: string; sourceId: string; organizationId: string | null }) => {
		const row = { ...input, id: crypto.randomUUID(), code: `DOC-${docs.length + 1}`, status: 'draft', module: 'human_resource', sourceType: 'employee' } as unknown as TDocumentSelect;
		docs.push(row);
		return row;
	},
	listBySource: async (_module: string, _type: string, sourceId: string) =>
		docs.filter((row) => row.sourceId === sourceId).map((row) => ({ ...row, files: [] }) as TSourceDocument),
	find: async (id: string) => docs.find((row) => row.id === id) ?? null,
	uploadFile: async () => ({ id: 'file-1' }) as never,
	downloadFile: async () => ({ url: 'https://example.test/file', fileName: 'a.pdf', mimeType: 'application/pdf' }),
	void: async (id: string) => {
		const row = docs.find((item) => item.id === id)!;
		row.status = 'void';
		return row;
	},
};

const people = new HrPeopleService({
	findVisible: async (id, scoped) =>
		staff.find((row) => row.id === id && (scoped.all || row.organizationId === null || row.organizationId === scoped.organizationId)) ?? null,
	listVisible: async () => staff,
	findByCodes: async () => [],
});

const service = () => new EmployeeDocumentService(documents as never, people, { enqueue: async (id) => void queued.push(id) });

beforeEach(() => {
	staff = [person(E1, 'org-sales'), person(E2, null), person(E3, 'org-other')];
	docs = [];
	queued = [];
});

describe('employee documents', () => {
	test('one live agreement: opened once, reused, re-opened after a void', async () => {
		const first = await service().ensureAgreement(staff[0]!);
		expect(first).toMatchObject({ documentType: 'employment_agreement', title: 'Perjanjian Kerja - Person e1', status: 'draft', organizationId: 'org-sales' });
		expect((await service().ensureAgreement(staff[0]!)).id).toBe(first.id);
		await service().void(scope, E1, first.id, 'hr');
		const second = await service().ensureAgreement(staff[0]!);
		expect(second.id).not.toBe(first.id);
	});

	test('other types are drafts with a default title; an agreement added by hand queues its PDF', async () => {
		const ktp = await service().create(scope, E2, { documentType: 'id_card', title: null });
		expect(ktp).toMatchObject({ documentType: 'id_card', title: 'KTP - Person e2', organizationId: null });
		expect(queued).toEqual([]);
		const agreement = await service().create(scope, E2, { documentType: 'employment_agreement', title: null });
		expect(queued).toEqual([agreement.id]);
		expect((await service().list(scope, E2)).map((row) => row.documentType).sort()).toEqual(['employment_agreement', 'id_card']);
	});

	test('documents of another employee, or of an employee outside the scope, are not found', async () => {
		const ktp = await service().create(scope, E1, { documentType: 'id_card', title: 'KTP' });
		await expect(service().void(scope, E2, ktp.id, 'hr')).rejects.toBeInstanceOf(HrNotFoundError);
		await expect(service().list(scope, E3)).rejects.toBeInstanceOf(HrNotFoundError);
		await expect(service().regeneratePdf(scope, E1, ktp.id)).rejects.toBeInstanceOf(EmployeeDocumentError);
		expect(await service().download(scope, E1, ktp.id, 'file-1', 'hr')).toMatchObject({ fileName: 'a.pdf' });
	});

	test('the PDF is queued after the claim only when the employee has an agreement', async () => {
		await service().queueAgreementPdf(E1);
		expect(queued).toEqual([]);
		const agreement = await service().ensureAgreement(staff[0]!);
		await service().queueAgreementPdf(E1);
		expect(queued).toEqual([agreement.id]);
	});
});

describe('claim adapter', () => {
	test('stores user fields, NIK and the residence address; an unknown village writes nothing', async () => {
		const writes: string[] = [];
		const adapter = new InvitationClaimAdapter(
			{
				findByUserId: async (userId) => staff.find((row) => row.userId === userId) ?? null,
				update: async (id, data) => {
					writes.push(`employee:${id}:${data.nationalId}`);
					return null;
				},
			},
			{
				savePrimaryResidence: async (employeeId, input) => {
					writes.push(`address:${employeeId}:${input.villageId}`);
					return {} as TEmployeeAddressSelect;
				},
			},
			{
				get: async () => null,
				update: async (userId, patch) => {
					writes.push(`user:${userId}:${patch.gender}:${patch.birthDate?.toISOString()}`);
				},
			},
			{
				assertVillage: async (id) => {
					if (id !== VILLAGE) throw new Error('village not found');
					return {} as never;
				},
			},
			{ queueAgreementPdf: async (employeeId) => void queued.push(employeeId) },
		);
		const data = {
			nationalId: '3201234567890123',
			birthPlace: 'Bandung',
			birthDate: '1995-04-12',
			gender: 'female' as const,
			maritalStatus: null,
			address: { addressLine: 'Jl. Merdeka 1', villageId: VILLAGE, postalCode: '40111' },
		};
		await expect(adapter.recordPersonalData('user-e1', { ...data, address: { ...data.address, villageId: crypto.randomUUID() } })).rejects.toThrow();
		expect(writes).toEqual([]);

		await adapter.recordPersonalData('user-e1', data);
		expect(writes).toEqual([`user:user-e1:female:1995-04-11T17:00:00.000Z`, `employee:${E1}:3201234567890123`, `address:${E1}:${VILLAGE}`]);

		await adapter.afterClaim('user-e1');
		await adapter.afterClaim('nobody');
		expect(queued).toEqual([E1]);
	});
});

describe('agreement render data', () => {
	test('a valid render token is required; the data carries no salary', async () => {
		const agreement = await service().ensureAgreement(staff[0]!);
		const pdf = new AgreementPdfService(
			{ find: documents.find, attachGeneratedFileTo: async () => true },
			{ findById: async (id) => ({ ...staff.find((row) => row.id === id)!, employeeCode: 'EMP-0001', nationalId: '3201', employmentType: 'permanent', workType: 'onsite', hireDate: null, legalName: null, email: null, phone: null }) },
			{ findPrimary: async () => null },
			{ get: async () => ({ gender: 'male', birthDate: null, birthPlace: 'Bogor', maritalStatus: 'single' }), update: async () => undefined },
			{ resolveVillagePath: async () => [] },
			{ get: async () => null },
			{ configured: false, render: async () => new Uint8Array() },
		);
		expect(await pdf.renderData(agreement.id, 'bad-token')).toBeNull();
		expect(await pdf.renderData(agreement.id, createRenderToken('quotation', agreement.id))).toBeNull();
		const data = await pdf.renderData(agreement.id, createRenderToken(AGREEMENT_RENDER_KIND, agreement.id));
		expect(data?.employee).toMatchObject({ employeeCode: 'EMP-0001', fullName: 'Person e1', birthPlace: 'Bogor', gender: 'male' });
		expect(JSON.stringify(data)).not.toMatch(/salary/i);
		expect(await pdf.render(agreement.id)).toBe('skipped');
	});
});

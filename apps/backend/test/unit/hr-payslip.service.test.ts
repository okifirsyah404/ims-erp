/**
 * ERP-0122 payslips: approving a period queues one job per newly approved
 * record; a job registers one `issued` payslip and is idempotent; without
 * Chromium it stops at `skipped`; downloads need the PDF and the ERP-0034
 * scope; the ZIP bundles the ready ones; an employee sees and downloads only
 * their own; the print data masks the account and needs a valid token; the
 * primary payee account comes from the finance facade.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import JSZip from 'jszip';
import type { TSourceDocument } from '../../src/app/document/contracts/document.contract';
import type { TDocumentSelect } from '@drizzle/schemas/document.schema';
import type { TEmployeeSalaryRecordSelect, TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import type { TCashBankAccountSelect } from '@drizzle/schemas/finance.schema';
import { createRenderToken } from '@providers/pdf/render-token';
import { ExportedFinanceService } from '../../src/app/finance/services/exported-finance.service';
import type { THrScope } from '../../src/app/human-resource/contracts/hr-records.contract';
import { HrNotFoundError, PayslipError } from '../../src/app/human-resource/errors/hr.errors';
import { HrPeopleService } from '../../src/app/human-resource/services/people.service';
import { PAYSLIP_RENDER_KIND, PayslipService } from '../../src/app/human-resource/services/payslip.service';

const E1 = '0190a1b2-0000-7000-8000-0000000000e1';
const E3 = '0190a1b2-0000-7000-8000-0000000000e3';
const scope: THrScope = { organizationId: 'org-sales', all: false };

let staff: TEmployeeSelect[];
let records: TEmployeeSalaryRecordSelect[];
let docs: TSourceDocument[];
let queued: string[];
let notices: { userIds: string[]; sourceId?: string }[];
let configured: boolean;

const record = (id: string, employeeId: string, extra: Partial<TEmployeeSalaryRecordSelect> = {}) =>
	({
		id,
		employeeId,
		employeeName: `Person ${employeeId.slice(-2)}`,
		period: '2026-11',
		status: 'approved',
		baseSalary: 5_000_000_00,
		allowances: 500_000_00,
		overtimePay: 0,
		bonus: 0,
		deductions: 100_000_00,
		netPay: 5_400_000_00,
		notes: null,
		approvedBy: 'owner-1',
		approvedAt: new Date('2026-11-25T03:00:00Z'),
		...extra,
	}) as TEmployeeSalaryRecordSelect;

const documents = {
	issueForSource: async (input: { documentType: string; title: string; sourceType: string; sourceId: string; organizationId: string | null }) => {
		const row = { ...input, id: crypto.randomUUID(), code: `DOC-${docs.length + 1}`, status: 'issued', module: 'human_resource', files: [] } as unknown as TSourceDocument;
		docs.push(row);
		return row as unknown as TDocumentSelect;
	},
	listBySource: async (_module: string, _type: string, sourceId: string) => docs.filter((row) => row.sourceId === sourceId),
	find: async (id: string) => (docs.find((row) => row.id === id) as unknown as TDocumentSelect) ?? null,
	attachGeneratedFileTo: async (id: string, file: File) => {
		const row = docs.find((item) => item.id === id);
		row?.files.push({ id: crypto.randomUUID(), fileName: file.name } as never);
		return !!row;
	},
	downloadFile: async (_id: string, fileId: string) => ({ url: `https://files.test/${fileId}`, fileName: 'slip.pdf', mimeType: 'application/pdf' }),
	readFile: async (_id: string, fileId: string) => ({ fileName: `${fileId}.pdf`, bytes: new Uint8Array([37, 80, 68, 70]) }),
};

const people = new HrPeopleService({
	findVisible: async (id, scoped) => staff.find((row) => row.id === id && (row.organizationId === null || row.organizationId === scoped.organizationId)) ?? null,
	listVisible: async () => staff,
	findByCodes: async () => [],
});

const service = () =>
	new PayslipService(
		{
			findById: async (id) => records.find((row) => row.id === id) ?? null,
			listPeriod: async (period) => records.filter((row) => row.period === period),
			listApprovedForEmployee: async (employeeId) => records.filter((row) => row.employeeId === employeeId && row.status === 'approved'),
		},
		{
			findById: async (id) => staff.find((row) => row.id === id) ?? null,
			findByUserId: async (userId) => staff.find((row) => row.userId === userId) ?? null,
		},
		people,
		documents as never,
		{ findPrimaryEmployeeBankAccount: async () => ({ accountType: 'bank', bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Person e1' }) },
		{ summary: async () => ({ name: 'Owner Satu' }) as never },
		{ get: async () => null },
		{
			get configured() {
				return configured;
			},
			render: async () => new Uint8Array([37, 80, 68, 70]),
		},
		{ notify: async (input) => void notices.push(input) },
		{ enqueue: async (id) => void queued.push(id) },
	);

beforeEach(() => {
	staff = [
		{ id: E1, organizationId: 'org-sales', userId: 'user-e1', employeeCode: 'EMP-0001', employmentType: 'permanent', legalName: null } as TEmployeeSelect,
		{ id: E3, organizationId: 'org-other', userId: null, employeeCode: 'EMP-0003', employmentType: 'contract', legalName: null } as TEmployeeSelect,
	];
	records = [record('r1', E1), record('r3', E3), record('d1', E1, { status: 'draft', period: '2026-12' })];
	docs = [];
	queued = [];
	notices = [];
	configured = true;
});

describe('payslip render job', () => {
	test('one issued payslip per approved record; idempotent; the employee is told once', async () => {
		expect(await service().render('r1')).toBe('attached');
		expect(docs).toHaveLength(1);
		expect(docs[0]).toMatchObject({ documentType: 'payslip', status: 'issued', sourceType: 'employee_salary_record', sourceId: 'r1', title: 'Slip Gaji Person e1 - 2026-11' });
		expect(notices).toEqual([expect.objectContaining({ userIds: ['user-e1'], sourceId: docs[0]!.id })]);
		expect(await service().render('r1')).toBe('exists');
		expect(docs).toHaveLength(1);
		expect(notices).toHaveLength(1);
		// No login: no notice, still a payslip.
		expect(await service().render('r3')).toBe('attached');
		expect(notices).toHaveLength(1);
		// A draft has no payslip.
		expect(await service().render('d1')).toBe('missing');
	});

	test('without Chromium the payslip is registered and the job stops at skipped', async () => {
		configured = false;
		expect(await service().render('r1')).toBe('skipped');
		expect(docs).toHaveLength(1);
		expect(docs[0]!.files).toHaveLength(0);
		await expect(service().download(scope, 'r1', 'hr')).rejects.toBeInstanceOf(PayslipError);
	});
});

describe('payslip downloads', () => {
	test('payroll readers: one (scoped), all as ZIP; regenerate only for approved records', async () => {
		await service().render('r1');
		await service().render('r3');
		expect(await service().download(scope, 'r1', 'hr')).toMatchObject({ fileName: 'slip.pdf' });
		await expect(service().download(scope, 'r3', 'hr')).rejects.toBeInstanceOf(HrNotFoundError);
		const zip = await JSZip.loadAsync(await service().zip(scope, '2026-11', 'hr'));
		expect(Object.keys(zip.files)).toHaveLength(2);
		await expect(service().zip(scope, '2027-01', 'hr')).rejects.toMatchObject({ key: 'hr.payslip.notReady' });
		expect(await service().regenerate(scope, 'r1')).toEqual({ queued: true });
		expect(queued).toEqual(['r1']);
		await expect(service().regenerate(scope, 'd1')).rejects.toMatchObject({ key: 'hr.payslip.notApproved' });
	});

	test('self-service: only the own approved records, ready flag, others are not found', async () => {
		await service().render('r1');
		expect(await service().mine('user-e1')).toEqual([{ recordId: 'r1', period: '2026-11', netPay: 5_400_000_00, ready: true }]);
		expect(await service().mine('nobody')).toEqual([]);
		expect(await service().downloadMine('user-e1', 'r1')).toMatchObject({ fileName: 'slip.pdf' });
		await expect(service().downloadMine('user-e1', 'r3')).rejects.toBeInstanceOf(HrNotFoundError);
		await expect(service().downloadMine('user-e1', 'd1')).rejects.toBeInstanceOf(HrNotFoundError);
	});
});

describe('payslip print data', () => {
	test('needs a payslip render token; masks the payee account; names the approver', async () => {
		await service().render('r1');
		const id = docs[0]!.id;
		expect(await service().renderData(id, 'bad')).toBeNull();
		expect(await service().renderData(id, createRenderToken('employment-agreement', id))).toBeNull();
		const data = await service().renderData(id, createRenderToken(PAYSLIP_RENDER_KIND, id));
		expect(data?.payee).toEqual({ bankName: 'BCA', accountNumber: '••••••7890', accountHolder: 'Person e1' });
		expect(data?.record).toMatchObject({ period: '2026-11', netPay: 5_400_000_00, approvedByName: 'Owner Satu' });
		expect(data?.employee).toMatchObject({ employeeCode: 'EMP-0001', fullName: 'Person e1' });
	});
});

describe('finance facade', () => {
	test('the primary active payee account, or null', async () => {
		const rows = [
			{ employeeId: E1, isPrimary: false, isActive: true, bankName: 'BRI', accountNumber: '1', accountHolder: 'A', accountType: 'bank' },
			{ employeeId: E1, isPrimary: true, isActive: true, bankName: 'BCA', accountNumber: '2', accountHolder: 'A', accountType: 'bank' },
		] as TCashBankAccountSelect[];
		const facade = new ExportedFinanceService({ listForEmployee: async (employeeId) => rows.filter((row) => row.employeeId === employeeId) });
		expect(await facade.findPrimaryEmployeeBankAccount(E1)).toMatchObject({ bankName: 'BCA', accountNumber: '2' });
		expect(await facade.findPrimaryEmployeeBankAccount(E3)).toBeNull();
	});
});

/**
 * ERP-0119 employee payee accounts in finance.cash_bank_accounts: the first
 * account is primary, a new primary clears the old one, deleting the
 * primary hands the role over, the number is masked without
 * employee:read_private, employees outside the ERP-0034 scope are not found,
 * and codes come from the `employee_bank_account` series.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TCashBankAccountSelect } from '@drizzle/schemas/finance.schema';
import {
	employeeBankAccountBodySchema,
	employeeBankAccountCreateSchema,
	type IEmployeeBankAccountRepository,
	type TEmployeeBankAccountContext,
} from '../../src/app/finance/contracts/employee-bank-account.contract';
import { EmployeeBankAccountNotFoundError, EmployeeNotVisibleError } from '../../src/app/finance/errors/ledger.errors';
import { EmployeeBankAccountService, maskAccountNumber } from '../../src/app/finance/services/employee-bank-account.service';

const E1 = '0190a1b2-0000-7000-8000-0000000000e1';
const E2 = '0190a1b2-0000-7000-8000-0000000000e2';
const E3 = '0190a1b2-0000-7000-8000-0000000000e3';
const ctx: TEmployeeBankAccountContext = { organizationId: 'org-sales', actorUserId: 'hr', allOrganizations: false, canReadPrivate: true };

const employees: Record<string, { id: string; organizationId: string | null; employmentStatus: string }> = {
	[E1]: { id: E1, organizationId: 'org-sales', employmentStatus: 'active' },
	[E2]: { id: E2, organizationId: null, employmentStatus: 'active' },
	[E3]: { id: E3, organizationId: 'org-other', employmentStatus: 'active' },
};

let rows: TCashBankAccountSelect[];
let issued: string[];
let sequence: number;

const live = () => rows.filter((row) => !row.deletedAt);
const repository: IEmployeeBankAccountRepository = {
	listForEmployee: async (employeeId) =>
		live()
			.filter((row) => row.employeeId === employeeId)
			.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.createdAt.getTime() - a.createdAt.getTime()),
	findById: async (id) => live().find((row) => row.id === id && row.employeeId) ?? null,
	insert: async (row) => {
		const created = { ...row, id: crypto.randomUUID(), createdAt: new Date(Date.now() + sequence++), deletedAt: null } as TCashBankAccountSelect;
		rows.push(created);
		return created;
	},
	update: async (id, data) => {
		const row = live().find((item) => item.id === id);
		return row ? Object.assign(row, data) : null;
	},
	clearPrimary: async (employeeId) => {
		for (const row of live()) if (row.employeeId === employeeId) row.isPrimary = false;
	},
	softDelete: async (id) => {
		const row = live().find((item) => item.id === id);
		if (row) Object.assign(row, { deletedAt: new Date(), isPrimary: false });
		return !!row;
	},
};

const service = () =>
	new EmployeeBankAccountService(
		repository,
		{ findEmployeeById: async (id) => employees[id] ?? null },
		{
			next: async (codeType) => {
				issued.push(codeType);
				return `REK-${String(issued.length).padStart(4, '0')}`;
			},
		},
		{ run: (work) => work({} as never) },
	);

const account = (employeeId: string, extra: Record<string, unknown> = {}) =>
	employeeBankAccountCreateSchema.parse({ employeeId, bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Person', ...extra });

beforeEach(() => {
	rows = [];
	issued = [];
	sequence = 0;
});

describe('employee bank accounts', () => {
	test('the first account is primary; a new primary clears the old one; codes from the employee_bank_account series', async () => {
		const first = await service().create(ctx, account(E1));
		expect(first).toMatchObject({ isPrimary: true, code: 'REK-0001', accountNumber: '1234567890', masked: false });
		const second = await service().create(ctx, account(E1, { bankName: 'Mandiri', isPrimary: true }));
		expect(second.isPrimary).toBe(true);
		expect((await service().list(ctx, E1)).map((row) => [row.bankName, row.isPrimary])).toEqual([
			['Mandiri', true],
			['BCA', false],
		]);
		expect(issued).toEqual(['employee_bank_account', 'employee_bank_account']);
		// Stored as a payee row: never a balance, the employee's organization.
		expect(rows[0]).toMatchObject({ employeeId: E1, organizationId: 'org-sales', accountType: 'bank' });
	});

	test('unticking the primary keeps it; deleting it hands the role to the newest remaining account', async () => {
		const first = await service().create(ctx, account(E1));
		const second = await service().create(ctx, account(E1, { bankName: 'BRI' }));
		const kept = await service().update(ctx, first.id, employeeBankAccountBodySchema.parse({ bankName: 'BCA', accountNumber: '111', accountHolder: 'P', isPrimary: false }));
		expect(kept.isPrimary).toBe(true);
		expect(await service().remove(ctx, first.id)).toEqual({ removed: true });
		expect((await service().list(ctx, E1)).map((row) => [row.id, row.isPrimary])).toEqual([[second.id, true]]);
		await expect(service().remove(ctx, first.id)).rejects.toBeInstanceOf(EmployeeBankAccountNotFoundError);
	});

	test('masked without employee:read_private', async () => {
		await service().create(ctx, account(E2));
		expect((await service().list({ ...ctx, canReadPrivate: false }, E2))[0]).toMatchObject({ accountNumber: '••••••7890', masked: true });
		expect(maskAccountNumber('1234')).toBe('1234');
	});

	test('employees outside the scope are not found; an application admin sees them', async () => {
		await expect(service().create(ctx, account(E3))).rejects.toBeInstanceOf(EmployeeNotVisibleError);
		await expect(service().list(ctx, '0190a1b2-0000-7000-8000-0000000000ff')).rejects.toBeInstanceOf(EmployeeNotVisibleError);
		const admin = { ...ctx, allOrganizations: true };
		const created = await service().create(admin, account(E3));
		await expect(service().remove(ctx, created.id)).rejects.toBeInstanceOf(EmployeeBankAccountNotFoundError);
		expect(await service().remove(admin, created.id)).toEqual({ removed: true });
	});
});

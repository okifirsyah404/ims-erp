import type { TCashBankAccountSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { z } from 'zod';

/**
 * Employees' salary payee accounts (ERP-0119, grill-me Q23-Q26/Q29): rows of
 * `finance.cash_bank_accounts` with `employee_id` set. Never a balance, never
 * printed on invoices, one primary per employee.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

export const EMPLOYEE_ACCOUNT_TYPES = ['bank', 'ewallet'] as const;

export const employeeBankAccountBodySchema = z.object({
	accountType: z.enum(EMPLOYEE_ACCOUNT_TYPES).default('bank'),
	bankName: z.string().trim().min(1).max(100),
	bankCode: optionalText(20),
	accountNumber: z.string().trim().min(3).max(50).regex(/^[0-9 -]+$/, 'Digits only'),
	accountHolder: z.string().trim().min(1).max(200),
	isPrimary: z.boolean().default(false),
	isActive: z.boolean().default(true),
});

export const employeeBankAccountCreateSchema = employeeBankAccountBodySchema.extend({ employeeId: z.uuid() });
export const employeeBankAccountListQuerySchema = z.object({ employeeId: z.uuid() });
export const employeeBankAccountIdParamSchema = z.object({ id: z.uuid() });

export type TEmployeeBankAccountBody = z.output<typeof employeeBankAccountBodySchema>;
export type TEmployeeBankAccountCreate = z.output<typeof employeeBankAccountCreateSchema>;

/** What the caller may see of the employee: who, and whether the number is unmasked. */
export type TEmployeeBankAccountContext = {
	organizationId: string;
	actorUserId: string;
	/** Application admins see every employee (the ERP-0034 rule). */
	allOrganizations: boolean;
	/** `employee:read_private`: the account number unmasked. */
	canReadPrivate: boolean;
};

export type TEmployeeBankAccountView = Pick<
	TCashBankAccountSelect,
	'id' | 'code' | 'employeeId' | 'accountType' | 'bankName' | 'bankCode' | 'accountNumber' | 'accountHolder' | 'isPrimary' | 'isActive'
> & { masked: boolean };

type TWrite = {
	organizationId: string | null;
	employeeId: string;
	code: string;
	name: string;
	accountType: string;
	bankName: string;
	bankCode: string | null;
	accountNumber: string;
	accountHolder: string;
	isPrimary: boolean;
	isActive: boolean;
};

/** Persistence port of the employee rows of `finance.cash_bank_accounts`. */
export interface IEmployeeBankAccountRepository {
	/** Live accounts of an employee, primary first. */
	listForEmployee(employeeId: string, tx?: TTx): Promise<TCashBankAccountSelect[]>;
	/** A live employee account (never a company account). */
	findById(id: string): Promise<TCashBankAccountSelect | null>;
	insert(row: TWrite, tx?: TTx): Promise<TCashBankAccountSelect>;
	update(id: string, data: Partial<Omit<TWrite, 'employeeId' | 'code' | 'organizationId'>>, tx?: TTx): Promise<TCashBankAccountSelect | null>;
	/** Clears `is_primary` on every live account of the employee. */
	clearPrimary(employeeId: string, tx: TTx): Promise<void>;
	softDelete(id: string, tx?: TTx): Promise<boolean>;
}

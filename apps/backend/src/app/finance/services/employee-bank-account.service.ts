import { EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN } from '@app/human-resource/constants/di';
import type { ExportedEmployeeService } from '@app/human-resource/services/exported-employee.service';
import type { TCashBankAccountSelect } from '@drizzle/schemas/finance.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_BANK_ACCOUNT_REPOSITORY_TOKEN, FINANCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type {
	IEmployeeBankAccountRepository,
	TEmployeeBankAccountBody,
	TEmployeeBankAccountContext,
	TEmployeeBankAccountCreate,
	TEmployeeBankAccountView,
} from '../contracts/employee-bank-account.contract';
import { EmployeeBankAccountNotFoundError, EmployeeNotVisibleError } from '../errors/ledger.errors';
import type { FinanceNumberingService } from './finance-numbering.service';

/** Masks all but the last four digits (`••••••7890`). */
export function maskAccountNumber(value: string | null): string | null {
	if (!value) return value;
	const digits = value.replace(/\s/g, '');
	return digits.length <= 4 ? digits : `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/**
 * Employees' salary payee accounts in `finance.cash_bank_accounts`
 * (ERP-0119, grill-me Q23-Q26/Q29).
 *
 * @remarks
 * Finance owns the rows; the employee is validated through the Human
 * Resource module's repository-only facade (`ExportedEmployeeService`), with
 * the same visibility rule as the HR screens: company-level employees and
 * those of the caller's organization, or all for an application admin. The
 * first account of an employee becomes primary; making another primary
 * clears the old one in the same transaction. The number is masked without
 * `employee:read_private`.
 */
@injectable()
export class EmployeeBankAccountService {
	constructor(
		@inject(EMPLOYEE_BANK_ACCOUNT_REPOSITORY_TOKEN) private readonly repository: IEmployeeBankAccountRepository,
		@inject(EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN) private readonly employees: Pick<ExportedEmployeeService, 'findEmployeeById'>,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<FinanceNumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	private view(ctx: TEmployeeBankAccountContext, row: TCashBankAccountSelect): TEmployeeBankAccountView {
		return {
			id: row.id,
			code: row.code,
			employeeId: row.employeeId,
			accountType: row.accountType,
			bankName: row.bankName,
			bankCode: row.bankCode,
			accountNumber: ctx.canReadPrivate ? row.accountNumber : maskAccountNumber(row.accountNumber),
			accountHolder: row.accountHolder,
			isPrimary: row.isPrimary,
			isActive: row.isActive,
			masked: !ctx.canReadPrivate,
		};
	}

	/** The employee, if the caller sees it (404 otherwise, so ids are not probed). */
	private async requireEmployee(ctx: TEmployeeBankAccountContext, employeeId: string) {
		const employee = await this.employees.findEmployeeById(employeeId);
		const visible =
			!!employee && (ctx.allOrganizations || employee.organizationId === null || employee.organizationId === ctx.organizationId);
		if (!employee || !visible) throw new EmployeeNotVisibleError();
		return employee;
	}

	private async requireAccount(ctx: TEmployeeBankAccountContext, id: string): Promise<TCashBankAccountSelect> {
		const row = await this.repository.findById(id);
		if (!row?.employeeId) throw new EmployeeBankAccountNotFoundError();
		await this.requireEmployee(ctx, row.employeeId).catch(() => {
			throw new EmployeeBankAccountNotFoundError();
		});
		return row;
	}

	async list(ctx: TEmployeeBankAccountContext, employeeId: string): Promise<TEmployeeBankAccountView[]> {
		await this.requireEmployee(ctx, employeeId);
		return (await this.repository.listForEmployee(employeeId)).map((row) => this.view(ctx, row));
	}

	async create(ctx: TEmployeeBankAccountContext, body: TEmployeeBankAccountCreate): Promise<TEmployeeBankAccountView> {
		const employee = await this.requireEmployee(ctx, body.employeeId);
		const created = await this.transactions.run(async (tx) => {
			const existing = await this.repository.listForEmployee(body.employeeId, tx);
			// The first account is the primary one whatever the form says.
			const isPrimary = body.isPrimary || !existing.some((row) => row.isPrimary);
			if (isPrimary) await this.repository.clearPrimary(body.employeeId, tx);
			const code = await this.numbering.next('employee_bank_account', { tx, organizationId: employee.organizationId ?? undefined });
			return this.repository.insert(
				{
					organizationId: employee.organizationId,
					employeeId: body.employeeId,
					code,
					name: `${body.bankName} ${body.accountHolder}`,
					accountType: body.accountType,
					bankName: body.bankName,
					bankCode: body.bankCode,
					accountNumber: body.accountNumber,
					accountHolder: body.accountHolder,
					isPrimary,
					isActive: body.isActive,
				},
				tx,
			);
		});
		return this.view(ctx, created);
	}

	async update(ctx: TEmployeeBankAccountContext, id: string, body: TEmployeeBankAccountBody): Promise<TEmployeeBankAccountView> {
		const current = await this.requireAccount(ctx, id);
		const employeeId = current.employeeId!;
		const updated = await this.transactions.run(async (tx) => {
			if (body.isPrimary && !current.isPrimary) await this.repository.clearPrimary(employeeId, tx);
			return this.repository.update(
				id,
				{
					name: `${body.bankName} ${body.accountHolder}`,
					accountType: body.accountType,
					bankName: body.bankName,
					bankCode: body.bankCode,
					accountNumber: body.accountNumber,
					accountHolder: body.accountHolder,
					// Unticking the primary account leaves the employee without one; keep it.
					isPrimary: body.isPrimary || current.isPrimary,
					isActive: body.isActive,
				},
				tx,
			);
		});
		if (!updated) throw new EmployeeBankAccountNotFoundError();
		return this.view(ctx, updated);
	}

	/** Soft deletes; a deleted primary hands the role to the newest remaining account. */
	async remove(ctx: TEmployeeBankAccountContext, id: string): Promise<{ removed: true }> {
		const current = await this.requireAccount(ctx, id);
		const employeeId = current.employeeId!;
		const wasPrimary = current.isPrimary;
		await this.transactions.run(async (tx) => {
			if (!(await this.repository.softDelete(id, tx))) throw new EmployeeBankAccountNotFoundError();
			if (wasPrimary) {
				const [next] = await this.repository.listForEmployee(employeeId, tx);
				if (next) await this.repository.update(next.id, { isPrimary: true }, tx);
			}
		});
		return { removed: true };
	}
}

import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_BANK_ACCOUNT_REPOSITORY_TOKEN } from '../constants/di';
import type { IEmployeeBankAccountRepository } from '../contracts/employee-bank-account.contract';

/** The salary payee account another module may print (the payslip). */
export type TPrimaryEmployeeBankAccount = {
	accountType: string;
	bankName: string | null;
	accountNumber: string | null;
	accountHolder: string | null;
};

/**
 * Repository-only facade other modules use for finance facts (ERP-0122,
 * grill-me Q25).
 *
 * @remarks
 * Depends on finance repositories only, so the Human Resource module can read
 * it while finance validates employees through HR's own repository-only
 * facade: neither side builds a service-to-service cycle (`elysia-module`
 * rule 3.5). The account number is returned in full; the caller masks it for
 * whatever it prints.
 */
@injectable()
export class ExportedFinanceService {
	constructor(
		@inject(EMPLOYEE_BANK_ACCOUNT_REPOSITORY_TOKEN)
		private readonly employeeAccounts: Pick<IEmployeeBankAccountRepository, 'listForEmployee'>,
	) {}

	/** The live primary (and active) payee account of an employee, if any. */
	async findPrimaryEmployeeBankAccount(employeeId: string): Promise<TPrimaryEmployeeBankAccount | null> {
		const primary = (await this.employeeAccounts.listForEmployee(employeeId)).find((row) => row.isPrimary && row.isActive);
		if (!primary) return null;
		return {
			accountType: primary.accountType,
			bankName: primary.bankName,
			accountNumber: primary.accountNumber,
			accountHolder: primary.accountHolder,
		};
	}
}

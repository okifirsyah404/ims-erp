import { DRIZZLE_TOKEN } from '@di/provider';
import { cashBankAccounts } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IEmployeeBankAccountRepository } from '../contracts/employee-bank-account.contract';

/**
 * Drizzle queries of the employee rows of `finance.cash_bank_accounts`
 * (ERP-0119). Every query requires `employee_id IS NOT NULL`, so a company
 * account can never be read or written here.
 */
@injectable()
export class EmployeeBankAccountRepository implements IEmployeeBankAccountRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listForEmployee(employeeId: string, tx?: TTx) {
		return (tx ?? this.database)
			.select()
			.from(cashBankAccounts)
			.where(and(eq(cashBankAccounts.employeeId, employeeId), isNull(cashBankAccounts.deletedAt)))
			.orderBy(desc(cashBankAccounts.isPrimary), desc(cashBankAccounts.createdAt));
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(cashBankAccounts)
			.where(and(eq(cashBankAccounts.id, id), isNotNull(cashBankAccounts.employeeId), isNull(cashBankAccounts.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async insert(row: Parameters<IEmployeeBankAccountRepository['insert']>[0], tx?: TTx) {
		const now = new Date();
		const [created] = await (tx ?? this.database)
			.insert(cashBankAccounts)
			.values({ ...row, openingBalance: 0, currentBalance: 0, invoiceUsage: null, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async update(id: string, data: Parameters<IEmployeeBankAccountRepository['update']>[1], tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.update(cashBankAccounts)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(cashBankAccounts.id, id), isNotNull(cashBankAccounts.employeeId), isNull(cashBankAccounts.deletedAt)))
			.returning();
		return row ?? null;
	}

	async clearPrimary(employeeId: string, tx: TTx) {
		await tx
			.update(cashBankAccounts)
			.set({ isPrimary: false, updatedAt: new Date() })
			.where(and(eq(cashBankAccounts.employeeId, employeeId), eq(cashBankAccounts.isPrimary, true), isNull(cashBankAccounts.deletedAt)));
	}

	async softDelete(id: string, tx?: TTx) {
		const now = new Date();
		const removed = await (tx ?? this.database)
			.update(cashBankAccounts)
			.set({ deletedAt: now, updatedAt: now, isPrimary: false })
			.where(and(eq(cashBankAccounts.id, id), isNotNull(cashBankAccounts.employeeId), isNull(cashBankAccounts.deletedAt)))
			.returning({ id: cashBankAccounts.id });
		return removed.length > 0;
	}
}

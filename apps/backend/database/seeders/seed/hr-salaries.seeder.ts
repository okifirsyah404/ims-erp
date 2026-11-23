import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { cashBankAccounts } from '../../../drizzle/schemas/finance.schema';
import { employeeSalaries, employees } from '../../../drizzle/schemas/human-resource.schema';
import { isProductionEnv } from '../../../config/providers/env';
import { FinanceCodeNumberingRepository } from '../../../src/app/finance/repositories/code-numbering.repository';
import { FinanceNumberingService } from '../../../src/app/finance/services/finance-numbering.service';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** One period for every seeded employee, in force since the start of the year. */
const EFFECTIVE_FROM = '2026-01-01';

/**
 * Seeds the ERP-0119 salary data of the active employees: one salary period
 * (`human_resource.employee_salaries`) and one primary payee account
 * (`finance.cash_bank_accounts` with `employee_id`).
 *
 * Amounts and account numbers are fixed per employee position (ordered by
 * employee code), so re-seeding gives the same data; nothing is
 * faker-generated. Each part is skipped as soon as any live row of its kind
 * exists, so a second run inserts nothing.
 */
export async function seedHrSalaries(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping HR salaries');
		return;
	}
	const people = await drizzleDB
		.select({ id: employees.id, organizationId: employees.organizationId, fullName: employees.fullName })
		.from(employees)
		.where(and(isNull(employees.deletedAt), eq(employees.employmentStatus, 'active')))
		.orderBy(asc(employees.employeeCode));
	if (people.length === 0) {
		logger.info('No active employees; skipping HR salaries');
		return;
	}
	const now = new Date();

	const [anyPeriod] = await drizzleDB.select({ id: employeeSalaries.id }).from(employeeSalaries).where(isNull(employeeSalaries.deletedAt)).limit(1);
	if (anyPeriod) {
		logger.info('human_resource.employee_salaries already seeded; skipping');
	} else {
		await drizzleDB.insert(employeeSalaries).values(
			people.map((person, index) => ({
				employeeId: person.id,
				// Rp 4.500.000 + Rp 250.000 per position, in minor units (ADR-0002).
				baseSalary: (4_500_000 + index * 250_000) * 100,
				fixedAllowances: 500_000 * 100,
				effectiveFrom: EFFECTIVE_FROM,
				effectiveTo: null,
				isActive: true,
				createdBy: null,
				createdAt: now,
				updatedAt: now,
			})),
		);
		logger.info({ created: people.length }, 'Seeded human_resource.employee_salaries');
	}

	const [anyAccount] = await drizzleDB
		.select({ id: cashBankAccounts.id })
		.from(cashBankAccounts)
		.where(and(isNotNull(cashBankAccounts.employeeId), isNull(cashBankAccounts.deletedAt)))
		.limit(1);
	if (anyAccount) {
		logger.info('Employee bank accounts already seeded; skipping');
		return;
	}
	// The seeder runs outside the DI container: the numbering service is wired
	// by hand, the {COMPANY} token is the seeded profile's document code.
	const numbering = new FinanceNumberingService(new FinanceCodeNumberingRepository(drizzleDB), { requireDocumentCode: async () => 'DEV' } as never);
	for (const [index, person] of people.entries()) {
		await drizzleDB.insert(cashBankAccounts).values({
			organizationId: person.organizationId,
			employeeId: person.id,
			code: await numbering.next('employee_bank_account'),
			name: `BCA ${person.fullName}`,
			accountType: 'bank',
			bankName: 'BCA',
			bankCode: '014',
			accountNumber: String(8_000_000_000 + index),
			accountHolder: person.fullName,
			openingBalance: 0,
			currentBalance: 0,
			invoiceUsage: null,
			isPrimary: true,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	}
	logger.info({ created: people.length }, 'Seeded employee bank accounts');
}

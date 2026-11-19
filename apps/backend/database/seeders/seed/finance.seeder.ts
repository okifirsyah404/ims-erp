import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { cashBankAccounts } from '../../../drizzle/schemas/finance.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Seeds the finance cash/bank accounts the payment and billing flows need.
 *
 * @remarks
 * These used to live on `company.bank_accounts` (ADR-0024 Q19: they are
 * `finance.cash_bank_accounts` now, with `bank_code`, `branch_name`,
 * `invoice_usage` and `is_primary`). Idempotent on `(organization, code)`.
 * Runs after `seedOrganization`, because the account is organization-scoped.
 */
export async function seedFinance(): Promise<void> {
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	if (!organization) {
		logger.info('Organization not found; skipping finance seed');
		return;
	}

	const accounts = [
		{
			code: 'BANK-BCA',
			name: 'Bank Central Asia',
			bankName: 'Bank Central Asia',
			bankCode: '014',
			branchName: 'Jakarta Sudirman',
			accountNumber: '1234567890',
			accountHolder: 'PT Entragate',
			invoiceUsage: 'vat' as const,
			isPrimary: true,
		},
		{
			code: 'BANK-MANDIRI',
			name: 'Bank Mandiri',
			bankName: 'Bank Mandiri',
			bankCode: '008',
			branchName: 'Jakarta Sudirman',
			accountNumber: '0987654321',
			accountHolder: 'PT Entragate',
			invoiceUsage: 'non_vat' as const,
			isPrimary: false,
		},
		{
			code: 'CASH',
			name: 'Petty cash',
			bankName: null,
			bankCode: null,
			branchName: null,
			accountNumber: null,
			accountHolder: null,
			invoiceUsage: null,
			isPrimary: false,
		},
	] as const;

	let inserted = 0;
	for (const account of accounts) {
		const [existing] = await drizzleDB
			.select({ id: cashBankAccounts.id })
			.from(cashBankAccounts)
			.where(
				and(
					eq(cashBankAccounts.organizationId, organization.id),
					eq(cashBankAccounts.code, account.code),
					isNull(cashBankAccounts.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;
		const now = new Date();
		await drizzleDB.insert(cashBankAccounts).values({
			organizationId: organization.id,
			code: account.code,
			name: account.name,
			accountType: account.code === 'CASH' ? 'cash' : 'bank',
			bankName: account.bankName,
			bankCode: account.bankCode,
			branchName: account.branchName,
			accountNumber: account.accountNumber,
			accountHolder: account.accountHolder,
			currencyCode: 'IDR',
			openingBalance: 0,
			currentBalance: 0,
			invoiceUsage: account.invoiceUsage,
			isPrimary: account.isPrimary,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
		inserted += 1;
	}
	logger.info({ inserted }, 'Finance cash/bank accounts seeded');
}

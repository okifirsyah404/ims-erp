import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { cashBankAccounts, bankAccountLinks, chartOfAccounts } from '../../../drizzle/schemas/finance.schema';
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
 * Runs after `seedOrganization`, because the account is organization-scoped,
 * and after `seedChartOfAccounts`, which creates the GL accounts linked below.
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
	const cashAccountIdByCode = new Map<string, string>();
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
		if (existing) {
			cashAccountIdByCode.set(account.code, existing.id);
			continue;
		}
		const now = new Date();
		const [created] = await drizzleDB
			.insert(cashBankAccounts)
			.values({
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
			})
			.returning({ id: cashBankAccounts.id });
		cashAccountIdByCode.set(account.code, created.id);
		inserted += 1;
	}
	logger.info({ inserted }, 'Finance cash/bank accounts seeded');

	await linkChartOfAccounts(organization.id, cashAccountIdByCode);
}

/**
 * GL account each seeded cash/bank account posts to (`chart-of-accounts.seeder`).
 */
const CASH_BANK_GL_CODES: Record<string, string> = {
	'BANK-BCA': '1-1120',
	'BANK-MANDIRI': '1-1130',
	CASH: '1-1110',
};

/**
 * Links the seeded cash/bank accounts to their GL accounts.
 *
 * @remarks
 * A treasury account cannot post a movement without a link
 * (`CashBankLinkRequiredError`), so a fresh database would otherwise need a
 * manual visit to `/finance/cash-bank` first. Idempotent: an existing link is
 * left alone (the unique index is on the cash account).
 */
async function linkChartOfAccounts(
	organizationId: string,
	cashAccountIdByCode: Map<string, string>,
): Promise<void> {
	const glRows = await drizzleDB
		.select({ id: chartOfAccounts.id, code: chartOfAccounts.code })
		.from(chartOfAccounts)
		.where(
			and(
				eq(chartOfAccounts.organizationId, organizationId),
				isNull(chartOfAccounts.deletedAt),
			),
		);
	const glIdByCode = new Map(glRows.map((row) => [row.code, row.id]));

	let linked = 0;
	for (const [cashCode, glCode] of Object.entries(CASH_BANK_GL_CODES)) {
		const cashBankAccountId = cashAccountIdByCode.get(cashCode);
		const chartOfAccountId = glIdByCode.get(glCode);
		if (!cashBankAccountId || !chartOfAccountId) continue;

		const [existing] = await drizzleDB
			.select({ id: bankAccountLinks.id })
			.from(bankAccountLinks)
			.where(
				and(
					eq(bankAccountLinks.cashBankAccountId, cashBankAccountId),
					isNull(bankAccountLinks.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;

		const now = new Date();
		await drizzleDB.insert(bankAccountLinks).values({
			organizationId,
			cashBankAccountId,
			chartOfAccountId,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
		linked += 1;
	}
	logger.info({ linked }, 'Cash/bank GL links seeded');
}

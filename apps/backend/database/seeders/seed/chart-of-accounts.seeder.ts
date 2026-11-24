import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { chartOfAccounts } from '../../../drizzle/schemas/finance.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

type TAccountSeed = {
	code: string;
	name: string;
	accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	normalBalance: 'debit' | 'credit';
	/** Header accounts group their children and never take journal lines. */
	isPostable: boolean;
	/** Codes hardcoded by the posting services (`constants/ar-posting.ts`). */
	isSystem: boolean;
	cashFlowCategory?: 'operating' | 'investing' | 'financing';
	parentCode?: string;
};

/**
 * Default Indonesian chart of accounts.
 *
 * @remarks
 * Every code in `constants/ar-posting.ts` is present (`1-1300`, `1-1400`,
 * `1-1800`, `2-1000`, `2-1100`, `2-1200`, `4-1000`, `5-1000`) and marked
 * `isSystem`, so invoice/bill/expense posting resolves on a fresh database.
 * The rest is the usual Indonesian skeleton: one header per account type plus
 * the cash/bank accounts the finance seeder links to.
 */
const ACCOUNTS: TAccountSeed[] = [
	// Assets
	{ code: '1-0000', name: 'Aset', accountType: 'asset', normalBalance: 'debit', isPostable: false, isSystem: false },
	{ code: '1-1000', name: 'Kas', accountType: 'asset', normalBalance: 'debit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '1-0000' },
	{ code: '1-1100', name: 'Kas di Bank BCA', accountType: 'asset', normalBalance: 'debit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '1-0000' },
	{ code: '1-1200', name: 'Kas di Bank Mandiri', accountType: 'asset', normalBalance: 'debit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '1-0000' },
	{ code: '1-1300', name: 'Piutang Usaha', accountType: 'asset', normalBalance: 'debit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '1-0000' },
	{ code: '1-1400', name: 'Persediaan', accountType: 'asset', normalBalance: 'debit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '1-0000' },
	{ code: '1-1800', name: 'PPN Masukan', accountType: 'asset', normalBalance: 'debit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '1-0000' },
	// Liabilities
	{ code: '2-0000', name: 'Kewajiban', accountType: 'liability', normalBalance: 'credit', isPostable: false, isSystem: false },
	{ code: '2-1000', name: 'PPN Keluaran', accountType: 'liability', normalBalance: 'credit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '2-0000' },
	{ code: '2-1100', name: 'Utang Usaha', accountType: 'liability', normalBalance: 'credit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '2-0000' },
	{ code: '2-1200', name: 'Utang Klaim Biaya', accountType: 'liability', normalBalance: 'credit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '2-0000' },
	// Equity
	{ code: '3-0000', name: 'Ekuitas', accountType: 'equity', normalBalance: 'credit', isPostable: false, isSystem: false },
	{ code: '3-1000', name: 'Modal Disetor', accountType: 'equity', normalBalance: 'credit', isPostable: true, isSystem: false, cashFlowCategory: 'financing', parentCode: '3-0000' },
	{ code: '3-2000', name: 'Laba Ditahan', accountType: 'equity', normalBalance: 'credit', isPostable: true, isSystem: false, parentCode: '3-0000' },
	// Revenue
	{ code: '4-0000', name: 'Pendapatan', accountType: 'revenue', normalBalance: 'credit', isPostable: false, isSystem: false },
	{ code: '4-1000', name: 'Pendapatan Usaha', accountType: 'revenue', normalBalance: 'credit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '4-0000' },
	{ code: '4-2000', name: 'Pendapatan Lain-lain', accountType: 'revenue', normalBalance: 'credit', isPostable: true, isSystem: false, cashFlowCategory: 'operating', parentCode: '4-0000' },
	// Expenses
	{ code: '5-0000', name: 'Beban', accountType: 'expense', normalBalance: 'debit', isPostable: false, isSystem: false },
	{ code: '5-1000', name: 'Beban Umum dan Administrasi', accountType: 'expense', normalBalance: 'debit', isPostable: true, isSystem: true, cashFlowCategory: 'operating', parentCode: '5-0000' },
	{ code: '5-1100', name: 'Beban Gaji', accountType: 'expense', normalBalance: 'debit', isPostable: true, isSystem: false, cashFlowCategory: 'operating', parentCode: '5-0000' },
	{ code: '5-1200', name: 'Beban Sewa', accountType: 'expense', normalBalance: 'debit', isPostable: true, isSystem: false, cashFlowCategory: 'operating', parentCode: '5-0000' },
	{ code: '5-1300', name: 'Beban Utilitas', accountType: 'expense', normalBalance: 'debit', isPostable: true, isSystem: false, cashFlowCategory: 'operating', parentCode: '5-0000' },
];

/**
 * Seeds the default chart of accounts.
 *
 * @remarks
 * Idempotent on `(organization, code)`: existing rows are never touched, so a
 * user's renamed or archived account survives a reseed. Parents are inserted
 * before children because the list is ordered that way; `level` follows the
 * parent. Runs before `seedFinance`, which links the cash/bank accounts to the
 * `1-10xx` / `1-11xx` / `1-12xx` rows.
 */
export async function seedChartOfAccounts(): Promise<void> {
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	if (!organization) {
		logger.info('Organization not found; skipping chart-of-accounts seed');
		return;
	}

	const idByCode = new Map<string, string>();
	let inserted = 0;

	for (const account of ACCOUNTS) {
		const [existing] = await drizzleDB
			.select({ id: chartOfAccounts.id })
			.from(chartOfAccounts)
			.where(
				and(
					eq(chartOfAccounts.organizationId, organization.id),
					eq(chartOfAccounts.code, account.code),
					isNull(chartOfAccounts.deletedAt),
				),
			)
			.limit(1);
		if (existing) {
			idByCode.set(account.code, existing.id);
			continue;
		}

		const parentId = account.parentCode
			? (idByCode.get(account.parentCode) ?? null)
			: null;
		const now = new Date();
		const [created] = await drizzleDB
			.insert(chartOfAccounts)
			.values({
				organizationId: organization.id,
				code: account.code,
				name: account.name,
				accountType: account.accountType,
				normalBalance: account.normalBalance,
				parentAccountId: parentId,
				level: parentId ? 2 : 1,
				isPostable: account.isPostable,
				isSystem: account.isSystem,
				isActive: true,
				cashFlowCategory: account.cashFlowCategory ?? null,
				description: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: chartOfAccounts.id });
		idByCode.set(account.code, created.id);
		inserted += 1;
	}

	logger.info({ inserted }, 'Chart of accounts seeded');
}

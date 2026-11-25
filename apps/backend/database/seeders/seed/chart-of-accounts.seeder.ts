import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import {
	ANY_POSTING_EVENT,
	chartOfAccounts,
	costCenters,
	postingRules,
} from '../../../drizzle/schemas/finance.schema';
import { DEFAULT_POSTING_RULE_CODES } from '../../../src/app/finance/constants/posting-roles';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

type TAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
type TCashFlow = 'operating' | 'investing' | 'financing';

type TAccountSeed = {
	code: string;
	name: string;
	accountType: TAccountType;
	normalBalance: 'debit' | 'credit';
	/** Header accounts group their children and never take journal lines. */
	isPostable: boolean;
	/** Accounts a default posting rule points at: never archived. */
	isSystem: boolean;
	cashFlowCategory?: TCashFlow;
	parentCode?: string;
};

/** Header account (non-postable). */
const h = (code: string, name: string, accountType: TAccountType, parentCode?: string): TAccountSeed => ({
	code,
	name,
	accountType,
	normalBalance: accountType === 'asset' || accountType === 'expense' ? 'debit' : 'credit',
	isPostable: false,
	isSystem: false,
	parentCode,
});

/** Postable account; `normal` overrides the type's normal side (contra accounts). */
const p = (
	code: string,
	name: string,
	accountType: TAccountType,
	parentCode: string,
	cashFlowCategory?: TCashFlow,
	normal?: 'debit' | 'credit',
): TAccountSeed => ({
	code,
	name,
	accountType,
	normalBalance: normal ?? (accountType === 'asset' || accountType === 'expense' ? 'debit' : 'credit'),
	isPostable: true,
	isSystem: false,
	cashFlowCategory,
	parentCode,
});

/**
 * Default Indonesian chart of accounts (ERP-0127, ADR-0030; SAK EP layout).
 *
 * @remarks
 * Format `X-XXXX`: 1 Aset, 2 Liabilitas, 3 Ekuitas, 4 Pendapatan, 5 Harga
 * Pokok Penjualan, 6 Beban Operasional, 7 Pendapatan Lain-lain, 8 Beban
 * Lain-lain. Headers group, leaves take postings. Every account a default
 * posting rule points at (`DEFAULT_POSTING_RULE_CODES`) is marked system.
 * `cashFlowCategory` drives the cash-flow mapping of the counter-account.
 */
const ACCOUNTS: TAccountSeed[] = [
	// 1 Aset
	h('1-0000', 'Aset', 'asset'),
	h('1-1000', 'Aset Lancar', 'asset', '1-0000'),
	h('1-1100', 'Kas dan Setara Kas', 'asset', '1-1000'),
	p('1-1110', 'Kas Kecil', 'asset', '1-1100', 'operating'),
	p('1-1120', 'Kas di Bank BCA', 'asset', '1-1100', 'operating'),
	p('1-1130', 'Kas di Bank Mandiri', 'asset', '1-1100', 'operating'),
	h('1-1200', 'Dana Dalam Perjalanan', 'asset', '1-1000'),
	p('1-1250', 'Kliring Payment Gateway', 'asset', '1-1200', 'operating'),
	h('1-1300', 'Piutang', 'asset', '1-1000'),
	p('1-1310', 'Piutang Usaha', 'asset', '1-1300', 'operating'),
	p('1-1320', 'Piutang Karyawan', 'asset', '1-1300', 'operating'),
	p('1-1330', 'Piutang Lain-lain', 'asset', '1-1300', 'operating'),
	p('1-1390', 'Cadangan Kerugian Piutang', 'asset', '1-1300', 'operating', 'credit'),
	h('1-1400', 'Persediaan', 'asset', '1-1000'),
	p('1-1410', 'Persediaan Barang Dagang', 'asset', '1-1400', 'operating'),
	p('1-1500', 'Uang Muka Pembelian', 'asset', '1-1000', 'operating'),
	p('1-1600', 'Biaya Dibayar Dimuka', 'asset', '1-1000', 'operating'),
	h('1-1800', 'Pajak Dibayar Dimuka', 'asset', '1-1000'),
	p('1-1810', 'PPN Masukan', 'asset', '1-1800', 'operating'),
	p('1-1820', 'PPh 23 Dibayar Dimuka', 'asset', '1-1800', 'operating'),
	h('1-2000', 'Aset Tidak Lancar', 'asset', '1-0000'),
	h('1-2100', 'Aset Tetap', 'asset', '1-2000'),
	p('1-2110', 'Peralatan Instalasi dan Alat Uji', 'asset', '1-2100', 'investing'),
	p('1-2120', 'Kendaraan', 'asset', '1-2100', 'investing'),
	p('1-2130', 'Peralatan Kantor dan Komputer', 'asset', '1-2100', 'investing'),
	p('1-2140', 'Bangunan', 'asset', '1-2100', 'investing'),
	h('1-2200', 'Akumulasi Penyusutan', 'asset', '1-2000'),
	p('1-2210', 'Akumulasi Penyusutan Peralatan Instalasi', 'asset', '1-2200', 'investing', 'credit'),
	p('1-2220', 'Akumulasi Penyusutan Kendaraan', 'asset', '1-2200', 'investing', 'credit'),
	p('1-2230', 'Akumulasi Penyusutan Peralatan Kantor', 'asset', '1-2200', 'investing', 'credit'),
	p('1-2240', 'Akumulasi Penyusutan Bangunan', 'asset', '1-2200', 'investing', 'credit'),
	h('1-2300', 'Aset Tak Berwujud', 'asset', '1-2000'),
	p('1-2310', 'Perangkat Lunak dan Lisensi', 'asset', '1-2300', 'investing'),
	// 2 Liabilitas
	h('2-0000', 'Liabilitas', 'liability'),
	h('2-1000', 'Liabilitas Jangka Pendek', 'liability', '2-0000'),
	p('2-1100', 'Utang Usaha', 'liability', '2-1000', 'operating'),
	p('2-1150', 'Barang Diterima Belum Ditagih (GR/IR)', 'liability', '2-1000', 'operating'),
	p('2-1200', 'Utang Klaim Biaya', 'liability', '2-1000', 'operating'),
	p('2-1300', 'Uang Muka Penjualan', 'liability', '2-1000', 'operating'),
	h('2-1400', 'Utang Pajak', 'liability', '2-1000'),
	p('2-1410', 'PPN Keluaran', 'liability', '2-1400', 'operating'),
	p('2-1420', 'Utang PPh 21', 'liability', '2-1400', 'operating'),
	p('2-1430', 'Utang PPh 23', 'liability', '2-1400', 'operating'),
	p('2-1440', 'Utang PPh 4 Ayat 2', 'liability', '2-1400', 'operating'),
	p('2-1450', 'Utang PPh 25/29', 'liability', '2-1400', 'operating'),
	p('2-1500', 'Pendapatan Diterima Dimuka', 'liability', '2-1000', 'operating'),
	p('2-1600', 'Utang Gaji', 'liability', '2-1000', 'operating'),
	p('2-1700', 'Utang BPJS', 'liability', '2-1000', 'operating'),
	p('2-1800', 'Biaya Masih Harus Dibayar', 'liability', '2-1000', 'operating'),
	p('2-1900', 'Utang Bagi Hasil', 'liability', '2-1000', 'financing'),
	h('2-2000', 'Liabilitas Jangka Panjang', 'liability', '2-0000'),
	p('2-2100', 'Utang Bank Jangka Panjang', 'liability', '2-2000', 'financing'),
	// 3 Ekuitas
	h('3-0000', 'Ekuitas', 'equity'),
	p('3-1000', 'Modal Disetor', 'equity', '3-0000', 'financing'),
	p('3-2000', 'Laba Ditahan', 'equity', '3-0000'),
	p('3-3000', 'Laba Tahun Berjalan', 'equity', '3-0000'),
	p('3-4000', 'Prive dan Dividen', 'equity', '3-0000', 'financing', 'debit'),
	// 4 Pendapatan
	h('4-0000', 'Pendapatan', 'revenue'),
	h('4-1000', 'Pendapatan Usaha', 'revenue', '4-0000'),
	p('4-1100', 'Penjualan Perangkat', 'revenue', '4-1000', 'operating'),
	p('4-1200', 'Pendapatan Lisensi Perangkat Lunak', 'revenue', '4-1000', 'operating'),
	p('4-1300', 'Pendapatan Jasa Instalasi', 'revenue', '4-1000', 'operating'),
	p('4-1400', 'Pendapatan Pemeliharaan dan Langganan', 'revenue', '4-1000', 'operating'),
	p('4-1500', 'Pendapatan Jasa Lainnya', 'revenue', '4-1000', 'operating'),
	p('4-1900', 'Retur dan Potongan Penjualan', 'revenue', '4-1000', 'operating', 'debit'),
	// 5 Harga Pokok Penjualan
	h('5-0000', 'Harga Pokok Penjualan', 'expense'),
	p('5-1100', 'HPP Barang', 'expense', '5-0000', 'operating'),
	p('5-1200', 'HPP Proyek', 'expense', '5-0000', 'operating'),
	p('5-1300', 'Selisih Harga Pembelian', 'expense', '5-0000', 'operating'),
	p('5-1400', 'Selisih Persediaan', 'expense', '5-0000', 'operating'),
	// 6 Beban Operasional
	h('6-0000', 'Beban Operasional', 'expense'),
	h('6-1000', 'Beban Karyawan', 'expense', '6-0000'),
	p('6-1100', 'Beban Gaji dan Tunjangan', 'expense', '6-1000', 'operating'),
	p('6-1200', 'Beban BPJS', 'expense', '6-1000', 'operating'),
	h('6-2000', 'Beban Umum dan Administrasi', 'expense', '6-0000'),
	p('6-2100', 'Beban Sewa', 'expense', '6-2000', 'operating'),
	p('6-2200', 'Beban Utilitas', 'expense', '6-2000', 'operating'),
	p('6-2300', 'Beban Perlengkapan Kantor', 'expense', '6-2000', 'operating'),
	p('6-2400', 'Beban Transportasi dan Perjalanan', 'expense', '6-2000', 'operating'),
	p('6-2500', 'Beban Penyusutan', 'expense', '6-2000', 'operating'),
	p('6-2600', 'Beban Kerugian Piutang', 'expense', '6-2000', 'operating'),
	p('6-2900', 'Beban Umum Lainnya', 'expense', '6-2000', 'operating'),
	h('6-3000', 'Beban Penjualan dan Pemasaran', 'expense', '6-0000'),
	p('6-3100', 'Beban Pemasaran', 'expense', '6-3000', 'operating'),
	p('6-3200', 'Beban Biaya Payment Gateway', 'expense', '6-3000', 'operating'),
	// 7 Pendapatan Lain-lain
	h('7-0000', 'Pendapatan Lain-lain', 'revenue'),
	p('7-1000', 'Pendapatan Bunga Bank', 'revenue', '7-0000', 'operating'),
	p('7-2000', 'Laba Pelepasan Aset', 'revenue', '7-0000', 'investing'),
	p('7-9000', 'Pendapatan Lain-lain', 'revenue', '7-0000', 'operating'),
	// 8 Beban Lain-lain
	h('8-0000', 'Beban Lain-lain', 'expense'),
	p('8-1000', 'Beban Administrasi Bank', 'expense', '8-0000', 'operating'),
	p('8-2000', 'Rugi Pelepasan Aset', 'expense', '8-0000', 'investing'),
	p('8-3000', 'Beban Pajak Penghasilan', 'expense', '8-0000', 'operating'),
	p('8-9000', 'Beban Lain-lain', 'expense', '8-0000', 'operating'),
];

const SYSTEM_CODES = new Set([...Object.values(DEFAULT_POSTING_RULE_CODES), '1-1110', '1-1120', '1-1130', '3-3000']);

/** Cost centres every organization starts with (ERP-0127). */
const COST_CENTERS = [
	{ code: 'UMUM', name: 'Umum dan Administrasi' },
	{ code: 'OPS', name: 'Operasional dan Instalasi' },
	{ code: 'SALES', name: 'Penjualan dan Pemasaran' },
];

/**
 * Seeds the default chart of accounts, the `'*'` posting rules that replace
 * the old hard-coded posting codes, and the starter cost centres.
 *
 * @remarks
 * Idempotent: accounts on `(organization, code)`, rules on their scope,
 * cost centres on `(organization, code)`; existing rows are never touched,
 * so a renamed or remapped row survives a reseed. Parents precede children
 * in the list; `level` follows the parent. Runs before `seedFinance`, which
 * links the cash/bank accounts to `1-1110` / `1-1120` / `1-1130`.
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

	const byCode = new Map<string, { id: string; level: number }>();
	let inserted = 0;

	for (const account of ACCOUNTS) {
		const [existing] = await drizzleDB
			.select({ id: chartOfAccounts.id, level: chartOfAccounts.level })
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
			byCode.set(account.code, existing);
			continue;
		}

		const parent = account.parentCode ? byCode.get(account.parentCode) : undefined;
		const now = new Date();
		const [created] = await drizzleDB
			.insert(chartOfAccounts)
			.values({
				organizationId: organization.id,
				code: account.code,
				name: account.name,
				accountType: account.accountType,
				normalBalance: account.normalBalance,
				parentAccountId: parent?.id ?? null,
				level: parent ? parent.level + 1 : 1,
				isPostable: account.isPostable,
				isSystem: account.isSystem || SYSTEM_CODES.has(account.code),
				isActive: true,
				cashFlowCategory: account.cashFlowCategory ?? null,
				description: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: chartOfAccounts.id, level: chartOfAccounts.level });
		byCode.set(account.code, created);
		inserted += 1;
	}

	let rulesInserted = 0;
	for (const [role, code] of Object.entries(DEFAULT_POSTING_RULE_CODES)) {
		const target = code ? byCode.get(code) : undefined;
		if (!target) continue;
		const [existing] = await drizzleDB
			.select({ id: postingRules.id })
			.from(postingRules)
			.where(
				and(
					eq(postingRules.organizationId, organization.id),
					eq(postingRules.eventType, ANY_POSTING_EVENT),
					eq(postingRules.role, role),
					eq(postingRules.discriminatorType, ''),
					eq(postingRules.discriminatorValue, ''),
					isNull(postingRules.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;
		const now = new Date();
		await drizzleDB.insert(postingRules).values({
			organizationId: organization.id,
			eventType: ANY_POSTING_EVENT,
			role,
			discriminatorType: '',
			discriminatorValue: '',
			accountId: target.id,
			isActive: true,
			description: 'Default rule (seed)',
			createdAt: now,
			updatedAt: now,
		});
		rulesInserted += 1;
	}

	// ERP-0139: receipts paid in cash land in petty cash; every other method
	// uses the default `cash_receipt` rule (the main bank account).
	const pettyCash = byCode.get('1-1110');
	for (const role of ['cash_receipt', 'cash_payment']) {
		if (!pettyCash) break;
		const [existing] = await drizzleDB
			.select({ id: postingRules.id })
			.from(postingRules)
			.where(
				and(
					eq(postingRules.organizationId, organization.id),
					eq(postingRules.eventType, ANY_POSTING_EVENT),
					eq(postingRules.role, role),
					eq(postingRules.discriminatorType, 'payment_method'),
					eq(postingRules.discriminatorValue, 'cash'),
					isNull(postingRules.deletedAt),
				),
			)
			.limit(1);
		if (!existing) {
			const now = new Date();
			await drizzleDB.insert(postingRules).values({
				organizationId: organization.id,
				eventType: ANY_POSTING_EVENT,
				role,
				discriminatorType: 'payment_method',
				discriminatorValue: 'cash',
				accountId: pettyCash.id,
				isActive: true,
				description: 'Cash in petty cash (seed)',
				createdAt: now,
				updatedAt: now,
			});
			rulesInserted += 1;
		}
	}

	let costCentersInserted = 0;
	for (const center of COST_CENTERS) {
		const [existing] = await drizzleDB
			.select({ id: costCenters.id })
			.from(costCenters)
			.where(
				and(
					eq(costCenters.organizationId, organization.id),
					eq(costCenters.code, center.code),
					isNull(costCenters.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;
		const now = new Date();
		await drizzleDB.insert(costCenters).values({
			organizationId: organization.id,
			code: center.code,
			name: center.name,
			parentCostCenterId: null,
			isActive: true,
			description: null,
			createdAt: now,
			updatedAt: now,
		});
		costCentersInserted += 1;
	}

	logger.info({ inserted, rulesInserted, costCentersInserted }, 'Chart of accounts seeded');
}

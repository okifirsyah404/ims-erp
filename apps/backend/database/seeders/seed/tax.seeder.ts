import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { pph21Brackets, pph21Ptkp, taxes } from '../../../drizzle/schemas/tax.schema';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Placeholder tax rates (plan D18). These are NOT confirmed by finance or the
 * tax authority. Replace them through the tax parameter screen before any
 * filing. Keyed on `(code, effectiveFrom)` so re-runs insert nothing new.
 */
const SEED_TAX_TYPES = [
	{
		code: 'PPN',
		name: 'PPN (placeholder 11%)',
		taxType: 'ppn_output',
		rate: '11.0000',
		baseType: 'gross',
		isInclusive: false,
	},
	{
		code: 'PPH23',
		name: 'PPh 23 (placeholder 2%)',
		taxType: 'pph',
		rate: '2.0000',
		baseType: 'gross',
		isInclusive: false,
	},
	{
		code: 'PPH4_2',
		name: 'PPh 4(2) (placeholder 10%)',
		taxType: 'pph',
		rate: '10.0000',
		baseType: 'gross',
		isInclusive: false,
	},
] as const;

const SEED_EFFECTIVE_FROM = '2026-01-01';

/**
 * Seeds placeholder tax rate rows for the seed organization.
 *
 * @remarks
 * Idempotent: existing live rows for the same code and start date are left
 * untouched, so running `drizzle:seed` twice changes nothing.
 */
export async function seedTax(): Promise<void> {
	const [org] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	if (!org) {
		throw new Error('Seed organization missing; run organization seeder first');
	}

	const now = new Date();
	let inserted = 0;
	for (const row of SEED_TAX_TYPES) {
		const [existing] = await drizzleDB
			.select({ id: taxes.id })
			.from(taxes)
			.where(
				and(
					eq(taxes.organizationId, org.id),
					eq(taxes.code, row.code),
					eq(taxes.effectiveFrom, SEED_EFFECTIVE_FROM),
					isNull(taxes.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;

		await drizzleDB.insert(taxes).values({
			organizationId: org.id,
			code: row.code,
			name: row.name,
			taxType: row.taxType,
			rate: row.rate,
			baseType: row.baseType,
			isInclusive: row.isInclusive,
			effectiveFrom: SEED_EFFECTIVE_FROM,
			effectiveTo: null,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
		inserted += 1;
	}

	logger.info({ inserted }, 'Tax seeding complete');
	await seedPph21Statutory();
}

/** Rupiah to minor units. */
const rp = (rupiah: number) => rupiah * 100;

/**
 * PTKP per status (PMK 101/PMK.010/2016, unchanged since) with the TER
 * category of PP 58/2023, which the 2024-01-01 set introduces.
 */
const PTKP_2024 = [
	{ statusCode: 'TK/0', annualAmount: rp(54_000_000), terCategory: 'A' },
	{ statusCode: 'TK/1', annualAmount: rp(58_500_000), terCategory: 'A' },
	{ statusCode: 'TK/2', annualAmount: rp(63_000_000), terCategory: 'B' },
	{ statusCode: 'TK/3', annualAmount: rp(67_500_000), terCategory: 'B' },
	{ statusCode: 'K/0', annualAmount: rp(58_500_000), terCategory: 'A' },
	{ statusCode: 'K/1', annualAmount: rp(63_000_000), terCategory: 'B' },
	{ statusCode: 'K/2', annualAmount: rp(67_500_000), terCategory: 'B' },
	{ statusCode: 'K/3', annualAmount: rp(72_000_000), terCategory: 'C' },
] as const;

/** Pasal 17 ayat (1) huruf a as amended by UU HPP (7/2021), from 2022. */
const BRACKETS_2022 = [
	{ lowerBound: 0, rate: '5.0000' },
	{ lowerBound: rp(60_000_000), rate: '15.0000' },
	{ lowerBound: rp(250_000_000), rate: '25.0000' },
	{ lowerBound: rp(500_000_000), rate: '30.0000' },
	{ lowerBound: rp(5_000_000_000), rate: '35.0000' },
] as const;

/**
 * Seeds the PPh 21 statutory tables (ERP-0138): PTKP and Pasal 17 only.
 *
 * @remarks
 * TER rates are deliberately not seeded: finance imports the official
 * PP 58/2023 table (`POST /taxes/pph21/ter-rates/import`). Global reference
 * data, keyed on the natural key, so a second run inserts nothing.
 */
export async function seedPph21Statutory(): Promise<void> {
	const now = new Date();
	let ptkp = 0;
	for (const row of PTKP_2024) {
		const [existing] = await drizzleDB
			.select({ id: pph21Ptkp.id })
			.from(pph21Ptkp)
			.where(and(eq(pph21Ptkp.statusCode, row.statusCode), eq(pph21Ptkp.effectiveFrom, '2024-01-01'), isNull(pph21Ptkp.deletedAt)))
			.limit(1);
		if (existing) continue;
		await drizzleDB.insert(pph21Ptkp).values({ ...row, effectiveFrom: '2024-01-01', createdAt: now, updatedAt: now });
		ptkp += 1;
	}
	let brackets = 0;
	for (const row of BRACKETS_2022) {
		const [existing] = await drizzleDB
			.select({ id: pph21Brackets.id })
			.from(pph21Brackets)
			.where(and(eq(pph21Brackets.lowerBound, row.lowerBound), eq(pph21Brackets.effectiveFrom, '2022-01-01'), isNull(pph21Brackets.deletedAt)))
			.limit(1);
		if (existing) continue;
		await drizzleDB.insert(pph21Brackets).values({ ...row, effectiveFrom: '2022-01-01', createdAt: now, updatedAt: now });
		brackets += 1;
	}
	logger.info({ ptkp, brackets }, 'PPh 21 statutory tables seeded (TER rows are imported, not seeded)');
}

import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { taxes } from '../../../drizzle/schemas/tax.schema';
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
}

import { inArray, isNull, and } from 'drizzle-orm';
import pino from 'pino';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { itemCategories } from '../../../drizzle/schemas/inventory.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * The public website's product categories (entragate-platform
 * `apps/web/src/data/catalog.ts`; decision 2026-11-02: ERP categories follow
 * the website so the catalog maps 1:1 by slug). Real reference data, seeded
 * in every environment.
 */
export const WEBSITE_CATEGORIES = [
	{ slug: 'swing-barrier-gate', name: 'Swing Barrier Gate', shortName: 'Swing Gates' },
	{ slug: 'flap-barrier-gate', name: 'Flap Barrier Gate', shortName: 'Flap Gates' },
	{ slug: 'tripod-turnstile', name: 'Tripod Turnstile', shortName: 'Turnstiles' },
	{ slug: 'parking-barrier', name: 'Automatic Parking Barrier', shortName: 'Parking Barriers' },
	{ slug: 'parking-equipment', name: 'Parking Equipment', shortName: 'Parking Kiosks' },
	{ slug: 'face-recognition', name: 'Face Recognition', shortName: 'Face Recognition' },
	{ slug: 'rfid-qr-scanner', name: 'RFID & QR Scanner', shortName: 'RFID & QR' },
	{ slug: 'access-controllers', name: 'Access Controllers', shortName: 'Controllers' },
	{ slug: 'accessories', name: 'Accessories', shortName: 'Accessories' },
] as const;

/** Internal categories for the dev inventory seed (tools, cable stock). */
export const DEV_INTERNAL_CATEGORIES = [
	{ slug: 'tools', name: 'Tools and instruments', shortName: 'Tools' },
	{ slug: 'cabling', name: 'Cabling and materials', shortName: 'Cabling' },
] as const;

/**
 * Idempotent item category seeder (ADR-0011): inserts only the slugs that
 * have no live row yet; existing rows, including renamed or deactivated
 * ones, are never touched. Internal categories are dev-only.
 */
export async function seedItemCategories(): Promise<void> {
	const wanted = [
		...WEBSITE_CATEGORIES,
		...(isProductionEnv() ? [] : DEV_INTERNAL_CATEGORIES),
	].map((category, index) => ({ ...category, sortOrder: (index + 1) * 10 }));

	const existing = await drizzleDB
		.select({ slug: itemCategories.slug })
		.from(itemCategories)
		.where(
			and(
				isNull(itemCategories.deletedAt),
				inArray(
					itemCategories.slug,
					wanted.map((category) => category.slug),
				),
			),
		);
	const have = new Set(existing.map((row) => row.slug));
	const missing = wanted.filter((category) => !have.has(category.slug));
	if (missing.length > 0) {
		const now = new Date();
		await drizzleDB
			.insert(itemCategories)
			.values(missing.map((category) => ({ ...category, createdAt: now, updatedAt: now })));
	}
	logger.info({ inserted: missing.length }, 'Item categories seeded');
}

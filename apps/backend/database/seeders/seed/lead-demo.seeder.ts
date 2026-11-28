import { and, eq } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { leads } from '../../../drizzle/schemas/project.schema';
import { isProductionEnv } from '../../../config/providers/env';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Demo leads for the reference form of P7-6 (Prospek, FU1).
 *
 * @remarks
 * Each row exercises one rule of the lead form so the form UAT has data to
 * open, not only an empty "new lead" dialog:
 *
 * - a WhatsApp-only lead whose follow-up has already passed: editing it must
 *   still save other fields (the "not in the past" rule only applies to a
 *   new or changed follow-up);
 * - an email-only lead with a company and an estimated value (money in
 *   integer IDR minor units, ADR-0002) and a follow-up in three days;
 * - a phone-only lead without a follow-up.
 *
 * Names and contacts are fixed fictitious values (no real people, `example`
 * domain, `+62812345000xx` numbers). Idempotent: a row is found again by its
 * name and source and never updated, so a second run inserts nothing.
 */
export async function seedDemoLeads(now: number = Date.now()): Promise<number> {
	if (isProductionEnv()) {
		logger.info('Demo lead seeding skipped in production');
		return 0;
	}

	const rows: Array<Omit<typeof leads.$inferInsert, 'createdAt'>> = [
		{
			name: 'Budi Santoso (contoh)',
			whatsapp: '+6281234500001',
			source: 'whatsapp',
			status: 'new',
			needs: 'Akses pintu kantor 2 lantai, 4 pintu.',
			nextFollowUpAt: new Date(now - DAY_MS),
		},
		{
			name: 'Siti Rahma (contoh)',
			companyName: 'PT Contoh Akses',
			email: 'siti.rahma@example.com',
			source: 'website',
			status: 'contacted',
			needs: 'Mesin absensi wajah untuk 3 cabang.',
			// Rp 15.000.000 in minor units.
			estimatedValue: 1_500_000_000,
			nextFollowUpAt: new Date(now + 3 * DAY_MS),
		},
		{
			name: 'Andi Wijaya (contoh)',
			phone: '+6281234500003',
			source: 'referral',
			status: 'new',
		},
	];

	let inserted = 0;
	for (const row of rows) {
		const [existing] = await drizzleDB
			.select({ id: leads.id })
			.from(leads)
			.where(and(eq(leads.name, row.name), eq(leads.source, row.source)))
			.limit(1);
		if (existing) continue;
		await drizzleDB.insert(leads).values({ ...row, createdAt: new Date(now) });
		inserted += 1;
	}
	logger.info({ inserted }, 'Demo leads seeded');
	return inserted;
}

import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { supplierCompanies } from '../../../drizzle/schemas/supplier.schema';
import { isProductionEnv } from '../../../config/providers/env';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Demo suppliers for document numbering (P7-5, K6).
 *
 * @remarks
 * The PO number renders the supplier code (`{SUPPLIER}`) and must fit 32
 * characters. These rows give the numbering UAT something real to show:
 *
 * - `HIT` and `ZKT`: short typed codes, the way the owner shortens codes in
 *   Settings → Code Number; their PO numbers fit
 *   (`PO/IMS-HIT/HW/1126/001`, 22 characters).
 * - `LEGACY-ENTRAGATE-SUP-001`: a long code like the ones the old default
 *   pattern generated. It makes the PO example on the settings page exceed
 *   32 characters (the warning) and lets a PO approval be refused with the
 *   FU6 message without using a number up (the gap check).
 *
 * Codes are typed, not taken from the `supplier_company` counter, so seeding
 * never collides with the `SUP-00001` codes the app generates. Names and
 * contacts are fictitious. Idempotent on the live `code`; a second run
 * inserts nothing.
 */
export async function seedDemoSuppliers(now: Date = new Date()): Promise<number> {
	if (isProductionEnv()) {
		logger.info('Demo supplier seeding skipped in production');
		return 0;
	}

	const rows: Array<Omit<typeof supplierCompanies.$inferInsert, 'createdAt'>> = [
		{
			code: 'HIT',
			name: 'PT Contoh Kunci Digital',
			supplierType: 'company',
			email: 'sales@kunci-digital.example.com',
			phone: '+622150000001',
			notes: 'Pemasok contoh (P7-5): kode pendek.',
		},
		{
			code: 'ZKT',
			name: 'CV Contoh Mesin Absensi',
			supplierType: 'company',
			email: 'order@mesin-absensi.example.com',
			phone: '+622150000002',
			notes: 'Pemasok contoh (P7-5): kode pendek.',
		},
		{
			code: 'LEGACY-ENTRAGATE-SUP-001',
			name: 'PT Contoh Kode Lama',
			supplierType: 'company',
			email: 'admin@kode-lama.example.com',
			phone: '+622150000003',
			notes:
				'Pemasok contoh (P7-5): kode lama terlalu panjang. Nomor PO-nya melebihi 32 karakter; persingkat kodenya di Pengaturan → Nomor Kode.',
		},
	];

	let inserted = 0;
	for (const row of rows) {
		const [existing] = await drizzleDB
			.select({ id: supplierCompanies.id })
			.from(supplierCompanies)
			.where(and(eq(supplierCompanies.code, row.code), isNull(supplierCompanies.deletedAt)))
			.limit(1);
		if (existing) continue;
		await drizzleDB.insert(supplierCompanies).values({ ...row, status: 'active', createdAt: now, updatedAt: now });
		inserted += 1;
	}
	logger.info({ inserted }, 'Demo suppliers seeded');
	return inserted;
}

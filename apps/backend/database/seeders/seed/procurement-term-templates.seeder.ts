import { and, eq, inArray, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { purchaseTermTemplates } from '../../../drizzle/schemas/procurement.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Starter purchase term templates (ERP-0165), written like the company's own
 * PO sample. Payment amounts are `{{placeholders}}`, so they follow the order.
 */
const TEMPLATES = [
	{
		name: 'Hardware',
		isDefault: true,
		paymentTerms: null,
		terms: [
			'Pembayaran: DP 50% sebesar {{grand_total_pct:50}}; pelunasan 50% sebesar {{grand_total_rest:50}} sebelum barang dikirimkan.',
			'Penyerahan: Lokasi penyerahan sesuai penawaran {{supplier_quote_ref}}. Biaya instalasi belum termasuk.',
			'Stok & pengadaan: Ready stock / stok berjalan; untuk barang indent, estimasi mengikuti konfirmasi ketersediaan pemasok.',
			'Harga & pembatalan: Pembatalan setelah diproses dikenai penalti sesuai ketentuan pemasok.',
			'Garansi: Garansi hardware 12 bulan sesuai penawaran pemasok.',
		].join('\n'),
		notes: null,
	},
	{
		name: 'Lisensi',
		isDefault: false,
		paymentTerms: null,
		terms: [
			'Pembayaran: 100% sebesar {{grand_total}} sebelum lisensi diterbitkan.',
			'Penyerahan: Kunci lisensi dikirim ke email PIC pembeli ({{buyer_pic}}).',
			'Masa berlaku: Sesuai ketentuan lisensi pemasok.',
		].join('\n'),
		notes: null,
	},
] as const;

/**
 * Purchase term templates (ERP-0165), in every environment.
 *
 * @remarks
 * Anchored on the name: a template is inserted only when no live one has that
 * name, so a template the company edited is never overwritten. The default
 * flag is only set when no live default exists yet (the partial unique index
 * allows one). Idempotent: a second run inserts nothing.
 */
export async function seedPurchaseTermTemplates(): Promise<void> {
	const now = new Date();
	const live = await drizzleDB
		.select({ name: purchaseTermTemplates.name, isDefault: purchaseTermTemplates.isDefault })
		.from(purchaseTermTemplates)
		.where(
			and(
				isNull(purchaseTermTemplates.deletedAt),
				inArray(
					purchaseTermTemplates.name,
					TEMPLATES.map((template) => template.name),
				),
			),
		);
	const have = new Set(live.map((row) => row.name));
	const hasDefault = (
		await drizzleDB
			.select({ id: purchaseTermTemplates.id })
			.from(purchaseTermTemplates)
			.where(and(isNull(purchaseTermTemplates.deletedAt), eq(purchaseTermTemplates.isDefault, true)))
	).length > 0;
	const missing = TEMPLATES.filter((template) => !have.has(template.name));
	if (missing.length > 0) {
		await drizzleDB.insert(purchaseTermTemplates).values(
			missing.map((template) => ({
				...template,
				isDefault: template.isDefault && !hasDefault,
				createdAt: now,
				updatedAt: now,
			})),
		);
	}
	logger.info({ inserted: missing.length }, 'Purchase term templates seeded');
}

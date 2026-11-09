/**
 * Warranty rules (pure, no I/O). Default texts follow the company's warranty
 * sample; the owner changes them in the company profile. Text syntax: one
 * item per line, a line starting with `o ` or `- ` is a sub-item of the
 * previous one, `**…**` prints bold.
 */

export const DEFAULT_WARRANTY_MONTHS = 12;

export const DEFAULT_WARRANTY_COVERAGE = [
	'Kerusakan perangkat akibat **cacat produksi pabrik**',
	'Kerusakan modul elektronik yang terjadi dalam pemakaian normal',
	'Penggantian atau perbaikan komponen yang dinyatakan rusak oleh pihak penyedia',
].join('\n');

export const DEFAULT_WARRANTY_EXCLUSIONS = [
	'Kerusakan akibat:',
	'o Tegangan listrik tidak stabil',
	'o Petir, banjir, kebakaran, gempa, atau force majeure',
	'Kerusakan karena:',
	'o Kesalahan instalasi oleh pihak lain',
	'o Perubahan wiring tanpa persetujuan penyedia',
	'o Pembongkaran perangkat tanpa izin tertulis',
	'Kerusakan akibat:',
	'o Benturan kendaraan',
	'o Vandalisme',
	'o Human error pengguna',
	'Perangkat dipindahkan dari lokasi awal pemasangan',
].join('\n');

export const DEFAULT_WARRANTY_SERVICE_TERMS = [
	'Garansi meliputi **perbaikan atau penggantian unit**, tidak termasuk biaya:',
	'o Transportasi teknisi',
	'o Akomodasi dan konsumsi',
	'o Pengiriman barang (jika lokasi di luar kota)',
	'Waktu penanganan garansi maksimal **3–14 hari kerja** setelah laporan diterima.',
	'Laporan garansi wajib disertai:',
	'o Foto / video kerusakan',
	'o Nomor seri perangkat',
	'o Berita Acara Serah Terima (BAST)',
].join('\n');

/** The profile text, or the sample's default when it is empty. */
export function textOrDefault(text: string | null | undefined, fallback: string): string {
	return text?.trim() ? text.trim() : fallback;
}

/**
 * Last covered day of a warranty of `months` starting on `startDate`
 * (`YYYY-MM-DD`): the day before the same date `months` later, clamped to
 * the month end (2025-12-24 + 12 → 2026-12-23; 2026-01-31 + 1 → 2026-02-27).
 */
export function warrantyEndDate(startDate: string, months: number): string {
	const [y, m, d] = startDate.split('-').map(Number) as [number, number, number];
	const targetMonth = m - 1 + months;
	const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
	const sameDay = new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay)));
	sameDay.setUTCDate(sameDay.getUTCDate() - 1);
	return sameDay.toISOString().slice(0, 10);
}

/** Customer code as printed in the certificate number (`IMS-APP`). */
export function customerNumberCode(code: string | null | undefined): string {
	return (code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'CUS';
}

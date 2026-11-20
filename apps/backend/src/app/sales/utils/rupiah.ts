/** IDR minor units → "Rp 1.250.000" (whole rupiah, Indonesian grouping), for messages. */
export function rupiahLabel(minor: number): string {
	return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(minor / 100))}`;
}

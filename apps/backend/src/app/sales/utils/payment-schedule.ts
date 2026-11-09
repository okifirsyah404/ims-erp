/**
 * Planned billing schedule helpers (pure, no I/O).
 * Shares are basis points of the order (10000 = 100%).
 */
import type { TPaymentScheduleItem } from '@drizzle/schemas/sales.schema';

/** Percent text without trailing zeros: 3000 -> "30", 3350 -> "33.5". */
export function formatPercent(bps: number): string {
	return String(Number((bps / 100).toFixed(2)));
}

/** Printed "Payment" line, e.g. "DP 30% - Siap Kirim 40% - Terpasang 30%". */
export function describeSchedule(items: TPaymentScheduleItem[]): string {
	return items
		.map((item) => `${item.label} ${formatPercent(item.percentBps)}%`)
		.join(' - ')
		.slice(0, 300);
}

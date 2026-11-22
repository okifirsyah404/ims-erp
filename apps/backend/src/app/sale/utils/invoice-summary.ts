import type {
	TInvoiceSummary,
	TInvoiceSummaryBucket,
} from '../contracts/invoice.repository.interface';

import { periodKeys } from '@utils/period-keys.util';

/** Re-exported: the helper moved to `@utils` so finance can share it. */
export { periodKeys };

/**
 * Zero-fills the periods a window touches and recomputes the totals from the
 * buckets, so a month with no invoices still appears in the chart.
 */
export function fillSummary(
	range: { from: string; to: string; groupBy: 'month' | 'day' },
	rows: TInvoiceSummaryBucket[],
): TInvoiceSummary {
	const byPeriod = new Map(rows.map((row) => [row.period, row]));
	const buckets = periodKeys(range.from, range.to, range.groupBy).map(
		(period) => byPeriod.get(period) ?? { period, invoiced: 0, count: 0 },
	);
	return {
		from: range.from,
		to: range.to,
		groupBy: range.groupBy,
		totalInvoiced: buckets.reduce((sum, bucket) => sum + bucket.invoiced, 0),
		invoiceCount: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
		buckets,
	};
}

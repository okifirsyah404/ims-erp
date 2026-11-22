import { periodKeys } from '@utils/period-keys.util';
import type {
	TCashFlowSummary,
	TCashFlowSummaryBucket,
} from '../contracts/cash-bank.repository.interface';

/**
 * Zero-fills the periods a window touches and recomputes the totals from the
 * buckets, so a period with no movement still appears in the chart.
 */
export function fillCashFlowSummary(
	range: { from: string; to: string; groupBy: 'month' | 'day' },
	rows: TCashFlowSummaryBucket[],
): TCashFlowSummary {
	const byPeriod = new Map(rows.map((row) => [row.period, row]));
	const buckets = periodKeys(range.from, range.to, range.groupBy).map(
		(period) => byPeriod.get(period) ?? { period, totalIn: 0, totalOut: 0 },
	);
	const totalIn = buckets.reduce((sum, bucket) => sum + bucket.totalIn, 0);
	const totalOut = buckets.reduce((sum, bucket) => sum + bucket.totalOut, 0);
	return {
		from: range.from,
		to: range.to,
		groupBy: range.groupBy,
		totalIn,
		totalOut,
		net: totalIn - totalOut,
		buckets,
	};
}

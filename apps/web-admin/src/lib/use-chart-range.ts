import { useState } from 'react';
import type { TDateRangeValue } from '@ims-erp/ui/components/date-range-picker';

import { salesChartWindow, type TSalesRange } from './dashboard-api';

/**
 * Window state of one dashboard chart: a preset or a custom date range.
 *
 * @remarks
 * Each chart owns its state, so the sales and the income-vs-outcome charts can
 * look at different windows. Each resolved window is its own query key, so
 * switching back is served from cache.
 */
export function useChartRange(today: string) {
	const [range, setRange] = useState<TSalesRange>('6m');
	const [custom, setCustom] = useState<TDateRangeValue>({});
	return {
		range,
		setRange,
		custom,
		setCustom,
		window: salesChartWindow(today, range, custom),
		/** True while Custom is picked but the range is not complete yet. */
		incomplete: range === 'custom' && !(custom.from && custom.to),
	};
}

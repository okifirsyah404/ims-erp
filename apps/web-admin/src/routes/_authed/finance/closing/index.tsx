import { createFileRoute } from '@tanstack/react-router';

import { ClosingPage } from '@/components/finance/closing-page';

/** Search params for the closing page. */
type TClosingSearch = { year?: number; month?: number };

/** `/finance/closing` - checklist + period close/lock (M09 F2/F7). */
export const Route = createFileRoute('/_authed/finance/closing/')({
	validateSearch: (search: Record<string, unknown>): TClosingSearch => ({
		year: search.year ? Number(search.year) || undefined : undefined,
		month: search.month ? Number(search.month) || undefined : undefined,
	}),
	component: ClosingPage,
});

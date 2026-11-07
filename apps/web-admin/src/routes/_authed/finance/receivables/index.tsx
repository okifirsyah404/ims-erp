import { createFileRoute } from '@tanstack/react-router';

import { ReceivablesPage } from '@/components/finance/receivables-page';

/** Search params for the AR aging view. */
type TReceivablesSearch = { asOf?: string };

/** `/finance/receivables` - AR aging on demand (M09 F4). */
export const Route = createFileRoute('/_authed/finance/receivables/')({
	validateSearch: (search: Record<string, unknown>): TReceivablesSearch => ({
		asOf: typeof search.asOf === 'string' ? search.asOf : undefined,
	}),
	component: ReceivablesPage,
});

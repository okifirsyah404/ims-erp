import { createFileRoute } from '@tanstack/react-router';

import { PayablesPage } from '@/components/finance/payables-page';

/** Search params for the AP aging view. */
type TPayablesSearch = { asOf?: string };

/** `/finance/payables` - AP aging + supplier bills (M09 F5). */
export const Route = createFileRoute('/_authed/finance/payables/')({
	validateSearch: (search: Record<string, unknown>): TPayablesSearch => ({
		asOf: typeof search.asOf === 'string' ? search.asOf : undefined,
	}),
	component: PayablesPage,
});

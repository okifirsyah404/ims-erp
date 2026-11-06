import { createFileRoute } from '@tanstack/react-router';

import { TaxCorrections } from '@/components/tax/tax-corrections';

/** Search params: the record whose corrections are shown. */
type TCorrectionsSearch = { recordId?: string };

/** `/finance/tax/corrections` - signed corrections (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/corrections/')({
	validateSearch: (search: Record<string, unknown>): TCorrectionsSearch => ({
		recordId:
			typeof search.recordId === 'string' && search.recordId
				? search.recordId
				: undefined,
	}),
	component: TaxCorrections,
});

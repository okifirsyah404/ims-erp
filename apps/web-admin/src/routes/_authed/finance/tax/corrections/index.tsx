import { createFileRoute } from '@tanstack/react-router';

import { TaxCorrections } from '@/components/tax/tax-corrections';

/** `/finance/tax/corrections` - signed corrections (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/corrections/')({
	component: TaxCorrections,
});

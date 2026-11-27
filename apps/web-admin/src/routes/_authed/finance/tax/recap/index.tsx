import { createFileRoute } from '@tanstack/react-router';

import { TaxRecap } from '@/components/tax/tax-recap';

/** `/finance/tax/recap` - period recap with CSV/XLSX export (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/recap/')({
	component: TaxRecap,
});

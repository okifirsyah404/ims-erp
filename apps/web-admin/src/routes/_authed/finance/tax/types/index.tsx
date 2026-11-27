import { createFileRoute } from '@tanstack/react-router';

import { TaxTypeList } from '@/components/tax/tax-type-list';

/** `/finance/tax/types` - tax type master (ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/types/')({
	component: TaxTypeList,
});

import { createFileRoute } from '@tanstack/react-router';

import { TaxRecordList } from '@/components/tax/tax-record-list';

/** `/finance/tax/records` - tax period working papers (ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/records/')({
	component: TaxRecordList,
});

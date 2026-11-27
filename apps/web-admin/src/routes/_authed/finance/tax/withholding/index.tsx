import { createFileRoute } from '@tanstack/react-router';

import { WithholdingList } from '@/components/tax/withholding-list';

/** `/finance/tax/withholding` - withholding records (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/withholding/')({
	component: WithholdingList,
});

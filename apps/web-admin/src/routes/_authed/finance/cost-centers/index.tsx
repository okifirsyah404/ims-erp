import { createFileRoute } from '@tanstack/react-router';

import { CostCentersPage } from '@/components/finance/cost-centers-page';

/** `/finance/cost-centers` - cost-centre master (ERP-0127). */
export const Route = createFileRoute('/_authed/finance/cost-centers/')({
	component: CostCentersPage,
});

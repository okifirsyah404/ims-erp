import { createFileRoute } from '@tanstack/react-router';

import { FixedAssetsPage } from '@/components/finance/fixed-assets-page';

/** `/finance/fixed-assets` - capitalized assets, depreciation run, fiscal report (ERP-0145). */
export const Route = createFileRoute('/_authed/finance/fixed-assets/')({
	component: FixedAssetsPage,
});

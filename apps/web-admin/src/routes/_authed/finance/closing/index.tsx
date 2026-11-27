import { createFileRoute } from '@tanstack/react-router';

import { ClosingPage } from '@/components/finance/closing-page';

/** `/finance/closing` - period checklist, close/lock transitions (F2/F7). */
export const Route = createFileRoute('/_authed/finance/closing/')({
	component: ClosingPage,
});

import { createFileRoute } from '@tanstack/react-router';

import { JournalPage } from '@/components/finance/journal-page';

/** `/finance/journal` - journal entries and the manual-journal workflow (ERP-0129). */
export const Route = createFileRoute('/_authed/finance/journal/')({
	component: JournalPage,
});

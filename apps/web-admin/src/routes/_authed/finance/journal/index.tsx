import { createFileRoute } from '@tanstack/react-router';

import { JournalPage } from '@/components/finance/journal-page';

/** Search params for the journal list. */
type TJournalSearch = { page?: number };

/** `/finance/journal` - posted journal entries (M09 F2). */
export const Route = createFileRoute('/_authed/finance/journal/')({
	validateSearch: (search: Record<string, unknown>): TJournalSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: JournalPage,
});

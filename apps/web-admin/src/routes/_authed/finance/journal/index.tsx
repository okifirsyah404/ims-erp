import { createFileRoute } from '@tanstack/react-router';

import { JournalPage } from '@/components/finance/journal-page';
import { JOURNAL_STATUSES, type TJournalStatus } from '@/lib/finance-api';

/** Search params for the journal list. */
type TJournalSearch = { page?: number; status?: TJournalStatus };

/** `/finance/journal` - journal entries and the manual-journal workflow (ERP-0129). */
export const Route = createFileRoute('/_authed/finance/journal/')({
	validateSearch: (search: Record<string, unknown>): TJournalSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		status: JOURNAL_STATUSES.includes(search.status as TJournalStatus)
			? (search.status as TJournalStatus)
			: undefined,
	}),
	component: JournalPage,
});

import { createFileRoute } from '@tanstack/react-router';

import { TaxRecordList } from '@/components/tax/tax-record-list';

/** Search params for the record list. */
type TRecordsSearch = {
	page?: number;
	year?: number;
	month?: number;
};

/** `/finance/tax/records` - period working papers (Phase 2, ERP-0016). */
export const Route = createFileRoute('/_authed/finance/tax/records/')({
	validateSearch: (search: Record<string, unknown>): TRecordsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		year: search.year ? Number(search.year) || undefined : undefined,
		month: search.month ? Number(search.month) || undefined : undefined,
	}),
	component: TaxRecordList,
});

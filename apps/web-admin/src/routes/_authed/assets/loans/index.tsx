import { createFileRoute } from '@tanstack/react-router';

import { AssetLoanList } from '@/components/assets/asset-loan-list';

/** Search params for the loans list. */
type TLoansSearch = {
	page?: number;
	/** `open` filters to assets currently `in_use`. */
	status?: string;
};

/** `/assets/loans` — custody assignments (Phase A-4 / D12). */
export const Route = createFileRoute('/_authed/assets/loans/')({
	validateSearch: (search: Record<string, unknown>): TLoansSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		status: typeof search.status === 'string' ? search.status : undefined,
	}),
	component: AssetLoanList,
});

import { createFileRoute } from '@tanstack/react-router';

import { AssetServiceRecordList } from '@/components/assets/asset-service-record-list';

/** Search params for the service-records page. */
type TServiceRecordsSearch = {
	page?: number;
};

/** `/assets/service-records` — maintenance history (Phase A-4). */
export const Route = createFileRoute('/_authed/assets/service-records/')({
	validateSearch: (search: Record<string, unknown>): TServiceRecordsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: AssetServiceRecordList,
});

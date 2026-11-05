import { createFileRoute } from '@tanstack/react-router';

import { AssetRegisterList } from '@/components/assets/asset-register-list';

/** Search params for the register list (URL-backed filters). */
type TAssetsSearch = {
	page?: number;
	search?: string;
	status?: string;
	assetType?: string;
	includeArchived?: boolean;
};

/** `/assets` — the asset register list (Phase A-4). */
export const Route = createFileRoute('/_authed/assets/')({
	validateSearch: (search: Record<string, unknown>): TAssetsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search:
			typeof search.search === 'string' && search.search
				? search.search
				: undefined,
		status: typeof search.status === 'string' ? search.status : undefined,
		assetType:
			typeof search.assetType === 'string' ? search.assetType : undefined,
		includeArchived:
			search.includeArchived === true || search.includeArchived === 'true'
				? true
				: undefined,
	}),
	component: AssetRegisterList,
});

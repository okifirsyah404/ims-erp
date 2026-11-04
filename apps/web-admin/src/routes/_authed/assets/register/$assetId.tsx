import { createFileRoute } from '@tanstack/react-router';

import { AssetDetail } from '@/components/assets/asset-detail';

/** `/assets/register/$assetId` — asset detail with history (Phase A-4). */
export const Route = createFileRoute('/_authed/assets/register/$assetId')({
	component: AssetDetailPage,
});

function AssetDetailPage() {
	const { assetId } = Route.useParams();
	return <AssetDetail assetId={assetId} />;
}

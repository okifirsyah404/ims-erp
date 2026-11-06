import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { AssetForm } from '@/components/assets/asset-form';
import { usePermission } from '@/lib/use-permission';

/** `/assets/register/new` — register a new asset (Phase A-4). */
export const Route = createFileRoute('/_authed/assets/register/new')({
	component: NewAssetPage,
});

function NewAssetPage() {
	const canCreate = usePermission('asset.create');
	const navigate = useNavigate();
	if (!canCreate) {
		void navigate({ to: '/assets/register' });
		return null;
	}
	return <AssetForm />;
}

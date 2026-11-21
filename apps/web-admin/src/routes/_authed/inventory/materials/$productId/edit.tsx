import { createFileRoute } from '@tanstack/react-router';

import { ItemEditPage } from '@/components/inventory/item-edit-page';

/** Edit form of a material. */
export const Route = createFileRoute('/_authed/inventory/materials/$productId/edit')({
	component: EditRoute,
});

function EditRoute() {
	const { productId } = Route.useParams();
	return <ItemEditPage kind='material' itemId={productId} />;
}
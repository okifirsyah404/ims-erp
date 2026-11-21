import { createFileRoute } from '@tanstack/react-router';

import { ItemDetailPage } from '@/components/inventory/item-detail-page';

/** Detail of a material: its fields, document photo and serialized units. */
export const Route = createFileRoute('/_authed/inventory/materials/$productId/')({
	component: DetailRoute,
});

function DetailRoute() {
	const { productId } = Route.useParams();
	return <ItemDetailPage kind='material' itemId={productId} />;
}
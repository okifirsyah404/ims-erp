import { createFileRoute } from '@tanstack/react-router';

import { ItemDetailPage } from '@/components/inventory/item-detail-page';

/** Detail of a product: its fields, document photo and serialized units. */
export const Route = createFileRoute('/_authed/products/$productId/')({
	component: DetailRoute,
});

function DetailRoute() {
	const { productId } = Route.useParams();
	return <ItemDetailPage kind='product' itemId={productId} />;
}
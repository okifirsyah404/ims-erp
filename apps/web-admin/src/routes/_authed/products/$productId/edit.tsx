import { createFileRoute } from '@tanstack/react-router';

import { ItemEditPage } from '@/components/inventory/item-edit-page';

/** Edit form of a product. */
export const Route = createFileRoute('/_authed/products/$productId/edit')({
	component: EditRoute,
});

function EditRoute() {
	const { productId } = Route.useParams();
	return <ItemEditPage kind='product' itemId={productId} />;
}
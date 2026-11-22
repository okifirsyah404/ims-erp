import { createFileRoute } from '@tanstack/react-router';

import { ItemEditPage } from '@/components/inventory/item-edit-page';

/** Edit form of a component. */
export const Route = createFileRoute('/_authed/inventory/components/$productId/edit')({
	component: EditRoute,
});

function EditRoute() {
	const { productId } = Route.useParams();
	return <ItemEditPage kind='component' itemId={productId} />;
}
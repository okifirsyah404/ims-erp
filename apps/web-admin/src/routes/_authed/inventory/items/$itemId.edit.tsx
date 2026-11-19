import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemForm } from '@/components/inventory/item-form';
import {
	productQueryOptions,
	updateProduct,
	type TProductUpdateInput,
} from '@/lib/inventory-api';

/** `/inventory/items/$itemId/edit` — edits a product's mutable fields. */
export const Route = createFileRoute('/_authed/inventory/items/$itemId/edit')({
	component: EditItemPage,
});

function EditItemPage() {
	const { t } = useTranslation(['inventory', 'common']);
	const { itemId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	const { data: item, isPending, isError } = useQuery(productQueryOptions(itemId));

	async function handleSubmit(input: TProductUpdateInput | Record<string, unknown>) {
		setSubmitting(true);
		try {
			await updateProduct(itemId, input as TProductUpdateInput);
			toast.success(t('inventory:form.updated'));
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] }),
				queryClient.invalidateQueries({
					queryKey: productQueryOptions(itemId).queryKey,
				}),
			]);
			void navigate({
				to: '/inventory/items/$itemId',
				params: { itemId },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	if (isPending) return null;

	if (isError || !item) {
		return (
			<AdminOnly>
				<p className='text-sm text-muted-foreground'>
					{t('inventory:detail.notFound')}
				</p>
			</AdminOnly>
		);
	}

	return (
		<AdminOnly>
			<ItemForm
				item={item}
				submitting={submitting}
				onSubmit={(input) => void handleSubmit(input)}
				onCancel={() =>
					void navigate({ to: '/inventory/items/$itemId', params: { itemId } })
				}
			/>
		</AdminOnly>
	);
}

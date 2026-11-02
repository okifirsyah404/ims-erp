import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemForm } from '@/components/inventory/item-form';
import { createItem, type TItemCreateInput } from '@/lib/inventory-api';

/** `/inventory/items/new` — creates an item. */
export const Route = createFileRoute('/_authed/inventory/items/new')({
	component: NewItemPage,
});

function NewItemPage() {
	const { t } = useTranslation(['inventory', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(input: TItemCreateInput | Record<string, unknown>) {
		setSubmitting(true);
		try {
			const created = await createItem(input as TItemCreateInput);
			if (!created) throw new Error(t('common:error.failed'));
			toast.success(t('inventory:form.created'));
			await queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
			void navigate({
				to: '/inventory/items/$itemId',
				params: { itemId: created.id },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<AdminOnly>
			<ItemForm
				submitting={submitting}
				onSubmit={(input) => void handleSubmit(input)}
				onCancel={() => void navigate({ to: '/inventory/products' })}
			/>
		</AdminOnly>
	);
}

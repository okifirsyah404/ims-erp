import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { SearchX } from 'lucide-react';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';

import { AdminOnly } from '@/components/inventory/admin-only';
import { ItemForm } from '@/components/inventory/item-form';
import {
	productQueryOptions,
	updateProduct,
	type TProductKind,
	type TProductUpdateInput,
} from '@/lib/inventory-api';
import { uploadGalleryImages } from '@/lib/image-gallery-api';
import { itemDetailLink, itemEditLink } from '@/lib/item-routes';

/**
 * Edits a product's mutable fields, shared by the three kind routes.
 *
 * @remarks
 * Like the detail page, an item opened under the wrong kind is redirected to
 * the edit route of its own kind.
 */
export function ItemEditPage({ kind, itemId }: { kind: TProductKind; itemId: string }) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	const { data: item, isPending, isError, error: loadError } = useQuery(productQueryOptions(itemId));

	async function handleSubmit(
		input: TProductUpdateInput | Record<string, unknown>,
		imageFiles: File[],
	) {
		setSubmitting(true);
		try {
			await updateProduct(itemId, input as TProductUpdateInput);
			// A failed upload must not lose the saved edit: report it and carry on.
			if (imageFiles.length) {
				const errors = await uploadGalleryImages(`/products/${itemId}`, imageFiles);
				if (errors.length) toast.error(errors.join(' '));
			}
			toast.success(t('product:form.updated'));
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] }),
				queryClient.invalidateQueries({ queryKey: ['image-gallery'] }),
				queryClient.invalidateQueries({
					queryKey: productQueryOptions(itemId).queryKey,
				}),
			]);
			void navigate(itemDetailLink(kind, itemId));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	if (isPending) return <PageSkeleton cards={1} />;

	if (isError) return <ErrorState error={loadError} bordered />;

	if (!item) {
		return (
			<AdminOnly>
				<EmptyState icon={SearchX} title={t('product:detail.notFound')} bordered />
			</AdminOnly>
		);
	}

	if (item.productKind !== kind) {
		return <Navigate {...itemEditLink(item.productKind, itemId)} replace />;
	}

	return (
		<AdminOnly>
			<ItemForm
				item={item}
				submitting={submitting}
				onSubmit={(input, imageFiles) => void handleSubmit(input, imageFiles)}
				onCancel={() => void navigate(itemDetailLink(kind, itemId))}
			/>
		</AdminOnly>
	);
}

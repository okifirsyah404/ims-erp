import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Ban } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	DOCUMENT_STATUSES,
	documentsQueryOptions,
	voidDocument,
	type TDocument,
	type TDocumentListParams,
	type TDocumentStatus,
} from '@/lib/documents-api';
import { usePermission } from '@/lib/use-permission';

type TDocumentSearch = { page?: number; search?: string; status?: string };

export const Route = createFileRoute('/_authed/documents/files/')({
	validateSearch: (search: Record<string, unknown>): TDocumentSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search: typeof search.search === 'string' ? search.search : undefined,
		status: typeof search.status === 'string' ? search.status : undefined,
	}),
	component: DocumentsPage,
});

/** `/documents/files` — the issued-document registry. */
function DocumentsPage() {
	const { t } = useTranslation(['documents', 'common']);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const canRead = usePermission('document.read');
	const canUpdate = usePermission('document.update');
	const [draft, setDraft] = useState(search.search ?? '');

	const params: TDocumentListParams = {
		page: search.page ?? 1,
		limit: 20,
		search: search.search,
		status: search.status as TDocumentStatus | undefined,
	};
	const { data, isPending, isError, error } = useQuery({
		...documentsQueryOptions(params),
		enabled: canRead,
	});

	const voidMutation = useMutation({
		mutationFn: voidDocument,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['documents'] });
			toast.success(t('documents:voided'));
		},
		onError: (cause) => toast.error(cause instanceof Error ? cause.message : t('common:error.failed')),
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TDocument, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TDocument, CellData>[] = [
			{
				id: 'code',
				header: t('documents:code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (
					<Link
						to='/documents/files/$documentId'
						params={{ documentId: row.original.id }}
						className='hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				accessorKey: 'documentType',
				header: t('documents:type'),
				meta: { cellClassName: 'text-xs' },
			},
			{ accessorKey: 'title', header: t('documents:documentTitle') },
			{
				accessorKey: 'issuedOn',
				header: t('documents:issuedOn'),
				meta: { cellClassName: 'whitespace-nowrap text-xs' },
			},
			{
				id: 'status',
				header: t('documents:status'),
				cell: ({ row }) => (
					<Badge variant={row.original.status === 'void' ? 'outline' : 'secondary'}>
						{t(`documents:status.${row.original.status}`)}
					</Badge>
				),
			},
		];
		if (!canUpdate) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						disabled={voidMutation.isPending}
						actions={[
							{
								key: 'void',
								label: t('documents:void'),
								icon: Ban,
								destructive: true,
								hidden: row.original.status === 'void',
								onSelect: () => voidMutation.mutate(row.original.id),
							},
						]}
					/>
				),
			},
		];
	}, [t, canUpdate, voidMutation]);

	if (!canRead) {
		return <div className='text-sm text-muted-foreground'>{t('documents:noPermission')}</div>;
	}

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='flex items-center gap-2 text-2xl font-bold'>
					<FileText className='size-6' />
					{t('documents:title')}
				</h1>
				<p className='text-sm text-muted-foreground'>{t('documents:description')}</p>
			</div>

			<div className='flex flex-wrap items-end gap-3'>
				<form
					className='flex items-end gap-2'
					onSubmit={(event) => {
						event.preventDefault();
						void navigate({
							search: (prev) => ({ ...prev, page: 1, search: draft.trim() || undefined }),
						});
					}}
				>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('documents:search')}</span>
						<Input
							className='w-64'
							value={draft}
							placeholder={t('documents:searchPlaceholder')}
							onChange={(event) => setDraft(event.target.value)}
						/>
					</div>
					<Button type='submit'>{t('common:action.search')}</Button>
				</form>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>{t('documents:status')}</span>
					<Select
						value={search.status ?? 'all'}
						onValueChange={(value) =>
							void navigate({
								search: (prev) => ({
									...prev,
									page: 1,
									status: value === 'all' ? undefined : (value ?? undefined),
								}),
							})
						}
					>
						<SelectTrigger className='w-44'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{t('documents:allStatuses')}</SelectItem>
							{DOCUMENT_STATUSES.map((status) => (
								<SelectItem key={status} value={status}>
									{t(`documents:status.${status}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('documents:entries')}</CardTitle>
					<CardDescription>
						{pagination ? t('documents:count', { count: pagination.total }) : null}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isError && <ErrorState error={error} size='sm' />}
					{!isPending && !isError && rows.length === 0 && (
						<EmptyState title={t('documents:empty')} size='sm' />
					)}
					{(isPending || rows.length > 0) && (
						<DataTable columns={columns} data={rows} getRowId={(row) => row.id} loading={isPending} />
					)}
					{pagination && (
						<PaginationControls
							page={pagination.page}
							totalPages={pagination.totalPages}
							onPageChange={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

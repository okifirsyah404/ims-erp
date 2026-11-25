import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Ban, Download, Eye, FileText, Printer } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
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
import { DocumentThumbnail } from '@/components/documents/document-canvas';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	DOCUMENT_STATUSES,
	documentsQueryOptions,
	downloadDocumentFile,
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

/** `/documents/files` — the issued-document registry as cards with a page preview. */
function DocumentsPage() {
	const { t } = useTranslation(['documents', 'common']);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const canRead = usePermission('document.read');
	const canUpdate = usePermission('document.update');
	const [draft, setDraft] = useState(search.search ?? '');
	// A presigned URL lives five minutes; one refetch per mount hands out fresh
	// ones instead of retrying a dead link on every card.
	const refreshed = useRef(false);

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

	const onPreviewError = useCallback(() => {
		if (refreshed.current) return;
		refreshed.current = true;
		void queryClient.invalidateQueries({ queryKey: ['documents'] });
	}, [queryClient]);

	const voidMutation = useMutation({
		mutationFn: voidDocument,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['documents'] });
			toast.success(t('documents:voided'));
		},
		onError: (cause) => toast.error(cause instanceof Error ? cause.message : t('common:error.failed')),
	});

	const voidWithConfirm = async (document: TDocument) => {
		const confirmed = await confirm({
			title: t('documents:voidConfirmTitle'),
			description: t('documents:voidConfirmDescription'),
			confirmLabel: t('documents:void'),
			destructive: true,
		});
		if (confirmed) voidMutation.mutate(document.id);
	};

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
				<CardContent className='flex flex-col gap-4'>
					{isError && <ErrorState error={error} size='sm' />}
					{!isPending && !isError && rows.length === 0 && (
						<EmptyState title={t('documents:empty')} size='sm' />
					)}
					{(isPending || rows.length > 0) && (
						<div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'>
							{isPending
								? Array.from({ length: 8 }, (_, index) => (
										<div key={index} className='aspect-210/297 animate-pulse rounded-lg bg-muted' />
									))
								: rows.map((document) => (
										<DocumentCard
											key={document.id}
											document={document}
											canUpdate={canUpdate}
											onVoid={() => void voidWithConfirm(document)}
											onPreviewError={onPreviewError}
										/>
									))}
						</div>
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

/**
 * One registry row as a card. The whole card is a link; void sits beside it so
 * the card never nests a button inside an anchor.
 *
 * @remarks
 * The link is deliberately not prefetched: the detail endpoint appends a
 * `view` row to the access trail, so hovering a card must not write one.
 */
function DocumentCard({
	document,
	canUpdate,
	onVoid,
	onPreviewError,
}: {
	document: TDocument;
	canUpdate: boolean;
	onVoid: () => void;
	onPreviewError: () => void;
}) {
	const { t } = useTranslation(['documents', 'common']);
	const navigate = Route.useNavigate();
	const canDownload = usePermission('document.download');
	const preview = document.preview;

	const open = (search?: { print: true }) =>
		void navigate({
			to: '/documents/files/$documentId',
			params: { documentId: document.id },
			search: search ?? {},
		});

	const download = () => {
		if (!preview) return;
		void downloadDocumentFile(document.id, preview.fileId)
			.then((url) => window.open(url, '_blank', 'noopener'))
			.catch((cause) =>
				toast.error(cause instanceof Error ? cause.message : t('common:error.failed')),
			);
	};

	return (
		<div className='group relative flex flex-col gap-2'>
			<Link
				to='/documents/files/$documentId'
				params={{ documentId: document.id }}
				preload={false}
				className={`flex flex-col gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted/60 ${document.status === 'void' ? 'opacity-60' : ''}`}
			>
				<DocumentThumbnail
					file={document.preview}
					alt={document.title}
					onError={onPreviewError}
				/>
				<div className='min-w-0 px-1 pb-1'>
					<div className='truncate text-sm font-medium'>{document.title}</div>
					<div className='truncate font-mono text-xs text-muted-foreground'>{document.code}</div>
					<div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
						<span className='truncate'>
							{document.documentType}
							{document.issuedOn ? ` · ${document.issuedOn}` : ''}
						</span>
						<Badge variant={document.status === 'void' ? 'outline' : 'secondary'}>
							{t(`documents:status.${document.status}`)}
						</Badge>
					</div>
				</div>
			</Link>
			<div className='absolute top-2 right-2 rounded-md bg-background/80 backdrop-blur opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100'>
				<RowActions
					menu
					label={t('common:action.actions')}
					actions={[
						{
							key: 'detail',
							label: t('documents:detailAction'),
							icon: Eye,
							onSelect: () => open(),
						},
						{
							key: 'void',
							label: t('documents:void'),
							icon: Ban,
							destructive: true,
							hidden: !canUpdate || document.status === 'void',
							onSelect: onVoid,
						},
						{
							key: 'print',
							label: t('documents:print'),
							icon: Printer,
							disabled: !preview,
							onSelect: () => open({ print: true }),
						},
						{
							key: 'download',
							label: t('common:action.download'),
							icon: Download,
							disabled: !preview || !canDownload,
							onSelect: download,
						},
					]}
				/>
			</div>
		</div>
	);
}

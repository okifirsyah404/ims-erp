import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { useState } from 'react';
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	DOCUMENT_STATUSES,
	documentsQueryOptions,
	voidDocument,
	type TDocumentListParams,
	type TDocumentStatus,
} from '@/lib/documents-api';
import { usePermission } from '@/lib/use-permission';

type TDocumentSearch = { page?: number; search?: string; status?: string };

export const Route = createFileRoute('/_authed/documents/')({
	validateSearch: (search: Record<string, unknown>): TDocumentSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search: typeof search.search === 'string' ? search.search : undefined,
		status: typeof search.status === 'string' ? search.status : undefined,
	}),
	component: DocumentsPage,
});

/** `/documents` — the issued-document registry. */
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
					{isError && <p className='text-sm text-destructive'>{error.message}</p>}
					{!isPending && !isError && rows.length === 0 && (
						<p className='text-sm text-muted-foreground'>{t('documents:empty')}</p>
					)}
					{rows.length > 0 && (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('documents:code')}</TableHead>
									<TableHead>{t('documents:type')}</TableHead>
									<TableHead>{t('documents:documentTitle')}</TableHead>
									<TableHead>{t('documents:issuedOn')}</TableHead>
									<TableHead>{t('documents:status')}</TableHead>
									{canUpdate && <TableHead />}
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((document) => (
									<TableRow key={document.id}>
										<TableCell className='font-mono text-xs'>{document.code}</TableCell>
										<TableCell className='text-xs'>{document.documentType}</TableCell>
										<TableCell>{document.title}</TableCell>
										<TableCell className='whitespace-nowrap text-xs'>
											{document.issuedOn}
										</TableCell>
										<TableCell>
											<Badge variant={document.status === 'void' ? 'outline' : 'secondary'}>
												{t(`documents:status.${document.status}`)}
											</Badge>
										</TableCell>
										{canUpdate && (
											<TableCell className='text-right'>
												{document.status !== 'void' && (
													<Button
														variant='outline'
														size='sm'
														disabled={voidMutation.isPending}
														onClick={() => voidMutation.mutate(document.id)}
													>
														{t('documents:void')}
													</Button>
												)}
											</TableCell>
										)}
									</TableRow>
								))}
							</TableBody>
						</Table>
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

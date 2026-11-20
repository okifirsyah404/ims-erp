import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { FileCheck2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import {
	SIGNATURE_METHODS,
	signaturesQueryOptions,
	type TSignature,
	type TSignatureMethod,
} from '@/lib/signature-api';
import { usePermission } from '@/lib/use-permission';

type TSignatureRegisterSearch = { page?: number; method?: string };

export const Route = createFileRoute('/_authed/documents/signatures/documents')({
	validateSearch: (search: Record<string, unknown>): TSignatureRegisterSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		method: typeof search.method === 'string' ? search.method : undefined,
	}),
	component: SignatureRegisterPage,
});

/** `/documents/signatures/documents` — the signature evidence register. */
function SignatureRegisterPage() {
	const { t, i18n } = useTranslation(['signatures', 'common']);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const canRead = usePermission('document.signature_read');

	const { data, isPending, isError, error } = useQuery({
		...signaturesQueryOptions({
			page: search.page ?? 1,
			limit: 20,
			method: search.method as TSignatureMethod | undefined,
		}),
		enabled: canRead,
	});

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	const columns = useMemo<ColumnDef<DataTableFeatures, TSignature, CellData>[]>(
		() => [
			{
				id: 'document',
				header: t('signatures:document'),
				cell: ({ row }) => (
					<>
						<span className='font-mono text-xs'>
							{row.original.documentCode ?? row.original.documentId}
						</span>
						{row.original.documentTitle && (
							<span className='block text-xs text-muted-foreground'>
								{row.original.documentTitle}
							</span>
						)}
					</>
				),
			},
			{ accessorKey: 'signerName', header: t('signatures:signer') },
			{
				id: 'method',
				header: t('signatures:method'),
				cell: ({ row }) => (
					<Badge variant={row.original.method === 'electronic' ? 'secondary' : 'outline'}>
						{t(`signatures:methodOption.${row.original.method}`)}
					</Badge>
				),
			},
			{
				id: 'signedAt',
				header: t('signatures:signedAt'),
				meta: { cellClassName: 'whitespace-nowrap text-xs' },
				cell: ({ row }) => new Date(row.original.signedAt).toLocaleString(i18n.language),
			},
			{
				id: 'ipAddress',
				header: t('signatures:ipAddress'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.ipAddress ?? '—',
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center gap-3'>
				<FileCheck2 className='size-5 text-muted-foreground' />
				<div>
					<h1 className='text-lg font-semibold'>{t('signatures:registerTitle')}</h1>
					<p className='text-sm text-muted-foreground'>{t('signatures:registerDescription')}</p>
				</div>
			</div>

			<div className='flex flex-col gap-1'>
				<span className='text-xs text-muted-foreground'>{t('signatures:method')}</span>
				<Select
					value={search.method ?? 'all'}
					onValueChange={(value) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								method: value === 'all' ? undefined : (value ?? undefined),
							}),
						})
					}
				>
					<SelectTrigger className='w-52'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('signatures:allMethods')}</SelectItem>
						{SIGNATURE_METHODS.map((method) => (
							<SelectItem key={method} value={method}>
								{t(`signatures:methodOption.${method}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('signatures:entries')}</CardTitle>
					<CardDescription>
						{pagination ? t('signatures:count', { count: pagination.total }) : null}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isError && <ErrorState error={error} size='sm' />}
					{!isPending && !isError && rows.length === 0 && (
						<EmptyState title={t('signatures:empty')} size='sm' />
					)}
					{((canRead && isPending) || rows.length > 0) && (
						<DataTable
							columns={columns}
							data={rows}
							getRowId={(row) => row.id}
							loading={canRead && isPending}
						/>
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

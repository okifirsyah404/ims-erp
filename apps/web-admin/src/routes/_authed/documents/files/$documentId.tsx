import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Download, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
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
import { PageSkeleton, SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import {
	createDocumentShare,
	deleteDocumentFile,
	documentDetailQueryOptions,
	downloadDocumentFile,
	publicShareUrl,
	revokeDocumentShare,
	type TDocumentFile,
	type TDocumentShare,
	uploadDocumentFile,
} from '@/lib/documents-api';
import { formatDateTime } from '@/lib/format';
import { documentSignatureSectionQueryOptions } from '@/lib/signature-api';
import { usePermission } from '@/lib/use-permission';

/** `/documents/files/$documentId` — one registry document with its files and links. */
export const Route = createFileRoute('/_authed/documents/files/$documentId')({
	component: DocumentDetailPage,
});

const EXPIRY_CHOICES = [7, 30, 90, 365];

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function DocumentDetailPage() {
	const { t, i18n } = useTranslation(['documents', 'signatures', 'common']);
	const { documentId } = Route.useParams();
	const queryClient = useQueryClient();
	const canRead = usePermission('document.read');
	const canUpdate = usePermission('document.update');
	const canDownload = usePermission('document.download');
	const canRequestSignature = usePermission('document.signature_request');
	const fileInput = useRef<HTMLInputElement>(null);
	const [expiresInDays, setExpiresInDays] = useState(30);

	const { data, isPending, isError, error } = useQuery({
		...documentDetailQueryOptions(documentId),
		enabled: canRead,
	});
	const signatureSection = useQuery({
		...documentSignatureSectionQueryOptions(documentId),
		enabled: canRead,
	});

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['documents', documentId] });
	const fail = useCallback(
		(cause: unknown) =>
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed')),
		[t],
	);

	const uploadMutation = useMutation({
		mutationFn: (file: File) => uploadDocumentFile(documentId, file),
		onSuccess: async () => {
			await refresh();
			toast.success(t('documents:fileUploaded'));
		},
		onError: fail,
	});

	const deleteMutation = useMutation({
		mutationFn: (fileId: string) => deleteDocumentFile(documentId, fileId),
		onSuccess: async () => {
			await refresh();
			toast.success(t('documents:fileDeleted'));
		},
		onError: fail,
	});

	const shareMutation = useMutation({
		mutationFn: () => createDocumentShare(documentId, expiresInDays),
		onSuccess: async () => {
			await refresh();
			toast.success(t('documents:shareCreated'));
		},
		onError: fail,
	});

	const revokeMutation = useMutation({
		mutationFn: (shareId: string) => revokeDocumentShare(documentId, shareId),
		onSuccess: async () => {
			await refresh();
			toast.success(t('documents:shareRevoked'));
		},
		onError: fail,
	});

	const editable = canUpdate && data?.status !== 'void';

	const fileColumns = useMemo<ColumnDef<DataTableFeatures, TDocumentFile, CellData>[]>(
		() => [
			{ accessorKey: 'fileName', header: t('documents:fileName') },
			{
				id: 'fileSize',
				header: t('documents:fileSize'),
				meta: { align: 'right', cellClassName: 'text-xs' },
				cell: ({ row }) =>
					`${Math.max(1, Math.round(row.original.sizeBytes / 1024)).toLocaleString(i18n.language)} KB`,
			},
			{
				id: 'uploadedAt',
				header: t('documents:uploadedAt'),
				meta: { cellClassName: 'whitespace-nowrap text-xs' },
				cell: ({ row }) => formatDateTime(row.original.uploadedAt, i18n.language),
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<div className='flex justify-end gap-1'>
						{canDownload && (
							<Button
								variant='ghost'
								size='icon'
								onClick={() => {
									void downloadDocumentFile(documentId, row.original.id)
										.then((url) => window.open(url, '_blank', 'noopener'))
										.catch(fail);
								}}
							>
								<Download className='size-4' />
							</Button>
						)}
						{editable && (
							<Button
								variant='ghost'
								size='icon'
								disabled={deleteMutation.isPending}
								onClick={() => deleteMutation.mutate(row.original.id)}
							>
								<Trash2 className='size-4' />
							</Button>
						)}
					</div>
				),
			},
		],
		[t, i18n.language, canDownload, editable, documentId, deleteMutation, fail],
	);

	const shareColumns = useMemo<ColumnDef<DataTableFeatures, TDocumentShare, CellData>[]>(
		() => [
			{
				id: 'link',
				header: t('documents:link'),
				meta: { cellClassName: 'max-w-72 truncate font-mono text-xs' },
				cell: ({ row }) => publicShareUrl(row.original.token),
			},
			{
				id: 'expiresAt',
				header: t('documents:expiresAt'),
				meta: { cellClassName: 'whitespace-nowrap text-xs' },
				cell: ({ row }) =>
					row.original.expiresAt ? formatDateTime(row.original.expiresAt, i18n.language) : '—',
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<div className='flex justify-end gap-1'>
						<Button
							variant='outline'
							size='sm'
							onClick={() => {
								void navigator.clipboard
									.writeText(publicShareUrl(row.original.token))
									.then(() => toast.success(t('documents:linkCopied')));
							}}
						>
							{t('documents:copyLink')}
						</Button>
						{editable && (
							<Button
								variant='ghost'
								size='sm'
								disabled={revokeMutation.isPending}
								onClick={() => revokeMutation.mutate(row.original.id)}
							>
								{t('documents:revoke')}
							</Button>
						)}
					</div>
				),
			},
		],
		[t, i18n.language, editable, revokeMutation],
	);

	if (!canRead) {
		return <div className='text-sm text-muted-foreground'>{t('documents:noPermission')}</div>;
	}
	if (isPending) return <PageSkeleton />;
	if (isError) return <ErrorState error={error} bordered />;

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/documents/files' className='text-sm text-muted-foreground hover:underline'>
				{t('documents:back')}
			</Link>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h1 className='font-mono text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>{data.title}</p>
				</div>
				<Badge variant={data.status === 'void' ? 'outline' : 'secondary'}>
					{t(`documents:status.${data.status}`)}
				</Badge>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('documents:overview')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<Detail label={t('documents:type')} value={data.documentType} />
					<Detail label={t('documents:issuedOn')} value={data.issuedOn} />
					<Detail label={t('documents:source')} value={data.sourceType} />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('documents:files')}</CardTitle>
					<CardDescription>{t('documents:filesHint')}</CardDescription>
					{editable && (
						<CardAction>
							<input
								ref={fileInput}
								type='file'
								className='hidden'
								accept='application/pdf,image/png,image/jpeg,image/webp'
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) uploadMutation.mutate(file);
									event.target.value = '';
								}}
							/>
							<Button
								size='sm'
								disabled={uploadMutation.isPending}
								onClick={() => fileInput.current?.click()}
							>
								{t('documents:uploadFile')}
							</Button>
						</CardAction>
					)}
				</CardHeader>
				<CardContent>
					{data.files.length === 0 ? (
						<EmptyState title={t('documents:noFiles')} size='sm' />
					) : (
						<DataTable columns={fileColumns} data={data.files} getRowId={(row) => row.id} />
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('documents:shares')}</CardTitle>
					<CardDescription>{t('documents:sharesHint')}</CardDescription>
					{editable && (
						<CardAction className='flex items-center gap-2'>
							<Select
								value={String(expiresInDays)}
								onValueChange={(value) => setExpiresInDays(Number(value))}
							>
								<SelectTrigger className='w-40'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EXPIRY_CHOICES.map((days) => (
										<SelectItem key={days} value={String(days)}>
											{t('documents:expiresInDays', { count: days })}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								size='sm'
								disabled={shareMutation.isPending}
								onClick={() => shareMutation.mutate()}
							>
								{t('documents:createShare')}
							</Button>
						</CardAction>
					)}
				</CardHeader>
				<CardContent>
					{data.shares.length === 0 ? (
						<EmptyState title={t('documents:noShares')} size='sm' />
					) : (
						<DataTable columns={shareColumns} data={data.shares} getRowId={(row) => row.id} />
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('signatures:entries')}</CardTitle>
					<CardDescription>{t('signatures:registerDescription')}</CardDescription>
					{canRequestSignature && data.status !== 'void' && (
						<CardAction>
							<Link
								to='/documents/signatures/request'
								className='text-sm font-medium text-primary hover:underline'
							>
								{t('signatures:requestTitle')}
							</Link>
						</CardAction>
					)}
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{signatureSection.isError && <ErrorState error={signatureSection.error} size='sm' />}
					<div>
						<h3 className='mb-2 text-sm font-medium'>{t('signatures:signaturesOnDocument')}</h3>
						{signatureSection.isPending ? (
							<SectionSkeleton lines={2} />
						) : (signatureSection.data?.signatures ?? []).length === 0 ? (
							<EmptyState title={t('signatures:empty')} size='sm' />
						) : (
							<ul className='flex flex-col gap-1 text-sm'>
								{(signatureSection.data?.signatures ?? []).map((signature) => (
									<li key={signature.id} className='flex flex-wrap justify-between gap-3'>
										<span>
											{signature.signerName} ·{' '}
											{t(`signatures:methodOption.${signature.method}`)}
										</span>
										<span className='text-xs text-muted-foreground'>
											{formatDateTime(signature.signedAt, i18n.language)}
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
					<div>
						<h3 className='mb-2 text-sm font-medium'>{t('signatures:outgoing')}</h3>
						{signatureSection.isPending ? (
							<SectionSkeleton lines={2} />
						) : (signatureSection.data?.requests ?? []).length === 0 ? (
							<EmptyState title={t('signatures:outgoingEmpty')} size='sm' />
						) : (
							<ul className='flex flex-col gap-1 text-sm'>
								{(signatureSection.data?.requests ?? []).map((request) => (
									<li key={request.id} className='flex flex-wrap items-center justify-between gap-3'>
										<span>
											{request.signerName}
											{request.expiresAt
												? ` · ${t('signatures:expiresAt')} ${formatDateTime(request.expiresAt, i18n.language)}`
												: ''}
										</span>
										<Badge variant={request.effectiveStatus === 'pending' ? 'secondary' : 'outline'}>
											{t(`signatures:status.${request.effectiveStatus}`)}
										</Badge>
									</li>
								))}
							</ul>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('documents:accessTrail')}</CardTitle>
					<CardDescription>{t('documents:accessTrailHint')}</CardDescription>
				</CardHeader>
				<CardContent>
					{data.accessTrail.length === 0 ? (
						<EmptyState title={t('documents:noAccess')} size='sm' />
					) : (
						<ul className='flex flex-col gap-1 text-sm'>
							{data.accessTrail.map((row) => (
								<li key={row.id} className='flex justify-between gap-3'>
									<span>{t(`documents:action.${row.action}`)}</span>
									<span className='text-xs text-muted-foreground'>
										{formatDateTime(row.accessedAt, i18n.language)}
									</span>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

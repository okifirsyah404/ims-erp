import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, Copy, Download, PanelRight, Printer, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@ims-erp/ui/components/sheet';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { DocumentPages } from '@/components/documents/document-canvas';
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
	voidDocument,
} from '@/lib/documents-api';
import { formatDateTime } from '@/lib/format';
import { documentSignatureSectionQueryOptions } from '@/lib/signature-api';
import { usePermission } from '@/lib/use-permission';

/**
 * `/documents/files/$documentId` — the document viewer.
 *
 * @remarks
 * The document is the page: every file page is stacked and drawn as it comes
 * into view. Metadata, files, share links, signatures and the access trail
 * live in the details panel, so the canvas stays as wide as the window.
 * `?print=1` (the card menu's Print) opens the browser dialog once every page
 * is drawn.
 */
export const Route = createFileRoute('/_authed/documents/files/$documentId')({
	validateSearch: (search: Record<string, unknown>): { print?: true } =>
		search.print === '1' || search.print === true ? { print: true } : {},
	component: DocumentViewerPage,
});

const EXPIRY_CHOICES = [7, 30, 90, 365];

/** Safety valve: printing must not hang on a page that never draws. */
const PRINT_TIMEOUT_MS = 8000;

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function isPdfFile(file: TDocumentFile | undefined) {
	if (!file) return false;
	return file.mimeType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');
}

function DocumentViewerPage() {
	const { t, i18n } = useTranslation(['documents', 'signatures', 'common']);
	const { documentId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const canRead = usePermission('document.read');
	const canUpdate = usePermission('document.update');
	const canDownload = usePermission('document.download');
	const canRequestSignature = usePermission('document.signature_request');
	const fileInput = useRef<HTMLInputElement>(null);
	const [expiresInDays, setExpiresInDays] = useState(30);
	const [fileId, setFileId] = useState<string | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [printing, setPrinting] = useState(false);
	const printWhenReady = useRef<(() => void) | null>(null);

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
		mutationFn: (id: string) => deleteDocumentFile(documentId, id),
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

	const voidMutation = useMutation({
		mutationFn: () => voidDocument(documentId),
		onSuccess: async () => {
			await refresh();
			await queryClient.invalidateQueries({ queryKey: ['documents'] });
			toast.success(t('documents:voided'));
		},
		onError: fail,
	});

	const editable = canUpdate && data?.status !== 'void';
	const files = data?.files ?? [];
	const activeFile = files.find((file) => file.id === fileId) ?? files[0];

	const download = useCallback(
		(file: TDocumentFile) => {
			void downloadDocumentFile(documentId, file.id)
				.then((url) => window.open(url, '_blank', 'noopener'))
				.catch(fail);
		},
		[documentId, fail],
	);

	/**
	 * Print the document, not the app chrome.
	 *
	 * @remarks
	 * A PDF prints page by page: pages the reader never scrolled to are drawn
	 * first (the canvas is told to render everything), and only then does the
	 * browser dialog open — otherwise unvisited pages come out blank.
	 */
	const clearPrintFlag = () => {
		if (search.print) void navigate({ search: {}, replace: true });
	};

	const print = () => {
		if (!activeFile) return;
		if (!isPdfFile(activeFile)) {
			window.print();
			clearPrintFlag();
			return;
		}
		setPrinting(true);
		printWhenReady.current = () => {
			printWhenReady.current = null;
			setPrinting(false);
			window.print();
			clearPrintFlag();
		};
		window.setTimeout(() => printWhenReady.current?.(), PRINT_TIMEOUT_MS);
	};
	const printAllRendered = useCallback(() => printWhenReady.current?.(), []);

	// `?print=1` (the card menu's Print): open the dialog once the document is on
	// screen. The flag is dropped afterwards so a reload does not print again.
	const autoPrinted = useRef(false);
	useEffect(() => {
		if (!search.print || autoPrinted.current || !activeFile) return;
		autoPrinted.current = true;
		print();
	});

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
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						actions={[
							{
								key: 'download',
								label: t('common:action.download'),
								icon: Download,
								hidden: !canDownload,
								onSelect: () => download(row.original),
							},
							{
								key: 'delete',
								label: t('common:action.delete'),
								icon: Trash2,
								destructive: true,
								disabled: deleteMutation.isPending,
								hidden: !editable,
								onSelect: () => deleteMutation.mutate(row.original.id),
							},
						]}
					/>
				),
			},
		],
		[t, i18n.language, canDownload, editable, deleteMutation, download],
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
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						actions={[
							{
								key: 'copy',
								label: t('documents:copyLink'),
								icon: Copy,
								onSelect: () => {
									void navigator.clipboard
										.writeText(publicShareUrl(row.original.token))
										.then(() => toast.success(t('documents:linkCopied')));
								},
							},
							{
								key: 'revoke',
								label: t('documents:revoke'),
								icon: Ban,
								destructive: true,
								disabled: revokeMutation.isPending,
								hidden: !editable,
								onSelect: () => revokeMutation.mutate(row.original.id),
							},
						]}
					/>
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

	const askVoid = async () => {
		const confirmed = await confirm({
			title: t('documents:voidConfirmTitle'),
			description: t('documents:voidConfirmDescription'),
			confirmLabel: t('documents:void'),
			destructive: true,
		});
		if (confirmed) voidMutation.mutate();
	};

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-wrap items-center justify-between gap-3 print:hidden'>
				<div className='flex min-w-0 items-center gap-2'>
					<Button
						variant='ghost'
						size='icon'
						nativeButton={false}
						aria-label={t('documents:back')}
						render={<Link to='/documents/files' />}
					>
						<ArrowLeft className='size-4' />
					</Button>
					<div className='min-w-0'>
						<div className='flex items-center gap-2'>
							<span className='truncate font-mono text-lg font-semibold'>{data.code}</span>
							<Badge variant={data.status === 'void' ? 'outline' : 'secondary'}>
								{t(`documents:status.${data.status}`)}
							</Badge>
						</div>
						<div className='truncate text-sm text-muted-foreground'>{data.title}</div>
					</div>
				</div>
				<div className='flex flex-wrap items-center gap-2'>
					{files.length > 1 && (
						<Select
							value={activeFile?.id ?? ''}
							onValueChange={(value) => setFileId(value ?? null)}
						>
							<SelectTrigger className='w-56'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{files.map((file) => (
									<SelectItem key={file.id} value={file.id}>
										{file.fileName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					<Button
						variant='outline'
						size='sm'
						disabled={!activeFile}
						onClick={() => activeFile && download(activeFile)}
					>
						<Download className='size-4' />
						{t('common:action.download')}
					</Button>
					<Button variant='outline' size='sm' disabled={!activeFile || printing} onClick={print}>
						<Printer className='size-4' />
						{t('documents:print')}
					</Button>
					{editable && (
						<Button
							variant='outline'
							size='sm'
							disabled={voidMutation.isPending}
							onClick={() => void askVoid()}
						>
							<Ban className='size-4' />
							{t('documents:void')}
						</Button>
					)}
					<Button variant='outline' size='sm' onClick={() => setDetailsOpen(true)}>
						<PanelRight className='size-4' />
						{t('documents:details')}
					</Button>
				</div>
			</div>

			<div className='rounded-lg bg-muted/40 p-3 print:bg-transparent print:p-0'>
				{!activeFile ? (
					<div className='flex flex-col items-center gap-3 py-16'>
						<EmptyState title={t('documents:noFiles')} description={t('documents:filesHint')} size='sm' />
						{editable && (
							<Button size='sm' disabled={uploadMutation.isPending} onClick={() => fileInput.current?.click()}>
								{t('documents:uploadFile')}
							</Button>
						)}
					</div>
				) : isPdfFile(activeFile) ? (
					<DocumentPages
						key={activeFile.url}
						url={activeFile.url}
						force={printing}
						onAllRendered={printAllRendered}
					/>
				) : (
					<img
						src={activeFile.url}
						alt={activeFile.fileName}
						className='mx-auto max-h-[85vh] rounded-sm bg-white shadow-sm'
					/>
				)}
			</div>

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

			<Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
				<SheetContent
					side='right'
					className='w-full overflow-y-auto data-[side=right]:sm:max-w-2xl print:hidden'
				>
					<SheetHeader>
						<SheetTitle className='font-mono'>{data.code}</SheetTitle>
						<SheetDescription>{data.title}</SheetDescription>
					</SheetHeader>
					<div className='flex flex-col gap-4 px-4 pb-4'>
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
									<DataTable columns={fileColumns} data={data.files} getRowId={(row) => row.id} sortable />
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
									<DataTable columns={shareColumns} data={data.shares} getRowId={(row) => row.id} sortable />
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
				</SheetContent>
			</Sheet>
		</div>
	);
}

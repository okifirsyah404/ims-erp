import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Download, FileUp, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { useConfirm } from '@/components/confirm-dialog';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import {
	createEmployeeDocument,
	EMPLOYEE_DOCUMENT_TYPES,
	employeeDocumentDownloadUrl,
	employeeDocumentsQueryOptions,
	regenerateAgreementPdf,
	type TEmployeeDocument,
	type TEmployeeDocumentType,
	uploadEmployeeDocumentFile,
	voidEmployeeDocument,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';

const isLiveAgreement = (row: TEmployeeDocument) => row.documentType === 'employment_agreement' && row.status !== 'void';

/**
 * The Documents card of the employee page (ERP-0121, grill-me Q13/Q14): the
 * employment agreement opened on invite (its PDF arrives after the claim)
 * plus KTP, NPWP, CV, certificates. Upload attaches a file, "void" keeps the
 * row. Reading `employee.read`; every change `employee.update`.
 */
export function EmployeeDocumentsCard({ employeeId }: { employeeId: string }) {
	const { t } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const canUpdate = usePermission('employee.update');
	const confirm = useConfirm();
	const query = useQuery(employeeDocumentsQueryOptions(employeeId));
	const [busy, setBusy] = useState(false);
	const [adding, setAdding] = useState(false);
	const upload = useRef<HTMLInputElement>(null);
	const [uploadFor, setUploadFor] = useState<string | null>(null);

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['hr', 'employee-documents', employeeId] });
			toast.success(done);
			return true;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	};

	const download = async (row: TEmployeeDocument, fileId: string) => {
		try {
			const { url } = await employeeDocumentDownloadUrl(employeeId, row.id, fileId);
			window.open(url, '_blank', 'noopener');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		}
	};

	const hasAgreement = (query.data ?? []).some(isLiveAgreement);

	return (
		<Card className='lg:col-span-2'>
			<CardHeader>
				<CardTitle>{t('hr:documents.title')}</CardTitle>
				{canUpdate && (
					<CardAction className='flex gap-2'>
						{query.data && !hasAgreement && (
							<Button
								size='sm'
								variant='outline'
								disabled={busy}
								onClick={() =>
									void run(() => createEmployeeDocument(employeeId, { documentType: 'employment_agreement', title: null }), t('hr:documents.agreementCreated'))
								}
							>
								{t('hr:documents.createAgreement')}
							</Button>
						)}
						<Button size='sm' variant='outline' onClick={() => setAdding(true)}>
							{t('hr:documents.add')}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent className='text-sm'>
				<input
					ref={upload}
					type='file'
					accept='application/pdf,image/*'
					className='hidden'
					onChange={(event) => {
						const file = event.target.files?.[0];
						event.target.value = '';
						if (file && uploadFor) void run(() => uploadEmployeeDocumentFile(employeeId, uploadFor, file), t('hr:documents.uploaded'));
					}}
				/>
				{query.isPending ? (
					<SectionSkeleton lines={3} />
				) : query.isError ? (
					<ErrorState error={query.error} size='sm' />
				) : query.data.length === 0 ? (
					<EmptyState title={t('hr:documents.empty')} size='sm' />
				) : (
					<ul className='divide-y'>
						{query.data.map((row) => (
							<li key={row.id} className='flex flex-wrap items-start justify-between gap-2 py-3'>
								<div className='min-w-0'>
									<div className='flex flex-wrap items-center gap-2'>
										<span className='font-medium'>{row.title}</span>
										<Badge variant={row.status === 'void' ? 'outline' : 'secondary'}>{t(`hr:documents.status.${row.status}`)}</Badge>
									</div>
									<div className='font-mono text-xs text-muted-foreground'>
										{row.code} · {t(`hr:documents.type.${row.documentType as TEmployeeDocumentType}`)}
									</div>
									{row.files.length === 0 ? (
										<div className='text-xs text-muted-foreground'>
											{isLiveAgreement(row) ? t('hr:documents.pdfPending') : t('hr:documents.noFile')}
										</div>
									) : (
										<ul className='mt-1 space-y-1'>
											{row.files.map((file) => (
												<li key={file.id}>
													<Button variant='link' size='sm' className='h-auto p-0' onClick={() => void download(row, file.id)}>
														<Download className='size-3' /> {file.fileName}
													</Button>
												</li>
											))}
										</ul>
									)}
								</div>
								{canUpdate && row.status !== 'void' && (
									<RowActions
										label={t('hr:documents.actions')}
										disabled={busy}
										actions={[
											{
												key: 'upload',
												label: t('hr:documents.upload'),
												icon: FileUp,
												onSelect: () => {
													setUploadFor(row.id);
													upload.current?.click();
												},
											},
											{
												key: 'regenerate',
												label: t('hr:documents.regeneratePdf'),
												icon: RefreshCw,
												hidden: !isLiveAgreement(row),
												onSelect: () => void run(() => regenerateAgreementPdf(employeeId, row.id), t('hr:documents.pdfQueued')),
											},
											{
												key: 'void',
												label: t('hr:documents.void'),
												icon: Ban,
												destructive: true,
												onSelect: async () => {
													if (await confirm({ title: t('hr:documents.voidConfirm', { title: row.title }), destructive: true })) {
														void run(() => voidEmployeeDocument(employeeId, row.id), t('hr:documents.voided'));
													}
												},
											},
										]}
									/>
								)}
							</li>
						))}
					</ul>
				)}
			</CardContent>
			{adding && <AddDocumentDialog employeeId={employeeId} busy={busy} run={run} onClose={() => setAdding(false)} />}
		</Card>
	);
}

function AddDocumentDialog({
	employeeId,
	busy,
	run,
	onClose,
}: {
	employeeId: string;
	busy: boolean;
	run: (work: () => Promise<unknown>, done: string) => Promise<boolean>;
	onClose: () => void;
}) {
	const { t } = useTranslation(['hr', 'common']);
	const [documentType, setDocumentType] = useState<TEmployeeDocumentType>('id_card');
	const [title, setTitle] = useState('');

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						if (await run(() => createEmployeeDocument(employeeId, { documentType, title: title.trim() || null }), t('hr:documents.added'))) onClose();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('hr:documents.add')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='document-type'>{t('hr:documents.documentType')}</FieldLabel>
							<Select value={documentType} onValueChange={(value: string | null) => setDocumentType((value ?? 'other') as TEmployeeDocumentType)}>
								<SelectTrigger id='document-type' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EMPLOYEE_DOCUMENT_TYPES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`hr:documents.type.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='document-title' optional>
								{t('hr:documents.documentTitle')}
							</FieldLabel>
							<Input id='document-title' maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy}>
							{t('hr:documents.add')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

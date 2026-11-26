import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { formatBusinessDate } from '@/lib/format';
import {
	declineMyRequest,
	mySignatureImageQueryOptions,
	mySignatureRequestsQueryOptions,
	removeMySignatureImage,
	signMyRequest,
	uploadMySignatureImage,
	type TMySignatureRequest,
	type TSignatureRequestStatus,
} from '@/lib/documents-api';

/**
 * `/signature` — the caller's signature inbox and their own signature image.
 *
 * @remarks
 * Signing uses the image on file (managed by the card on this page): the
 * signature module stamps it on the document PDF, so an empty image is the one
 * thing worth warning about before a sign click.
 */
export function SignaturePage() {
	const { t, i18n } = useTranslation('employee');
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<TSignatureRequestStatus | 'all'>('pending');
	const [declining, setDeclining] = useState<TMySignatureRequest | null>(null);
	const [reason, setReason] = useState('');

	const requests = useQuery(mySignatureRequestsQueryOptions(status === 'all' ? {} : { status }));
	const image = useQuery(mySignatureImageQueryOptions);

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'signature-requests'] });
	};

	const sign = useMutation({
		mutationFn: (id: string) => signMyRequest(id),
		onSuccess: async () => {
			toast.success(t('signature.signed'));
			await refresh();
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});

	const decline = useMutation({
		mutationFn: ({ id, reason: why }: { id: string; reason: string }) => declineMyRequest(id, why),
		onSuccess: async () => {
			setDeclining(null);
			setReason('');
			await refresh();
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});

	const upload = useMutation({
		mutationFn: (file: File) => uploadMySignatureImage(file),
		onSuccess: async () => {
			toast.success(t('signature.imageSaved'));
			await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'signature-image'] });
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});

	const clearImage = useMutation({
		mutationFn: removeMySignatureImage,
		onSuccess: async () => {
			toast.success(t('signature.imageRemoved'));
			await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'signature-image'] });
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('signature.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('signature.subtitle')}</p>
			</header>

			<div className='flex flex-wrap gap-2'>
				{(['pending', 'all'] as const).map((filter) => (
					<Button
						key={filter}
						size='sm'
						variant={status === filter ? 'default' : 'outline'}
						onClick={() => setStatus(filter)}
					>
						{filter === 'all' ? t('signature.filterAll') : t('signature.filterPending')}
					</Button>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{t('signature.imageTitle')}</CardTitle>
				</CardHeader>
				<CardContent className='space-y-3'>
					<p className='text-xs text-muted-foreground'>{t('signature.imageHint')}</p>
					{image.data?.url ? (
						<img src={image.data.url} alt={t('signature.imageTitle')} className='h-20 rounded-md border bg-white object-contain p-1' />
					) : (
						<p className='text-sm text-muted-foreground'>{t('signature.imageEmpty')}</p>
					)}
					<div className='flex flex-wrap items-center gap-2'>
						<Input
							type='file'
							accept='image/*'
							className='max-w-xs'
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) upload.mutate(file);
							}}
						/>
						{image.data?.url ? (
							<Button
								size='sm'
								variant='outline'
								disabled={clearImage.isPending}
								onClick={() => clearImage.mutate()}
							>
								{t('signature.imageRemove')}
							</Button>
						) : null}
					</div>
				</CardContent>
			</Card>

			{requests.isPending ? (
				<PageSkeleton cards={1} />
			) : requests.isError ? (
				<ErrorState error={requests.error} />
			) : (requests.data ?? []).length === 0 ? (
				<EmptyState title={t('signature.empty')} bordered />
			) : (
				<ul className='divide-y rounded-lg border'>
					{(requests.data ?? []).map((request) => (
						<li key={request.id} className='flex flex-wrap items-center justify-between gap-2 p-3 text-sm'>
							<div className='space-y-1'>
								<p className='font-medium'>{request.documentTitle ?? request.documentCode ?? request.documentId}</p>
								<p className='text-xs text-muted-foreground'>
									{request.requestedByName ?? '-'}
									{request.expiresAt
										? ` · ${t('signature.expires', { date: formatBusinessDate(request.expiresAt.slice(0, 10), i18n.language) })}`
										: ''}
								</p>
							</div>
							<div className='flex items-center gap-2'>
								<Badge variant={request.effectiveStatus === 'pending' ? 'secondary' : 'outline'}>
									{t(`signature.status.${request.effectiveStatus}` as const)}
								</Badge>
								{request.effectiveStatus === 'pending' ? (
									<>
										<Button size='sm' disabled={sign.isPending} onClick={() => sign.mutate(request.id)}>
											{t('signature.sign')}
										</Button>
										<Button
											size='sm'
											variant='outline'
											onClick={() => {
												setDeclining(request);
												setReason('');
											}}
										>
											{t('signature.decline')}
										</Button>
									</>
								) : null}
							</div>
						</li>
					))}
				</ul>
			)}

			<Dialog
				open={declining !== null}
				onOpenChange={(open) => {
					if (!open) setDeclining(null);
				}}
			>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>{t('signature.declineTitle')}</DialogTitle>
						<DialogDescription>{declining?.documentTitle ?? ''}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='decline-reason'>{t('signature.declineReason')}</FieldLabel>
						<Textarea
							id='decline-reason'
							required
							maxLength={500}
							value={reason}
							onChange={(event) => setReason(event.target.value)}
						/>
					</Field>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDeclining(null)}>
							{t('projects.cancel')}
						</Button>
						<Button
							disabled={reason.trim() === '' || decline.isPending}
							onClick={() => declining && decline.mutate({ id: declining.id, reason: reason.trim() })}
						>
							{t('signature.declineConfirm')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export const Route = createFileRoute('/_authed/signature')({
	component: SignaturePage,
});

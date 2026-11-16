import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { PenLine } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import {
	SIGNATURE_METHODS,
	declineSignatureRequest,
	deleteMySignatureImage,
	incomingSignatureRequestsQueryOptions,
	mySignatureImageQueryOptions,
	signSignatureRequest,
	uploadMySignatureImage,
	type TSignatureMethod,
} from '@/lib/signature-api';
import { usePermission } from '@/lib/use-permission';

export const Route = createFileRoute('/_authed/documents/signatures/mine')({
	component: MySignaturePage,
});

/** `/documents/signatures/mine` — my image plus the requests addressed to me. */
function MySignaturePage() {
	const { t, i18n } = useTranslation(['signatures', 'common']);
	const queryClient = useQueryClient();
	const canSign = usePermission('document.signature_sign');
	const fileInput = useRef<HTMLInputElement>(null);
	const [method, setMethod] = useState<TSignatureMethod>('electronic');
	const [decliningId, setDecliningId] = useState<string | null>(null);
	const [reason, setReason] = useState('');

	const image = useQuery({ ...mySignatureImageQueryOptions(), enabled: canSign });
	const incoming = useQuery({
		...incomingSignatureRequestsQueryOptions({ page: 1, limit: 20, pendingOnly: true }),
		enabled: canSign,
	});
	const history = useQuery({
		...incomingSignatureRequestsQueryOptions({ page: 1, limit: 20 }),
		enabled: canSign,
	});

	const invalidate = async () => {
		await queryClient.invalidateQueries({ queryKey: ['documents', 'signatures'] });
	};

	const uploadMutation = useMutation({
		mutationFn: uploadMySignatureImage,
		onSuccess: async () => {
			await invalidate();
			toast.success(t('signatures:imageUploaded'));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const removeMutation = useMutation({
		mutationFn: deleteMySignatureImage,
		onSuccess: async () => {
			await invalidate();
			toast.success(t('signatures:imageRemoved'));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const signMutation = useMutation({
		mutationFn: ({ id }: { id: string }) => signSignatureRequest(id, method),
		onSuccess: async () => {
			await invalidate();
			toast.success(t('signatures:signed'));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const declineMutation = useMutation({
		mutationFn: ({ id, reason: text }: { id: string; reason: string }) =>
			declineSignatureRequest(id, text),
		onSuccess: async () => {
			await invalidate();
			setDecliningId(null);
			setReason('');
			toast.success(t('signatures:declined'));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const pending = incoming.data?.rows ?? [];
	const historyRows = (history.data?.rows ?? []).filter(
		(request) => request.effectiveStatus !== 'pending',
	);
	const imageUrl = image.data ?? null;

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center gap-3'>
				<PenLine className='size-5 text-muted-foreground' />
				<div>
					<h1 className='text-lg font-semibold'>{t('signatures:mineTitle')}</h1>
					<p className='text-sm text-muted-foreground'>{t('signatures:mineDescription')}</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('signatures:imageTitle')}</CardTitle>
					<CardDescription>{t('signatures:imageHint')}</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-3'>
					{imageUrl ? (
						<img
							src={imageUrl}
							alt={t('signatures:imageTitle')}
							className='h-24 w-auto object-contain'
						/>
					) : (
						<p className='text-sm text-muted-foreground'>{t('signatures:imageEmpty')}</p>
					)}
					<input
						ref={fileInput}
						type='file'
						accept='image/png,image/jpeg,image/webp'
						className='hidden'
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) uploadMutation.mutate(file);
							event.target.value = '';
						}}
					/>
					<div className='flex gap-2'>
						<Button
							variant='outline'
							size='sm'
							disabled={uploadMutation.isPending}
							onClick={() => fileInput.current?.click()}
						>
							{imageUrl ? t('signatures:replaceImage') : t('signatures:uploadImage')}
						</Button>
						{imageUrl && (
							<Button
								variant='ghost'
								size='sm'
								disabled={removeMutation.isPending}
								onClick={() => removeMutation.mutate()}
							>
								{t('signatures:removeImage')}
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('signatures:incoming')}</CardTitle>
					<CardDescription>{t('signatures:incomingHint')}</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-3'>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:method')}</span>
						<Select
							value={method}
							onValueChange={(value) => setMethod((value ?? 'electronic') as TSignatureMethod)}
						>
							<SelectTrigger className='w-52'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SIGNATURE_METHODS.map((option) => (
									<SelectItem key={option} value={option}>
										{t(`signatures:methodOption.${option}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className='text-xs text-muted-foreground'>{t('signatures:signHint')}</p>
					</div>

					{incoming.isError && <p className='text-sm text-destructive'>{incoming.error.message}</p>}
					{!incoming.isPending && pending.length === 0 && (
						<p className='text-sm text-muted-foreground'>{t('signatures:incomingEmpty')}</p>
					)}
					{pending.map((request) => (
						<div
							key={request.id}
							className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'
						>
							<div>
								<p className='text-sm font-medium'>
									{request.documentCode ?? request.documentId}
									{request.documentTitle ? ` · ${request.documentTitle}` : ''}
								</p>
								<p className='text-xs text-muted-foreground'>
									{t('signatures:requestedBy', { name: request.requestedByName ?? '—' })} ·{' '}
									{new Date(request.createdAt).toLocaleString(i18n.language)}
								</p>
								{request.note && <p className='text-xs'>{request.note}</p>}
							</div>
							<div className='flex gap-2'>
								<Button
									size='sm'
									disabled={signMutation.isPending}
									onClick={() => signMutation.mutate({ id: request.id })}
								>
									{t('signatures:sign')}
								</Button>
								<Button
									size='sm'
									variant='outline'
									onClick={() => {
										setDecliningId(request.id);
										setReason('');
									}}
								>
									{t('signatures:decline')}
								</Button>
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('signatures:history')}</CardTitle>
				</CardHeader>
				<CardContent className='flex flex-col gap-2'>
					{!history.isPending && historyRows.length === 0 && (
						<p className='text-sm text-muted-foreground'>{t('signatures:historyEmpty')}</p>
					)}
					{historyRows.map((request) => (
						<div
							key={request.id}
							className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'
						>
							<div>
								<p className='text-sm font-medium'>
									{request.documentCode ?? request.documentId}
									{request.documentTitle ? ` · ${request.documentTitle}` : ''}
								</p>
								{request.declineReason && (
									<p className='text-xs text-muted-foreground'>{request.declineReason}</p>
								)}
							</div>
							<Badge variant='outline'>{t(`signatures:status.${request.effectiveStatus}`)}</Badge>
						</div>
					))}
				</CardContent>
			</Card>

			<Dialog open={decliningId !== null} onOpenChange={(open) => !open && setDecliningId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('signatures:declineTitle')}</DialogTitle>
						<DialogDescription>{t('signatures:declineReasonPlaceholder')}</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:declineReason')}</span>
						<Input value={reason} onChange={(event) => setReason(event.target.value)} />
						{reason.trim().length === 0 && (
							<span className='text-xs text-muted-foreground'>{t('signatures:declineRequired')}</span>
						)}
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDecliningId(null)}>
							{t('common:action.cancel')}
						</Button>
						<Button
							disabled={reason.trim().length === 0 || declineMutation.isPending}
							onClick={() => {
								if (decliningId && reason.trim()) {
									declineMutation.mutate({ id: decliningId, reason: reason.trim() });
								}
							}}
						>
							{t('signatures:decline')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

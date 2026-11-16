import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Send } from 'lucide-react';
import { useState } from 'react';
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import { documentsQueryOptions } from '@/lib/documents-api';
import { organizationMembersQueryOptions } from '@/lib/organization-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import {
	cancelSignatureRequest,
	createSignatureRequests,
	outgoingSignatureRequestsQueryOptions,
} from '@/lib/signature-api';
import { usePermission } from '@/lib/use-permission';

export const Route = createFileRoute('/_authed/documents/signatures/request')({
	component: RequestSignaturePage,
});

/** The `document.signature_request_expiry_days` default, in days. */
const DEFAULT_EXPIRY_DAYS = 14;

/** `/documents/signatures/request` — ask internal users to sign a document. */
function RequestSignaturePage() {
	const { t, i18n } = useTranslation(['signatures', 'common']);
	const queryClient = useQueryClient();
	const organizationId = useActiveOrganizationId();
	const canRequest = usePermission('document.signature_request');

	const [documentId, setDocumentId] = useState('');
	const [signerUserIds, setSignerUserIds] = useState<string[]>([]);
	const [note, setNote] = useState('');
	const [expiryDays, setExpiryDays] = useState(String(DEFAULT_EXPIRY_DAYS));

	const documents = useQuery({ ...documentsQueryOptions({ page: 1, limit: 50 }), enabled: canRequest });
	const members = useQuery({
		...organizationMembersQueryOptions(organizationId ?? '', 1, 100),
		enabled: canRequest && Boolean(organizationId),
	});
	const outgoing = useQuery({
		...outgoingSignatureRequestsQueryOptions({ page: 1, limit: 20 }),
		enabled: canRequest,
	});

	const createMutation = useMutation({
		mutationFn: createSignatureRequests,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['documents', 'signatures'] });
			setSignerUserIds([]);
			setNote('');
			toast.success(t('signatures:requestCreated'));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const cancelMutation = useMutation({
		mutationFn: cancelSignatureRequest,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['documents', 'signatures'] });
			toast.success(t('signatures:requestCancelled'));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const toggleSigner = (userId: string) => {
		setSignerUserIds((current) =>
			current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
		);
	};

	const submit = () => {
		const days = Number(expiryDays);
		const expiresAt =
			Number.isFinite(days) && days > 0
				? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
				: null;
		createMutation.mutate({
			documentId,
			signerUserIds,
			note: note.trim() || null,
			expiresAt,
		});
	};

	const canSubmit = Boolean(documentId) && signerUserIds.length > 0 && !createMutation.isPending;

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center gap-3'>
				<Send className='size-5 text-muted-foreground' />
				<div>
					<h1 className='text-lg font-semibold'>{t('signatures:requestTitle')}</h1>
					<p className='text-sm text-muted-foreground'>{t('signatures:requestDescription')}</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('signatures:newRequest')}</CardTitle>
					<CardDescription>{t('signatures:newRequestHint')}</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:document')}</span>
						<Select value={documentId} onValueChange={(value) => setDocumentId(value ?? '')}>
							<SelectTrigger className='w-full max-w-xl'>
								<SelectValue placeholder={t('signatures:documentPlaceholder')} />
							</SelectTrigger>
							<SelectContent>
								{(documents.data?.rows ?? []).map((document) => (
									<SelectItem key={document.id} value={document.id}>
										{document.code} · {document.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:signers')}</span>
						<div className='flex flex-wrap gap-2'>
							{(members.data?.rows ?? []).map((member) => (
								<Button
									key={member.userId}
									type='button'
									size='sm'
									variant={signerUserIds.includes(member.userId) ? 'default' : 'outline'}
									onClick={() => toggleSigner(member.userId)}
								>
									{member.user?.name ?? member.userId}
								</Button>
							))}
						</div>
						<p className='text-xs text-muted-foreground'>{t('signatures:signersHint')}</p>
					</div>

					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:note')}</span>
						<Input
							className='max-w-xl'
							value={note}
							placeholder={t('signatures:notePlaceholder')}
							onChange={(event) => setNote(event.target.value)}
						/>
					</div>

					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:expiryDays')}</span>
						<Input
							className='w-32'
							type='number'
							min={1}
							value={expiryDays}
							onChange={(event) => setExpiryDays(event.target.value)}
						/>
					</div>

					<div>
						<Button disabled={!canSubmit} onClick={submit}>
							{t('signatures:sendRequest')}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('signatures:outgoing')}</CardTitle>
					<CardDescription>{t('signatures:outgoingHint')}</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-2'>
					{outgoing.isError && (
						<p className='text-sm text-destructive'>{outgoing.error.message}</p>
					)}
					{!outgoing.isPending && (outgoing.data?.rows ?? []).length === 0 && (
						<p className='text-sm text-muted-foreground'>{t('signatures:outgoingEmpty')}</p>
					)}
					{(outgoing.data?.rows ?? []).map((request) => (
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
									{t('signatures:requestedOf', { name: request.signerName })} ·{' '}
									{new Date(request.createdAt).toLocaleString(i18n.language)}
								</p>
							</div>
							<div className='flex items-center gap-2'>
								<Badge variant={request.effectiveStatus === 'pending' ? 'secondary' : 'outline'}>
									{t(`signatures:status.${request.effectiveStatus}`)}
								</Badge>
								{request.effectiveStatus === 'pending' && (
									<Button
										size='sm'
										variant='outline'
										disabled={cancelMutation.isPending}
										onClick={() => cancelMutation.mutate(request.id)}
									>
										{t('signatures:cancelRequest')}
									</Button>
								)}
							</div>
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

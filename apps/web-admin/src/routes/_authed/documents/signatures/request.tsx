import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Send } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from '@ims-erp/ui/components/combobox';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { SearchableSelect } from '@/components/inventory/searchable-select';
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

/** A signing deadline is at least tomorrow: today or earlier makes no sense. */
function tomorrowIso(): string {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	const pad = (part: number) => String(part).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The earliest deadline and the year range the picker offers, read once. */
const MIN_EXPIRY = tomorrowIso();
const FIRST_YEAR = new Date().getFullYear();
const LAST_YEAR = FIRST_YEAR + 2;

/** `YYYY-MM-DD` at the end of that day, as an instant the backend accepts. */
function endOfDay(value: string): string | null {
	const [year, month, day] = value.split('-').map(Number);
	if (!year || !month || !day) return null;
	// 23:59:59.999 local: the request stays actionable through the whole day.
	return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

type TSigner = { userId: string; name: string };

/** `/documents/signatures/request` — ask internal users to sign a document. */
function RequestSignaturePage() {
	const { t, i18n } = useTranslation(['signatures', 'common']);
	const queryClient = useQueryClient();
	const organizationId = useActiveOrganizationId();
	const canRequest = usePermission('document.signature_request');
	const signerAnchor = useComboboxAnchor();

	const [documentId, setDocumentId] = useState('');
	const [signers, setSigners] = useState<TSigner[]>([]);
	const [note, setNote] = useState('');
	const [expiresOn, setExpiresOn] = useState(MIN_EXPIRY);
	const [documentSearch, setDocumentSearch] = useState('');

	const documents = useQuery({
		...documentsQueryOptions({ page: 1, limit: 50, search: documentSearch || undefined }),
		enabled: canRequest,
	});
	const members = useQuery({
		...organizationMembersQueryOptions(organizationId ?? '', 1, 100),
		enabled: canRequest && Boolean(organizationId),
	});
	const outgoing = useQuery({
		...outgoingSignatureRequestsQueryOptions({ page: 1, limit: 20 }),
		enabled: canRequest,
	});

	const documentOptions = useMemo(
		() =>
			(documents.data?.rows ?? []).map((document) => ({
				value: document.id,
				label: `${document.code} · ${document.title}`,
			})),
		[documents.data],
	);

	const signerOptions = useMemo<TSigner[]>(
		() =>
			(members.data?.rows ?? []).map((member) => ({
				userId: member.userId,
				name: member.user?.name ?? member.userId,
			})),
		[members.data],
	);

	const createMutation = useMutation({
		mutationFn: createSignatureRequests,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['documents', 'signatures'] });
			setSigners([]);
			setNote('');
			setExpiresOn(MIN_EXPIRY);
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

	const submit = () => {
		const deadline = endOfDay(expiresOn);
		if (!deadline) return;
		createMutation.mutate({
			documentId,
			signerUserIds: signers.map((signer) => signer.userId),
			note: note.trim() || null,
			expiresAt: deadline,
		});
	};

	const canSubmit = Boolean(documentId) && signers.length > 0 && !createMutation.isPending;

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
					<div className='flex max-w-xl flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:document')}</span>
						<SearchableSelect
							value={documentId || null}
							options={documentOptions}
							loading={documents.isPending}
							placeholder={t('signatures:documentPlaceholder')}
							emptyLabel={t('signatures:noDocumentMatch')}
							onSearch={setDocumentSearch}
							onChange={(value) => setDocumentId(value ?? '')}
						/>
					</div>

					<div className='flex max-w-xl flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:signers')}</span>
						<Combobox<TSigner, true>
							multiple
							items={signerOptions}
							value={signers}
							onValueChange={(next) => setSigners(next)}
							isItemEqualToValue={(item, candidate) => item.userId === candidate.userId}
						>
							<ComboboxChips ref={signerAnchor} className='w-full'>
								<ComboboxValue>
									{(selected: TSigner[]) => (
										<>
											{selected.map((signer) => (
												<ComboboxChip key={signer.userId}>{signer.name}</ComboboxChip>
											))}
											<ComboboxChipsInput placeholder={t('signatures:signersPlaceholder')} />
										</>
									)}
								</ComboboxValue>
							</ComboboxChips>
							<ComboboxContent anchor={signerAnchor}>
								<ComboboxList>
									<ComboboxEmpty>{t('signatures:noSignerMatch')}</ComboboxEmpty>
									{signerOptions.map((signer) => (
										<ComboboxItem key={signer.userId} value={signer}>
											{signer.name}
										</ComboboxItem>
									))}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						<p className='text-xs text-muted-foreground'>{t('signatures:signersHint')}</p>
					</div>

					<div className='flex max-w-xl flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:note')}</span>
						<Textarea
							rows={3}
							value={note}
							placeholder={t('signatures:notePlaceholder')}
							onChange={(event) => setNote(event.target.value)}
						/>
					</div>

					<div className='flex w-64 flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('signatures:expiresOn')}</span>
						<DatePicker
							value={expiresOn}
							onChange={setExpiresOn}
							min={MIN_EXPIRY}
							fromYear={FIRST_YEAR}
							toYear={LAST_YEAR}
							required
						/>
						<p className='text-xs text-muted-foreground'>{t('signatures:expiresOnHint')}</p>
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
					{canRequest && outgoing.isPending && <SectionSkeleton />}
					{outgoing.isError && <ErrorState error={outgoing.error} size='sm' />}
					{!outgoing.isPending && !outgoing.isError && (outgoing.data?.rows ?? []).length === 0 && (
						<EmptyState title={t('signatures:outgoingEmpty')} size='sm' />
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

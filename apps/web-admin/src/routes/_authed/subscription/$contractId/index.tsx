import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { ContractBadges } from '@/components/licensing/contract-badges';
import { EventTable } from '@/components/licensing/event-table';
import { toast } from '@/components/toast';
import { formatBusinessDate, formatDateTime, formatIdr } from '@/lib/format';
import {
	activateContract,
	addLicenseKey,
	contractQueryOptions,
	reactivateContract,
	releaseSeat,
	renewContract,
	revokeLicenseKey,
	suspendContract,
	terminateContract,
} from '@/lib/license-api';
import { usePermission } from '@/lib/use-permission';

/** `/subscription/$contractId` — one license contract, its keys and actions. */
export const Route = createFileRoute('/_authed/subscription/$contractId/')({
	component: ContractDetailPage,
});

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{children || '—'}</div>
		</div>
	);
}

type TDialog = { kind: 'terminate' } | { kind: 'suspend' } | { kind: 'revoke'; keyId: string } | { kind: 'key' } | null;

function ContractDetailPage() {
	const { t, i18n } = useTranslation(['licensing', 'common']);
	const { contractId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('license.create');
	const canActivate = usePermission('license.activate');
	const canRevoke = usePermission('license.revoke');
	const canExtend = usePermission('license.extend');
	const canQuote = usePermission('quotation.create');
	const { data, isPending, isError, error } = useQuery(contractQueryOptions(contractId));
	const [dialog, setDialog] = useState<TDialog>(null);
	const [reason, setReason] = useState('');
	const [keyValue, setKeyValue] = useState('');
	const [maxActivations, setMaxActivations] = useState('1');
	const [expiresOn, setExpiresOn] = useState('');
	const [keyNotes, setKeyNotes] = useState('');
	const [busy, setBusy] = useState(false);

	if (isPending) return <PageSkeleton />;
	if (isError) {
		return (
			<div className='flex flex-col gap-6'>
				<ErrorState error={error} bordered />
				<Link to='/subscription' className='text-sm hover:underline'>
					{t('licensing:contracts.back')}
				</Link>
			</div>
		);
	}

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['licenses'] });
			toast.success(done);
			setDialog(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const openDialog = (next: TDialog) => {
		setReason('');
		setKeyValue('');
		setMaxActivations('1');
		setExpiresOn('');
		setKeyNotes('');
		setDialog(next);
	};
	const renew = async () => {
		setBusy(true);
		try {
			const created = await renewContract(contractId);
			await queryClient.invalidateQueries({ queryKey: ['licenses'] });
			toast.success(t('licensing:done.renewed'));
			void navigate({ to: '/subscription/$contractId', params: { contractId: created.id } });
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const copy = async (value: string) => {
		await navigator.clipboard.writeText(value);
		toast.success(t('licensing:done.copied'));
	};

	const own = data.applicationSource === 'own';
	const live = data.status === 'draft' || data.status === 'active' || data.status === 'suspended';
	const showRenew = data.status === 'active' && canExtend && !data.renewal;
	const anyMasked = data.keys.some((key) => key.masked);

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/subscription' className='text-sm text-muted-foreground hover:underline'>
				{t('licensing:contracts.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>
						{data.customerName} · {data.applicationName}
					</p>
					<div className='mt-2'>
						<ContractBadges contract={data} />
					</div>
				</div>
				<div className='flex flex-wrap items-center gap-2'>
					{data.status === 'draft' && canCreate && (
						<Button
							variant='outline'
							render={<Link to='/subscription/$contractId/edit' params={{ contractId }} />}
							nativeButton={false}
						>
							{t('licensing:action.edit')}
						</Button>
					)}
					{data.status === 'draft' && canActivate && (
						<Button disabled={busy} onClick={() => void run(() => activateContract(contractId), t('licensing:done.activated'))}>
							{t('licensing:action.activate')}
						</Button>
					)}
					{data.status === 'active' && canActivate && (
						<Button variant='outline' disabled={busy} onClick={() => openDialog({ kind: 'suspend' })}>
							{t('licensing:action.suspend')}
						</Button>
					)}
					{data.status === 'suspended' && canActivate && (
						<Button disabled={busy} onClick={() => void run(() => reactivateContract(contractId), t('licensing:done.reactivated'))}>
							{t('licensing:action.reactivate')}
						</Button>
					)}
					{showRenew && (
						<Button variant='outline' disabled={busy} onClick={() => void renew()}>
							{t('licensing:action.renew')}
						</Button>
					)}
					{canQuote && (data.status === 'draft' || data.status === 'active') && (
						<Button
							variant='outline'
							render={<Link to='/sales/quotes/new' search={{ customerId: data.customerId ?? undefined }} />}
							nativeButton={false}
						>
							{t('licensing:action.quote')}
						</Button>
					)}
					{live && canRevoke && (
						<Button variant='destructive' disabled={busy} onClick={() => openDialog({ kind: 'terminate' })}>
							{t('licensing:action.terminate')}
						</Button>
					)}
				</div>
			</div>

			{showRenew && <p className='text-sm text-muted-foreground'>{t('licensing:detail.renewHint')}</p>}

			<Card>
				<CardHeader>
					<CardTitle>{t('licensing:detail.terms')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<Detail label={t('licensing:field.application')}>
						{data.applicationCode} — {data.applicationName}
						<div className='text-xs text-muted-foreground'>{t(`licensing:source.${data.applicationSource}`)}</div>
					</Detail>
					<Detail label={t('licensing:field.package')}>{data.packageName}</Detail>
					<Detail label={t('licensing:field.period')}>
						{formatBusinessDate(data.startDate, i18n.language)} –{' '}
						{data.endDate ? formatBusinessDate(data.endDate, i18n.language) : t('licensing:timing.perpetual')}
						{data.isExpired && data.daysLeft !== null && (
							<div className='text-xs text-destructive'>{t('licensing:timing.daysAgo', { count: -data.daysLeft })}</div>
						)}
					</Detail>
					<Detail label={t('licensing:field.value')}>
						{formatIdr(data.contractValue)} · {t(`licensing:cycle.${data.billingCycle}`)}
					</Detail>
					<Detail label={t('licensing:field.salesOrder')}>
						{data.orderId && (
							<Link to='/sales/orders/$orderId' params={{ orderId: data.orderId }} className='hover:underline'>
								{t('licensing:detail.openOrder')}
							</Link>
						)}
					</Detail>
					<Detail label={t('licensing:detail.renewedFrom')}>
						{data.renewedFrom && (
							<Link to='/subscription/$contractId' params={{ contractId: data.renewedFrom.id }} className='hover:underline'>
								{data.renewedFrom.code}
							</Link>
						)}
					</Detail>
					<Detail label={t('licensing:detail.renewal')}>
						{data.renewal && (
							<Link to='/subscription/$contractId' params={{ contractId: data.renewal.id }} className='hover:underline'>
								{data.renewal.code} · {t(`licensing:status.${data.renewal.status}`)}
							</Link>
						)}
					</Detail>
					<Detail label={t('licensing:field.notes')}>{data.notes}</Detail>
					{data.terminationReason && <Detail label={t('licensing:detail.terminationReason')}>{data.terminationReason}</Detail>}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('licensing:keys.title')}</CardTitle>
					{live && canCreate && (
						<CardAction>
							<Button size='sm' onClick={() => openDialog({ kind: 'key' })}>
								{t('licensing:action.addKey')}
							</Button>
						</CardAction>
					)}
				</CardHeader>
				<CardContent className='p-0'>
					{data.keys.length === 0 ? (
						<EmptyState title={t('licensing:keys.empty')} size='sm' />
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('licensing:keys.key')}</TableHead>
									<TableHead>{t('licensing:field.source')}</TableHead>
									<TableHead>{t('licensing:keys.maxActivations')}</TableHead>
									<TableHead>{t('licensing:keys.expiresOn')}</TableHead>
									<TableHead>{t('licensing:field.status')}</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.keys.map((key) => (
									<TableRow key={key.id}>
										<TableCell>
											<code className='font-mono text-sm'>{key.licenseKey}</code>
											{key.revokeReason && <div className='text-xs text-muted-foreground'>{key.revokeReason}</div>}
										</TableCell>
										<TableCell>{t(`licensing:keys.source.${key.keySource}`)}</TableCell>
										<TableCell>{key.maxActivations}</TableCell>
										<TableCell>{formatBusinessDate(key.expiresOn, i18n.language)}</TableCell>
										<TableCell>
											<Badge variant={key.status === 'active' ? 'default' : 'outline'}>{t(`licensing:keys.status.${key.status}`)}</Badge>
										</TableCell>
										<TableCell className='text-right whitespace-nowrap'>
											{!key.masked && (
												<Button size='sm' variant='ghost' onClick={() => void copy(key.licenseKey)}>
													{t('licensing:action.copy')}
												</Button>
											)}
											{key.status === 'active' && canRevoke && (
												<Button size='sm' variant='ghost' onClick={() => openDialog({ kind: 'revoke', keyId: key.id })}>
													{t('licensing:action.revoke')}
												</Button>
											)}
										</TableCell>
									</TableRow>
								)).flatMap((row, index) => {
									const key = data.keys[index];
									if (!key || key.activations.length === 0) return [row];
									return [
										row,
										<TableRow key={`${key.id}-seats`} className='bg-muted/40 hover:bg-muted/40'>
											<TableCell colSpan={6} className='py-2'>
												<div className='mb-1 text-xs font-medium text-muted-foreground'>
													{t('licensing:seats.title', {
														used: key.activations.filter((seat) => seat.status === 'active').length,
														max: key.maxActivations,
													})}
												</div>
												<ul className='flex flex-col gap-1 text-sm'>
													{key.activations.map((seat) => (
														<li key={seat.id} className='flex flex-wrap items-center gap-x-3 gap-y-1'>
															<code className='font-mono text-xs'>{seat.instanceId}</code>
															{seat.deviceName && <span>{seat.deviceName}</span>}
															<span className='text-xs text-muted-foreground'>
																{t('licensing:seats.lastSeen', { at: formatDateTime(seat.lastSeenAt, i18n.language) })}
															</span>
															{seat.status === 'active' ? (
																canRevoke && (
																	<Button
																		size='sm'
																		variant='ghost'
																		className='h-7'
																		disabled={busy}
																		onClick={() => void run(() => releaseSeat(contractId, seat.id), t('licensing:done.seatReleased'))}
																	>
																		{t('licensing:action.release')}
																	</Button>
																)
															) : (
																<Badge variant='outline'>{t('licensing:seats.released')}</Badge>
															)}
														</li>
													))}
												</ul>
											</TableCell>
										</TableRow>,
									];
								})}
							</TableBody>
						</Table>
					)}
					{anyMasked && <p className='px-6 py-3 text-xs text-muted-foreground'>{t('licensing:keys.masked')}</p>}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('licensing:events.title')}</CardTitle>
				</CardHeader>
				<CardContent className='p-0'>
					{data.events.length === 0 ? (
						<p className='px-6 pb-6 text-sm text-muted-foreground'>{t('licensing:events.empty')}</p>
					) : (
						<EventTable events={data.events} showContract={false} />
					)}
				</CardContent>
			</Card>

			<Dialog open={dialog !== null} onOpenChange={(next) => !next && setDialog(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (dialog?.kind === 'suspend') {
								void run(() => suspendContract(contractId, reason.trim()), t('licensing:done.suspended'));
							} else if (dialog?.kind === 'terminate') {
								void run(() => terminateContract(contractId, reason.trim()), t('licensing:done.terminated'));
							} else if (dialog?.kind === 'revoke') {
								void run(() => revokeLicenseKey(contractId, dialog.keyId, reason.trim()), t('licensing:done.keyRevoked'));
							} else if (dialog?.kind === 'key') {
								void run(
									() =>
										addLicenseKey(contractId, {
											licenseKey: keyValue.trim() || null,
											maxActivations: Number(maxActivations) || 1,
											expiresOn: expiresOn || null,
											notes: keyNotes.trim() || null,
										}),
									t('licensing:done.keyAdded'),
								);
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>
								{dialog?.kind === 'suspend'
									? t('licensing:reason.suspendTitle')
									: dialog?.kind === 'terminate'
									? t('licensing:reason.terminateTitle')
									: dialog?.kind === 'revoke'
										? t('licensing:reason.revokeTitle')
										: t('licensing:action.addKey')}
							</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							{dialog?.kind === 'key' ? (
								<>
									<Field>
										<FieldLabel htmlFor='key-value'>{t('licensing:keys.key')}</FieldLabel>
										<Input
											id='key-value'
											required={!own}
											maxLength={500}
											autoComplete='off'
											className='font-mono'
											value={keyValue}
											onChange={(event) => setKeyValue(event.target.value)}
										/>
										<FieldDescription>{own ? t('licensing:keys.keyHintOwn') : t('licensing:keys.keyHintVendor')}</FieldDescription>
									</Field>
									<Field>
										<FieldLabel htmlFor='key-max'>{t('licensing:keys.maxActivations')}</FieldLabel>
										<Input
											id='key-max'
											type='number'
											min='1'
											max='100000'
											step='1'
											inputMode='numeric'
											required
											value={maxActivations}
											onChange={(event) => setMaxActivations(event.target.value)}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='key-expires'>{t('licensing:keys.expiresOn')}</FieldLabel>
										<DatePicker id='key-expires' value={expiresOn} onChange={setExpiresOn} />
										<FieldDescription>{t('licensing:keys.expiresHint')}</FieldDescription>
									</Field>
									<Field>
										<FieldLabel htmlFor='key-notes'>{t('licensing:field.notes')}</FieldLabel>
										<Input id='key-notes' maxLength={1000} value={keyNotes} onChange={(event) => setKeyNotes(event.target.value)} />
									</Field>
								</>
							) : (
								<Field>
									<FieldLabel htmlFor='reason'>{t('licensing:reason.label')}</FieldLabel>
									<Textarea id='reason' required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
								</Field>
							)}
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setDialog(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button
								type='submit'
								variant={dialog?.kind === 'key' ? 'default' : 'destructive'}
								disabled={busy || (dialog?.kind === 'key' ? !own && !keyValue.trim() : !reason.trim())}
							>
								{dialog?.kind === 'suspend'
									? t('licensing:action.suspend')
									: dialog?.kind === 'terminate'
									? t('licensing:action.terminate')
									: dialog?.kind === 'revoke'
										? t('licensing:action.revoke')
										: t('licensing:action.addKey')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

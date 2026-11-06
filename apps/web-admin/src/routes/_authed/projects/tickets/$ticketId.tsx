import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, formatDateTime, formatIdr } from '@/lib/format';
import {
	assignTicket,
	closeTicket,
	reopenTicket,
	resolveTicket,
	startTicket,
	TICKET_CHANNELS,
	TICKET_STATUS_VARIANT,
	techniciansQueryOptions,
	ticketQueryOptions,
	type TTicketChannel,
} from '@/lib/service-ticket-api';
import { usePermission } from '@/lib/use-permission';

/** `/projects/tickets/$ticketId` — one service ticket and its actions. */
export const Route = createFileRoute('/_authed/projects/tickets/$ticketId')({
	component: TicketDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

type TDialog = 'resolve' | 'close' | null;
const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function TicketDetailPage() {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const { ticketId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canAssign = usePermission('service_ticket.assign');
	const canUpdate = usePermission('service_ticket.update');
	const canResolve = usePermission('service_ticket.resolve');
	const canClose = usePermission('service_ticket.close');
	const technicians = useQuery(techniciansQueryOptions(canAssign));
	const { data, isPending, isError, error } = useQuery(ticketQueryOptions(ticketId));
	const [dialog, setDialog] = useState<TDialog>(null);
	const [resolution, setResolution] = useState('');
	const [cost, setCost] = useState('');
	const [confirmedBy, setConfirmedBy] = useState('');
	const [confirmChannel, setConfirmChannel] = useState<TTicketChannel>('phone');
	const [busy, setBusy] = useState(false);

	if (isPending) return null;
	if (isError) {
		return (
			<div className='flex flex-col gap-4 p-6'>
				<p className='text-sm text-destructive'>{error.message}</p>
				<Link to='/projects/tickets' className='text-sm hover:underline'>
					{t('projects:tickets.back')}
				</Link>
			</div>
		);
	}

	const worker = canAssign || canClose || data.assigneeUserId === session?.user.id;
	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['tickets'] });
			toast.success(done);
			setDialog(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const open = data.status === 'new' || data.status === 'in_progress';

	return (
		<div className='flex flex-col gap-6 p-6'>
			<Link to='/projects/tickets' className='text-sm text-muted-foreground hover:underline'>
				{t('projects:tickets.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>{data.customerName}</p>
					<div className='mt-2 flex gap-2'>
						<Badge variant={TICKET_STATUS_VARIANT[data.status]}>{t(`projects:ticketStatus.${data.status}`)}</Badge>
						<Badge variant={data.inWarranty ? 'default' : 'outline'}>
							{data.inWarranty ? t('projects:ticket.inWarranty') : t('projects:ticket.outOfWarranty')}
						</Badge>
					</div>
				</div>
				<div className='flex flex-wrap items-center gap-2'>
					{open && canAssign && (
						<select
							aria-label={t('projects:ticket.assignee')}
							className={`${select} w-56`}
							value={data.assigneeUserId ?? ''}
							disabled={busy}
							onChange={(event) => event.target.value && void run(() => assignTicket(ticketId, event.target.value), t('projects:tickets.assigned'))}
						>
							<option value=''>{t('projects:tasks.unassigned')}</option>
							{(technicians.data ?? []).map((person) => (
								<option key={person.userId} value={person.userId}>
									{person.name}
								</option>
							))}
						</select>
					)}
					{data.status === 'new' && worker && canUpdate && (
						<Button variant='outline' disabled={busy} onClick={() => void run(() => startTicket(ticketId), t('projects:tickets.started'))}>
							{t('projects:tickets.start')}
						</Button>
					)}
					{open && worker && canResolve && <Button onClick={() => setDialog('resolve')}>{t('projects:tickets.resolve')}</Button>}
					{data.status === 'resolved' && worker && canUpdate && (
						<Button variant='outline' disabled={busy} onClick={() => void run(() => reopenTicket(ticketId), t('projects:tickets.reopened'))}>
							{t('projects:tickets.reopen')}
						</Button>
					)}
					{data.status === 'resolved' && canClose && <Button onClick={() => setDialog('close')}>{t('projects:tickets.close')}</Button>}
				</div>
			</div>

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('projects:ticket.report')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('projects:ticket.reportedAt')} value={formatDateTime(data.reportedAt, i18n.language)} />
						<Detail label={t('projects:ticket.channel')} value={t(`projects:channel.${data.channel}`)} />
						<Detail label={t('projects:ticket.reporter')} value={[data.reporterName, data.reporterContact].filter(Boolean).join(' · ')} />
						<Detail label={t('projects:ticket.assignee')} value={data.assignee?.name} />
						<div className='sm:col-span-2'>
							<Detail label={t('projects:ticket.complaint')} value={data.complaint} />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('projects:ticket.device')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('projects:ticket.serialNumber')} value={data.serialNumber} />
						<Detail label={t('projects:ticket.device')} value={data.deviceDescription} />
						<div>
							<div className='text-muted-foreground'>{t('projects:ticket.project')}</div>
							{data.projectId ? (
								<Link to='/projects/$projectId' params={{ projectId: data.projectId }} className='hover:underline'>
									{t('projects:ticket.openProject')}
								</Link>
							) : (
								'—'
							)}
						</div>
						<Detail
							label={t('projects:ticket.warranty')}
							value={
								data.warrantyEndsOn
									? `${data.warrantyCode} · ${t('projects:ticket.until', { date: formatBusinessDate(data.warrantyEndsOn, i18n.language) })}`
									: t('projects:ticket.noWarranty')
							}
						/>
					</CardContent>
				</Card>
			</div>

			{(data.resolution || data.confirmedByName) && (
				<Card>
					<CardHeader>
						<CardTitle>{t('projects:ticket.outcome')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
						<Detail label={t('projects:ticket.resolution')} value={data.resolution} />
						<Detail label={t('projects:ticket.serviceCost')} value={formatIdr(data.serviceCost)} />
						<Detail
							label={t('projects:ticket.confirmedBy')}
							value={
								data.confirmedByName
									? `${data.confirmedByName} · ${t(`projects:channel.${data.confirmationChannel ?? 'other'}`)} · ${formatDateTime(data.confirmedAt!, i18n.language)}`
									: null
							}
						/>
					</CardContent>
				</Card>
			)}

			<Dialog open={dialog !== null} onOpenChange={(next) => !next && setDialog(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (dialog === 'resolve') {
								void run(
									() => resolveTicket(ticketId, { resolution: resolution.trim(), serviceCost: Math.round(Number(cost || 0) * 100) }),
									t('projects:tickets.resolved'),
								);
							} else {
								void run(() => closeTicket(ticketId, { confirmedByName: confirmedBy.trim(), confirmationChannel: confirmChannel }), t('projects:tickets.closed'));
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>{dialog === 'resolve' ? t('projects:tickets.resolve') : t('projects:tickets.close')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							{dialog === 'resolve' ? (
								<>
									<Field>
										<FieldLabel htmlFor='ticket-resolution'>{t('projects:ticket.resolution')}</FieldLabel>
										<Textarea id='ticket-resolution' required maxLength={4000} value={resolution} onChange={(event) => setResolution(event.target.value)} />
									</Field>
									<Field>
										<FieldLabel htmlFor='ticket-cost'>{t('projects:ticket.serviceCostRp')}</FieldLabel>
										<Input id='ticket-cost' type='number' min='0' step='0.01' inputMode='decimal' value={cost} onChange={(event) => setCost(event.target.value)} />
									</Field>
								</>
							) : (
								<>
									<p className='text-sm text-muted-foreground'>{t('projects:tickets.closeHint')}</p>
									<Field>
										<FieldLabel htmlFor='ticket-confirmed-by'>{t('projects:ticket.confirmedBy')}</FieldLabel>
										<Input id='ticket-confirmed-by' required maxLength={200} value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
									</Field>
									<Field>
										<FieldLabel htmlFor='ticket-confirm-channel'>{t('projects:ticket.channel')}</FieldLabel>
										<select
											id='ticket-confirm-channel'
											className={select}
											value={confirmChannel}
											onChange={(event) => setConfirmChannel(event.target.value as TTicketChannel)}
										>
											{TICKET_CHANNELS.map((value) => (
												<option key={value} value={value}>
													{t(`projects:channel.${value}`)}
												</option>
											))}
										</select>
									</Field>
								</>
							)}
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setDialog(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || (dialog === 'resolve' ? !resolution.trim() : !confirmedBy.trim())}>
								{dialog === 'resolve' ? t('projects:tickets.resolve') : t('projects:tickets.close')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

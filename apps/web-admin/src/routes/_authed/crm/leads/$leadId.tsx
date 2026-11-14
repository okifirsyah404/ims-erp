import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@ims-erp/ui/components/alert-dialog';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DateTimePicker } from '@ims-erp/ui/components/datetime-picker';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ConvertLeadDialog } from '@/components/crm/convert-lead-dialog';
import { LeadFormDialog } from '@/components/crm/lead-form-dialog';
import { toast } from '@/components/toast';
import { formatIdr } from '@/lib/dashboard-api';
import { formatDateTime, fromDateTimeInput } from '@/lib/format';
import {
	addLeadActivity,
	archiveLead,
	assignLead,
	convertLead,
	LEAD_ACTIVITY_TYPES,
	LEAD_OPEN_STATUSES,
	LEAD_STATUS_VARIANT,
	leadAssigneesQueryOptions,
	leadAttachmentUrl,
	leadQueryOptions,
	setLeadStatus,
	type TLeadActivityType,
	type TLeadStatus,
	updateLead,
} from '@/lib/lead-api';
import { usePermission } from '@/lib/use-permission';

/** `/crm/leads/$leadId` — one lead: pipeline, follow-ups, attachments. */
export const Route = createFileRoute('/_authed/crm/leads/$leadId')({
	component: LeadDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function LeadDetailPage() {
	const { t, i18n } = useTranslation(['crm', 'common']);
	const { leadId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canUpdate = usePermission('lead.update');
	const canManage = usePermission('lead.assign');
	const canArchive = usePermission('lead.archive');
	const canConvert = usePermission(['lead.update', 'customer.create']);
	const canQuote = usePermission('quotation.create');
	const { data: lead, isPending, isError } = useQuery(leadQueryOptions(leadId));
	const assignees = useQuery(leadAssigneesQueryOptions(canManage));
	const [submitting, setSubmitting] = useState(false);
	const [editing, setEditing] = useState(false);
	const [converting, setConverting] = useState(false);
	const [archiving, setArchiving] = useState(false);
	const [nextStatus, setNextStatus] = useState<TLeadStatus | ''>('');
	const [lostReason, setLostReason] = useState('');
	const [activityType, setActivityType] = useState<TLeadActivityType>('call');
	const [activityNotes, setActivityNotes] = useState('');
	const [activityFollowUp, setActivityFollowUp] = useState('');

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });

	async function run(action: () => Promise<unknown>, success: string, done?: () => void) {
		setSubmitting(true);
		try {
			await action();
			await refresh();
			toast.success(success);
			done?.();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	async function download(attachmentId: string) {
		try {
			// The presigned URL answers with `Content-Disposition: attachment`, so a
			// plain link click downloads without a (blockable) popup window.
			const { url } = await leadAttachmentUrl(leadId, attachmentId);
			const link = document.createElement('a');
			link.href = url;
			link.rel = 'noopener';
			link.click();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		}
	}

	if (isPending) return null;
	if (isError || !lead) return <p className='text-sm text-muted-foreground'>{t('crm:leads.notFound')}</p>;

	const open = lead.status !== 'won';
	const statusChoice = nextStatus || lead.status;

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/crm/leads' className='text-sm text-muted-foreground hover:underline'>
				← {t('crm:leads.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<div className='flex items-center gap-2'>
						<h1 className='text-2xl font-bold'>{lead.name}</h1>
						<Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{t(`crm:leadStatus.${lead.status}`)}</Badge>
					</div>
					<p className='text-sm text-muted-foreground'>
						{[lead.companyName, lead.channel && t(`crm:leadChannel.${lead.channel}`), lead.reference]
							.filter(Boolean)
							.join(' · ')}
					</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{open && canUpdate && (
						<Button variant='outline' onClick={() => setEditing(true)}>
							{t('common:action.edit')}
						</Button>
					)}
					{open && lead.status !== 'lost' && canConvert && (
						<Button onClick={() => setConverting(true)}>{t('crm:leads.convert')}</Button>
					)}
					{lead.customerId && (
						<Button
							variant='outline'
							onClick={() => void navigate({ to: '/crm/customers/$customerId', params: { customerId: lead.customerId! } })}
						>
							{t('crm:leads.openCustomer')}
						</Button>
					)}
					{lead.customerId && canQuote && (
						<Button
							variant='outline'
							onClick={() =>
								void navigate({
									to: '/sales/quotes/new',
									search: { customerId: lead.customerId!, leadId: lead.id },
								})
							}
						>
							{t('crm:leads.newQuotation')}
						</Button>
					)}
					{canArchive && (
						<Button variant='outline' onClick={() => setArchiving(true)}>
							{t('crm:leads.archive')}
						</Button>
					)}
				</div>
			</div>

			<div className='grid gap-6 lg:grid-cols-[2fr_1fr]'>
				<Card>
					<CardHeader>
						<CardTitle>{t('crm:customers.details')}</CardTitle>
					</CardHeader>
					<CardContent className='grid grid-cols-2 gap-4 text-sm'>
						<Detail label={t('crm:lead.phone')} value={lead.phone} />
						<Detail label={t('crm:lead.whatsapp')} value={lead.whatsapp} />
						<Detail label={t('crm:lead.email')} value={lead.email} />
						<Detail label={t('crm:lead.source')} value={t(`crm:leadSource.${lead.source}`)} />
						<Detail
							label={t('crm:lead.estimatedValue')}
							value={lead.estimatedValue != null ? formatIdr(lead.estimatedValue) : null}
						/>
						<Detail label={t('crm:lead.createdAt')} value={formatDateTime(lead.createdAt, i18n.language)} />
						<div className='col-span-2'>
							<Detail label={t('crm:lead.needs')} value={lead.needs} />
						</div>
						{lead.attachments.length > 0 && (
							<div className='col-span-2'>
								<div className='text-muted-foreground'>{t('crm:attachments.title')}</div>
								<ul className='mt-1 flex flex-col gap-1'>
									{lead.attachments.map((file) => (
										<li key={file.id} className='flex items-center justify-between gap-2'>
											<span>{file.fileName}</span>
											<Button size='sm' variant='outline' onClick={() => void download(file.id)}>
												{t('crm:attachments.download')}
											</Button>
										</li>
									))}
								</ul>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t('crm:lead.status')}</CardTitle>
					</CardHeader>
					<CardContent>
						<FieldGroup>
							{open && canUpdate ? (
								<>
									<Field>
										<FieldLabel htmlFor='lead-status'>{t('crm:lead.status')}</FieldLabel>
										<Select value={statusChoice} onValueChange={(value: string | null) => setNextStatus(value as TLeadStatus)}>
											<SelectTrigger id='lead-status' className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{[...LEAD_OPEN_STATUSES, 'lost' as const].map((value) => (
													<SelectItem key={value} value={value}>
														{t(`crm:leadStatus.${value}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
									{statusChoice === 'lost' && lead.status !== 'lost' && (
										<Field>
											<FieldLabel htmlFor='lead-lost-reason'>{t('crm:lead.lostReason')}</FieldLabel>
											<Textarea
												id='lead-lost-reason'
												rows={2}
												maxLength={1000}
												required
												value={lostReason}
												onChange={(e) => setLostReason(e.target.value)}
											/>
										</Field>
									)}
									<Button
										size='sm'
										disabled={
											submitting ||
											statusChoice === lead.status ||
											(statusChoice === 'lost' && lostReason.trim() === '')
										}
										onClick={() =>
											void run(
												() => setLeadStatus(lead.id, statusChoice, statusChoice === 'lost' ? lostReason.trim() : undefined),
												t('crm:lead.statusSaved'),
												() => setNextStatus(''),
											)
										}
									>
										{t('crm:lead.saveStatus')}
									</Button>
								</>
							) : null}
							{lead.status === 'lost' && <Detail label={t('crm:lead.lostReason')} value={lead.lostReason} />}
							{canManage ? (
								<Field>
									<FieldLabel htmlFor='lead-assignee'>{t('crm:lead.assignee')}</FieldLabel>
									<Select
										value={lead.ownerUserId ?? 'none'}
										disabled={submitting}
										onValueChange={(value: string | null) =>
											void run(() => assignLead(lead.id, value && value !== 'none' ? value : null), t('crm:lead.assigned'))
										}
									>
										<SelectTrigger id='lead-assignee' className='w-full'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='none'>{t('crm:lead.unassigned')}</SelectItem>
											{lead.assignee && !assignees.data?.some((p) => p.userId === lead.assignee?.userId) && (
												<SelectItem value={lead.assignee.userId}>{lead.assignee.name}</SelectItem>
											)}
											{(assignees.data ?? []).map((person) => (
												<SelectItem key={person.userId} value={person.userId}>
													{person.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							) : (
								<Detail label={t('crm:lead.assignee')} value={lead.assignee?.name ?? t('crm:lead.unassigned')} />
							)}
							<Detail label={t('crm:lead.nextFollowUpAt')} value={formatDateTime(lead.nextFollowUpAt, i18n.language)} />
						</FieldGroup>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('crm:activities.title')}</CardTitle>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{open && canUpdate && (
						<form
							className='flex flex-col gap-3 rounded-md border p-3'
							onSubmit={(event) => {
								event.preventDefault();
								void run(
									() =>
										addLeadActivity(lead.id, {
											activityType,
											notes: activityNotes.trim(),
											...(activityFollowUp ? { nextFollowUpAt: fromDateTimeInput(activityFollowUp) } : {}),
										}),
									t('crm:activities.saved'),
									() => {
										setActivityNotes('');
										setActivityFollowUp('');
									},
								);
							}}
						>
							<div className='grid gap-3 sm:grid-cols-2'>
								<Field>
									<FieldLabel htmlFor='activity-type'>{t('crm:activities.type')}</FieldLabel>
									<Select value={activityType} onValueChange={(value: string | null) => setActivityType(value as TLeadActivityType)}>
										<SelectTrigger id='activity-type' className='w-full'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{LEAD_ACTIVITY_TYPES.map((value) => (
												<SelectItem key={value} value={value}>
													{t(`crm:activityType.${value}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
								<Field>
									<FieldLabel htmlFor='activity-follow-up'>{t('crm:activities.nextFollowUp')}</FieldLabel>
									<DateTimePicker
										id='activity-follow-up'
										value={activityFollowUp}
										onChange={setActivityFollowUp}
									/>
								</Field>
							</div>
							<Field>
								<FieldLabel htmlFor='activity-notes'>{t('crm:activities.notes')}</FieldLabel>
								<Textarea
									id='activity-notes'
									rows={2}
									maxLength={4000}
									required
									value={activityNotes}
									onChange={(e) => setActivityNotes(e.target.value)}
								/>
							</Field>
							<Button type='submit' size='sm' className='self-start' disabled={submitting || !activityNotes.trim()}>
								{t('crm:activities.add')}
							</Button>
						</form>
					)}
					{lead.activities.length === 0 ? (
						<p className='text-sm text-muted-foreground'>{t('crm:activities.empty')}</p>
					) : (
						<ul className='flex flex-col gap-3 text-sm'>
							{lead.activities.map((activity) => (
								<li key={activity.id} className='border-l-2 pl-3'>
									<div className='flex flex-wrap items-center gap-2'>
										<Badge variant='outline'>{t(`crm:activityType.${activity.activityType}`)}</Badge>
										<span className='text-muted-foreground'>
											{formatDateTime(activity.occurredAt, i18n.language)}
											{activity.author && ` · ${t('crm:activities.by', { name: activity.author.name })}`}
										</span>
									</div>
									<p className='mt-1 whitespace-pre-line'>{activity.notes}</p>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			{editing && (
				<LeadFormDialog
					lead={lead}
					submitting={submitting}
					onClose={() => setEditing(false)}
					onSave={(input) => void run(() => updateLead(lead.id, input), t('crm:leads.saved'), () => setEditing(false))}
				/>
			)}
			{converting && (
				<ConvertLeadDialog
					lead={lead}
					submitting={submitting}
					onClose={() => setConverting(false)}
					onConvert={(input) =>
						void run(() => convertLead(lead.id, input), t('crm:leads.converted'), () => setConverting(false))
					}
				/>
			)}
			<AlertDialog open={archiving} onOpenChange={setArchiving}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('crm:leads.archive')}</AlertDialogTitle>
						<AlertDialogDescription>{t('crm:leads.archiveConfirm', { name: lead.name })}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								void run(() => archiveLead(lead.id), t('crm:leads.archived'), () => void navigate({ to: '/crm/leads' }))
							}
						>
							{t('crm:leads.archive')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

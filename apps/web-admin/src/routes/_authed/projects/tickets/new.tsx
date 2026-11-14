import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { customersQueryOptions } from '@/lib/customer-api';
import { formatBusinessDate } from '@/lib/format';
import { projectsQueryOptions } from '@/lib/project-api';
import { checkWarranty, createTicket, STAFF_TICKET_CHANNELS, type TTicketChannel, type TWarrantyCheck } from '@/lib/service-ticket-api';

/** `/projects/tickets/new` — open a service ticket with the warranty check. */
export const Route = createFileRoute('/_authed/projects/tickets/new')({
	component: NewTicketPage,
});

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function NewTicketPage() {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const customers = useQuery(customersQueryOptions({ limit: 100, status: 'active' }));
	const projects = useQuery(projectsQueryOptions({ limit: 100 }));
	const [customerId, setCustomerId] = useState('');
	const [projectId, setProjectId] = useState('');
	const [serialNumber, setSerialNumber] = useState('');
	const [deviceDescription, setDeviceDescription] = useState('');
	const [channel, setChannel] = useState<TTicketChannel>('whatsapp');
	const [reporterName, setReporterName] = useState('');
	const [reporterContact, setReporterContact] = useState('');
	const [complaint, setComplaint] = useState('');
	const [check, setCheck] = useState<TWarrantyCheck | null>(null);
	const [busy, setBusy] = useState(false);
	const customerProjects = (projects.data?.rows ?? []).filter((project) => project.customerId === customerId);

	const runCheck = async (query: { serialNumber?: string; projectId?: string }) => {
		if (!query.serialNumber && !query.projectId) {
			setCheck(null);
			return;
		}
		try {
			const result = await checkWarranty(query);
			setCheck(result);
			// A shipped serial fills in what it knows.
			if (result.customerId && !customerId) setCustomerId(result.customerId);
			if (result.projectId && !projectId) setProjectId(result.projectId);
			if (result.deviceDescription && !deviceDescription) setDeviceDescription(result.deviceDescription);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		}
	};

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('projects:tickets.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('projects:tickets.newHint')}</p>
			</div>
			<form
				onSubmit={async (event) => {
					event.preventDefault();
					setBusy(true);
					try {
						const created = await createTicket({
							customerId,
							projectId: projectId || null,
							serialNumber: serialNumber.trim() || null,
							deviceDescription: deviceDescription.trim() || null,
							channel,
							reporterName: reporterName.trim(),
							reporterContact: reporterContact.trim() || null,
							complaint: complaint.trim(),
						});
						await queryClient.invalidateQueries({ queryKey: ['tickets'] });
						toast.success(t('projects:tickets.created'));
						void navigate({ to: '/projects/tickets/$ticketId', params: { ticketId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					} finally {
						setBusy(false);
					}
				}}
			>
				<Card>
					<CardContent className='pt-6'>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='ticket-serial'>{t('projects:ticket.serialNumber')}</FieldLabel>
								<Input
									id='ticket-serial'
									maxLength={100}
									value={serialNumber}
									onChange={(event) => setSerialNumber(event.target.value)}
									onBlur={() => void runCheck({ serialNumber: serialNumber.trim() || undefined, projectId: projectId || undefined })}
								/>
								<FieldDescription>{t('projects:ticket.serialHint')}</FieldDescription>
							</Field>
							<div className='flex items-end'>
								{check && (
									<div className='flex flex-col gap-1 text-sm' aria-live='polite'>
										<Badge variant={check.inWarranty ? 'default' : 'outline'}>
											{check.inWarranty ? t('projects:ticket.inWarranty') : t('projects:ticket.outOfWarranty')}
										</Badge>
										{check.warrantyEndsOn && (
											<span className='text-muted-foreground'>
												{check.warrantyCode} · {t('projects:ticket.until', { date: formatBusinessDate(check.warrantyEndsOn, i18n.language) })}
											</span>
										)}
									</div>
								)}
							</div>
							<Field>
								<FieldLabel htmlFor='ticket-customer'>{t('projects:ticket.customer')}</FieldLabel>
								<select
									id='ticket-customer'
									required
									className={select}
									value={customerId}
									onChange={(event) => {
										setCustomerId(event.target.value);
										setProjectId('');
									}}
								>
									<option value=''>{t('projects:ticket.pickCustomer')}</option>
									{(customers.data?.rows ?? []).map((customer) => (
										<option key={customer.id} value={customer.id}>
											{customer.code} — {customer.name}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-project'>{t('projects:ticket.project')}</FieldLabel>
								<select
									id='ticket-project'
									className={select}
									value={projectId}
									disabled={!customerId}
									onChange={(event) => {
										setProjectId(event.target.value);
										void runCheck({ serialNumber: serialNumber.trim() || undefined, projectId: event.target.value || undefined });
									}}
								>
									<option value=''>{t('projects:ticket.noProject')}</option>
									{customerProjects.map((project) => (
										<option key={project.id} value={project.id}>
											{project.code} — {project.title}
										</option>
									))}
								</select>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='ticket-device'>{t('projects:ticket.device')}</FieldLabel>
								<Input id='ticket-device' maxLength={300} value={deviceDescription} onChange={(event) => setDeviceDescription(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-reporter'>{t('projects:ticket.reporter')}</FieldLabel>
								<Input id='ticket-reporter' required maxLength={200} value={reporterName} onChange={(event) => setReporterName(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-contact'>{t('projects:ticket.contact')}</FieldLabel>
								<Input id='ticket-contact' type='tel' maxLength={200} value={reporterContact} onChange={(event) => setReporterContact(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-channel'>{t('projects:ticket.channel')}</FieldLabel>
								<select id='ticket-channel' className={select} value={channel} onChange={(event) => setChannel(event.target.value as TTicketChannel)}>
									{STAFF_TICKET_CHANNELS.map((value) => (
										<option key={value} value={value}>
											{t(`projects:channel.${value}`)}
										</option>
									))}
								</select>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='ticket-complaint'>{t('projects:ticket.complaint')}</FieldLabel>
								<Textarea id='ticket-complaint' required rows={4} maxLength={4000} value={complaint} onChange={(event) => setComplaint(event.target.value)} />
							</Field>
						</FieldGroup>
					</CardContent>
				</Card>
				<div className='mt-6 flex justify-end gap-2'>
					<Button type='button' variant='outline' onClick={() => void navigate({ to: '/projects/tickets' })}>
						{t('common:action.cancel')}
					</Button>
					<Button type='submit' disabled={busy || !customerId || !reporterName.trim() || !complaint.trim()}>
						{t('projects:tickets.submit')}
					</Button>
				</div>
			</form>
		</div>
	);
}

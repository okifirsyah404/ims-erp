import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardFooter } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { customersQueryOptions } from '@/lib/customer-api';
import { formatBusinessDate } from '@/lib/format';
import { projectsQueryOptions } from '@/lib/project-api';
import { checkWarranty, createTicket, STAFF_TICKET_CHANNELS, type TTicketChannel, type TWarrantyCheck } from '@/lib/service-ticket-api';

/** `/tickets/new` — open a service ticket with the warranty check. */
export const Route = createFileRoute('/_authed/tickets/new')({
	component: NewTicketPage,
});

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
						void navigate({ to: '/tickets/$ticketId', params: { ticketId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					} finally {
						setBusy(false);
					}
				}}
			>
				<Card>
					<CardContent>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='ticket-serial' optional>{t('projects:ticket.serialNumber')}</FieldLabel>
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
								<Select
									value={customerId || 'none'}
									onValueChange={(value: string | null) => {
										setCustomerId(value === null || value === 'none' ? '' : value);
										setProjectId('');
									}}
								>
									<SelectTrigger id='ticket-customer' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>{t('projects:ticket.pickCustomer')}</SelectItem>
										{(customers.data?.rows ?? []).map((customer) => (
											<SelectItem key={customer.id} value={customer.id}>
												{customer.code} — {customer.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-project'>{t('projects:ticket.project')}</FieldLabel>
								<Select
									value={projectId || 'none'}
									disabled={!customerId}
									onValueChange={(value: string | null) => {
										const next = value === null || value === 'none' ? '' : value;
										setProjectId(next);
										void runCheck({ serialNumber: serialNumber.trim() || undefined, projectId: next || undefined });
									}}
								>
									<SelectTrigger id='ticket-project' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>{t('projects:ticket.noProject')}</SelectItem>
										{customerProjects.map((project) => (
											<SelectItem key={project.id} value={project.id}>
												{project.code} — {project.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='ticket-device' optional>{t('projects:ticket.device')}</FieldLabel>
								<Input id='ticket-device' maxLength={300} value={deviceDescription} onChange={(event) => setDeviceDescription(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-reporter'>{t('projects:ticket.reporter')}</FieldLabel>
								<Input id='ticket-reporter' required maxLength={200} value={reporterName} onChange={(event) => setReporterName(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-contact' optional>{t('projects:ticket.contact')}</FieldLabel>
								<Input id='ticket-contact' type='tel' maxLength={200} value={reporterContact} onChange={(event) => setReporterContact(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='ticket-channel'>{t('projects:ticket.channel')}</FieldLabel>
								<Select value={channel} onValueChange={(value: string | null) => setChannel(value as TTicketChannel)}>
									<SelectTrigger id='ticket-channel' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{STAFF_TICKET_CHANNELS.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`projects:channel.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='ticket-complaint'>{t('projects:ticket.complaint')}</FieldLabel>
								<Textarea id='ticket-complaint' required rows={4} maxLength={4000} value={complaint} onChange={(event) => setComplaint(event.target.value)} />
							</Field>
						</FieldGroup>
					</CardContent>
					<CardFooter className='justify-end gap-2'>
						<Button type='button' variant='outline' onClick={() => void navigate({ to: '/tickets' })}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !customerId || !reporterName.trim() || !complaint.trim()}>
							{t('projects:tickets.submit')}
						</Button>
					</CardFooter>
				</Card>
			</form>
		</div>
	);
}

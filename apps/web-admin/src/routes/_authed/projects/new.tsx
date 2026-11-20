import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardFooter } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { Search } from 'lucide-react';
import { toast } from '@/components/toast';
import { formatIdr } from '@/lib/format';
import { createProject, openDealsQueryOptions, projectStaffQueryOptions } from '@/lib/project-api';

/** `/projects/new` — a project from a deal (sales order). */
export const Route = createFileRoute('/_authed/projects/new')({
	component: NewProjectPage,
});

function NewProjectPage() {
	const { t } = useTranslation(['projects', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const deals = useQuery(openDealsQueryOptions());
	const staff = useQuery(projectStaffQueryOptions());
	const [dealSearch, setDealSearch] = useState('');
	const [orderId, setOrderId] = useState('');
	const [picUserId, setPicUserId] = useState('');
	const [siteName, setSiteName] = useState('');
	const [targetStartDate, setTargetStartDate] = useState('');
	const [targetEndDate, setTargetEndDate] = useState('');
	const [notes, setNotes] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const query = dealSearch.trim().toLowerCase();
	const open = (deals.data ?? []).filter(
		(deal) => !deal.hasProject && (!query || `${deal.code} ${deal.quotationCode} ${deal.title} ${deal.customerName}`.toLowerCase().includes(query)),
	);
	const deal = deals.data?.find((row) => row.id === orderId);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('projects:new.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('projects:new.hint')}</p>
			</div>
			<form
				onSubmit={async (event) => {
					event.preventDefault();
					setSubmitting(true);
					try {
						const created = await createProject({
							orderId,
							picUserId,
							siteName: siteName.trim() || null,
							targetStartDate: targetStartDate || null,
							targetEndDate: targetEndDate || null,
							notes: notes.trim() || null,
						});
						await queryClient.invalidateQueries({ queryKey: ['projects'] });
						toast.success(t('projects:new.created'));
						void navigate({ to: '/projects/$projectId', params: { projectId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					} finally {
						setSubmitting(false);
					}
				}}
			>
				<Card>
					<CardContent>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='project-deal-search'>{t('projects:new.searchDeal')}</FieldLabel>
								<InputGroup>
									<InputGroupAddon align='inline-start'>
										<Search aria-hidden='true' />
									</InputGroupAddon>
									<InputGroupInput
										id='project-deal-search'
										type='search'
										value={dealSearch}
										onChange={(event) => setDealSearch(event.target.value)}
									/>
								</InputGroup>
							</Field>
							<Field>
								<FieldLabel htmlFor='project-deal'>{t('projects:field.deal')}</FieldLabel>
								<Select value={orderId || 'none'} onValueChange={(value: string | null) => setOrderId(value === null || value === 'none' ? '' : value)}>
									<SelectTrigger id='project-deal' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>{t('projects:new.pickDeal')}</SelectItem>
										{open.map((row) => (
											<SelectItem key={row.id} value={row.id}>
												{row.code} — {row.quotationCode} — {row.customerName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{deals.data && open.length === 0 && <FieldDescription>{t('projects:new.noDeals')}</FieldDescription>}
							</Field>
							{deal && (
								<div className='rounded-md bg-muted p-3 text-sm sm:col-span-2'>
									<div className='font-medium'>{deal.title}</div>
									<div className='text-muted-foreground'>
										{deal.customerName} · {formatIdr(deal.grandTotal)}
									</div>
								</div>
							)}
							<Field>
								<FieldLabel htmlFor='project-pic'>{t('projects:field.pic')}</FieldLabel>
								<Select value={picUserId || 'none'} onValueChange={(value: string | null) => setPicUserId(value === null || value === 'none' ? '' : value)}>
									<SelectTrigger id='project-pic' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>{t('projects:new.pickPic')}</SelectItem>
										{(staff.data?.pics ?? []).map((person) => (
											<SelectItem key={person.userId} value={person.userId}>
												{person.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='project-site'>{t('projects:field.site')}</FieldLabel>
								<Input id='project-site' maxLength={200} value={siteName} onChange={(event) => setSiteName(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='project-start'>{t('projects:field.targetStart')}</FieldLabel>
								<DatePicker id='project-start' value={targetStartDate} onChange={setTargetStartDate} />
							</Field>
							<Field>
								<FieldLabel htmlFor='project-end'>{t('projects:field.targetEnd')}</FieldLabel>
								<DatePicker
									id='project-end'
									min={targetStartDate || undefined}
									value={targetEndDate}
									onChange={setTargetEndDate}
								/>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='project-notes'>{t('projects:field.notes')}</FieldLabel>
								<Textarea id='project-notes' rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
							</Field>
						</FieldGroup>
					</CardContent>
					<CardFooter className='justify-end gap-2'>
						<Button type='button' variant='outline' onClick={() => void navigate({ to: '/projects' })}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting || !orderId || !picUserId}>
							{t('projects:new.submit')}
						</Button>
					</CardFooter>
				</Card>
			</form>
		</div>
	);
}

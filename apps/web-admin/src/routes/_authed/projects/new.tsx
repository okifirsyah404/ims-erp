import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { formatIdr } from '@/lib/format';
import { createProject, openDealsQueryOptions, projectStaffQueryOptions } from '@/lib/project-api';

/** `/projects/new` — a project from a deal (sales order). */
export const Route = createFileRoute('/_authed/projects/new')({
	component: NewProjectPage,
});

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function NewProjectPage() {
	const { t } = useTranslation(['projects', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const deals = useQuery(openDealsQueryOptions());
	const staff = useQuery(projectStaffQueryOptions());
	const [dealSearch, setDealSearch] = useState('');
	const [salesOrderId, setSalesOrderId] = useState('');
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
	const deal = deals.data?.find((row) => row.id === salesOrderId);

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
							salesOrderId,
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
					<CardContent className='pt-6'>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='project-deal-search'>{t('projects:new.searchDeal')}</FieldLabel>
								<Input id='project-deal-search' type='search' value={dealSearch} onChange={(event) => setDealSearch(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='project-deal'>{t('projects:field.deal')}</FieldLabel>
								<select id='project-deal' required className={select} value={salesOrderId} onChange={(event) => setSalesOrderId(event.target.value)}>
									<option value=''>{t('projects:new.pickDeal')}</option>
									{open.map((row) => (
										<option key={row.id} value={row.id}>
											{row.code} — {row.quotationCode} — {row.customerName}
										</option>
									))}
								</select>
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
								<select id='project-pic' required className={select} value={picUserId} onChange={(event) => setPicUserId(event.target.value)}>
									<option value=''>{t('projects:new.pickPic')}</option>
									{(staff.data?.pics ?? []).map((person) => (
										<option key={person.userId} value={person.userId}>
											{person.name}
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor='project-site'>{t('projects:field.site')}</FieldLabel>
								<Input id='project-site' maxLength={200} value={siteName} onChange={(event) => setSiteName(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='project-start'>{t('projects:field.targetStart')}</FieldLabel>
								<Input id='project-start' type='date' value={targetStartDate} onChange={(event) => setTargetStartDate(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='project-end'>{t('projects:field.targetEnd')}</FieldLabel>
								<Input
									id='project-end'
									type='date'
									min={targetStartDate || undefined}
									value={targetEndDate}
									onChange={(event) => setTargetEndDate(event.target.value)}
								/>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='project-notes'>{t('projects:field.notes')}</FieldLabel>
								<Textarea id='project-notes' rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
							</Field>
						</FieldGroup>
					</CardContent>
				</Card>
				<div className='mt-6 flex justify-end gap-2'>
					<Button type='button' variant='outline' onClick={() => void navigate({ to: '/projects' })}>
						{t('common:action.cancel')}
					</Button>
					<Button type='submit' disabled={submitting || !salesOrderId || !picUserId}>
						{t('projects:new.submit')}
					</Button>
				</div>
			</form>
		</div>
	);
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { LeadFormDialog } from '@/components/crm/lead-form-dialog';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { formatDateTime } from '@/lib/format';
import {
	createLead,
	LEAD_SOURCES,
	LEAD_STATUS_VARIANT,
	LEAD_STATUSES,
	leadsQueryOptions,
	type TLeadInput,
	type TLeadSource,
	type TLeadStatus,
} from '@/lib/lead-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/crm/leads` — the lead pipeline visible to the caller (ADR-0011 step 3b). */
export const Route = createFileRoute('/_authed/crm/leads/')({
	component: LeadListPage,
});

function LeadListPage() {
	const { t, i18n } = useTranslation(['crm', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('lead.create');
	const canManage = usePermission('lead.assign');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TLeadStatus | ''>('');
	const [source, setSource] = useState<TLeadSource | ''>('');
	const [assigned, setAssigned] = useState<'me' | 'unassigned' | ''>('');
	const [followUpDue, setFollowUpDue] = useState(false);
	const [creating, setCreating] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const filtered = deferredSearch !== '' || status !== '' || source !== '' || assigned !== '' || followUpDue;
	const { data, isPending, isError, error } = useQuery(
		leadsQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: deferredSearch || undefined,
			status: status || undefined,
			source: source || undefined,
			assigned: assigned || undefined,
			followUpDue,
		}),
	);
	const reset = <T,>(set: (value: T) => void) => (value: T) => {
		set(value);
		setPage(1);
	};

	async function handleCreate(input: TLeadInput) {
		setSubmitting(true);
		try {
			const created = await createLead(input);
			await queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
			toast.success(t('crm:leads.saved'));
			void navigate({ to: '/crm/leads/$leadId', params: { leadId: created.id } });
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	const select = 'h-9 rounded-md border bg-transparent px-3 text-sm';

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('crm:leads.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('crm:leads.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setCreating(true)}>{t('crm:leads.new')}</Button>}
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('crm:leads.search')}
					placeholder={t('crm:leads.search')}
					value={search}
					onChange={(e) => reset(setSearch)(e.target.value)}
				/>
				<select
					aria-label={t('crm:lead.status')}
					className={select}
					value={status}
					onChange={(e) => reset(setStatus)(e.target.value as TLeadStatus | '')}
				>
					<option value=''>{t('crm:leads.allStatuses')}</option>
					{LEAD_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`crm:leadStatus.${value}`)}
						</option>
					))}
				</select>
				<select
					aria-label={t('crm:lead.source')}
					className={select}
					value={source}
					onChange={(e) => reset(setSource)(e.target.value as TLeadSource | '')}
				>
					<option value=''>{t('crm:leads.allSources')}</option>
					{LEAD_SOURCES.map((value) => (
						<option key={value} value={value}>
							{t(`crm:leadSource.${value}`)}
						</option>
					))}
				</select>
				{canManage && (
					<select
						aria-label={t('crm:lead.assignee')}
						className={select}
						value={assigned}
						onChange={(e) => reset(setAssigned)(e.target.value as 'me' | 'unassigned' | '')}
					>
						<option value=''>{t('crm:leads.assignedAll')}</option>
						<option value='me'>{t('crm:leads.assignedMe')}</option>
						<option value='unassigned'>{t('crm:leads.assignedNone')}</option>
					</select>
				)}
				<label className='flex items-center gap-2 text-sm'>
					<Checkbox checked={followUpDue} onCheckedChange={(checked) => reset(setFollowUpDue)(checked === true)} />
					{t('crm:leads.followUpDue')}
				</label>
			</div>

			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{filtered ? t('crm:leads.noResults') : t('crm:leads.empty')}
					</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('crm:lead.name')}</TableHead>
										<TableHead>{t('crm:lead.source')}</TableHead>
										<TableHead>{t('crm:lead.status')}</TableHead>
										<TableHead>{t('crm:lead.assignee')}</TableHead>
										<TableHead>{t('crm:lead.nextFollowUpAt')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((lead) => (
										<TableRow key={lead.id}>
											<TableCell>
												<Link
													to='/crm/leads/$leadId'
													params={{ leadId: lead.id }}
													className='font-medium hover:underline'
												>
													{lead.name}
												</Link>
												<div className='text-xs text-muted-foreground'>
													{[lead.companyName, lead.reference].filter(Boolean).join(' · ')}
												</div>
											</TableCell>
											<TableCell>{t(`crm:leadSource.${lead.source}`)}</TableCell>
											<TableCell>
												<Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{t(`crm:leadStatus.${lead.status}`)}</Badge>
											</TableCell>
											<TableCell className='text-muted-foreground'>
												{lead.assignee?.name ?? t('crm:lead.unassigned')}
											</TableCell>
											<TableCell className='text-muted-foreground'>
												{formatDateTime(lead.nextFollowUpAt, i18n.language)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls
							page={data.pagination.page}
							totalPages={data.pagination.totalPages}
							onPageChange={setPage}
						/>
					)}
				</>
			)}

			{creating && (
				<LeadFormDialog
					lead={null}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input) => void handleCreate(input)}
				/>
			)}
		</div>
	);
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
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
	type TLead,
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

	const columns = useMemo<ColumnDef<DataTableFeatures, TLead, CellData>[]>(
		() => [
			{
				id: 'name',
				header: t('crm:lead.name'),
				cell: ({ row }) => (
					<>
						<Link
							to='/crm/leads/$leadId'
							params={{ leadId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.name}
						</Link>
						<div className='text-xs text-muted-foreground'>
							{[row.original.companyName, row.original.reference].filter(Boolean).join(' · ')}
						</div>
					</>
				),
			},
			{
				id: 'source',
				header: t('crm:lead.source'),
				cell: ({ row }) => t(`crm:leadSource.${row.original.source}`),
			},
			{
				id: 'status',
				header: t('crm:lead.status'),
				cell: ({ row }) => (
					<Badge variant={LEAD_STATUS_VARIANT[row.original.status]}>
						{t(`crm:leadStatus.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'assignee',
				header: t('crm:lead.assignee'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.assignee?.name ?? t('crm:lead.unassigned'),
			},
			{
				id: 'nextFollowUpAt',
				header: t('crm:lead.nextFollowUpAt'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatDateTime(row.original.nextFollowUpAt, i18n.language),
			},
		],
		[t, i18n.language],
	);

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
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('crm:leads.search')}
						placeholder={t('crm:leads.search')}
						value={search}
						onChange={(e) => reset(setSearch)(e.target.value)}
					/>
				</InputGroup>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) =>
						reset(setStatus)(value === null || value === 'all' ? '' : (value as TLeadStatus))
					}
				>
					<SelectTrigger aria-label={t('crm:lead.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('crm:leads.allStatuses')}</SelectItem>
						{LEAD_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`crm:leadStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={source || 'all'}
					onValueChange={(value: string | null) =>
						reset(setSource)(value === null || value === 'all' ? '' : (value as TLeadSource))
					}
				>
					<SelectTrigger aria-label={t('crm:lead.source')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('crm:leads.allSources')}</SelectItem>
						{LEAD_SOURCES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`crm:leadSource.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{canManage && (
					<Select
						value={assigned || 'all'}
						onValueChange={(value: string | null) =>
							reset(setAssigned)(value === null || value === 'all' ? '' : (value as 'me' | 'unassigned'))
						}
					>
						<SelectTrigger aria-label={t('crm:lead.assignee')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{t('crm:leads.assignedAll')}</SelectItem>
							<SelectItem value='me'>{t('crm:leads.assignedMe')}</SelectItem>
							<SelectItem value='unassigned'>{t('crm:leads.assignedNone')}</SelectItem>
						</SelectContent>
					</Select>
				)}
				<Field orientation='horizontal' className='w-auto'>
					<Checkbox id='leads-follow-up-due' checked={followUpDue} onCheckedChange={(checked) => reset(setFollowUpDue)(checked === true)} />
					<FieldLabel htmlFor='leads-follow-up-due'>{t('crm:leads.followUpDue')}</FieldLabel>
				</Field>
			</div>

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState title={filtered ? t('crm:leads.noResults') : t('crm:leads.empty')} bordered />
			) : (
				<>
					<DataTable columns={columns} data={data?.rows ?? []} getRowId={(row) => row.id} loading={isPending} bordered />
					{data && data.pagination.totalPages > 1 && (
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

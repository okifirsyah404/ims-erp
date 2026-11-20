import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Plus, Users } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	archiveEmployee,
	EMPLOYMENT_STATUSES,
	employeesQueryOptions,
	type TEmployee,
	type TEmploymentStatus,
} from '@/lib/hr-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/hr/employees` (validated search params). */
const routeApi = getRouteApi('/_authed/hr/employees/');

/** Rows per page. */
const PAGE_SIZE = 12;

/** Badge tone per employment status. */
const STATUS_TONE: Record<TEmploymentStatus, 'default' | 'secondary' | 'destructive'> = {
	active: 'default',
	inactive: 'secondary',
	terminated: 'destructive',
};

/**
 * The employee list (`/hr/employees`, ERP-0034).
 *
 * @remarks
 * Card grid with URL-backed search + status filter and server pagination
 * (`placeholderData: previous` house pattern). Shows own-org employees plus
 * company-level ones. Create is invite-first: the new form sends the email
 * that becomes both the invitation and the employee's login.
 */
export function EmployeeList() {
	const { t } = useTranslation(['hr', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const [searchDraft, setSearchDraft] = useState(search.search ?? '');
	const canCreate = usePermission('employee.create');
	const canArchive = usePermission('employee.archive');

	const page = search.page ?? 1;

	const { data, isPending, isError, error } = useQuery({
		...employeesQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: search.search,
			status: search.status as TEmploymentStatus | undefined,
		}),
		placeholderData: (previous) => previous,
	});

	const archive = useMutation({
		mutationFn: (id: string) => archiveEmployee(id),
		onSuccess: () => {
			toast.success(t('hr:list.archived'));
			void queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<div className='space-y-4 p-4'>
			{/* Header ------------------------------------------------------- */}
			<div className='flex items-start justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>{t('hr:list.title')}</h1>
					<p className='text-muted-foreground text-sm'>
						{t('hr:list.description')}
					</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/hr/employees/new' />} className='shrink-0'>
						<Plus className='size-4' data-icon='inline-start' />
						{t('hr:list.new')}
					</Button>
				)}
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-center gap-3'>
				<Input
					className='w-64'
					placeholder={t('hr:list.searchPlaceholder')}
					value={searchDraft}
					onChange={(event) => setSearchDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							void navigate({
								search: (prev) => ({
									...prev,
									page: 1,
									search: searchDraft || undefined,
								}),
							});
						}
					}}
				/>
				<Select
					value={search.status ?? 'all'}
					onValueChange={(value: string | null) =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								status:
									value === 'all' ? undefined : (value as TEmploymentStatus),
							}),
						})
					}
				>
					<SelectTrigger className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>
							{t('hr:list.filterAllStatuses')}
						</SelectItem>
						{EMPLOYMENT_STATUSES.map((status) => (
							<SelectItem key={status} value={status}>
								{t(`hr:status.${status}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Grid --------------------------------------------------------- */}
			{isPending ? (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{Array.from({ length: 6 }, (_, index) => (
						<Card key={index} className='animate-pulse'>
							<CardHeader>
								<CardTitle className='h-5 w-1/2 rounded bg-muted' />
							</CardHeader>
							<CardContent className='space-y-2'>
								<div className='h-4 w-3/4 rounded bg-muted' />
								<div className='h-4 w-1/2 rounded bg-muted' />
							</CardContent>
						</Card>
					))}
				</div>
			) : isError ? (
				<ErrorState error={error} bordered />
			) : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={Users}
					title={t('hr:list.emptyTitle')}
					description={t('hr:list.empty')}
				/>
			) : (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{data.rows.map((employee) => (
						<EmployeeCard
							key={employee.id}
							employee={employee}
							canArchive={canArchive}
							onArchive={() => archive.mutate(employee.id)}
							archiving={archive.isPending && archive.variables === employee.id}
						/>
					))}
				</div>
			)}

			{/* Pagination --------------------------------------------------- */}
			{data && data.pagination.totalPages > 1 && (
				<PaginationControls
					page={data.pagination.page}
					totalPages={data.pagination.totalPages}
					onPageChange={(next) =>
						void navigate({ search: (prev) => ({ ...prev, page: next }) })
					}
				/>
			)}
		</div>
	);
}

function EmployeeCard(props: {
	employee: TEmployee;
	canArchive: boolean;
	onArchive: () => void;
	archiving: boolean;
}) {
	const { t } = useTranslation(['hr', 'common']);
	const { employee } = props;
	return (
		<Card className='flex flex-col'>
			<CardHeader>
				<CardTitle>
					<Link
						to='/hr/employees/$employeeId'
						params={{ employeeId: employee.id }}
						className='hover:underline'
					>
						{employee.fullName}
					</Link>
				</CardTitle>
				<CardDescription className='font-mono text-xs'>
					{employee.employeeCode}
				</CardDescription>
				<CardAction>
					<Badge variant={STATUS_TONE[employee.employmentStatus]}>
						{t(`hr:status.${employee.employmentStatus}`)}
					</Badge>
				</CardAction>
			</CardHeader>
			<CardContent className='flex flex-1 flex-col gap-1 text-sm'>
				{employee.email && (
					<p className='text-muted-foreground truncate'>{employee.email}</p>
				)}
				<p className='text-muted-foreground text-xs'>
					{t(`hr:employmentType.${employee.employmentType}`)} ·{' '}
					{t(`hr:workType.${employee.workType}`)}
				</p>
				{employee.organizationId === null && (
					<Badge variant='outline' className='w-fit'>
						{t('hr:list.companyLevel')}
					</Badge>
				)}
				{props.canArchive && (
					<Button
						variant='ghost'
						size='sm'
						className='mt-auto w-fit'
						disabled={props.archiving}
						onClick={props.onArchive}
					>
						{t('hr:list.archive')}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

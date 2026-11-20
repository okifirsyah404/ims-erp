import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import {
	ADMIN_PERMISSIONS,
	auditQueryOptions,
	type TAuditListParams,
	type TAdminAudit,
} from '@/lib/admin-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission } from '@/lib/use-permission';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';

/** Audit actions the user-management domain emits (mirrors the backend). */
const AUDIT_ACTIONS = [
	'invitation.sent',
	'invitation.resent',
	'invitation.cancelled',
	'invitation.deleted',
	'invitation.claimed',
	'user.precreated',
	'user.deactivated',
	'user.restored',
	'user.deleted',
	'role.created',
	'role.updated',
	'role.deleted',
	'member.added',
	'member.removed',
	'member.roleChanged',
	'org.created',
] as const;

/** Target types the backend vocabulary uses. */
const TARGET_TYPES = ['invitation', 'user', 'role', 'member', 'organization'] as const;

type TAuditSearch = {
	page?: number;
	action?: string;
	targetType?: string;
	/** ISO date (`YYYY-MM-DD`) lower bound, converted to a full timestamp. */
	from?: string;
	to?: string;
};

export const Route = createFileRoute('/_authed/admin/audit/')({
	validateSearch: (search: Record<string, unknown>): TAuditSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		action: typeof search.action === 'string' ? search.action : undefined,
		targetType: typeof search.targetType === 'string' ? search.targetType : undefined,
		from: typeof search.from === 'string' ? search.from : undefined,
		to: typeof search.to === 'string' ? search.to : undefined,
	}),
	component: AuditPage,
});

function AuditPage() {
	const organizationId = useActiveOrganizationId();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const canRead = usePermission(ADMIN_PERMISSIONS.readAudit);
	const { t } = useTranslation(['admin', 'common']);

	const [fromDraft, setFromDraft] = useState(search.from ?? '');
	const [toDraft, setToDraft] = useState(search.to ?? '');

	const params: TAuditListParams = {
		page: search.page ?? 1,
		limit: 50,
		action: search.action,
		targetType: search.targetType,
		organizationId: organizationId ?? undefined,
		// `from` at 00:00:00Z, `to` at the end of the chosen day.
		from: search.from ? `${search.from}T00:00:00.000Z` : undefined,
		to: search.to ? `${search.to}T23:59:59.000Z` : undefined,
	};

	const { data, isPending, isError, error } = useQuery({
		...auditQueryOptions(organizationId ?? '', params),
		enabled: !!organizationId && canRead,
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TAdminAudit, CellData>[]>(
		() => [
			{
				accessorKey: 'createdAt',
				header: t('audit.when'),
				meta: { cellClassName: 'whitespace-nowrap text-xs text-muted-foreground', skeletonClassName: 'h-4 w-36' },
				cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
			},
			{
				accessorKey: 'action',
				header: t('audit.action'),
				cell: ({ row }) => <Badge variant='secondary'>{row.original.action}</Badge>,
			},
			{
				id: 'actor',
				header: t('audit.actor'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) => row.original.actorEmail ?? row.original.actorUserId,
			},
			{
				id: 'target',
				header: t('audit.target'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) => (
					<>
						<span className='text-muted-foreground'>{row.original.targetType}</span>{' '}
						<span className='font-mono'>{shortId(row.original.targetId)}</span>
					</>
				),
			},
			{
				id: 'metadata',
				header: t('audit.metadata'),
				meta: { cellClassName: 'max-w-md truncate text-xs text-muted-foreground' },
				cell: ({ row }) =>
					row.original.meta ? JSON.stringify(row.original.meta) : '-',
			},
		],
		[t],
	);

	if (!organizationId) {
		return (
			<div className='text-sm text-muted-foreground'>
				{t('audit.noOrganization')}
			</div>
		);
	}

	if (!canRead) {
		return (
			<div className='text-sm text-muted-foreground'>
				{t('audit.noPermission')}
			</div>
		);
	}

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;


	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='flex items-center gap-2 text-2xl font-bold'>
					<ScrollText className='size-6' />
					{t('audit.title')}
				</h1>
				<p className='text-sm text-muted-foreground'>{t('audit.description')}</p>
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-end gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>
						{t('audit.filterAction')}
					</span>
					<Select
						value={search.action ?? 'all'}
						onValueChange={(value) =>
							void navigate({
								search: (prev) => ({
									...prev,
									page: 1,
									action: value === 'all' ? undefined : (value ?? undefined),
								}),
							})
						}
					>
						<SelectTrigger className='w-52'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{t('audit.allActions')}</SelectItem>
							{AUDIT_ACTIONS.map((action) => (
								<SelectItem key={action} value={action}>
									{action}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>
						{t('audit.filterTarget')}
					</span>
					<Select
						value={search.targetType ?? 'all'}
						onValueChange={(value) =>
							void navigate({
								search: (prev) => ({
									...prev,
									page: 1,
									targetType: value === 'all' ? undefined : (value ?? undefined),
								}),
							})
						}
					>
						<SelectTrigger className='w-44'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{t('audit.allTargets')}</SelectItem>
							{TARGET_TYPES.map((target) => (
								<SelectItem key={target} value={target}>
									{target}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>{t('audit.from')}</span>
					<DatePicker
						className='w-40'
						value={fromDraft}
						onChange={setFromDraft}
					/>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>{t('audit.to')}</span>
					<DatePicker
						className='w-40'
						value={toDraft}
						onChange={setToDraft}
					/>
				</div>
				<Button
					onClick={() =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								from: fromDraft || undefined,
								to: toDraft || undefined,
							}),
						})
					}
				>
					{t('users.apply')}
				</Button>
				<Button
					variant='ghost'
					onClick={() => {
						setFromDraft('');
						setToDraft('');
						void navigate({ search: {} });
					}}
				>
					{t('users.reset')}
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('audit.entries')}</CardTitle>
					<CardDescription>
						{pagination ? (
							t('audit.count', { count: pagination.total })
						) : isPending ? (
							<Skeleton className='h-4 w-24 motion-reduce:animate-none' />
						) : null}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isError && (
						<ErrorState error={error} size='sm' />
					)}
					{!isPending && !isError && rows.length === 0 && (
						<EmptyState title={t('audit.empty')} size='sm' />
					)}
					{(isPending || rows.length > 0) && (
						<DataTable
							columns={columns}
							data={rows}
							getRowId={(entry) => entry.id}
							loading={isPending}
						/>
					)}
					{isPending && <span className='sr-only'>{t('audit.loading')}</span>}

					{pagination && (
						<PaginationControls
							page={pagination.page}
							totalPages={pagination.totalPages}
							onPageChange={(page) =>
								void navigate({
									search: (prev) => ({ ...prev, page }),
								})
							}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

/** Truncates long ids for the table while keeping them recognizable. */
function shortId(id: string): string {
	return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}


import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
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
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import {
	ADMIN_PERMISSIONS,
	auditQueryOptions,
	type TAuditListParams,
} from '@/lib/admin-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission } from '@/lib/use-permission';

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

/** Number of placeholder rows shown while the first page loads. */
const SKELETON_ROW_COUNT = 5;

/** Per-column placeholder widths, matching the audit table's shape. */
const SKELETON_CELLS = [
	{ key: 'when', className: 'h-4 w-36' },
	{ key: 'action', className: 'h-5 w-28 rounded-full' },
	{ key: 'actor', className: 'h-4 w-40' },
	{ key: 'target', className: 'h-4 w-44' },
	{ key: 'metadata', className: 'h-4 w-full max-w-md' },
] as const;

type TAuditSearch = {
	page?: number;
	action?: string;
	targetType?: string;
	/** ISO date (`YYYY-MM-DD`) lower bound, converted to a full timestamp. */
	from?: string;
	to?: string;
};

export const Route = createFileRoute('/_authed/audit/')({
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

	if (!organizationId) {
		return (
			<div className='p-6 text-sm text-muted-foreground'>
				{t('audit.noOrganization')}
			</div>
		);
	}

	if (!canRead) {
		return (
			<div className='p-6 text-sm text-muted-foreground'>
				{t('audit.noPermission')}
			</div>
		);
	}

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='flex flex-col gap-6 p-6'>
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
					<Input
						type='date'
						className='w-40'
						value={fromDraft}
						onChange={(event) => setFromDraft(event.target.value)}
					/>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>{t('audit.to')}</span>
					<Input
						type='date'
						className='w-40'
						value={toDraft}
						onChange={(event) => setToDraft(event.target.value)}
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
						<p className='text-sm text-destructive'>{(error as Error).message}</p>
					)}
					{!isPending && !isError && rows.length === 0 && (
						<p className='text-sm text-muted-foreground'>{t('audit.empty')}</p>
					)}
					{(isPending || rows.length > 0) && (
						<Table aria-busy={isPending || undefined}>
							<TableHeader>
								<TableRow>
									<TableHead>{t('audit.when')}</TableHead>
									<TableHead>{t('audit.action')}</TableHead>
									<TableHead>{t('audit.actor')}</TableHead>
									<TableHead>{t('audit.target')}</TableHead>
									<TableHead>{t('audit.metadata')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isPending &&
									Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
										<TableRow key={index} aria-hidden='true'>
											{SKELETON_CELLS.map((cell) => (
												<TableCell key={cell.key}>
													<Skeleton
														className={`${cell.className} motion-reduce:animate-none`}
													/>
												</TableCell>
											))}
										</TableRow>
									))}
								{rows.map((entry) => (
									<TableRow key={entry.id}>
										<TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
											{new Date(entry.createdAt).toLocaleString()}
										</TableCell>
										<TableCell>
											<Badge variant='secondary'>{entry.action}</Badge>
										</TableCell>
										<TableCell className='text-xs'>
											{entry.actorEmail ?? entry.actorUserId}
										</TableCell>
										<TableCell className='text-xs'>
											<span className='text-muted-foreground'>
												{entry.targetType}
											</span>{' '}
											<span className='font-mono'>{shortId(entry.targetId)}</span>
										</TableCell>
										<TableCell className='max-w-md truncate text-xs text-muted-foreground'>
											{entry.meta ? JSON.stringify(entry.meta) : '—'}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
					{isPending && <span className='sr-only'>{t('audit.loading')}</span>}

					{pagination && pagination.totalPages > 1 && (
						<div className='mt-4 flex items-center justify-end gap-2'>
							<Button
								variant='outline'
								size='sm'
								disabled={(search.page ?? 1) <= 1}
								onClick={() =>
									void navigate({
										search: (prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }),
									})
								}
							>
								{t('common:action.previous')}
							</Button>
							<span className='text-xs text-muted-foreground'>
								{t('common:pagination.summary', {
									page: pagination.page,
									totalPages: pagination.totalPages,
								})}
							</span>
							<Button
								variant='outline'
								size='sm'
								disabled={pagination.page >= pagination.totalPages}
								onClick={() =>
									void navigate({
										search: (prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }),
									})
								}
							>
								{t('common:action.next')}
							</Button>
						</div>
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

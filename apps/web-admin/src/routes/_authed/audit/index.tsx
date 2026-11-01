import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';

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
				Select an organization to view its audit trail.
			</div>
		);
	}

	if (!canRead) {
		return (
			<div className='p-6 text-sm text-muted-foreground'>
				You do not have permission to read the audit log.
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
					Audit log
				</h1>
				<p className='text-sm text-muted-foreground'>
					Append-only trail of invitations, account lifecycle, role and member
					changes. Newest first.
				</p>
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-end gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>Action</span>
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
							<SelectItem value='all'>All actions</SelectItem>
							{AUDIT_ACTIONS.map((action) => (
								<SelectItem key={action} value={action}>
									{action}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>Target</span>
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
							<SelectItem value='all'>All targets</SelectItem>
							{TARGET_TYPES.map((target) => (
								<SelectItem key={target} value={target}>
									{target}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>From</span>
					<Input
						type='date'
						className='w-40'
						value={fromDraft}
						onChange={(event) => setFromDraft(event.target.value)}
					/>
				</div>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>To</span>
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
					Apply
				</Button>
				<Button
					variant='ghost'
					onClick={() => {
						setFromDraft('');
						setToDraft('');
						void navigate({ search: {} });
					}}
				>
					Reset
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Entries</CardTitle>
					<CardDescription>
						{pagination ? `${pagination.total} entr(ies)` : 'Loading…'}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPending && (
						<p className='text-sm text-muted-foreground'>Loading audit log…</p>
					)}
					{isError && (
						<p className='text-sm text-destructive'>{(error as Error).message}</p>
					)}
					{!isPending && !isError && rows.length === 0 && (
						<p className='text-sm text-muted-foreground'>
							No audit entries for these filters.
						</p>
					)}
					{rows.length > 0 && (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>When</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Actor</TableHead>
									<TableHead>Target</TableHead>
									<TableHead>Metadata</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
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
								Previous
							</Button>
							<span className='text-xs text-muted-foreground'>
								Page {pagination.page} of {pagination.totalPages}
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
								Next
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

import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import {
	borrowingDocumentsQueryOptions,
	borrowingRequestsQueryOptions,
	closeBorrowing,
	transitionBorrowing,
	type TBorrowingDocument,
	type TBorrowingRequest,
	type TBorrowingStatus,
} from '@/lib/borrowing-api';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { Ban, Check, CircleCheck, PackageCheck, X } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { ItemThumb } from '@/components/item-thumb';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { useClampPage } from '@/lib/use-clamp-page';

/** Rows per page: 24 keeps a full-height page without endless scrolling. */
const PAGE_SIZE = 24;

/** Which half of the lifecycle the list shows. */
export type TBorrowingListTab = 'requests' | 'issued';

/**
 * Badge emphasis per status.
 *
 * @remarks
 * `issued` and `partially_returned` are the states where stock is **out**, so
 * they get the loudest variant: a reader scanning the list should see at a
 * glance what the warehouse cannot use right now.
 */
const STATUS_VARIANT: Record<
	TBorrowingStatus,
	'default' | 'secondary' | 'outline' | 'destructive'
> = {
	draft: 'outline',
	requested: 'secondary',
	approved: 'secondary',
	rejected: 'outline',
	issued: 'default',
	partially_returned: 'default',
	returned: 'secondary',
	closed: 'outline',
	cancelled: 'outline',
};

/** The request transitions this list offers. Each is gated server-side independently. */
type TListAction = 'approve' | 'reject' | 'issue' | 'cancel';

/**
 * The borrowing list: requests on one tab, issued borrowings on the other.
 *
 * @remarks
 * A borrowing is a request (`/inventory/borrowing-requests`) until it is issued
 * and an issue document (`/inventory/borrowings`) afterwards, and the backend
 * lists the two separately, so the screen does too. Every row links to the
 * detail page by its **request id**.
 *
 * The inline buttons mirror the backend state machine; the machine stays
 * authoritative, so an illegal edge is refused server-side no matter what this
 * table renders. They are only offered on `requested` rows: a request keeps the
 * `approved` status after it is issued and the list cannot tell the two apart,
 * so approved rows are acted on from the detail page, which knows whether a
 * borrowing exists. `issue` is offered from `requested` because approval is
 * skippable for a caller holding `asset_borrowing:issue` — the backend decides
 * whether *this* caller may skip it.
 */
export function BorrowingList({
	page,
	tab,
	onPageChange,
	onTabChange,
}: {
	/** Current page, owned by the route's `page` search param. */
	page: number;
	/** Current tab, owned by the route's `tab` search param. */
	tab: TBorrowingListTab;
	onPageChange: (page: number) => void;
	onTabChange: (tab: TBorrowingListTab) => void;
}) {
	const { t } = useTranslation(['assets', 'common']);
	const queryClient = useQueryClient();
	const requests = useQuery({
		...borrowingRequestsQueryOptions({ page, limit: PAGE_SIZE }),
		enabled: tab === 'requests',
		// Keeps the current page visible while the next one loads.
		placeholderData: (previous) => previous,
	});
	const issued = useQuery({
		...borrowingDocumentsQueryOptions({ page, limit: PAGE_SIZE }),
		enabled: tab === 'issued',
		placeholderData: (previous) => previous,
	});
	const active = tab === 'requests' ? requests : issued;

	const transition = useMutation({
		mutationFn: ({ id, action }: { id: string; action: TListAction }) =>
			transitionBorrowing(id, action),
		onSuccess: (_data, { action }) => {
			// Each key is spelled out rather than looked up: the compiler and the
			// dead-key scan then see exactly which translations are used.
			switch (action) {
				case 'approve':
					toast.success(t('assets:borrowingActions.approved'));
					break;
				case 'reject':
					toast.success(t('assets:borrowingActions.rejected'));
					break;
				case 'issue':
					toast.success(t('assets:borrowingActions.issued'));
					break;
				case 'cancel':
					toast.success(t('assets:borrowingActions.cancelled'));
					break;
			}
			void queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError) => {
			toast.error(mutationError.message);
		},
	});

	const close = useMutation({
		mutationFn: (borrowingId: string) => closeBorrowing(borrowingId),
		onSuccess: () => {
			toast.success(t('assets:borrowingActions.closed'));
			void queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError) => {
			toast.error(mutationError.message);
		},
	});

	// A shrinking result set must not leave the list on a page that no longer
	// exists.
	const pagination = active.data?.pagination;
	useClampPage(page, pagination?.totalPages, onPageChange);
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);

	const header = (
		<CardHeader>
			<CardTitle>{t('assets:borrowings.title')}</CardTitle>
			<CardDescription>{t('assets:borrowings.description')}</CardDescription>
			<CardAction>
				<Button size='sm' render={<Link to='/assets/borrowings/new' />}>
					{t('assets:borrowings.new')}
				</Button>
			</CardAction>
		</CardHeader>
	);

	const tabs = (
		<div className='flex gap-2'>
			<Button
				size='sm'
				variant={tab === 'requests' ? 'default' : 'outline'}
				onClick={() => onTabChange('requests')}
			>
				{t('assets:borrowings.tabRequests')}
			</Button>
			<Button
				size='sm'
				variant={tab === 'issued' ? 'default' : 'outline'}
				onClick={() => onTabChange('issued')}
			>
				{t('assets:borrowings.tabIssued')}
			</Button>
		</div>
	);

	if (active.isPending) {
		return (
			<Card>
				<CardContent className='space-y-4'>
					{tabs}
					<SectionSkeleton lines={5} />
				</CardContent>
			</Card>
		);
	}

	if (active.isError) {
		return (
			<Card>
				<CardContent className='space-y-4'>
					{tabs}
					<ErrorState error={active.error} size='sm' />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			{header}
			<CardContent className='space-y-4'>
				{tabs}

				{tab === 'requests' ? (
					<RequestTable
						rows={requests.data?.rows ?? []}
						pendingId={
							transition.isPending ? transition.variables?.id : undefined
						}
						onAction={(id, action) => transition.mutate({ id, action })}
					/>
				) : (
					<IssuedTable
						rows={issued.data?.rows ?? []}
						pendingId={close.isPending ? close.variables : undefined}
						onClose={(id) => close.mutate(id)}
					/>
				)}

				<PaginationControls
					page={effectivePage}
					totalPages={pagination?.totalPages ?? 1}
					onPageChange={onPageChange}
				/>
			</CardContent>
		</Card>
	);
}

/** The request half: raised, approved, rejected or cancelled documents. */
function RequestTable({
	rows,
	pendingId,
	onAction,
}: {
	rows: TBorrowingRequest[];
	pendingId: string | undefined;
	onAction: (id: string, action: TListAction) => void;
}) {
	const { t } = useTranslation(['assets', 'common']);

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TBorrowingRequest, CellData>[]
	>(
		() => [
			{
				id: 'code',
				header: t('assets:borrowings.code'),
				cell: ({ row }) => (
					<div className='flex items-center gap-2'>
						<ItemThumb src={row.original.imageUrl} name={row.original.code} />
						<Link
							to='/assets/borrowings/$borrowingId'
							params={{ borrowingId: row.original.id }}
							className='font-mono text-xs underline-offset-4 hover:underline'
						>
							{row.original.code}
						</Link>
					</div>
				),
			},
			{
				id: 'borrower',
				header: t('assets:borrowings.borrower'),
				// A guest's name survives redaction (only the identity fields are
				// withheld); the fallback covers a retention sweep that nulled it.
				cell: ({ row }) =>
					row.original.borrowerType === 'guest'
						? (row.original.guestName ?? t('assets:borrowings.guest'))
						: row.original.borrowerType === 'user'
							? (row.original.borrowerUserId ?? '—')
							: (row.original.borrowerCustomerId ?? '—'),
			},
			{
				id: 'purpose',
				header: t('assets:borrowings.purpose'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) =>
					t(
						`assets:borrowingPurpose.${row.original.purpose}` as 'assets:borrowingPurpose.rental',
					),
			},
			{
				id: 'dueAt',
				header: t('assets:borrowings.dueAt'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) => new Date(row.original.dueAt).toLocaleDateString(),
			},
			{
				id: 'status',
				header: t('assets:borrowings.status'),
				cell: ({ row }) => (
					<Badge variant={STATUS_VARIANT[row.original.status]}>
						{t(
							`assets:borrowingStatus.${row.original.status}` as 'assets:borrowingStatus.requested',
						)}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('assets:borrowings.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const id = row.original.id;
					const hidden = row.original.status !== 'requested';
					return (
						<RowActions
							label={t('assets:borrowings.actions')}
							disabled={pendingId === id}
							actions={[
								{
									key: 'approve',
									label: t('assets:borrowingActions.approve'),
									icon: Check,
									hidden,
									onSelect: () => onAction(id, 'approve'),
								},
								{
									key: 'issue',
									label: t('assets:borrowingActions.issue'),
									icon: PackageCheck,
									hidden,
									onSelect: () => onAction(id, 'issue'),
								},
								{
									key: 'reject',
									label: t('assets:borrowingActions.reject'),
									icon: X,
									destructive: true,
									hidden,
									onSelect: () => onAction(id, 'reject'),
								},
								{
									key: 'cancel',
									label: t('assets:borrowingActions.cancel'),
									icon: Ban,
									destructive: true,
									hidden,
									onSelect: () => onAction(id, 'cancel'),
								},
							]}
						/>
					);
				},
			},
		],
		[onAction, pendingId, t],
	);

	if (rows.length === 0) {
		return <EmptyState size='sm' title={t('assets:borrowings.empty')} />;
	}

	return <DataTable columns={columns} data={rows} getRowId={(row) => row.id} sortable />;
}

/** The issued half: issue documents, linked to their request's detail page. */
function IssuedTable({
	rows,
	pendingId,
	onClose,
}: {
	rows: TBorrowingDocument[];
	pendingId: string | undefined;
	onClose: (borrowingId: string) => void;
}) {
	const { t } = useTranslation(['assets', 'common']);

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TBorrowingDocument, CellData>[]
	>(
		() => [
			{
				id: 'code',
				header: t('assets:borrowings.code'),
				cell: ({ row }) => (
					<Link
						to='/assets/borrowings/$borrowingId'
						params={{ borrowingId: row.original.borrowingRequestId }}
						className='font-mono text-xs underline-offset-4 hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				id: 'issuedAt',
				header: t('assets:borrowings.issuedAt'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) =>
					row.original.issuedAt
						? new Date(row.original.issuedAt).toLocaleDateString()
						: '—',
			},
			{
				id: 'dueAt',
				header: t('assets:borrowings.dueAt'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) => new Date(row.original.dueAt).toLocaleDateString(),
			},
			{
				id: 'status',
				header: t('assets:borrowings.status'),
				cell: ({ row }) => (
					<Badge variant={STATUS_VARIANT[row.original.status]}>
						{t(
							`assets:borrowingStatus.${row.original.status}` as 'assets:borrowingStatus.issued',
						)}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('assets:borrowings.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('assets:borrowings.actions')}
						disabled={pendingId === row.original.id}
						actions={[
							{
								key: 'close',
								label: t('assets:borrowingActions.close'),
								icon: CircleCheck,
								hidden: row.original.status !== 'returned',
								onSelect: () => onClose(row.original.id),
							},
						]}
					/>
				),
			},
		],
		[onClose, pendingId, t],
	);

	if (rows.length === 0) {
		return <EmptyState size='sm' title={t('assets:borrowings.emptyIssued')} />;
	}

	return <DataTable columns={columns} data={rows} getRowId={(row) => row.id} sortable />;
}


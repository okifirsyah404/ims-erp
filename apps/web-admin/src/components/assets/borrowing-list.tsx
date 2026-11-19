import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import {
	borrowingDocumentsQueryOptions,
	borrowingRequestsQueryOptions,
	closeBorrowing,
	transitionBorrowing,
	type TBorrowingDocument,
	type TBorrowingRequest,
	type TBorrowingStatus,
} from '@/lib/borrowing-api';
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
		<div className='flex flex-wrap items-start justify-between gap-3'>
			<div>
				<h2 className='text-lg font-semibold'>
					{t('assets:borrowings.title')}
				</h2>
				<p className='max-w-prose text-sm text-muted-foreground'>
					{t('assets:borrowings.description')}
				</p>
			</div>
			<Button size='sm' render={<Link to='/assets/borrowings/new' />}>
				{t('assets:borrowings.new')}
			</Button>
		</div>
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
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('common:state.loading')}
				</CardContent>
			</Card>
		);
	}

	if (active.isError) {
		return (
			<Card>
				<CardContent className='space-y-4 pt-6'>
					{tabs}
					<p className='py-4 text-center text-sm text-destructive'>
						{active.error.message}
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent className='space-y-4 pt-6'>
				{header}
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

	if (rows.length === 0) {
		return (
			<p className='py-6 text-center text-sm text-muted-foreground'>
				{t('assets:borrowings.empty')}
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t('assets:borrowings.code')}</TableHead>
					<TableHead>{t('assets:borrowings.borrower')}</TableHead>
					<TableHead>{t('assets:borrowings.purpose')}</TableHead>
					<TableHead>{t('assets:borrowings.dueAt')}</TableHead>
					<TableHead>{t('assets:borrowings.status')}</TableHead>
					<TableHead className='text-right'>
						{t('assets:borrowings.actions')}
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<RequestRow
						key={row.id}
						row={row}
						pending={pendingId === row.id}
						onAction={(action) => onAction(row.id, action)}
					/>
				))}
			</TableBody>
		</Table>
	);
}

/** One request row plus the actions its status allows. */
function RequestRow({
	row,
	pending,
	onAction,
}: {
	row: TBorrowingRequest;
	pending: boolean;
	onAction: (action: TListAction) => void;
}) {
	const { t } = useTranslation(['assets', 'common']);

	/**
	 * The borrower label.
	 *
	 * @remarks
	 * A guest's name survives redaction (only the identity fields are withheld),
	 * so it is safe to render; the fallback covers the case where the retention
	 * sweep has already nulled it.
	 */
	const borrower =
		row.borrowerType === 'guest'
			? (row.guestName ?? t('assets:borrowings.guest'))
			: row.borrowerType === 'user'
				? (row.borrowerUserId ?? '—')
				: (row.borrowerCustomerId ?? '—');

	return (
		<TableRow>
			<TableCell>
				<div className='flex items-center gap-2'>
					<ItemThumb src={row.imageUrl} name={row.code} />
					<Link
						to='/assets/borrowings/$borrowingId'
						params={{ borrowingId: row.id }}
						className='font-mono text-xs underline-offset-4 hover:underline'
					>
						{row.code}
					</Link>
				</div>
			</TableCell>
			<TableCell>{borrower}</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{t(
					`assets:borrowingPurpose.${row.purpose}` as 'assets:borrowingPurpose.rental',
				)}
			</TableCell>
			<TableCell className='text-xs'>
				{new Date(row.dueAt).toLocaleDateString()}
			</TableCell>
			<TableCell>
				<Badge variant={STATUS_VARIANT[row.status]}>
					{t(
						`assets:borrowingStatus.${row.status}` as 'assets:borrowingStatus.requested',
					)}
				</Badge>
			</TableCell>
			<TableCell className='text-right'>
				{row.status === 'requested' ? (
					<>
						<Button
							size='sm'
							disabled={pending}
							onClick={() => onAction('approve')}
						>
							{t('assets:borrowingActions.approve')}
						</Button>
						<Button
							size='sm'
							variant='secondary'
							disabled={pending}
							onClick={() => onAction('issue')}
						>
							{t('assets:borrowingActions.issue')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('reject')}
						>
							{t('assets:borrowingActions.reject')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('cancel')}
						>
							{t('assets:borrowingActions.cancel')}
						</Button>
					</>
				) : null}
			</TableCell>
		</TableRow>
	);
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

	if (rows.length === 0) {
		return (
			<p className='py-6 text-center text-sm text-muted-foreground'>
				{t('assets:borrowings.emptyIssued')}
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t('assets:borrowings.code')}</TableHead>
					<TableHead>{t('assets:borrowings.issuedAt')}</TableHead>
					<TableHead>{t('assets:borrowings.dueAt')}</TableHead>
					<TableHead>{t('assets:borrowings.status')}</TableHead>
					<TableHead className='text-right'>
						{t('assets:borrowings.actions')}
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.id}>
						<TableCell>
							<Link
								to='/assets/borrowings/$borrowingId'
								params={{ borrowingId: row.borrowingRequestId }}
								className='font-mono text-xs underline-offset-4 hover:underline'
							>
								{row.code}
							</Link>
						</TableCell>
						<TableCell className='text-xs'>
							{row.issuedAt ? new Date(row.issuedAt).toLocaleDateString() : '—'}
						</TableCell>
						<TableCell className='text-xs'>
							{new Date(row.dueAt).toLocaleDateString()}
						</TableCell>
						<TableCell>
							<Badge variant={STATUS_VARIANT[row.status]}>
								{t(
									`assets:borrowingStatus.${row.status}` as 'assets:borrowingStatus.issued',
								)}
							</Badge>
						</TableCell>
						<TableCell className='text-right'>
							{row.status === 'returned' ? (
								<Button
									size='sm'
									disabled={pendingId === row.id}
									onClick={() => onClose(row.id)}
								>
									{t('assets:borrowingActions.close')}
								</Button>
							) : null}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

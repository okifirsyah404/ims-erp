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
	borrowingsQueryOptions,
	transitionBorrowing,
	type TBorrowing,
	type TBorrowingStatus,
} from '@/lib/borrowing-api';
import { ItemThumb } from '@/components/item-thumb';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { useClampPage } from '@/lib/use-clamp-page';

/** Rows per page: 24 keeps a full-height page without endless scrolling. */
const PAGE_SIZE = 24;

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

/** The transitions this list offers. Each is gated server-side independently. */
type TListAction = 'approve' | 'reject' | 'issue' | 'cancel' | 'close';

/**
 * The borrowing list, with the workflow actions available per status.
 *
 * @remarks
 * The buttons mirror the backend state machine; the machine stays authoritative,
 * so an illegal edge is refused server-side no matter what this table renders.
 * Rendering only legal actions keeps the common path from producing a
 * predictable 422.
 *
 * `issue` is offered from `requested` as well as `approved` because approval is
 * skippable for a caller holding `asset_borrowing:issue` — the backend decides whether
 * *this* caller may skip it, and a caller who may not gets a 422 with an
 * explanation rather than a hidden button.
 */
export function BorrowingList({
	page,
	onPageChange,
}: {
	/** Current page, owned by the route's `page` search param. */
	page: number;
	onPageChange: (page: number) => void;
}) {
	const { t } = useTranslation(['assets', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery({
		...borrowingsQueryOptions({ page, limit: PAGE_SIZE }),
		// Keeps the current page visible while the next one loads.
		placeholderData: (previous) => previous,
	});

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
				case 'close':
					toast.success(t('assets:borrowingActions.closed'));
					break;
			}
			void queryClient.invalidateQueries({ queryKey: ['assets'] });
		},
		onError: (mutationError) => {
			toast.error(mutationError.message);
		},
	});

	// A shrinking result set must not leave the list on a page that no longer
	// exists.
	const pagination = data?.pagination;
	useClampPage(page, pagination?.totalPages, onPageChange);
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);

	if (isPending) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('common:state.loading')}
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-destructive'>
					{error.message}
				</CardContent>
			</Card>
		);
	}

	const rows = data?.rows ?? [];

	return (
		<Card>
			<CardContent className='space-y-4 pt-6'>
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

				{rows.length === 0 ? (
					<p className='py-6 text-center text-sm text-muted-foreground'>
						{t('assets:borrowings.empty')}
					</p>
				) : (
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
								<BorrowingRow
									key={row.id}
									row={row}
									pending={
										transition.isPending &&
										transition.variables?.id === row.id
									}
									onAction={(action) =>
										transition.mutate({ id: row.id, action })
									}
								/>
							))}
						</TableBody>
					</Table>
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

/** One list row plus the actions its current status allows. */
function BorrowingRow({
	row,
	pending,
	onAction,
}: {
	row: TBorrowing;
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
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('reject')}
						>
							{t('assets:borrowingActions.reject')}
						</Button>
					</>
				) : null}
				{row.status === 'approved' || row.status === 'requested' ? (
					<Button
						size='sm'
						variant={row.status === 'approved' ? 'default' : 'secondary'}
						disabled={pending}
						onClick={() => onAction('issue')}
					>
						{t('assets:borrowingActions.issue')}
					</Button>
				) : null}
				{row.status === 'requested' || row.status === 'approved' ? (
					<Button
						size='sm'
						variant='ghost'
						disabled={pending}
						onClick={() => onAction('cancel')}
					>
						{t('assets:borrowingActions.cancel')}
					</Button>
				) : null}
				{row.status === 'returned' ? (
					<Button
						size='sm'
						disabled={pending}
						onClick={() => onAction('close')}
					>
						{t('assets:borrowingActions.close')}
					</Button>
				) : null}
			</TableCell>
		</TableRow>
	);
}

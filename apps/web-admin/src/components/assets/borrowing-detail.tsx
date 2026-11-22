import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import {
	borrowingQueryOptions,
	borrowingStatusOf,
	closeBorrowing,
	extendBorrowing,
	extendBorrowingRequest,
	markBorrowingItemLost,
	returnBorrowing,
	transitionBorrowing,
	type TBorrowingAction,
	type TBorrowingItem,
	type TBorrowingStatus,
} from '@/lib/borrowing-api';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { CircleAlert, Undo2 } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';

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

/**
 * One borrowing with its units, its timeline, and the actions its status allows.
 *
 * @remarks
 * The page is keyed by the **request id**; once the request is issued the view
 * carries the issue document as `borrowing`, and the actions that belong to it
 * (return, extend, mark lost, close) address `borrowing.id`.
 *
 * **The timeline is the point of this page.** Every `issued`, `returned`, and
 * `marked_lost` entry shows the `movementId` it wrote, because that link is
 * what distinguishes a real custody change from a claimed one — the backend's
 * CHECK constraint makes the link mandatory, so a rendered entry without a
 * movement id is either an automated `marked_late`, a request-half event, or a
 * bug.
 *
 * **Redaction is rendered, not assumed.** When the server withholds the guest
 * identity fields it says so with `guestIdentityRedacted`, and the page shows a
 * marker explaining why rather than a blank row that looks like missing data.
 */
export function BorrowingDetail({ borrowingId }: { borrowingId: string }) {
	const { t } = useTranslation(['assets', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(
		borrowingQueryOptions(borrowingId),
	);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['assets'] });
	};

	const transition = useMutation({
		mutationFn: (action: TBorrowingAction) =>
			transitionBorrowing(borrowingId, action),
		onSuccess: (_data, action) => {
			// Each key is spelled out rather than looked up, so the compiler and
			// the dead-key scan see exactly which translations are used.
			if (action === 'submit') {
				toast.success(t('assets:borrowingActions.submitted'));
			}
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	const close = useMutation({
		mutationFn: (issuedBorrowingId: string) =>
			closeBorrowing(issuedBorrowingId),
		onSuccess: () => {
			toast.success(t('assets:borrowingActions.closed'));
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	const extend = useMutation({
		mutationFn: ({
			issuedBorrowingId,
			dueAt,
		}: {
			/** `null` extends the not-yet-issued request instead. */
			issuedBorrowingId: string | null;
			dueAt: string;
		}) =>
			issuedBorrowingId
				? extendBorrowing(issuedBorrowingId, dueAt)
				: extendBorrowingRequest(borrowingId, dueAt),
		onSuccess: () => {
			toast.success(t('assets:borrowingActions.extended'));
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	const returnItems = useMutation({
		mutationFn: ({
			issuedBorrowingId,
			borrowingItemId,
		}: {
			issuedBorrowingId: string;
			borrowingItemId?: string;
		}) =>
			returnBorrowing(issuedBorrowingId, {
				...(borrowingItemId ? { borrowingItemId } : {}),
				condition: 'good',
			}),
		onSuccess: () => {
			toast.success(t('assets:borrowingActions.returned'));
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	const markLost = useMutation({
		mutationFn: ({
			issuedBorrowingId,
			borrowingItemId,
		}: {
			issuedBorrowingId: string;
			borrowingItemId: string;
		}) => markBorrowingItemLost(issuedBorrowingId, { borrowingItemId }),
		onSuccess: () => {
			toast.success(t('assets:borrowingActions.lost'));
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	if (isPending) {
		return <PageSkeleton />;
	}

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	if (!data) {
		return <EmptyState title={t('assets:borrowings.notFound')} bordered />;
	}

	const { borrowing, items, events } = data;
	const status = borrowingStatusOf(data);
	const dueAt = borrowing?.dueAt ?? data.dueAt;
	const openItems = items.filter(
		(item) =>
			item.issuedAt !== null &&
			item.returnedAt === null &&
			item.markedLostAt === null,
	);
	const busy =
		transition.isPending ||
		close.isPending ||
		returnItems.isPending ||
		markLost.isPending ||
		extend.isPending;

	/**
	 * Prompts for a new due date and requests the extension.
	 *
	 * @remarks
	 * A `prompt` rather than a date input keeps the detail page's action bar
	 * uniform: extension is a rare action and does not deserve permanent form
	 * furniture. The value is converted to ISO at the boundary, and a cancelled
	 * prompt sends nothing.
	 */
	function promptExtend() {
		const input = window.prompt(t('assets:borrowingForm.dueAt'));
		if (!input) return;
		const parsed = new Date(input);
		if (Number.isNaN(parsed.getTime())) return;
		extend.mutate({
			issuedBorrowingId: borrowing?.id ?? null,
			dueAt: parsed.toISOString(),
		});
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<div className='flex items-center gap-2'>
						<h2 className='font-mono text-lg font-semibold'>
							{borrowing?.code ?? data.code}
						</h2>
						<Badge variant={STATUS_VARIANT[status]}>
							{t(
								`assets:borrowingStatus.${status}` as 'assets:borrowingStatus.requested',
							)}
						</Badge>
					</div>
					<p className='text-sm text-muted-foreground'>
						{t('assets:borrowings.dueAt')}:{' '}
						{new Date(dueAt).toLocaleDateString()}
					</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{status === 'draft' ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() => transition.mutate('submit')}
						>
							{t('assets:borrowingActions.submit')}
						</Button>
					) : null}
					{status === 'requested' ? (
						<>
							<Button
								size='sm'
								disabled={busy}
								onClick={() => transition.mutate('approve')}
							>
								{t('assets:borrowingActions.approve')}
							</Button>
							<Button
								size='sm'
								variant='ghost'
								disabled={busy}
								onClick={() => transition.mutate('reject')}
							>
								{t('assets:borrowingActions.reject')}
							</Button>
						</>
					) : null}
					{status === 'requested' || status === 'approved' ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() => transition.mutate('issue')}
						>
							{t('assets:borrowingActions.issue')}
						</Button>
					) : null}
					{borrowing && openItems.length > 1 ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() =>
								returnItems.mutate({ issuedBorrowingId: borrowing.id })
							}
						>
							{t('assets:borrowingActions.returnAll')}
						</Button>
					) : null}
					{status === 'issued' ||
					status === 'partially_returned' ||
					status === 'approved' ? (
						<Button
							size='sm'
							variant='secondary'
							disabled={busy}
							onClick={promptExtend}
						>
							{t('assets:borrowingActions.extend')}
						</Button>
					) : null}
					{borrowing && status === 'returned' ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() => close.mutate(borrowing.id)}
						>
							{t('assets:borrowingActions.close')}
						</Button>
					) : null}
					{status === 'requested' || status === 'approved' ? (
						<Button
							size='sm'
							variant='ghost'
							disabled={busy}
							onClick={() => transition.mutate('cancel')}
						>
							{t('assets:borrowingActions.cancel')}
						</Button>
					) : null}
				</div>
			</div>

			<BorrowerCard borrowing={data} />

			<Card>
				<CardHeader>
					<CardTitle>
						{t('assets:borrowings.lines')}
					</CardTitle>
					<p className='text-sm text-muted-foreground'>
						{t('assets:borrowings.linesDescription')}
					</p>
				</CardHeader>
				<CardContent>
					<ItemsTable
						items={items}
						busy={busy}
						canAct={borrowing !== null}
						onReturn={(item) =>
							borrowing &&
							returnItems.mutate({
								issuedBorrowingId: borrowing.id,
								borrowingItemId: item.id,
							})
						}
						onMarkLost={(item) =>
							borrowing &&
							markLost.mutate({
								issuedBorrowingId: borrowing.id,
								borrowingItemId: item.id,
							})
						}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>
						{t('assets:borrowings.timeline')}
					</CardTitle>
					<p className='text-sm text-muted-foreground'>
						{t('assets:borrowings.timelineDescription')}
					</p>
				</CardHeader>
				<CardContent>
					{events.length === 0 ? (
						<p className='text-sm text-muted-foreground'>
							{t('assets:borrowings.noEvents')}
						</p>
					) : (
						<ol className='space-y-3'>
							{events.map((event) => (
								<li key={event.id} className='flex flex-wrap items-baseline gap-2'>
									<span className='text-xs text-muted-foreground'>
										{new Date(event.occurredAt).toLocaleString()}
									</span>
									<Badge variant={event.movementId ? 'default' : 'outline'}>
										{t(
											`assets:borrowingEvent.${event.eventType}` as 'assets:borrowingEvent.issued',
										)}
									</Badge>
									{event.movementId ? (
										<span className='font-mono text-xs text-muted-foreground'>
											{t('assets:borrowings.movement')}: {event.movementId}
										</span>
									) : null}
									{event.actorUserId === null ? (
										<Badge variant='secondary'>
											{t('assets:borrowings.auto')}
										</Badge>
									) : null}
									{event.note ? (
										<span className='text-xs text-muted-foreground'>
											{event.note}
										</span>
									) : null}
								</li>
							))}
						</ol>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

/** The borrower block, including the guest redaction marker when present. */
function BorrowerCard({
	borrowing,
}: {
	borrowing: {
		borrowerType: string;
		borrowerUserId: string | null;
		borrowerCustomerId: string | null;
		guestName: string | null;
		guestPhone: string | null;
		guestIdType: string | null;
		guestIdNumber: string | null;
		guestAddressText: string | null;
		guestIdDocumentRef: string | null;
		guestIdentityRedacted?: boolean;
	};
}) {
	const { t } = useTranslation(['assets', 'common']);

	// The detail projection attaches the flag; the list projection does not.
	const redacted = borrowing.guestIdentityRedacted === true;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{t('assets:borrowings.borrower')}
				</CardTitle>
			</CardHeader>
			<CardContent className='space-y-1 text-sm'>
				{borrowing.borrowerType === 'guest' ? (
					<>
						<p className='font-medium'>
							{borrowing.guestName ?? t('assets:borrowings.guest')}
						</p>
						{borrowing.guestPhone ? <p>{borrowing.guestPhone}</p> : null}
						{redacted ? (
							<div className='rounded-md border border-dashed p-2 text-xs text-muted-foreground'>
								<p className='font-medium'>
									{t('assets:borrowings.redacted')}
								</p>
								<p>{t('assets:borrowings.redactedHint')}</p>
							</div>
						) : (
							<>
								{borrowing.guestIdType && borrowing.guestIdNumber ? (
									<p className='font-mono text-xs'>
										{borrowing.guestIdType.toUpperCase()} {borrowing.guestIdNumber}
									</p>
								) : null}
								{borrowing.guestAddressText ? (
									<p className='text-xs text-muted-foreground'>
										{borrowing.guestAddressText}
									</p>
								) : null}
								{borrowing.guestIdDocumentRef ? (
									<p className='text-xs text-muted-foreground'>
										{borrowing.guestIdDocumentRef}
									</p>
								) : null}
							</>
						)}
					</>
				) : (
					<p className='font-mono text-xs'>
						{borrowing.borrowerType === 'user'
							? borrowing.borrowerUserId
							: borrowing.borrowerCustomerId}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

/** The borrowed units plus the per-item actions each one allows. */
function ItemsTable({
	items,
	busy,
	canAct,
	onReturn,
	onMarkLost,
}: {
	items: TBorrowingItem[];
	busy: boolean;
	/** `false` before issue: there is no borrowing to return against. */
	canAct: boolean;
	onReturn: (item: TBorrowingItem) => void;
	onMarkLost: (item: TBorrowingItem) => void;
}) {
	const { t } = useTranslation(['assets', 'common']);

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TBorrowingItem, CellData>[]
	>(
		() => [
			{
				id: 'serial',
				header: t('assets:borrowings.serial'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (
					<>
						{row.original.itemId}
						{row.original.markedLateAt ? (
							<Badge variant='destructive' className='ml-2'>
								{t('assets:borrowings.late')}
							</Badge>
						) : null}
						{row.original.markedLostAt ? (
							<Badge variant='destructive' className='ml-2'>
								{t('assets:borrowings.lost')}
							</Badge>
						) : null}
					</>
				),
			},
			{
				id: 'origin',
				header: t('assets:borrowings.origin'),
				meta: { cellClassName: 'font-mono text-xs text-muted-foreground' },
				cell: ({ row }) => row.original.originWarehouseId ?? '—',
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
				id: 'returnedAt',
				header: t('assets:borrowings.returnedAt'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) =>
					row.original.returnedAt
						? new Date(row.original.returnedAt).toLocaleDateString()
						: '—',
			},
			{
				id: 'condition',
				header: t('assets:borrowings.condition'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) =>
					row.original.returnedCondition
						? t(
								`assets:borrowingCondition.${row.original.returnedCondition}` as 'assets:borrowingCondition.good',
							)
						: '—',
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('assets:borrowings.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const item = row.original;
					// An item is "open" only once issued and while neither returned nor lost.
					const open =
						item.issuedAt !== null &&
						item.returnedAt === null &&
						item.markedLostAt === null;
					return (
						<RowActions
							label={t('assets:borrowings.actions')}
							disabled={busy}
							actions={[
								{
									key: 'return',
									label: t('assets:borrowingActions.return'),
									icon: Undo2,
									hidden: !(open && canAct),
									onSelect: () => onReturn(item),
								},
								{
									key: 'lost',
									label: t('assets:borrowingActions.markLost'),
									icon: CircleAlert,
									destructive: true,
									hidden: !(open && canAct),
									onSelect: () => onMarkLost(item),
								},
							]}
						/>
					);
				},
			},
		],
		[busy, canAct, onMarkLost, onReturn, t],
	);

	return <DataTable columns={columns} data={items} getRowId={(row) => row.id} />;
}

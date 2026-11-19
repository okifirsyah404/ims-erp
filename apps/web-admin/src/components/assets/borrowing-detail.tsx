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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
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

	if (!data) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('assets:borrowings.notFound')}
				</CardContent>
			</Card>
		);
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
					<CardTitle className='text-base'>
						{t('assets:borrowings.lines')}
					</CardTitle>
					<p className='text-sm text-muted-foreground'>
						{t('assets:borrowings.linesDescription')}
					</p>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('assets:borrowings.serial')}</TableHead>
								<TableHead>{t('assets:borrowings.origin')}</TableHead>
								<TableHead>{t('assets:borrowings.issuedAt')}</TableHead>
								<TableHead>{t('assets:borrowings.returnedAt')}</TableHead>
								<TableHead>{t('assets:borrowings.condition')}</TableHead>
								<TableHead className='text-right'>
									{t('assets:borrowings.actions')}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => (
								<ItemRow
									key={item.id}
									item={item}
									busy={busy}
									canAct={borrowing !== null}
									onReturn={() =>
										borrowing &&
										returnItems.mutate({
											issuedBorrowingId: borrowing.id,
											borrowingItemId: item.id,
										})
									}
									onMarkLost={() =>
										borrowing &&
										markLost.mutate({
											issuedBorrowingId: borrowing.id,
											borrowingItemId: item.id,
										})
									}
								/>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>
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
				<CardTitle className='text-base'>
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

/** One borrowed unit plus the per-item actions it allows. */
function ItemRow({
	item,
	busy,
	canAct,
	onReturn,
	onMarkLost,
}: {
	item: TBorrowingItem;
	busy: boolean;
	/** `false` before issue: there is no borrowing to return against. */
	canAct: boolean;
	onReturn: () => void;
	onMarkLost: () => void;
}) {
	const { t } = useTranslation(['assets', 'common']);

	// An item is "open" only once issued and while neither returned nor lost.
	const open =
		item.issuedAt !== null &&
		item.returnedAt === null &&
		item.markedLostAt === null;

	return (
		<TableRow>
			<TableCell className='font-mono text-xs'>
				{item.itemId}
				{item.markedLateAt ? (
					<Badge variant='destructive' className='ml-2'>
						{t('assets:borrowings.late')}
					</Badge>
				) : null}
				{item.markedLostAt ? (
					<Badge variant='destructive' className='ml-2'>
						{t('assets:borrowings.lost')}
					</Badge>
				) : null}
			</TableCell>
			<TableCell className='font-mono text-xs text-muted-foreground'>
				{item.originWarehouseId ?? '—'}
			</TableCell>
			<TableCell className='text-xs'>
				{item.issuedAt ? new Date(item.issuedAt).toLocaleDateString() : '—'}
			</TableCell>
			<TableCell className='text-xs'>
				{item.returnedAt ? new Date(item.returnedAt).toLocaleDateString() : '—'}
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{item.returnedCondition
					? t(
							`assets:borrowingCondition.${item.returnedCondition}` as 'assets:borrowingCondition.good',
						)
					: '—'}
			</TableCell>
			<TableCell className='text-right'>
				{open && canAct ? (
					<>
						<Button size='sm' disabled={busy} onClick={onReturn}>
							{t('assets:borrowingActions.return')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={busy}
							onClick={onMarkLost}
						>
							{t('assets:borrowingActions.markLost')}
						</Button>
					</>
				) : null}
			</TableCell>
		</TableRow>
	);
}

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
	extendBorrowing,
	markBorrowingLineLost,
	returnBorrowing,
	transitionBorrowing,
	type TBorrowingLine,
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
 * **The timeline is the point of this page.** Every `issued`, `returned`, and
 * `marked_lost` entry shows the `stockMovementId` it wrote, because that link is
 * what distinguishes a real custody change from a claimed one — the backend's
 * CHECK constraint makes the link mandatory, so a rendered entry without a
 * movement id is either an automated `marked_late` or a bug.
 *
 * **Redaction is rendered, not assumed.** When the server withholds the guest
 * identity fields it says so with `guestIdentityRedacted`, and the page shows a
 * marker explaining why rather than a blank row that looks like missing data.
 */
export function BorrowingDetail({ borrowingId }: { borrowingId: string }) {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(
		borrowingQueryOptions(borrowingId),
	);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['inventory'] });
	};

	const transition = useMutation({
		mutationFn: (
			action: 'submit' | 'approve' | 'reject' | 'issue' | 'cancel' | 'close',
		) => transitionBorrowing(borrowingId, action),
		onSuccess: (_data, action) => {
			// Each key is spelled out rather than looked up, so the compiler and
			// the dead-key scan see exactly which translations are used.
			if (action === 'submit') {
				toast.success(t('inventory:borrowingActions.submitted'));
			}
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	const extend = useMutation({
		mutationFn: (dueAt: string) => extendBorrowing(borrowingId, dueAt),
		onSuccess: () => {
			toast.success(t('inventory:borrowingActions.extended'));
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	const returnLines = useMutation({
		mutationFn: (lineId?: string) =>
			returnBorrowing(borrowingId, {
				...(lineId ? { lineId } : {}),
				condition: 'good',
			}),
		onSuccess: () => {
			toast.success(t('inventory:borrowingActions.returned'));
			invalidate();
		},
		onError: (mutationError) => toast.error(mutationError.message),
	});

	const markLost = useMutation({
		mutationFn: (lineId: string) =>
			markBorrowingLineLost(borrowingId, { lineId }),
		onSuccess: () => {
			toast.success(t('inventory:borrowingActions.lost'));
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

	if (data === null) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('inventory:borrowings.notFound')}
				</CardContent>
			</Card>
		);
	}

	const { borrowing, lines, events } = data;
	const openLines = lines.filter(
		(line) => line.issuedAt !== null && line.returnedAt === null && line.markedLostAt === null,
	);
	const busy =
		transition.isPending ||
		returnLines.isPending ||
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
		const input = window.prompt(t('inventory:borrowingForm.dueAt'));
		if (!input) return;
		const parsed = new Date(input);
		if (Number.isNaN(parsed.getTime())) return;
		extend.mutate(parsed.toISOString());
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<div className='flex items-center gap-2'>
						<h2 className='font-mono text-lg font-semibold'>{borrowing.code}</h2>
						<Badge variant={STATUS_VARIANT[borrowing.status]}>
							{t(
								`inventory:borrowingStatus.${borrowing.status}` as 'inventory:borrowingStatus.requested',
							)}
						</Badge>
					</div>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:borrowings.dueAt')}:{' '}
						{new Date(borrowing.dueAt).toLocaleDateString()}
					</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{borrowing.status === 'draft' ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() => transition.mutate('submit')}
						>
							{t('inventory:borrowingActions.submit')}
						</Button>
					) : null}
					{borrowing.status === 'requested' ? (
						<>
							<Button
								size='sm'
								disabled={busy}
								onClick={() => transition.mutate('approve')}
							>
								{t('inventory:borrowingActions.approve')}
							</Button>
							<Button
								size='sm'
								variant='ghost'
								disabled={busy}
								onClick={() => transition.mutate('reject')}
							>
								{t('inventory:borrowingActions.reject')}
							</Button>
						</>
					) : null}
					{borrowing.status === 'requested' || borrowing.status === 'approved' ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() => transition.mutate('issue')}
						>
							{t('inventory:borrowingActions.issue')}
						</Button>
					) : null}
					{openLines.length > 1 ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() => returnLines.mutate(undefined)}
						>
							{t('inventory:borrowingActions.returnAll')}
						</Button>
					) : null}
					{borrowing.status === 'issued' ||
					borrowing.status === 'partially_returned' ||
					borrowing.status === 'approved' ? (
						<Button
							size='sm'
							variant='secondary'
							disabled={busy}
							onClick={promptExtend}
						>
							{t('inventory:borrowingActions.extend')}
						</Button>
					) : null}
					{borrowing.status === 'returned' ? (
						<Button
							size='sm'
							disabled={busy}
							onClick={() => transition.mutate('close')}
						>
							{t('inventory:borrowingActions.close')}
						</Button>
					) : null}
					{borrowing.status === 'requested' || borrowing.status === 'approved' ? (
						<Button
							size='sm'
							variant='ghost'
							disabled={busy}
							onClick={() => transition.mutate('cancel')}
						>
							{t('inventory:borrowingActions.cancel')}
						</Button>
					) : null}
				</div>
			</div>

			<BorrowerCard borrowing={borrowing} />

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>
						{t('inventory:borrowings.lines')}
					</CardTitle>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:borrowings.linesDescription')}
					</p>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('inventory:borrowings.serial')}</TableHead>
								<TableHead>{t('inventory:borrowings.origin')}</TableHead>
								<TableHead>{t('inventory:borrowings.issuedAt')}</TableHead>
								<TableHead>{t('inventory:borrowings.returnedAt')}</TableHead>
								<TableHead>{t('inventory:borrowings.condition')}</TableHead>
								<TableHead className='text-right'>
									{t('inventory:borrowings.actions')}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{lines.map((line) => (
								<LineRow
									key={line.id}
									line={line}
									busy={busy}
									onReturn={() => returnLines.mutate(line.id)}
									onMarkLost={() => markLost.mutate(line.id)}
								/>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>
						{t('inventory:borrowings.timeline')}
					</CardTitle>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:borrowings.timelineDescription')}
					</p>
				</CardHeader>
				<CardContent>
					{events.length === 0 ? (
						<p className='text-sm text-muted-foreground'>
							{t('inventory:borrowings.noEvents')}
						</p>
					) : (
						<ol className='space-y-3'>
							{events.map((event) => (
								<li key={event.id} className='flex flex-wrap items-baseline gap-2'>
									<span className='text-xs text-muted-foreground'>
										{new Date(event.occurredAt).toLocaleString()}
									</span>
									<Badge variant={event.stockMovementId ? 'default' : 'outline'}>
										{t(
											`inventory:borrowingEvent.${event.eventType}` as 'inventory:borrowingEvent.issued',
										)}
									</Badge>
									{event.stockMovementId ? (
										<span className='font-mono text-xs text-muted-foreground'>
											{t('inventory:borrowings.movement')}: {event.stockMovementId}
										</span>
									) : null}
									{event.actorUserId === null ? (
										<Badge variant='secondary'>
											{t('inventory:borrowings.auto')}
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
	const { t } = useTranslation(['inventory', 'common']);

	// The detail projection attaches the flag; the list projection does not.
	const redacted = borrowing.guestIdentityRedacted === true;

	return (
		<Card>
			<CardHeader>
				<CardTitle className='text-base'>
					{t('inventory:borrowings.borrower')}
				</CardTitle>
			</CardHeader>
			<CardContent className='space-y-1 text-sm'>
				{borrowing.borrowerType === 'guest' ? (
					<>
						<p className='font-medium'>
							{borrowing.guestName ?? t('inventory:borrowings.guest')}
						</p>
						{borrowing.guestPhone ? <p>{borrowing.guestPhone}</p> : null}
						{redacted ? (
							<div className='rounded-md border border-dashed p-2 text-xs text-muted-foreground'>
								<p className='font-medium'>
									{t('inventory:borrowings.redacted')}
								</p>
								<p>{t('inventory:borrowings.redactedHint')}</p>
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

/** One unit line plus the per-line actions it allows. */
function LineRow({
	line,
	busy,
	onReturn,
	onMarkLost,
}: {
	line: TBorrowingLine;
	busy: boolean;
	onReturn: () => void;
	onMarkLost: () => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);

	// A line is "open" only once issued and while neither returned nor lost.
	const open =
		line.issuedAt !== null && line.returnedAt === null && line.markedLostAt === null;

	return (
		<TableRow>
			<TableCell className='font-mono text-xs'>
				{line.serialTrackedItemId}
				{line.markedLateAt ? (
					<Badge variant='destructive' className='ml-2'>
						{t('inventory:borrowings.late')}
					</Badge>
				) : null}
				{line.markedLostAt ? (
					<Badge variant='destructive' className='ml-2'>
						{t('inventory:borrowings.lost')}
					</Badge>
				) : null}
			</TableCell>
			<TableCell className='font-mono text-xs text-muted-foreground'>
				{line.originWarehouseId}
			</TableCell>
			<TableCell className='text-xs'>
				{line.issuedAt ? new Date(line.issuedAt).toLocaleDateString() : '—'}
			</TableCell>
			<TableCell className='text-xs'>
				{line.returnedAt ? new Date(line.returnedAt).toLocaleDateString() : '—'}
			</TableCell>
			<TableCell className='text-xs text-muted-foreground'>
				{line.returnedCondition
					? t(
							`inventory:borrowingCondition.${line.returnedCondition}` as 'inventory:borrowingCondition.good',
						)
					: '—'}
			</TableCell>
			<TableCell className='text-right'>
				{open ? (
					<>
						<Button size='sm' disabled={busy} onClick={onReturn}>
							{t('inventory:borrowingActions.return')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={busy}
							onClick={onMarkLost}
						>
							{t('inventory:borrowingActions.markLost')}
						</Button>
					</>
				) : null}
			</TableCell>
		</TableRow>
	);
}

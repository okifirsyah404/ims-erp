import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { CalendarCheck, CircleCheck, CircleX, Lock, LockOpen } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	runDeferredRevenue,
	closeChecklistQueryOptions,
	ensurePeriod,
	periodsQueryOptions,
	transitionPeriod,
	type TPeriod,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/closing` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/closing/');

const currentYear = () => new Date().getFullYear();
const currentMonth = () => new Date().getMonth() + 1;

const statusKey = (status: string) =>
	`finance:periods.status.${status}` as const;

/** Period closing: advisory checklist + close/lock transitions (F2/F7). */
export function ClosingPage() {
	const { t } = useTranslation(['finance', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canRead = usePermission('accounting_period.read');
	const canClose = usePermission('accounting_period.close');
	const canReopen = usePermission('accounting_period.reopen');

	const year = search.year ?? currentYear();
	const month = search.month ?? currentMonth();
	const [yearInput, setYearInput] = useState(String(year));
	const [monthInput, setMonthInput] = useState(String(month));
	const [applied, setApplied] = useState({ year, month });

	const { data: checklist } = useQuery({
		...closeChecklistQueryOptions(applied.year, applied.month),
		enabled: canClose,
	});

	const { data: periods, isPending, isError, error } = useQuery({
		...periodsQueryOptions({ page: 1, limit: 24 }),
		enabled: canRead,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ['periods'] });
		void queryClient.invalidateQueries({ queryKey: ['close-checklist'] });
	};

	const ensure = useMutation({
		mutationFn: () => ensurePeriod(applied.year, applied.month),
		onSuccess: async () => {
			toast.success(t('finance:periods.created'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const canAmortise = usePermission('journal.post');
	const amortise = useMutation({
		mutationFn: () => runDeferredRevenue(applied.year, applied.month),
		onSuccess: (result) => {
			toast.success(
				t('finance:closing.deferredRevenueDone', {
					entries: result.entries,
					amount: (result.amount / 100).toLocaleString(),
				}),
			);
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const transition = useMutation({
		mutationFn: (input: { id: string; to: 'closed' | 'locked' | 'open' }) =>
			transitionPeriod(input.id, input.to),
		onSuccess: async () => {
			toast.success(t('finance:periods.transitioned'));
			invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const apply = () => {
		const nextYear = Number(yearInput) || currentYear();
		const nextMonth = Math.min(12, Math.max(1, Number(monthInput) || currentMonth()));
		setApplied({ year: nextYear, month: nextMonth });
		void navigate({ search: { year: nextYear, month: nextMonth } });
	};

	const nextAction = (
		status: string,
	): { to: 'closed' | 'locked' | 'open'; labelKey: string; allowed: boolean } | null => {
		if (status === 'open')
			return canClose
				? { to: 'closed', labelKey: 'finance:periods.transition.closed', allowed: true }
				: null;
		if (status === 'closed')
			return canClose
				? { to: 'locked', labelKey: 'finance:periods.transition.locked', allowed: true }
				: null;
		if (status === 'locked')
			return canReopen
				? { to: 'open', labelKey: 'finance:periods.transition.open', allowed: true }
				: null;
		return null;
	};

	const columns = useMemo<ColumnDef<DataTableFeatures, TPeriod, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TPeriod, CellData>[] = [
			{
				accessorKey: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'range',
				header: t('finance:periods.range'),
				cell: ({ row }) => `${row.original.startDate} → ${row.original.endDate}`,
			},
			{
				id: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === 'open'
								? 'secondary'
								: row.original.status === 'locked'
									? 'destructive'
									: 'outline'
						}
					>
						{t(`finance:${statusKey(row.original.status)}` as never)}
					</Badge>
				),
			},
		];
		if (!(canClose || canReopen)) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const action = nextAction(row.original.status);
					return (
						<RowActions
							label={t('finance:common.actions')}
							disabled={transition.isPending}
							actions={
								action
									? [
											{
												key: action.to,
												label: t(action.labelKey as never),
												icon: action.to === 'open' ? LockOpen : Lock,
												onSelect: () =>
													void transition.mutateAsync({
														id: row.original.id,
														to: action.to,
													}),
											},
										]
									: []
							}
						/>
					);
				},
			},
		];
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nextAction closes over canClose/canReopen
	}, [canClose, canReopen, t, transition, transition.isPending]);

	if (!canRead) {
		return (
			<EmptyState icon={CalendarCheck} title={t('finance:closing.title')} bordered />
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:closing.title')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('finance:closing.description')}
				</p>
			</div>

			{canClose ? (
				<Card>
					<CardHeader>
						<CardTitle>{t('finance:closing.checklist')}</CardTitle>
					</CardHeader>
					<CardContent className='space-y-3'>
						<div className='flex flex-wrap items-center gap-2'>
							<Input
								className='w-28'
								placeholder={t('finance:closing.year')}
								value={yearInput}
								onChange={(event) => setYearInput(event.target.value)}
							/>
							<Input
								className='w-20'
								placeholder={t('finance:closing.month')}
								value={monthInput}
								onChange={(event) => setMonthInput(event.target.value)}
							/>
							<Button size='sm' variant='outline' onClick={apply}>
								{t('finance:aging.apply')}
							</Button>
							<Button
								size='sm'
								variant='ghost'
								disabled={ensure.isPending}
								onClick={() => void ensure.mutateAsync()}
							>
								{t('finance:periods.create')}
							</Button>
							{canAmortise ? (
								<Button
									size='sm'
									variant='ghost'
									disabled={amortise.isPending}
									onClick={() => void amortise.mutateAsync()}
								>
									{t('finance:closing.runDeferredRevenue')}
								</Button>
							) : null}
						</div>
						{checklist ? (
							<>
								<Badge variant={checklist.allClear ? 'secondary' : 'destructive'}>
									{checklist.allClear
										? t('finance:closing.allClear')
										: t('finance:closing.notClear')}
								</Badge>
								<div className='space-y-1'>
									{checklist.items.map((item) => (
										<div
											key={item.key}
											className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
										>
											<span className='flex items-center gap-2'>
												{item.pass ? (
													<CircleCheck className='size-4 text-green-600' />
												) : (
													<CircleX className='text-destructive size-4' />
												)}
												{item.label}
											</span>
											<span className='font-mono text-xs'>{item.count}</span>
										</div>
									))}
								</div>
							</>
						) : null}
					</CardContent>
				</Card>
			) : null}

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && (periods?.rows.length ?? 0) === 0 ? (
				<EmptyState icon={CalendarCheck} title={t('finance:periods.empty')} bordered />
			) : (
				<DataTable
					columns={columns}
					data={periods?.rows ?? []}
					loading={isPending}
					getRowId={(row) => row.id}
					bordered
				/>
			)}
		</div>
	);
}

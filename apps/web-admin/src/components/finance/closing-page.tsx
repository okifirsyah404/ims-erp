import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { CalendarCheck, CircleCheck, CircleX } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	closeChecklistQueryOptions,
	ensurePeriod,
	periodsQueryOptions,
	transitionPeriod,
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

	if (!canRead) {
		return (
			<EmptyState icon={CalendarCheck} title={t('finance:closing.title')} className='border' />
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
						<CardTitle className='text-base'>{t('finance:closing.checklist')}</CardTitle>
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

			{isPending ? null : isError ? (
				<EmptyState icon={CalendarCheck} title={error.message} className='border' />
			) : (periods?.rows.length ?? 0) === 0 ? (
				<EmptyState icon={CalendarCheck} title={t('finance:periods.empty')} className='border' />
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:common.code')}</TableHead>
								<TableHead>{t('finance:periods.range')}</TableHead>
								<TableHead>{t('finance:common.status')}</TableHead>
								{canClose || canReopen ? (
									<TableHead className='text-right'>
										{t('finance:common.actions')}
									</TableHead>
								) : null}
							</TableRow>
						</TableHeader>
						<TableBody>
							{periods?.rows.map((period) => {
								const action = nextAction(period.status);
								return (
									<TableRow key={period.id}>
										<TableCell className='font-mono text-xs'>{period.code}</TableCell>
										<TableCell>
											{period.startDate} → {period.endDate}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													period.status === 'open'
														? 'secondary'
														: period.status === 'locked'
															? 'destructive'
															: 'outline'
												}
											>
												{t(`finance:${statusKey(period.status)}` as never)}
											</Badge>
										</TableCell>
										{canClose || canReopen ? (
											<TableCell className='text-right'>
												{action ? (
													<Button
														size='sm'
														variant='outline'
														disabled={transition.isPending}
														onClick={() =>
															void transition.mutateAsync({
																id: period.id,
																to: action.to,
															})
														}
													>
														{t(action.labelKey as never)}
													</Button>
												) : null}
											</TableCell>
										) : null}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}

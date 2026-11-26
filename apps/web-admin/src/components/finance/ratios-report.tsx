import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { ratiosQueryOptions } from '@/lib/finance-api';

type TKind = 'times' | 'percent' | 'days';
const format = (value: number | null, kind: TKind) => {
	if (value === null) return '—';
	if (kind === 'percent') return `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
	if (kind === 'days') return value.toLocaleString('id-ID', { maximumFractionDigits: 1 });
	return `${value.toLocaleString('id-ID', { maximumFractionDigits: 2 })}×`;
};

/** Liquidity, profitability, leverage and efficiency ratios (ERP-0151). */
export function RatiosReport({ startDate, endDate }: { startDate: string; endDate: string }) {
	const { t } = useTranslation(['finance']);
	const enabled = startDate !== '' && startDate <= endDate;
	const query = useQuery({ ...ratiosQueryOptions(startDate, endDate), enabled });
	if (!query.data) return null;
	const r = query.data;
	const groups: Array<{ title: string; items: Array<[string, number | null, TKind]> }> = [
		{
			title: t('finance:ratios.liquidity'),
			items: [
				[t('finance:ratios.current'), r.liquidity.current, 'times'],
				[t('finance:ratios.quick'), r.liquidity.quick, 'times'],
				[t('finance:ratios.cash'), r.liquidity.cash, 'times'],
			],
		},
		{
			title: t('finance:ratios.profitability'),
			items: [
				[t('finance:ratios.grossMargin'), r.profitability.grossMargin, 'percent'],
				[t('finance:ratios.netMargin'), r.profitability.netMargin, 'percent'],
				[t('finance:ratios.roa'), r.profitability.returnOnAssets, 'percent'],
				[t('finance:ratios.roe'), r.profitability.returnOnEquity, 'percent'],
			],
		},
		{ title: t('finance:ratios.leverage'), items: [[t('finance:ratios.der'), r.leverage.debtToEquity, 'times']] },
		{
			title: t('finance:ratios.efficiency', { days: r.days }),
			items: [
				[t('finance:ratios.dso'), r.efficiency.dso, 'days'],
				[t('finance:ratios.dpo'), r.efficiency.dpo, 'days'],
				[t('finance:ratios.dio'), r.efficiency.dio, 'days'],
			],
		},
	];
	return (
		<div className='space-y-4'>
			{groups.map((group) => (
				<div key={group.title}>
					<h3 className='mb-2 font-medium'>{group.title}</h3>
					<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
						{group.items.map(([label, value, kind]) => (
							<div key={label} className='rounded-md border p-3'>
								<p className='text-muted-foreground text-xs'>{label}</p>
								<p className='text-lg font-semibold tabular-nums'>{format(value, kind)}</p>
							</div>
						))}
					</div>
				</div>
			))}
			<p className='text-muted-foreground text-xs'>{t('finance:ratios.hint')}</p>
		</div>
	);
}

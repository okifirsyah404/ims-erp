import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { CalendarClock } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import {
	AGING_BUCKETS,
	type TAgingResponse,
} from '@/lib/finance-api';

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Shared aging table (F4 AR / F5 AP): bucket columns per party, computed
 * on demand from the sub-ledger (D7). `queryFor(date)` lets the page supply
 * a query keyed by the applied as-of date.
 */
export function AgingTable({
	title,
	description,
	partyLabel,
	partyKey,
	queryFor,
	enabled,
	asOfDate,
	onAsOfChange,
}: {
	title: string;
	description: string;
	partyLabel: string;
	partyKey: 'customerId' | 'supplierId';
	queryFor: (asOf: string | undefined) => ReturnType<
		typeof import('@/lib/finance-api').arAgingQueryOptions
	>;
	enabled: boolean;
	asOfDate?: string;
	onAsOfChange: (asOf: string | undefined) => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const [asOfInput, setAsOfInput] = useState(asOfDate ?? '');

	const { data, isPending, isError, error } = useQuery({
		...queryFor(asOfDate),
		enabled,
	});

	const rows: TAgingResponse['rows'] = data?.rows ?? [];

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>{title}</h1>
					<p className='text-muted-foreground text-sm'>{description}</p>
				</div>
				<div className='flex items-center gap-2'>
					<Input
						type='date'
						className='w-40'
						value={asOfInput}
						onChange={(event) => setAsOfInput(event.target.value)}
					/>
					<Button
						size='sm'
						variant='outline'
						onClick={() => onAsOfChange(asOfInput || undefined)}
					>
						{t('finance:aging.apply')}
					</Button>
				</div>
			</div>
			<p className='text-muted-foreground text-xs'>
				{t('finance:aging.asOf')}: {data?.asOfDate ?? today()}
			</p>

			{isPending ? null : isError ? (
				<EmptyState icon={CalendarClock} title={error.message} className='border' />
			) : rows.length === 0 ? (
				<EmptyState
					icon={CalendarClock}
					title={t('finance:aging.empty')}
					className='border'
				/>
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{partyLabel}</TableHead>
								{AGING_BUCKETS.map((bucket) => (
									<TableHead key={bucket} className='text-right'>
										{t(`finance:aging.bucket.${bucket}`)}
									</TableHead>
								))}
								<TableHead className='text-right'>
									{t('finance:common.total')}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row, index) => (
								<TableRow key={row[partyKey] ?? `row-${index}`}>
									<TableCell>
										{row[partyKey] ?? t('finance:aging.unassigned')}
									</TableCell>
									{AGING_BUCKETS.map((bucket) => (
										<TableCell key={bucket} className='text-right'>
											{formatMoney(row.buckets[bucket])}
										</TableCell>
									))}
									<TableCell className='text-right font-medium'>
										{formatMoney(row.total)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
						<TableFooter>
							<TableRow>
								<TableCell>{t('finance:aging.grandTotal')}</TableCell>
								{AGING_BUCKETS.map((bucket) => (
									<TableCell key={bucket} className='text-right'>
										{formatMoney(
											rows.reduce((sum, row) => sum + row.buckets[bucket], 0),
										)}
									</TableCell>
								))}
								<TableCell className='text-right font-semibold'>
									{formatMoney(data?.grandTotal ?? 0)}
								</TableCell>
							</TableRow>
						</TableFooter>
					</Table>
				</div>
			)}
		</div>
	);
}

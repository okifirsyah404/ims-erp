import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { EmptyState } from '@/components/empty-state';
import {
	accountsQueryOptions,
	generalLedgerQueryOptions,
	trialBalanceQueryOptions,
} from '@/lib/finance-api';

const formatMoney = (minor: number) => (minor === 0 ? '—' : (minor / 100).toLocaleString());
const NONE = 'none';

/** Trial balance for the applied range (ERP-0133): opening, movement, closing. */
export function TrialBalanceReport({ startDate, endDate }: { startDate: string; endDate: string }) {
	const { t } = useTranslation(['finance', 'common']);
	const { data } = useQuery({
		...trialBalanceQueryOptions(startDate, endDate),
		enabled: startDate !== '' && startDate <= endDate,
	});
	if (!data) return <EmptyState icon={FileSpreadsheet} title={t('finance:reports.run')} bordered />;

	const head = 'px-2 py-1 text-right font-medium';
	const cell = 'px-2 py-1 text-right tabular-nums';
	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between gap-2'>
				<CardTitle>{t('finance:reports.tab.trialBalance')}</CardTitle>
				<Badge variant={data.balanced ? 'secondary' : 'destructive'}>
					{data.balanced ? t('finance:reports.tb.balanced') : t('finance:reports.tb.unbalanced')}
				</Badge>
			</CardHeader>
			<CardContent className='overflow-x-auto'>
				<table className='w-full text-sm'>
					<thead className='border-b'>
						<tr>
							<th rowSpan={2} className='px-2 py-1 text-left font-medium'>
								{t('finance:reports.tb.account')}
							</th>
							<th colSpan={2} className={head}>{t('finance:reports.tb.opening')}</th>
							<th colSpan={2} className={head}>{t('finance:reports.tb.movement')}</th>
							<th colSpan={2} className={head}>{t('finance:reports.tb.closing')}</th>
						</tr>
						<tr>
							{[0, 1, 2].map((group) => (
								<FragmentHeads key={group} debit={t('finance:journal.debit')} credit={t('finance:journal.credit')} />
							))}
						</tr>
					</thead>
					<tbody>
						{data.rows.map((row) => (
							<tr key={row.accountId} className='border-b last:border-0'>
								<td className='px-2 py-1 font-mono text-xs'>
									{row.code} — {row.name}
								</td>
								<td className={cell}>{formatMoney(row.openingDebit)}</td>
								<td className={cell}>{formatMoney(row.openingCredit)}</td>
								<td className={cell}>{formatMoney(row.periodDebit)}</td>
								<td className={cell}>{formatMoney(row.periodCredit)}</td>
								<td className={cell}>{formatMoney(row.closingDebit)}</td>
								<td className={cell}>{formatMoney(row.closingCredit)}</td>
							</tr>
						))}
					</tbody>
					<tfoot className='border-t font-medium'>
						<tr>
							<td className='px-2 py-1'>{t('finance:reports.tb.total')}</td>
							<td className={cell}>{formatMoney(data.totals.openingDebit)}</td>
							<td className={cell}>{formatMoney(data.totals.openingCredit)}</td>
							<td className={cell}>{formatMoney(data.totals.periodDebit)}</td>
							<td className={cell}>{formatMoney(data.totals.periodCredit)}</td>
							<td className={cell}>{formatMoney(data.totals.closingDebit)}</td>
							<td className={cell}>{formatMoney(data.totals.closingCredit)}</td>
						</tr>
					</tfoot>
				</table>
			</CardContent>
		</Card>
	);
}

function FragmentHeads({ debit, credit }: { debit: string; credit: string }) {
	return (
		<>
			<th className='px-2 py-1 text-right text-xs font-normal'>{debit}</th>
			<th className='px-2 py-1 text-right text-xs font-normal'>{credit}</th>
		</>
	);
}

/** General ledger of one account (ERP-0133) with a running balance. */
export function GeneralLedgerReport({ startDate, endDate }: { startDate: string; endDate: string }) {
	const { t } = useTranslation(['finance', 'common']);
	const [accountId, setAccountId] = useState('');
	const { data: accounts } = useQuery(accountsQueryOptions({ page: 1, limit: 100 }));
	const { data } = useQuery({
		...generalLedgerQueryOptions(accountId, startDate, endDate),
		enabled: accountId !== '' && startDate !== '' && startDate <= endDate,
	});

	const cell = 'px-2 py-1 text-right tabular-nums';
	return (
		<div className='space-y-3'>
			<h3 className='text-sm font-medium'>{t('finance:reports.tab.generalLedger')}</h3>
			<Select value={accountId === '' ? NONE : accountId} onValueChange={(v: string | null) => setAccountId(v == null || v === NONE ? '' : v)}>
				<SelectTrigger className='w-80'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NONE}>{t('finance:reports.gl.selectAccount')}</SelectItem>
					{accounts?.rows
						.filter((account) => account.isPostable)
						.map((account) => (
							<SelectItem key={account.id} value={account.id}>
								{account.code} — {account.name}
							</SelectItem>
						))}
				</SelectContent>
			</Select>
			{!data ? (
				<EmptyState icon={FileSpreadsheet} title={t('finance:reports.gl.selectAccount')} bordered />
			) : (
				<Card>
					<CardHeader>
						<CardTitle className='font-mono text-sm'>
							{data.account.code} — {data.account.name}
						</CardTitle>
					</CardHeader>
					<CardContent className='overflow-x-auto'>
						<table className='w-full text-sm'>
							<thead className='border-b'>
								<tr>
									<th className='px-2 py-1 text-left font-medium'>{t('finance:common.date')}</th>
									<th className='px-2 py-1 text-left font-medium'>{t('finance:reports.gl.entry')}</th>
									<th className='px-2 py-1 text-left font-medium'>{t('finance:common.description')}</th>
									<th className='px-2 py-1 text-right font-medium'>{t('finance:journal.debit')}</th>
									<th className='px-2 py-1 text-right font-medium'>{t('finance:journal.credit')}</th>
									<th className='px-2 py-1 text-right font-medium'>{t('finance:reports.gl.balance')}</th>
								</tr>
							</thead>
							<tbody>
								<tr className='border-b text-muted-foreground'>
									<td className='px-2 py-1' colSpan={5}>
										{t('finance:reports.gl.opening')}
									</td>
									<td className={cell}>{(data.openingBalance / 100).toLocaleString()}</td>
								</tr>
								{data.lines.map((line, index) => (
									<tr key={`${line.entryId}-${index}`} className='border-b last:border-0'>
										<td className='px-2 py-1'>{line.entryDate}</td>
										<td className='px-2 py-1 font-mono text-xs'>{line.entryCode ?? '—'}</td>
										<td className='max-w-72 truncate px-2 py-1'>{line.description ?? '—'}</td>
										<td className={cell}>{formatMoney(line.debit)}</td>
										<td className={cell}>{formatMoney(line.credit)}</td>
										<td className={cell}>{(line.balance / 100).toLocaleString()}</td>
									</tr>
								))}
							</tbody>
							<tfoot className='border-t font-medium'>
								<tr>
									<td className='px-2 py-1' colSpan={3}>
										{t('finance:reports.gl.closing')}
									</td>
									<td className={cell}>{formatMoney(data.totalDebit)}</td>
									<td className={cell}>{formatMoney(data.totalCredit)}</td>
									<td className={cell}>{(data.closingBalance / 100).toLocaleString()}</td>
								</tr>
							</tfoot>
						</table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

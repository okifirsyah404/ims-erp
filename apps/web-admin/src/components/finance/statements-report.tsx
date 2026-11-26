import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { statementsQueryOptions, type TStatementCompare, type TStatements } from '@/lib/finance-api';

const money = (minor: number | undefined) => (minor === undefined ? '' : (minor / 100).toLocaleString('id-ID'));

type TRow = { key: string; label: string; current: number; comparative?: number; strong?: boolean; indent?: boolean };

function Rows({ rows, comparative }: { rows: TRow[]; comparative: boolean }) {
	return (
		<>
			{rows.map((row) => (
				<TableRow key={row.key} className={row.strong ? 'font-semibold' : undefined}>
					<TableCell className={row.indent ? 'pl-6' : undefined}>{row.label}</TableCell>
					<TableCell className={`text-right tabular-nums ${row.current < 0 ? 'text-destructive' : ''}`}>{money(row.current)}</TableCell>
					{comparative ? <TableCell className='text-right tabular-nums text-muted-foreground'>{money(row.comparative)}</TableCell> : null}
				</TableRow>
			))}
		</>
	);
}

/** Lines of one cash-flow section, matched by account across the two ranges. */
function sectionRows(key: string, label: string, current: { lines: Array<{ accountId: string; code: string; name: string; amount: number }>; total: number }, other?: typeof current): TRow[] {
	const others = new Map((other?.lines ?? []).map((line) => [line.accountId, line.amount]));
	const ids = new Set([...current.lines.map((line) => line.accountId), ...others.keys()]);
	const names = new Map([...(other?.lines ?? []), ...current.lines].map((line) => [line.accountId, `${line.code} ${line.name}`]));
	return [
		...[...ids].map((id) => ({
			key: `${key}-${id}`,
			label: names.get(id) ?? id,
			current: current.lines.find((line) => line.accountId === id)?.amount ?? 0,
			comparative: other ? (others.get(id) ?? 0) : undefined,
			indent: true,
		})),
		{ key: `${key}-total`, label, current: current.total, comparative: other?.total, strong: true },
	];
}

/**
 * Direct cash flow, indirect reconciliation and changes in equity for the
 * selected range, with an optional comparative column (ERP-0148).
 */
export function StatementsReport({ startDate, endDate }: { startDate: string; endDate: string }) {
	const { t } = useTranslation(['finance']);
	const [compare, setCompare] = useState<TStatementCompare>('previous_period');
	const enabled = startDate !== '' && startDate <= endDate;
	const query = useQuery({ ...statementsQueryOptions(startDate, endDate, compare), enabled });
	if (!query.data) return null;
	const { current, comparative } = query.data as TStatements;
	const c = comparative ?? undefined;
	const hasComparative = c !== undefined;
	const head = (title: string) => (
		<TableHeader>
			<TableRow>
				<TableHead>{title}</TableHead>
				<TableHead className='text-right'>
					{current.from} – {current.to}
				</TableHead>
				{hasComparative ? (
					<TableHead className='text-right'>
						{c.from} – {c.to}
					</TableHead>
				) : null}
			</TableRow>
		</TableHeader>
	);
	const d = current.directCashFlow;
	const i = current.indirectCashFlow;
	return (
		<div className='space-y-6'>
			<Select value={compare} onValueChange={(value: string | null) => value && setCompare(value as TStatementCompare)}>
				<SelectTrigger className='w-64'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value='none'>{t('finance:statements.compare.none')}</SelectItem>
					<SelectItem value='previous_period'>{t('finance:statements.compare.previous_period')}</SelectItem>
					<SelectItem value='previous_year'>{t('finance:statements.compare.previous_year')}</SelectItem>
				</SelectContent>
			</Select>

			<Table>
				{head(t('finance:statements.directTitle'))}
				<TableBody>
					<Rows
						comparative={hasComparative}
						rows={[
							...sectionRows('op', t('finance:statements.operating'), d.operating, c?.directCashFlow.operating),
							...sectionRows('inv', t('finance:statements.investing'), d.investing, c?.directCashFlow.investing),
							...sectionRows('fin', t('finance:statements.financing'), d.financing, c?.directCashFlow.financing),
							{ key: 'net', label: t('finance:statements.netChange'), current: d.netChange, comparative: c?.directCashFlow.netChange, strong: true },
							{ key: 'open', label: t('finance:statements.openingCash'), current: d.openingCash, comparative: c?.directCashFlow.openingCash },
							{ key: 'close', label: t('finance:statements.closingCash'), current: d.closingCash, comparative: c?.directCashFlow.closingCash, strong: true },
						]}
					/>
				</TableBody>
			</Table>
			{d.tieDifference !== 0 ? <p className='text-destructive text-sm'>{t('finance:statements.notTied', { amount: money(d.tieDifference) })}</p> : null}

			<Table>
				{head(t('finance:statements.indirectTitle'))}
				<TableBody>
					<Rows
						comparative={hasComparative}
						rows={[
							{ key: 'ni', label: t('finance:statements.netIncome'), current: i.netIncome, comparative: c?.indirectCashFlow.netIncome, strong: true },
							...sectionRows('adj', t('finance:statements.adjustments'), i.adjustments, c?.indirectCashFlow.adjustments),
							...sectionRows('wc', t('finance:statements.workingCapital'), i.workingCapital, c?.indirectCashFlow.workingCapital),
							{ key: 'iop', label: t('finance:statements.operating'), current: i.operating, comparative: c?.indirectCashFlow.operating, strong: true },
							...sectionRows('iinv', t('finance:statements.investing'), i.investing, c?.indirectCashFlow.investing),
							...sectionRows('ifin', t('finance:statements.financing'), i.financing, c?.indirectCashFlow.financing),
							{ key: 'inet', label: t('finance:statements.netChange'), current: i.netChange, comparative: c?.indirectCashFlow.netChange, strong: true },
						]}
					/>
				</TableBody>
			</Table>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t('finance:statements.equityTitle')}</TableHead>
						<TableHead className='text-right'>{t('finance:statements.opening')}</TableHead>
						<TableHead className='text-right'>{t('finance:statements.increase')}</TableHead>
						<TableHead className='text-right'>{t('finance:statements.decrease')}</TableHead>
						<TableHead className='text-right'>{t('finance:statements.closing')}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{current.changesInEquity.lines.map((row) => (
						<TableRow key={row.accountId}>
							<TableCell>
								{row.code} {row.name}
							</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.opening)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.increase)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.decrease)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.closing)}</TableCell>
						</TableRow>
					))}
					<TableRow>
						<TableCell>{t('finance:statements.unclosedPriorResult')}</TableCell>
						<TableCell className='text-right tabular-nums'>{money(current.changesInEquity.unclosedPriorResult)}</TableCell>
						<TableCell colSpan={2} />
						<TableCell className='text-right tabular-nums'>{money(current.changesInEquity.unclosedPriorResult)}</TableCell>
					</TableRow>
					<TableRow>
						<TableCell>{t('finance:statements.periodResult')}</TableCell>
						<TableCell />
						<TableCell colSpan={2} className='text-right tabular-nums'>
							{money(current.changesInEquity.periodResult)}
						</TableCell>
						<TableCell className='text-right tabular-nums'>{money(current.changesInEquity.periodResult)}</TableCell>
					</TableRow>
					<TableRow className='font-semibold'>
						<TableCell>{t('finance:statements.totalEquity')}</TableCell>
						<TableCell className='text-right tabular-nums'>{money(current.changesInEquity.opening)}</TableCell>
						<TableCell colSpan={2} />
						<TableCell className='text-right tabular-nums'>{money(current.changesInEquity.closing)}</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	);
}

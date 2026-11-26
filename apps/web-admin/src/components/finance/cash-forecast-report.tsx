import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { MoneyInput } from '@/components/money-input';
import { toast } from '@/components/toast';
import { addForecastLine, cashForecastQueryOptions, forecastLinesQueryOptions, removeForecastLine, toMinor } from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const money = (minor: number) => (minor / 100).toLocaleString('id-ID');

/** 13-week cash forecast with manual lines and the licence renewals due (ERP-0149). */
export function CashForecastReport() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canEdit = usePermission('cash_bank.create');
	const forecast = useQuery(cashForecastQueryOptions());
	const lines = useQuery(forecastLinesQueryOptions());
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [direction, setDirection] = useState<'in' | 'out'>('in');
	const [amount, setAmount] = useState('');
	const [description, setDescription] = useState('');
	const refresh = () => queryClient.invalidateQueries({ queryKey: ['finance', 'forecast'] });
	const add = useMutation({
		mutationFn: () => addForecastLine({ expectedDate: date, direction, amount: toMinor(amount), description: description.trim() }),
		onSuccess: () => {
			setAmount('');
			setDescription('');
			void refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const remove = useMutation({ mutationFn: removeForecastLine, onSuccess: () => void refresh(), onError: (error: Error) => toast.error(error.message) });
	if (!forecast.data) return null;
	const data = forecast.data;
	return (
		<div className='space-y-4'>
			<p className='text-muted-foreground text-sm'>
				{t('finance:forecast.hint', { cash: money(data.openingCash) })}
				{data.payrollBasis ? ` ${t('finance:forecast.payrollBasis', { period: data.payrollBasis.period })}` : ` ${t('finance:forecast.noPayroll')}`}
			</p>
			<div className='overflow-x-auto'>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t('finance:forecast.week')}</TableHead>
							<TableHead className='text-right'>{t('finance:forecast.receivables')}</TableHead>
							<TableHead className='text-right'>{t('finance:forecast.manualIn')}</TableHead>
							<TableHead className='text-right'>{t('finance:forecast.payables')}</TableHead>
							<TableHead className='text-right'>{t('finance:forecast.payroll')}</TableHead>
							<TableHead className='text-right'>{t('finance:forecast.statutory')}</TableHead>
							<TableHead className='text-right'>{t('finance:forecast.manualOut')}</TableHead>
							<TableHead className='text-right'>{t('finance:forecast.closing')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.weeks.map((row) => (
							<TableRow key={row.week} className={row.week === data.lowestWeek.week ? 'bg-muted/50' : undefined}>
								<TableCell className='whitespace-nowrap'>
									{row.week}. {row.start} – {row.end}
								</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.receivables)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.manualIn)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.payables)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.payroll)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.statutory)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.manualOut)}</TableCell>
								<TableCell className={`text-right font-medium tabular-nums ${row.closing < 0 ? 'text-destructive' : ''}`}>{money(row.closing)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<div className='space-y-2 rounded-md border p-4'>
				<h3 className='font-medium'>{t('finance:forecast.manualTitle')}</h3>
				{canEdit ? (
					<div className='flex flex-wrap items-center gap-2'>
						<DatePicker className='w-40' value={date} onChange={setDate} />
						<Select value={direction} onValueChange={(value: string | null) => value && setDirection(value as 'in' | 'out')}>
							<SelectTrigger className='w-36'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='in'>{t('finance:forecast.directionIn')}</SelectItem>
								<SelectItem value='out'>{t('finance:forecast.directionOut')}</SelectItem>
							</SelectContent>
						</Select>
						<MoneyInput className='w-40' value={amount} onValueChange={setAmount} />
						<Input className='w-72' placeholder={t('finance:forecast.description')} value={description} onChange={(event) => setDescription(event.target.value)} />
						<Button size='sm' disabled={add.isPending || toMinor(amount) <= 0 || description.trim() === ''} onClick={() => add.mutate()}>
							{t('common:action.save')}
						</Button>
					</div>
				) : null}
				{(lines.data ?? []).map((line) => (
					<div key={line.id} className='flex items-center justify-between text-sm'>
						<span>
							{line.expectedDate} · {line.direction === 'in' ? '+' : '−'}
							{money(line.amount)} · {line.description}
						</span>
						{canEdit ? (
							<Button size='icon' variant='ghost' aria-label={t('finance:forecast.remove')} onClick={() => remove.mutate(line.id)}>
								<Trash2 className='size-4' />
							</Button>
						) : null}
					</div>
				))}
			</div>

			{data.renewalsDue.length > 0 ? (
				<div className='space-y-1 rounded-md border p-4 text-sm'>
					<h3 className='font-medium'>{t('finance:forecast.renewalsTitle')}</h3>
					<p className='text-muted-foreground text-xs'>{t('finance:forecast.renewalsHint')}</p>
					{data.renewalsDue.map((contract) => (
						<p key={contract.id}>
							<span className='font-mono text-xs'>{contract.code}</span> {contract.customerName} · {contract.endDate ?? '—'}
						</p>
					))}
				</div>
			) : null}
		</div>
	);
}

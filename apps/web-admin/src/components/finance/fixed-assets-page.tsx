import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { PageSkeleton } from '@/components/page-skeleton';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { assetsQueryOptions } from '@/lib/asset-api';
import {
	accountsQueryOptions,
	capitalizeAsset,
	FISCAL_GROUPS,
	fiscalReportQueryOptions,
	fixedAssetsQueryOptions,
	runDepreciation,
	setFiscalGroup,
	type TFiscalGroup,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const money = (minor: number | null) => (minor === null ? '—' : (minor / 100).toLocaleString('id-ID'));
const NONE = 'none';

/**
 * `/finance/fixed-assets` (ERP-0145): capitalized inventory items with their
 * book, the monthly depreciation run, and the fiscal (UU PPh Pasal 11)
 * report. The physical asset register stays in inventory.
 */
export function FixedAssetsPage() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canPost = usePermission('journal.post');
	const books = useQuery(fixedAssetsQueryOptions());
	const [now] = useState(() => new Date());
	const [year, setYear] = useState(String(now.getFullYear()));
	const [month, setMonth] = useState(String(now.getMonth() + 1));
	const [reportYear, setReportYear] = useState(String(now.getFullYear()));
	const report = useQuery(fiscalReportQueryOptions(Number(reportYear) || now.getFullYear()));
	const [capitalizing, setCapitalizing] = useState(false);
	const refresh = () => queryClient.invalidateQueries({ queryKey: ['finance', 'fixed-assets'] });

	const run = useMutation({
		mutationFn: () => runDepreciation(Number(year), Number(month)),
		onSuccess: (result) => {
			toast.success(t('finance:fixedAssets.runDone', { count: result.depreciated, total: money(result.total) }));
			void refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const group = useMutation({
		mutationFn: (input: { itemId: string; fiscalGroup: TFiscalGroup | null }) => setFiscalGroup(input.itemId, input.fiscalGroup),
		onSuccess: () => void refresh(),
		onError: (error: Error) => toast.error(error.message),
	});

	if (books.isPending) return <PageSkeleton cards={2} />;
	if (books.isError) return <ErrorState error={books.error} bordered />;
	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('finance:fixedAssets.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('finance:fixedAssets.description')}</p>
				</div>
				{canPost ? (
					<div className='flex flex-wrap items-center gap-2'>
						<Input className='w-20' aria-label={t('finance:fixedAssets.year')} value={year} onChange={(event) => setYear(event.target.value)} />
						<Input className='w-14' aria-label={t('finance:fixedAssets.month')} value={month} onChange={(event) => setMonth(event.target.value)} />
						<Button variant='outline' disabled={run.isPending} onClick={() => run.mutate()}>
							{t('finance:fixedAssets.run')}
						</Button>
						<Button onClick={() => setCapitalizing(true)}>{t('finance:fixedAssets.capitalize')}</Button>
					</div>
				) : null}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('finance:fixedAssets.title')}</CardTitle>
					{canPost ? (
						<CardAction>
							<Button size='sm' onClick={() => setCapitalizing(true)}>
								{t('finance:fixedAssets.capitalize')}
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:common.code')}</TableHead>
						<TableHead>{t('finance:fixedAssets.item')}</TableHead>
						<TableHead>{t('finance:fixedAssets.capitalizedOn')}</TableHead>
						<TableHead className='text-right'>{t('finance:fixedAssets.cost')}</TableHead>
						<TableHead className='text-right'>{t('finance:fixedAssets.accumulated')}</TableHead>
						<TableHead className='text-right'>{t('finance:fixedAssets.bookValue')}</TableHead>
						<TableHead>{t('finance:fixedAssets.fiscalGroup')}</TableHead>
						<TableHead>{t('finance:common.status')}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{books.data.map((row) => (
						<TableRow key={row.id}>
							<TableCell className='font-mono text-xs'>{row.itemCode}</TableCell>
							<TableCell>{row.itemName}</TableCell>
							<TableCell>{row.capitalizedOn}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.capitalizedAmount)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.accumulatedDepreciation)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.bookValue)}</TableCell>
							<TableCell>
								<Select
									value={row.fiscalGroup ?? NONE}
									disabled={!canPost || row.status !== 'active'}
									onValueChange={(value: string | null) =>
										group.mutate({ itemId: row.itemId ?? '', fiscalGroup: !value || value === NONE ? null : (value as TFiscalGroup) })
									}
								>
									<SelectTrigger className='w-48 text-xs'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>{t('finance:fixedAssets.noGroup')}</SelectItem>
										{FISCAL_GROUPS.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`finance:fixedAssets.group.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell>
								<Badge variant='outline'>{t(`finance:fixedAssets.status.${row.status}`)}</Badge>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('finance:fixedAssets.fiscalTitle')}</CardTitle>
					<CardDescription>{t('finance:fixedAssets.fiscalHint')}</CardDescription>
					<CardAction>
						<Input className='w-24' aria-label={t('finance:fixedAssets.year')} value={reportYear} onChange={(event) => setReportYear(event.target.value)} />
					</CardAction>
				</CardHeader>
				<CardContent>
					<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t('finance:fixedAssets.item')}</TableHead>
							<TableHead>{t('finance:fixedAssets.fiscalGroup')}</TableHead>
							<TableHead className='text-right'>{t('finance:fixedAssets.fiscalYear')}</TableHead>
							<TableHead className='text-right'>{t('finance:fixedAssets.commercialYear')}</TableHead>
							<TableHead className='text-right'>{t('finance:fixedAssets.difference')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{(report.data?.rows ?? []).map((row) => (
							<TableRow key={row.itemId}>
								<TableCell>
									<span className='font-mono text-xs'>{row.itemCode}</span> {row.itemName}
								</TableCell>
								<TableCell>{row.fiscalGroup ? t(`finance:fixedAssets.group.${row.fiscalGroup}`) : t('finance:fixedAssets.noGroup')}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.fiscalDepreciation)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.commercialDepreciation)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.difference)}</TableCell>
							</TableRow>
						))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{capitalizing ? <CapitalizeDialog onClose={() => setCapitalizing(false)} onSaved={refresh} /> : null}
		</div>
	);
}

function CapitalizeDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const items = useQuery(assetsQueryOptions({ page: 1, limit: 100 }));
	const accounts = useQuery(accountsQueryOptions({ page: 1, limit: 200, isActive: true, isPostable: true }));
	const [itemId, setItemId] = useState(NONE);
	const [accountId, setAccountId] = useState(NONE);
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [fiscalGroup, setGroup] = useState<string>(NONE);
	const save = useMutation({
		mutationFn: () =>
			capitalizeAsset(itemId, {
				capitalizedOn: date,
				counterpartAccountId: accountId,
				fiscalGroup: fiscalGroup === NONE ? null : (fiscalGroup as TFiscalGroup),
			}),
		onSuccess: () => {
			toast.success(t('finance:fixedAssets.capitalized'));
			onSaved();
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const valid = itemId !== NONE && accountId !== NONE;
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) save.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('finance:fixedAssets.capitalize')}</DialogTitle>
						<DialogDescription>{t('finance:fixedAssets.capitalizeHint')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='cap-item'>{t('finance:fixedAssets.item')}</FieldLabel>
						<Select value={itemId} onValueChange={(value: string | null) => setItemId(value ?? NONE)}>
							<SelectTrigger id='cap-item'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:common.none')}</SelectItem>
								{(items.data?.rows ?? [])
									.filter((item) => item.acquisitionCost > 0)
									.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.code} — {item.name} (Rp {money(item.acquisitionCost)})
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='cap-account'>{t('finance:fixedAssets.counterpart')}</FieldLabel>
						<Select value={accountId} onValueChange={(value: string | null) => setAccountId(value ?? NONE)}>
							<SelectTrigger id='cap-account'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:common.none')}</SelectItem>
								{(accounts.data?.rows ?? []).map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='cap-date'>{t('finance:fixedAssets.capitalizedOn')}</FieldLabel>
							<DatePicker value={date} onChange={setDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='cap-group'>{t('finance:fixedAssets.fiscalGroup')}</FieldLabel>
							<Select value={fiscalGroup} onValueChange={(value: string | null) => setGroup(value ?? NONE)}>
								<SelectTrigger id='cap-group'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>{t('finance:fixedAssets.noGroup')}</SelectItem>
									{FISCAL_GROUPS.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`finance:fixedAssets.group.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || save.isPending}>
							{t('finance:fixedAssets.capitalize')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { MoneyInput } from '@/components/money-input';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	activateBudget,
	budgetReportQueryOptions,
	budgetVersionsQueryOptions,
	createBudgetVersion,
	replaceBudgetLines,
	setBudgetMode,
	type TBudgetLine,
	toMinor,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';
import { ProjectSelect } from './project-select';

const money = (minor: number) => (minor / 100).toLocaleString('id-ID');

/**
 * `/finance/project-budgets` (ERP-0146): versioned budget per project x
 * account x month, the draft editor, activation and the budget vs actual
 * report with the purchase-order commitment.
 */
export function ProjectBudgetsPage() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canManage = usePermission('journal.approve');
	const [projectId, setProjectId] = useState<string | null>(null);
	const versions = useQuery({ ...budgetVersionsQueryOptions(projectId ?? ''), enabled: projectId !== null });
	const report = useQuery({ ...budgetReportQueryOptions(projectId ?? ''), enabled: projectId !== null });
	const accounts = useQuery(accountsQueryOptions({ page: 1, limit: 300, accountType: 'expense', isActive: true, isPostable: true }));
	const accountName = useMemo(() => new Map((accounts.data?.rows ?? []).map((a) => [a.id, `${a.code} — ${a.name}`])), [accounts.data]);
	const draft = versions.data?.find((version) => version.status === 'draft') ?? null;
	const [lines, setLines] = useState<Array<TBudgetLine & { key: string }> | null>(null);
	const editing = lines ?? (draft ? draft.lines.map((line) => ({ ...line, key: line.id })) : []);
	const refresh = () => queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
	const onError = (error: Error) => toast.error(error.message);

	const create = useMutation({ mutationFn: () => createBudgetVersion(projectId!), onSuccess: () => { setLines(null); void refresh(); }, onError });
	const save = useMutation({
		mutationFn: () => replaceBudgetLines(draft!.id, editing.map(({ accountId, period, amount }) => ({ accountId, period, amount }))),
		onSuccess: () => {
			toast.success(t('finance:budgets.saved'));
			setLines(null);
			void refresh();
		},
		onError,
	});
	const activate = useMutation({ mutationFn: () => activateBudget(draft!.id), onSuccess: () => { toast.success(t('finance:budgets.activated')); void refresh(); }, onError });
	const mode = useMutation({ mutationFn: (input: { id: string; mode: 'warn' | 'block' }) => setBudgetMode(input.id, input.mode), onSuccess: () => void refresh(), onError });
	const active = versions.data?.find((version) => version.status === 'active') ?? null;
	const update = (key: string, patch: Partial<TBudgetLine>) => setLines(editing.map((line) => (line.key === key ? { ...line, ...patch } : line)));

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('finance:budgets.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('finance:budgets.description')}</p>
			</div>
			<div className='w-96 max-w-full'>
				<ProjectSelect value={projectId} onChange={(next) => { setProjectId(next); setLines(null); }} />
			</div>
			{projectId && versions.data ? (
				<>
					<div className='flex flex-wrap items-center gap-2'>
						{versions.data.map((version) => (
							<Badge key={version.id} variant={version.status === 'active' ? 'default' : 'outline'}>
								v{version.version} · {t(`finance:budgets.status.${version.status}`)}
							</Badge>
						))}
						{canManage && !draft ? (
							<Button size='sm' variant='outline' disabled={create.isPending} onClick={() => create.mutate()}>
								<Plus className='size-4' data-icon='inline-start' />
								{t('finance:budgets.newVersion')}
							</Button>
						) : null}
						{active && canManage ? (
							<Select value={active.controlMode} onValueChange={(value: string | null) => value && mode.mutate({ id: active.id, mode: value as 'warn' | 'block' })}>
								<SelectTrigger className='w-56'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='warn'>{t('finance:budgets.mode.warn')}</SelectItem>
									<SelectItem value='block'>{t('finance:budgets.mode.block')}</SelectItem>
								</SelectContent>
							</Select>
						) : null}
					</div>

					{draft && canManage ? (
						<Card>
							<CardHeader>
								<CardTitle>{t('finance:budgets.draftTitle', { version: draft.version })}</CardTitle>
							</CardHeader>
							<CardContent className='space-y-2'>
							{editing.map((line) => (
								<div key={line.key} className='grid items-center gap-2 sm:grid-cols-[1fr_9rem_10rem_auto]'>
									<Select value={line.accountId || 'none'} onValueChange={(value: string | null) => update(line.key, { accountId: value && value !== 'none' ? value : '' })}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='none'>{t('finance:settlements.account')}</SelectItem>
											{(accounts.data?.rows ?? []).map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.code} — {account.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Input type='month' value={line.period} onChange={(event) => update(line.key, { period: event.target.value })} />
									<MoneyInput value={String(line.amount / 100)} onValueChange={(value) => update(line.key, { amount: toMinor(value) })} />
									<Button type='button' size='icon' variant='ghost' aria-label={t('finance:settlements.removeLine')} onClick={() => setLines(editing.filter((item) => item.key !== line.key))}>
										<Trash2 className='size-4' />
									</Button>
								</div>
							))}
							<div className='flex flex-wrap gap-2'>
								<Button
									size='sm'
									variant='outline'
									onClick={() => setLines([...editing, { key: String(Date.now()), accountId: '', period: new Date().toISOString().slice(0, 7), amount: 0 }])}
								>
									<Plus className='size-4' data-icon='inline-start' />
									{t('finance:settlements.addLine')}
								</Button>
								<Button size='sm' disabled={save.isPending || editing.some((line) => !line.accountId)} onClick={() => save.mutate()}>
									{t('common:action.save')}
								</Button>
								<Button size='sm' variant='secondary' disabled={activate.isPending || lines !== null} onClick={() => activate.mutate()}>
									{t('finance:budgets.activate')}
								</Button>
							</div>
							</CardContent>
						</Card>
					) : null}

					{report.data ? (
						<div className='space-y-3'>
							<div className='grid gap-3 sm:grid-cols-4'>
								{(['budget', 'actual', 'commitment', 'available'] as const).map((key) => (
									<Card key={key} size='sm' className='gap-0 py-3'>
										<CardContent>
										<p className='text-muted-foreground text-xs'>{t(`finance:budgets.total.${key}`)}</p>
										<p className={`text-lg font-semibold tabular-nums ${key === 'available' && report.data.totals.available < 0 ? 'text-destructive' : ''}`}>
											Rp {money(report.data.totals[key])}
										</p>
										</CardContent>
									</Card>
								))}
							</div>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('finance:budgets.period')}</TableHead>
										<TableHead>{t('finance:settlements.account')}</TableHead>
										<TableHead className='text-right'>{t('finance:budgets.total.budget')}</TableHead>
										<TableHead className='text-right'>{t('finance:budgets.total.actual')}</TableHead>
										<TableHead className='text-right'>{t('finance:budgets.variance')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{report.data.rows.map((row) => (
										<TableRow key={`${row.accountId}-${row.period}`}>
											<TableCell>{row.period}</TableCell>
											<TableCell>{accountName.get(row.accountId) ?? row.accountId}</TableCell>
											<TableCell className='text-right tabular-nums'>{money(row.budget)}</TableCell>
											<TableCell className='text-right tabular-nums'>{money(row.actual)}</TableCell>
											<TableCell className={`text-right tabular-nums ${row.budget - row.actual < 0 ? 'text-destructive' : ''}`}>{money(row.budget - row.actual)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : null}
				</>
			) : null}
		</div>
	);
}

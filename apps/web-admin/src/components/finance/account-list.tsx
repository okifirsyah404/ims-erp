import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Archive, Plus } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	ACCOUNT_TYPES,
	archiveAccount,
	accountsQueryOptions,
	createAccount,
	CASH_FLOW_CATEGORIES,
	type TAccountType,
	type TCashFlowCategory,
	updateAccount,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/accounts` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/accounts/');

const PAGE_SIZE = 20;

const typeKey = (t: TAccountType) => `finance:accountType.${t}` as const;
const categoryKey = (c: TCashFlowCategory) =>
	`finance:cashFlowCategory.${c}` as const;

/** Chart of accounts: CRUD-lite with archive (F2). */
export function AccountList() {
	const { t } = useTranslation(['finance', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const canCreate = usePermission('chart_of_account.create');
	const canUpdate = usePermission('chart_of_account.update');
	const canArchive = usePermission('chart_of_account.archive');

	const [type, setType] = useState<TAccountType | 'all'>('all');
	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const [normalBalance, setNormalBalance] = useState<'debit' | 'credit'>('debit');
	const [cashFlowCategory, setCashFlowCategory] = useState<string>('none');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...accountsQueryOptions({
			page,
			limit: PAGE_SIZE,
			accountType: type === 'all' ? undefined : type,
		}),
		placeholderData: (previous) => previous,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['accounts'] });

	const create = useMutation({
		mutationFn: () =>
			createAccount({
				code,
				name,
				accountType: type === 'all' ? 'asset' : type,
				normalBalance,
				cashFlowCategory: cashFlowCategory === 'none' ? null : (cashFlowCategory as TCashFlowCategory),
			}),
		onSuccess: async () => {
			toast.success(t('finance:accounts.created'));
			setCode('');
			setName('');
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const toggleActive = useMutation({
		mutationFn: (row: { id: string; isActive: boolean }) =>
			updateAccount(row.id, { isActive: !row.isActive }),
		onSuccess: async () => {
			toast.success(t('finance:accounts.updated'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const archive = useMutation({
		mutationFn: (id: string) => archiveAccount(id),
		onSuccess: async () => {
			toast.success(t('finance:accounts.archivedDone'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:accounts.title')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('finance:accounts.description')}
				</p>
			</div>

			{canCreate ? (
				<div className='flex flex-wrap items-end gap-2'>
					<div className='w-28'>
						<Input
							placeholder={t('finance:common.code')}
							value={code}
							onChange={(event) => setCode(event.target.value)}
						/>
					</div>
					<div className='w-56'>
						<Input
							placeholder={t('finance:common.name')}
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<Select
						value={type}
						onValueChange={(value) => setType(value as TAccountType | 'all')}
					>
						<SelectTrigger className='w-36'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{t('finance:common.all')}</SelectItem>
							{ACCOUNT_TYPES.map((accountType) => (
								<SelectItem key={accountType} value={accountType}>
									{t(typeKey(accountType))}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={normalBalance}
						onValueChange={(value) =>
							setNormalBalance(value as 'debit' | 'credit')
						}
					>
						<SelectTrigger className='w-32'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='debit'>
								{t('finance:normalBalance.debit')}
							</SelectItem>
							<SelectItem value='credit'>
								{t('finance:normalBalance.credit')}
							</SelectItem>
						</SelectContent>
					</Select>
					<Select value={cashFlowCategory} onValueChange={(value) => setCashFlowCategory(value ?? 'none')}>
						<SelectTrigger className='w-40'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>{t('finance:common.none')}</SelectItem>
							{CASH_FLOW_CATEGORIES.map((category) => (
								<SelectItem key={category} value={category}>
									{t(categoryKey(category))}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						size='sm'
						disabled={create.isPending || !code || !name}
						onClick={() => void create.mutateAsync()}
					>
						<Plus className='mr-1 size-4' />
						{create.isPending
							? t('finance:common.creating')
							: t('finance:accounts.create')}
					</Button>
				</div>
			) : null}

			{isPending ? null : isError ? (
				<EmptyState
					icon={Archive}
					title={error.message}
					className='border'
				/>
			) : (data?.rows.length ?? 0) === 0 ? (
				<EmptyState
					icon={Archive}
					title={t('finance:accounts.empty')}
					className='border'
				/>
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:common.code')}</TableHead>
								<TableHead>{t('finance:common.name')}</TableHead>
								<TableHead>{t('finance:accounts.type')}</TableHead>
								<TableHead>{t('finance:accounts.normalBalance')}</TableHead>
								<TableHead>{t('finance:accounts.cashFlowCategory')}</TableHead>
								<TableHead>{t('finance:common.status')}</TableHead>
								{canUpdate || canArchive ? (
									<TableHead className='text-right'>
										{t('finance:common.actions')}
									</TableHead>
								) : null}
							</TableRow>
						</TableHeader>
						<TableBody>
							{data?.rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className='font-mono text-xs'>{row.code}</TableCell>
									<TableCell>{row.name}</TableCell>
									<TableCell>{t(typeKey(row.accountType))}</TableCell>
									<TableCell>
										{t(
											row.normalBalance === 'debit'
												? 'finance:normalBalance.debit'
												: 'finance:normalBalance.credit',
										)}
									</TableCell>
									<TableCell>
										{row.cashFlowCategory
											? t(categoryKey(row.cashFlowCategory))
											: t('finance:common.none')}
									</TableCell>
									<TableCell>
										<Badge
											variant={row.isActive ? 'secondary' : 'outline'}
										>
											{row.isActive
												? t('finance:accounts.isActive')
												: t('finance:accounts.archived')}
										</Badge>
									</TableCell>
									{canUpdate || canArchive ? (
										<TableCell className='text-right'>
											{canUpdate ? (
												<Button
													variant='outline'
													size='sm'
													className='mr-1'
													disabled={toggleActive.isPending}
													onClick={() => void toggleActive.mutateAsync(row)}
												>
													{row.isActive
														? t('finance:accounts.archived')
														: t('finance:accounts.isActive')}
												</Button>
											) : null}
											{canArchive && row.isActive ? (
												<Button
													variant='ghost'
													size='sm'
													disabled={archive.isPending}
													onClick={() => {
														if (window.confirm(t('finance:accounts.archiveConfirm'))) {
															void archive.mutateAsync(row.id);
														}
													}}
												>
													<Archive className='size-4' />
												</Button>
											) : null}
										</TableCell>
									) : null}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<PaginationControls
				page={page}
				totalPages={data?.pagination.totalPages ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>
		</div>
	);
}

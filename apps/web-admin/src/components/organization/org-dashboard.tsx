import {
	Bar,
	BarChart,
	CartesianGrid,
	XAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@ims-erp/ui/components/chart';
import { Badge } from '@ims-erp/ui/components/badge';
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';

import {
	activities,
	cashAccounts,
	inventorySummary,
	profitAndLossByMonth,
	projects,
	roleCounts,
	salesByMonth,
	type TDashboardCashAccount,
} from '@/lib/org-dashboard-data';

const rupiah = (value: number) =>
	new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		maximumFractionDigits: 0,
	}).format(value);

const salesConfig = {
	sales: { color: 'var(--chart-1)' },
} satisfies ChartConfig;

const plConfig = {
	revenue: { color: 'var(--chart-2)' },
	expense: { color: 'var(--chart-3)' },
} satisfies ChartConfig;

function RolesCard() {
	const { t } = useTranslation('admin');
	const total = roleCounts.reduce((sum, role) => sum + role.count, 0);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('orgDashboard.roles.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				{roleCounts.map((role) => (
					<div key={role.role} className='flex items-center justify-between gap-2'>
						<span className='text-muted-foreground'>
							{t(`orgDashboard.roles.${role.role}`)}
						</span>
						<Badge variant='secondary'>{role.count}</Badge>
					</div>
				))}
				<div className='flex items-center justify-between gap-2 border-t pt-2 font-medium'>
					<span>{t('orgDashboard.roles.total')}</span>
					<span>{total}</span>
				</div>
			</CardContent>
		</Card>
	);
}

const projectStatusVariant = {
	planned: 'outline',
	in_progress: 'default',
	done: 'secondary',
	on_hold: 'destructive',
} as const;

function ProjectsCard() {
	const { t } = useTranslation('admin');
	return (
		<Card className='lg:col-span-2'>
			<CardHeader>
				<CardTitle>{t('orgDashboard.projects.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-3 text-sm'>
				{projects.map((project) => (
					<div key={project.name} className='flex flex-col gap-1'>
						<div className='flex items-center justify-between gap-2'>
							<span className='truncate'>{project.name}</span>
							<Badge variant={projectStatusVariant[project.status]}>
								{t(`orgDashboard.projects.status.${project.status}`)}
							</Badge>
						</div>
						<div className='h-1.5 w-full rounded-full bg-muted'>
							<div
								className='h-full rounded-full bg-primary'
								style={{ width: `${project.progress}%` }}
							/>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function SalesCard() {
	const { t } = useTranslation('admin');
	const total = salesByMonth.reduce((sum, row) => sum + row.sales, 0);
	return (
		<Card className='lg:col-span-2'>
			<CardHeader>
				<CardTitle>{t('orgDashboard.sales.title')}</CardTitle>
				<CardAction>
					<span className='text-sm font-medium tabular-nums'>
					{t('orgDashboard.sales.total6m', { total: rupiah(total) })}
				</span>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ChartContainer config={salesConfig} className='h-[180px] w-full'>
					<BarChart data={salesByMonth} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey='month'
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value: string) => value.slice(5)}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value) => rupiah(Number(value))}
								/>
							}
						/>
						<Bar dataKey='sales' fill='var(--color-sales)' radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function InventoryCard() {
	const { t } = useTranslation('admin');
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('orgDashboard.inventory.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				<div className='flex justify-between'>
					<span className='text-muted-foreground'>{t('orgDashboard.inventory.totalItems')}</span>
					<span className='font-medium tabular-nums'>{inventorySummary.totalItems}</span>
				</div>
				<div className='flex justify-between'>
					<span className='text-muted-foreground'>{t('orgDashboard.inventory.totalValue')}</span>
					<span className='font-medium tabular-nums'>{rupiah(inventorySummary.totalValue)}</span>
				</div>
				<p className='border-t pt-2 font-medium'>{t('orgDashboard.inventory.lowStock')}</p>
				{inventorySummary.lowStock.map((item) => (
					<div key={item.name} className='flex items-center justify-between gap-2'>
						<span className='truncate'>{item.name}</span>
						<Badge variant='destructive'>
							{t('orgDashboard.inventory.qtyOf', {
								quantity: item.quantity,
								min: item.minQuantity,
							})}
						</Badge>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function ActivityCard() {
	const { t } = useTranslation('admin');
	return (
		<Card className='lg:col-span-3'>
			<CardHeader>
				<CardTitle>{t('orgDashboard.activity.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				{activities.map((activity, index) => (
					<div key={index} className='flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0'>
						<span>
							<span className='font-medium'>{activity.actor}</span>{' '}
							{t(`orgDashboard.activity.actions.${activity.action}`)}
						</span>
						<span className='text-muted-foreground'>
							{activity.target} · {new Date(activity.at).toLocaleString()}
						</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function ProfitLossCard() {
	const { t } = useTranslation('admin');
	const revenue = profitAndLossByMonth.reduce((sum, row) => sum + row.revenue, 0);
	const expense = profitAndLossByMonth.reduce((sum, row) => sum + row.expense, 0);
	return (
		<Card className='lg:col-span-2'>
			<CardHeader>
				<CardTitle>{t('orgDashboard.pl.title')}</CardTitle>
				<CardAction>
					<span className='text-sm font-medium tabular-nums'>
					{t('orgDashboard.pl.net', { net: rupiah(revenue - expense) })}
				</span>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ChartContainer config={plConfig} className='h-[200px] w-full'>
					<BarChart data={profitAndLossByMonth} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey='month'
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value: string) => value.slice(5)}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value) => rupiah(Number(value))}
								/>
							}
						/>
						<Bar dataKey='revenue' fill='var(--color-revenue)' radius={4} />
						<Bar dataKey='expense' fill='var(--color-expense)' radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function CashBankCard() {
	const { t } = useTranslation('admin');
	const total = cashAccounts.reduce((sum, account) => sum + account.balance, 0);
	const renderAccount = (account: TDashboardCashAccount) => (
		<div key={account.name} className='flex items-center justify-between gap-2'>
			<span className='flex items-center gap-2 truncate'>
				<Badge variant={account.type === 'bank' ? 'default' : 'outline'}>
					{t(`orgDashboard.cash.${account.type}`)}
				</Badge>
				<span className='truncate'>{account.name}</span>
			</span>
			<span className='shrink-0 tabular-nums'>{rupiah(account.balance)}</span>
		</div>
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('orgDashboard.cash.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				{cashAccounts.filter((a) => a.type === 'bank').map(renderAccount)}
				{cashAccounts.filter((a) => a.type === 'cash').map(renderAccount)}
				<div className='flex items-center justify-between gap-2 border-t pt-2 font-medium'>
					<span>{t('orgDashboard.cash.total')}</span>
					<span className='tabular-nums'>{rupiah(total)}</span>
				</div>
			</CardContent>
		</Card>
	);
}

/** Dummy dashboard shown on the organization info tab. */
export function OrganizationDashboard({
	name,
	slug,
	description,
	createdAt,
}: {
	name: string;
	slug: string;
	/** Free-text description; the card renders `-` when unset. */
	description: string | null;
	createdAt: Date;
}) {
	const { t } = useTranslation('admin');
	return (
		<div className='grid gap-4 lg:grid-cols-3'>
			<Card className='lg:col-span-3'>
				<CardHeader>
					<CardTitle>{t('orgDetail.details')}</CardTitle>
				</CardHeader>
				<CardContent className='grid grid-cols-[140px_1fr] gap-2 text-sm'>
					<span className='text-muted-foreground'>{t('orgDetail.name')}</span>
					<span>{name}</span>
					<span className='text-muted-foreground'>{t('orgDetail.code')}</span>
					<span>{slug}</span>
					<span className='text-muted-foreground'>
						{t('orgDetail.description')}
					</span>
					{/* Newlines are preserved: the field is free text. */}
					<span className='whitespace-pre-line'>{description || '-'}</span>
					<span className='text-muted-foreground'>{t('orgDetail.created')}</span>
					<span>{createdAt.toLocaleString()}</span>
				</CardContent>
			</Card>
			<RolesCard />
			<ProjectsCard />
			<SalesCard />
			<InventoryCard />
			<ActivityCard />
			<ProfitLossCard />
			<CashBankCard />
		</div>
	);
}

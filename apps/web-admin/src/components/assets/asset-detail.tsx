import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { CircleAlert, Wrench } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@/components/empty-state';
import {
	assetDetailQueryOptions,
	formatMoney,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Asset detail (Phase A-4): stats, meta, and history sections
 * (custody, movements, condition checks, service records, depreciation,
 * documents). Actions: assign, return, deactivate/reactivate, dispose.
 */
export function AssetDetail({ assetId }: { assetId: string }) {
	const { t } = useTranslation(['assets', 'common']);
	const canUpdate = usePermission('asset.update');
	const canAssign = usePermission('asset.assign');
	const canDispose = usePermission('asset.dispose');

	const { data, isPending, isError, error } = useQuery({
		...assetDetailQueryOptions(assetId),
		placeholderData: (previous) => previous,
	});

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:detail.title')}
				description={error.message}
			/>
		);
	}

	if (isPending || !data) {
		return (
			<Card className='animate-pulse'>
				<CardHeader>
					<CardTitle className='h-6 w-1/3 rounded bg-muted' />
				</CardHeader>
				<CardContent className='h-40 rounded bg-muted' />
			</Card>
		);
	}

	const { asset, history } = data;

	return (
		<div className='space-y-6'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>{asset.name}</h1>
					<p className='font-mono text-xs text-muted-foreground'>
						{asset.code}
					</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{canAssign && asset.status === 'in_stock' ? (
						<Button render={<Link to='/assets/loans' />} variant='outline'>
							{t('assets:detail.assign')}
						</Button>
					) : null}
					{canUpdate && asset.status !== 'inactive' && asset.deletedAt === null ? (
						<Button
							render={<Link to='/assets/register' />}
							variant='outline'
						>
							{t('assets:detail.deactivate')}
						</Button>
					) : null}
					{canDispose && asset.status !== 'disposed' && asset.deletedAt === null ? (
						<Button render={<Link to='/assets/disposals' />} variant='outline'>
							{t('assets:detail.dispose')}
						</Button>
					) : null}
				</div>
			</div>

			<div className='grid gap-4 sm:grid-cols-3'>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>
							{t('assets:register.status')}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Badge variant='secondary'>
							{t(`assets:status.${asset.status}`)}
						</Badge>
						{asset.status === 'inactive' && asset.deactivationReason ? (
							<p className='mt-2 text-xs text-muted-foreground'>
								{asset.deactivationReason}
							</p>
						) : null}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>
							{t('assets:register.bookValue')}
						</CardTitle>
					</CardHeader>
					<CardContent className='text-lg font-semibold'>
						{formatMoney(asset.bookValue, asset.currencyCode)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>
							{t('assets:register.condition')}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{t(`assets:condition.${asset.condition}`)}
					</CardContent>
				</Card>
			</div>

			{/* History sections ------------------------------------------- */}
			<div className='grid gap-6 lg:grid-cols-2'>
				<HistorySection
					title={t('assets:detail.custody')}
					empty={t('assets:detail.noHistory')}
					rows={history.assignments.map((assignment) => ({
						id: assignment.id,
						left:
							assignment.assignedToUserId ?? assignment.assignedToEmployeeId ?? '—',
						right: assignment.returnedAt
							? `${t('assets:detail.returnedAt')}: ${assignment.returnedAt}`
							: t('assets:loans.open'),
					}))}
				/>
				<HistorySection
					title={t('assets:detail.movements')}
					empty={t('assets:detail.noHistory')}
					rows={history.movements.map((movement) => ({
						id: movement.id,
						left: movement.movementType,
						right: movement.toLocation ?? '—',
					}))}
				/>
				<HistorySection
					title={t('assets:detail.conditionChecks')}
					empty={t('assets:detail.noHistory')}
					rows={history.conditionChecks.map((check) => ({
						id: check.id,
						left: `${check.checkDate} · ${t(`assets:condition.${check.condition}`)}`,
						right: check.findings ?? '—',
					}))}
				/>
				<HistorySection
					title={t('assets:detail.maintenances')}
					empty={t('assets:detail.noHistory')}
					rows={history.maintenances.map((maintenance) => ({
						id: maintenance.id,
						left: `${maintenance.code} · ${t(`assets:maintenanceType.${maintenance.maintenanceType}`)}`,
						right: formatMoney(maintenance.cost, maintenance.currencyCode),
					}))}
				/>
				<HistorySection
					title={t('assets:detail.depreciations')}
					empty={t('assets:detail.noHistory')}
					rows={history.depreciations.map((entry) => ({
						id: entry.id,
						left: `${entry.periodYear}-${String(entry.periodMonth).padStart(2, '0')}`,
						right: formatMoney(entry.depreciationAmount, entry.currencyCode),
					}))}
				/>
				<HistorySection
					title={t('assets:detail.documents')}
					empty={t('assets:detail.noHistory')}
					rows={history.documents.map((document) => ({
						id: document.id,
						left: document.documentType,
						right: document.documentId,
					}))}
				/>
			</div>
			<Wrench className='hidden' />
		</div>
	);
}

/** A titled list of two-column history rows. */
function HistorySection({
	title,
	empty,
	rows,
}: {
	title: string;
	empty: string;
	rows: Array<{ id: string; left: string; right: string }>;
}) {
	return (
		<Card>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm'>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className='text-sm text-muted-foreground'>{empty}</p>
				) : (
					<ul className='space-y-1 text-sm'>
						{rows.map((row) => (
							<li
								key={row.id}
								className='flex items-center justify-between gap-2 border-b py-1 last:border-b-0'
							>
								<span>{row.left}</span>
								<span className='text-muted-foreground'>{row.right}</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { formatDateTime } from '@/lib/format';
import type { TLicenseEvent } from '@/lib/license-api';

const PASSED = new Set(['ok', 'grace']);

type TResult = 'ok' | 'grace' | 'unknown' | 'expired' | 'not_started' | 'suspended' | 'terminated' | 'revoked' | 'seat_limit' | 'not_activated';

/** The license event log: API calls from applications and staff overrides. */
export function EventTable({ events, showContract }: { events: TLicenseEvent[]; showContract: boolean }) {
	const { t, i18n } = useTranslation(['licensing', 'common']);

	const columns = useMemo<ColumnDef<DataTableFeatures, TLicenseEvent, CellData>[]>(() => {
		const contractColumn: ColumnDef<DataTableFeatures, TLicenseEvent, CellData>[] = showContract
			? [
					{
						id: 'contract',
						header: t('licensing:events.contract'),
						cell: ({ row }) => (
							<>
								{row.original.licenseContractId ? (
									<Link
										to='/subscription/$contractId'
										params={{ contractId: row.original.licenseContractId }}
										className='hover:underline'
									>
										{row.original.contractCode}
									</Link>
								) : (
									'—'
								)}
								{row.original.customerName && (
									<div className='text-xs text-muted-foreground'>{row.original.customerName}</div>
								)}
							</>
						),
					},
				]
			: [];
		return [
			{
				id: 'at',
				header: t('licensing:events.at'),
				meta: { cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => formatDateTime(row.original.eventAt, i18n.language),
			},
			{
				id: 'type',
				header: t('licensing:events.type'),
				cell: ({ row }) => t(`licensing:events.kind.${row.original.eventType}`),
			},
			{
				id: 'result',
				header: t('licensing:events.result'),
				cell: ({ row }) => (
					<Badge
						variant={
							PASSED.has(row.original.result)
								? row.original.result === 'grace'
									? 'secondary'
									: 'default'
								: 'destructive'
						}
					>
						{t(`licensing:result.${row.original.result as TResult}`)}
					</Badge>
				),
			},
			...contractColumn,
			{
				id: 'source',
				header: t('licensing:events.source'),
				cell: ({ row }) =>
					row.original.applicationApiKeyId
						? t('licensing:events.byApplication')
						: t('licensing:events.byStaff'),
			},
			{
				id: 'detail',
				header: t('licensing:events.detail'),
				meta: { cellClassName: 'max-w-80 text-sm' },
				cell: ({ row }) => (
					<>
						{row.original.instanceId && <code className='font-mono text-xs'>{row.original.instanceId}</code>}
						{row.original.ipAddress && (
							<span className='ml-2 text-xs text-muted-foreground'>{row.original.ipAddress}</span>
						)}
						{row.original.description && (
							<div className='text-xs text-muted-foreground'>{row.original.description}</div>
						)}
					</>
				),
			},
		];
	}, [i18n.language, showContract, t]);

	return <DataTable columns={columns} data={events} getRowId={(row) => row.id} />;
}

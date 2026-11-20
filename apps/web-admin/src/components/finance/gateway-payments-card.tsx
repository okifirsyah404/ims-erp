import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { EmptyState } from '@/components/empty-state';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { toast } from '@/components/toast';
import { formatDateTime, formatIdr } from '@/lib/format';
import {
	GATEWAY_STATUS_VARIANT,
	gatewayPaymentsQueryOptions,
	gatewayStatusQueryOptions,
	openGatewayPayment,
	type TGatewayPayment,
} from '@/lib/invoice-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Online payment of one invoice (ERP-0020): the checkout links opened at the
 * payment gateway and their state. Staff send the link to the customer; the
 * receipt appears by itself once the provider confirms the payment.
 */
export function GatewayPaymentsCard({ invoiceId, payable }: { invoiceId: string; payable: boolean }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canReceive = usePermission('receipt.create');
	const [busy, setBusy] = useState(false);
	const { data: gateway } = useQuery(gatewayStatusQueryOptions());
	const { data: rows } = useQuery(gatewayPaymentsQueryOptions(invoiceId));
	if (!gateway || !rows || (!gateway.enabled && rows.length === 0)) return null;

	async function open() {
		setBusy(true);
		try {
			const row = await openGatewayPayment(invoiceId);
			await queryClient.invalidateQueries({ queryKey: ['finance', 'invoices', invoiceId, 'gateway-payments'] });
			if (row.paymentUrl) await copy(row.paymentUrl);
			else toast.success(t('finance:gateway.opened'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	}

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			toast.success(t('finance:gateway.copied'));
		} catch {
			toast.error(t('common:error.failed'));
		}
	}

	const note = (row: TGatewayPayment) =>
		row.status === 'paid' && !row.receiptId ? t('finance:gateway.unapplied') : row.receiptId ? t('finance:gateway.receipted') : null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('finance:gateway.title')}</CardTitle>
				{gateway.enabled && payable && canReceive && (
					<CardAction>
						<Button size='sm' disabled={busy} onClick={() => void open()}>
							{t('finance:gateway.open')}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent className='p-0'>
				{rows.length === 0 ? (
					<EmptyState title={t('finance:gateway.empty')} size='sm' />
				) : (
					<GatewayPaymentsTable rows={rows} note={note} onCopy={(url) => void copy(url)} />
				)}
			</CardContent>
		</Card>
	);
}

/** The checkout-link table of one invoice. */
function GatewayPaymentsTable({
	rows,
	note,
	onCopy,
}: {
	rows: TGatewayPayment[];
	note: (row: TGatewayPayment) => string | null;
	onCopy: (url: string) => void;
}) {
	const { t, i18n } = useTranslation(['finance', 'common']);

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TGatewayPayment, CellData>[]
	>(
		() => [
			{
				id: 'created',
				header: t('finance:gateway.created'),
				cell: ({ row }) => formatDateTime(row.original.createdAt, i18n.language),
			},
			{
				id: 'provider',
				header: t('finance:gateway.provider'),
				meta: { cellClassName: 'capitalize' },
				cell: ({ row }) => (
					<>
						{row.original.provider}
						{row.original.paymentChannel ? ` · ${row.original.paymentChannel}` : ''}
					</>
				),
			},
			{
				id: 'amount',
				header: t('finance:receipt.amount'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.paidAmount ?? row.original.amount),
			},
			{
				id: 'status',
				header: t('finance:invoice.status'),
				cell: ({ row }) => (
					<>
						<Badge variant={GATEWAY_STATUS_VARIANT[row.original.status]}>
							{t(`finance:gateway.status.${row.original.status}`)}
						</Badge>
						{note(row.original) && (
							<div className='mt-1 text-xs text-muted-foreground'>{note(row.original)}</div>
						)}
					</>
				),
			},
			{
				id: 'expires',
				header: t('finance:gateway.expires'),
				cell: ({ row }) =>
					row.original.status === 'pending'
						? formatDateTime(row.original.expiresAt, i18n.language)
						: '—',
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) => {
					const url = row.original.paymentUrl;
					return row.original.status === 'pending' && url ? (
						<div className='flex justify-end gap-1'>
							<Button variant='ghost' size='sm' onClick={() => onCopy(url)}>
								{t('finance:gateway.copy')}
							</Button>
							<Button
								variant='ghost'
								size='sm'
								render={<a href={url} target='_blank' rel='noreferrer' />}
								nativeButton={false}
							>
								{t('finance:gateway.visit')}
							</Button>
						</div>
					) : null;
				},
			},
		],
		[i18n.language, note, onCopy, t],
	);

	return <DataTable columns={columns} data={rows} getRowId={(row) => row.id} />;
}

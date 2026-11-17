import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
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
	const { t, i18n } = useTranslation(['finance', 'common']);
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
			<CardHeader className='flex flex-row items-center justify-between gap-2'>
				<CardTitle>{t('finance:gateway.title')}</CardTitle>
				{gateway.enabled && payable && canReceive && (
					<Button size='sm' disabled={busy} onClick={() => void open()}>
						{t('finance:gateway.open')}
					</Button>
				)}
			</CardHeader>
			<CardContent className='p-0'>
				{rows.length === 0 ? (
					<p className='p-4 text-sm text-muted-foreground'>{t('finance:gateway.empty')}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('finance:gateway.created')}</TableHead>
								<TableHead>{t('finance:gateway.provider')}</TableHead>
								<TableHead className='text-right'>{t('finance:receipt.amount')}</TableHead>
								<TableHead>{t('finance:invoice.status')}</TableHead>
								<TableHead>{t('finance:gateway.expires')}</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell>{formatDateTime(row.createdAt, i18n.language)}</TableCell>
									<TableCell className='capitalize'>
										{row.provider}
										{row.paymentChannel ? ` · ${row.paymentChannel}` : ''}
									</TableCell>
									<TableCell className='text-right'>{formatIdr(row.paidAmount ?? row.amount)}</TableCell>
									<TableCell>
										<Badge variant={GATEWAY_STATUS_VARIANT[row.status]}>{t(`finance:gateway.status.${row.status}`)}</Badge>
										{note(row) && <div className='mt-1 text-xs text-muted-foreground'>{note(row)}</div>}
									</TableCell>
									<TableCell>{row.status === 'pending' ? formatDateTime(row.expiresAt, i18n.language) : '—'}</TableCell>
									<TableCell className='text-right'>
										{row.status === 'pending' && row.paymentUrl && (
											<div className='flex justify-end gap-1'>
												<Button variant='ghost' size='sm' onClick={() => void copy(row.paymentUrl!)}>
													{t('finance:gateway.copy')}
												</Button>
												<Button
													variant='ghost'
													size='sm'
													render={<a href={row.paymentUrl} target='_blank' rel='noreferrer' />}
													nativeButton={false}
												>
													{t('finance:gateway.visit')}
												</Button>
											</div>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

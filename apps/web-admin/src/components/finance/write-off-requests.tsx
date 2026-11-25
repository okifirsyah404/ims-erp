import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { writeOffRequestsQueryOptions } from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

/** Pending write-off requests, for the approver to open each invoice (ERP-0135). */
export function WriteOffRequests() {
	const { t } = useTranslation(['finance', 'common']);
	const canSee = usePermission('ar_write_off.read');
	const { data } = useQuery({ ...writeOffRequestsQueryOptions(), enabled: canSee });
	if (!canSee || (data?.length ?? 0) === 0) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('finance:adjustments.pendingWriteOffs')}</CardTitle>
			</CardHeader>
			<CardContent className='space-y-2 text-sm'>
				{data?.map((item) => (
					<div key={item.id} className='flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0'>
						<span>
							{(item.outstandingAmount / 100).toLocaleString()} · {item.writeOffReason}
						</span>
						{item.invoiceId ? (
							<Link to='/sales/invoices/$invoiceId' params={{ invoiceId: item.invoiceId }} className='hover:underline'>
								{t('finance:adjustments.openInvoice')}
							</Link>
						) : null}
					</div>
				))}
			</CardContent>
		</Card>
	);
}

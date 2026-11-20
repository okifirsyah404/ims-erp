import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { PaymentGatewaysPanel } from '@/components/settings/payment-gateways';
import { usePermission } from '@/lib/use-permission';

/**
 * `/settings/payment-gateways` — online payment providers and their write-only
 * secrets. The backend gates the list on `payment_gateway:read` and changes on
 * `payment_gateway:update`.
 */
export const Route = createFileRoute('/_authed/settings/payment-gateways/')({
	component: PaymentGatewaysPage,
});

function PaymentGatewaysPage() {
	const { t } = useTranslation(['settings']);
	const canRead = usePermission('payment_gateway.read');
	const canEdit = usePermission('payment_gateway.update');

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('settings:paymentGateways.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('settings:paymentGateways.description')}</p>
			</div>
			{canRead ? (
				<PaymentGatewaysPanel canEdit={canEdit} />
			) : (
				<Alert>
					<AlertDescription>{t('settings:paymentGateways.noAccess')}</AlertDescription>
				</Alert>
			)}
		</div>
	);
}

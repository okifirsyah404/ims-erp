import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { StockMovementForm } from '@/components/inventory/stock-movement-form';

/**
 * `/inventory/stock/receive` - manual stock receipt (B-29, KF-G1): stock that
 * comes in outside a purchase order, e.g. material back from a project site.
 *
 * @remarks
 * Gated server-side on `stock:receive`; the menu entry is hidden without it.
 */
export const Route = createFileRoute('/_authed/inventory/stock/receive')({
	component: ReceiveStockPage,
});

function ReceiveStockPage() {
	const { t } = useTranslation('inventory');
	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('manualStock.receiveTitle')}</h1>
				{/* RF-29: one sentence under the title saying what the page is for. */}
				<p className='text-sm text-muted-foreground'>{t('manualStock.receiveDescription')}</p>
			</div>
			<StockMovementForm kind='receipt' />
		</div>
	);
}

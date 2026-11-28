import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { StockMovementForm } from '@/components/inventory/stock-movement-form';

/**
 * `/inventory/stock/issue` - manual stock issue (B-29, KF-G1): material taken
 * out for a project (counted as project material cost) or for own use.
 *
 * @remarks
 * Gated server-side on `stock:issue`; the menu entry is hidden without it.
 */
export const Route = createFileRoute('/_authed/inventory/stock/issue')({
	component: IssueStockPage,
});

function IssueStockPage() {
	const { t } = useTranslation('inventory');
	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('manualStock.issueTitle')}</h1>
				{/* RF-29: one sentence under the title saying what the page is for. */}
				<p className='text-sm text-muted-foreground'>{t('manualStock.issueDescription')}</p>
			</div>
			<StockMovementForm kind='issue' />
		</div>
	);
}

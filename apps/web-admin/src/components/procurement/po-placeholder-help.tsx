import { useTranslation } from 'react-i18next';

import type { NamespaceKey } from '@ims-erp/locales';

/** Label keys of the placeholders (no interpolation, unlike `placeholders.hint`). */
type TPlaceholderLabelKey = Exclude<Extract<NamespaceKey<'procurement'>, `placeholders.${string}`>, 'placeholders.hint'>;

/**
 * The `{{placeholders}}` purchase order terms and notes may hold (ERP-0165),
 * as a collapsible reference next to the text fields.
 *
 * @remarks
 * The names are the ones `@ims-erp/common` resolves on print and the backend
 * validates on save; keep this list in step with `PO_PLACEHOLDERS` and
 * `PO_PERCENT_PLACEHOLDERS`.
 */
const PLACEHOLDERS: { token: string; labelKey: TPlaceholderLabelKey }[] = [
	{ token: '{{grand_total}}', labelKey: 'placeholders.grandTotal' },
	{ token: '{{grand_total_pct:N}}', labelKey: 'placeholders.grandTotalPct' },
	{ token: '{{grand_total_rest:N}}', labelKey: 'placeholders.grandTotalRest' },
	{ token: '{{subtotal}}', labelKey: 'placeholders.subtotal' },
	{ token: '{{tax_total}}', labelKey: 'placeholders.taxTotal' },
	{ token: '{{vat_rate}}', labelKey: 'placeholders.vatRate' },
	{ token: '{{po_number}}', labelKey: 'placeholders.poNumber' },
	{ token: '{{order_date}}', labelKey: 'placeholders.orderDate' },
	{ token: '{{expected_delivery_date}}', labelKey: 'placeholders.expectedDeliveryDate' },
	{ token: '{{subject}}', labelKey: 'placeholders.subject' },
	{ token: '{{supplier_name}}', labelKey: 'placeholders.supplierName' },
	{ token: '{{supplier_quote_ref}}', labelKey: 'placeholders.supplierQuoteRef' },
	{ token: '{{supplier_quote_date}}', labelKey: 'placeholders.supplierQuoteDate' },
	{ token: '{{project_name}}', labelKey: 'placeholders.projectName' },
	{ token: '{{buyer_pic}}', labelKey: 'placeholders.buyerPic' },
	{ token: '{{company_name}}', labelKey: 'placeholders.companyName' },
];

export function PoPlaceholderHelp() {
	const { t } = useTranslation('procurement');
	return (
		<details className='rounded-md border bg-muted/30 px-3 py-2 text-sm sm:col-span-2'>
			<summary className='cursor-pointer font-medium'>{t('placeholders.title')}</summary>
			<p className='mt-2 text-muted-foreground'>{t('placeholders.hint', { example: '{{grand_total_pct:50}}' })}</p>
			<dl className='mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]'>
				{PLACEHOLDERS.map(({ token, labelKey }) => (
					<div key={token} className='contents'>
						<dt>
							<code className='rounded bg-background px-1 py-0.5 text-xs'>{token}</code>
						</dt>
						<dd className='text-muted-foreground'>{t(labelKey)}</dd>
					</div>
				))}
			</dl>
			<p className='mt-2 text-xs text-muted-foreground'>{t('placeholders.percentHint')}</p>
		</details>
	);
}

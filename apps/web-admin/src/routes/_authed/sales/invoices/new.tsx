import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { InvoiceForm, type TInvoiceFormInitial } from '@/components/sales/invoice-form';
import { toast } from '@/components/toast';
import { ticketQueryOptions } from '@/lib/service-ticket-api';

/**
 * `/sales/invoices/new` - invoice without a sales order (B-42, KF-S6):
 * services, extra costs, license renewals.
 *
 * @remarks
 * `?ticketId=` prefills the customer and one "service" line from a paid
 * ticket (B-31 links here). Gated server-side on `invoice:create`.
 */
export const Route = createFileRoute('/_authed/sales/invoices/new')({
	validateSearch: z.object({ ticketId: z.uuid().optional() }),
	component: NewInvoicePage,
});

function NewInvoicePage() {
	const { t } = useTranslation(['sales', 'finance']);
	const navigate = useNavigate();
	const { ticketId } = Route.useSearch();
	const ticket = useQuery({ ...ticketQueryOptions(ticketId ?? ''), enabled: Boolean(ticketId) });

	if (ticketId && ticket.isPending) return null;
	const source = ticketId ? ticket.data : undefined;
	const initial: TInvoiceFormInitial | undefined = source
		? {
				customer: source.customerId ? { id: source.customerId, code: '', name: source.customerName } : null,
				title: t('sales:freeInvoice.ticketTitle', { code: source.code }),
				lines: [
					{
						description: t('sales:freeInvoice.ticketLine', { code: source.code, device: source.deviceDescription ?? '' }).trim(),
						quantity: 1,
						unitPriceMinor: source.serviceCost,
					},
				],
			}
		: undefined;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<Link to='/sales/invoices' className='text-sm text-muted-foreground hover:underline'>
					{t('finance:invoices.back')}
				</Link>
				<h1 className='text-2xl font-bold'>{t('sales:freeInvoice.pageTitle')}</h1>
				{/* RF-29: one sentence under the title saying what the page is for. */}
				<p className='text-sm text-muted-foreground'>{t('sales:freeInvoice.pageDescription')}</p>
			</div>
			<InvoiceForm
				initial={initial}
				onCreated={(invoice) => {
					toast.success(t('sales:freeInvoice.created', { code: invoice.code ?? '' }));
					void navigate({ to: '/sales/invoices/$invoiceId', params: { invoiceId: invoice.id } });
				}}
			/>
		</div>
	);
}

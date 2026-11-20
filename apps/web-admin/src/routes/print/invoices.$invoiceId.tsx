import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { InvoiceDocument } from '@/components/finance/invoice-document';
import { RenderReady } from '@/components/print/render-ready';
import { invoiceRenderQueryOptions } from '@/lib/print-render-api';

/**
 * `/print/invoices/$invoiceId?org=…&token=…` — the invoice exactly as the staff print page
 * shows it, for the backend's PDF renderer (customer portal downloads, ERP-0079). Public:
 * the render token is the only credential (no session, no app shell).
 */
export const Route = createFileRoute('/print/invoices/$invoiceId')({
	validateSearch: z.object({ org: z.string().min(1), token: z.string().min(1) }),
	component: InvoiceRenderPage,
});

function InvoiceRenderPage() {
	const { invoiceId } = Route.useParams();
	const { org, token } = Route.useSearch();
	const render = useQuery(invoiceRenderQueryOptions(invoiceId, org, token));

	if (render.isError) return <p className='p-8 text-sm text-destructive'>{render.error.message}</p>;
	if (!render.data) return null;
	return (
		<RenderReady>
			<div className='p-12'>
				<InvoiceDocument invoice={render.data.invoice} profile={render.data.profile} />
			</div>
		</RenderReady>
	);
}

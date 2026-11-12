import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DeliveryNoteDocument } from '@/components/sales/delivery-note-document';
import { companyProfileQueryOptions } from '@/lib/company-api';
import { deliveryNoteQueryOptions } from '@/lib/delivery-note-api';

/** `/sales/deliveries/$deliveryNoteId/print` — the printable surat jalan. */
export const Route = createFileRoute('/_authed/sales/deliveries/$deliveryNoteId/print')({
	component: PrintDeliveryNotePage,
});

function PrintDeliveryNotePage() {
	const { t } = useTranslation(['sales', 'common']);
	const { deliveryNoteId } = Route.useParams();
	const note = useQuery(deliveryNoteQueryOptions(deliveryNoteId));
	const profile = useQuery(companyProfileQueryOptions());

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex justify-between gap-2 print:hidden'>
				<Button
					variant='outline'
					render={<Link to='/sales/deliveries/$deliveryNoteId' params={{ deliveryNoteId }} />}
					nativeButton={false}
				>
					{t('sales:deliveries.backToNote')}
				</Button>
				<Button onClick={() => window.print()} disabled={!note.data}>
					{t('sales:deliveries.print')}
				</Button>
			</div>
			{note.isError ? (
				<p className='text-sm text-destructive'>{note.error.message}</p>
			) : note.data && !profile.isPending ? (
				<div className='mx-auto w-full max-w-4xl rounded-md border p-12 print:max-w-none print:border-0 print:p-0'>
					<DeliveryNoteDocument note={note.data} profile={profile.data} />
				</div>
			) : null}
		</div>
	);
}

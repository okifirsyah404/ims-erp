import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { todayBusinessDate } from '@/lib/format';
import type { TSalesOrderInput } from '@/lib/sales-order-api';

/** Turns an approved or sent SPH into a sales order (the SPH becomes Deal). */
export function CreateOrderDialog({
	quotationId,
	submitting,
	onClose,
	onSave,
}: {
	quotationId: string;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TSalesOrderInput) => void;
}) {
	const { t } = useTranslation(['sales', 'common']);
	const [customerPoNumber, setCustomerPoNumber] = useState('');
	const [orderDate, setOrderDate] = useState(todayBusinessDate());
	const [deliveryDate, setDeliveryDate] = useState('');
	const [notes, setNotes] = useState('');

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							quotationId,
							customerPoNumber: customerPoNumber.trim() || null,
							orderDate,
							deliveryDate: deliveryDate || null,
							notes: notes.trim() || null,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('sales:orders.new')}</DialogTitle>
					</DialogHeader>
					<p className='pt-2 text-sm text-muted-foreground'>{t('sales:orders.newHint')}</p>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='order-po' optional>{t('sales:order.customerPo')}</FieldLabel>
							<Input
								id='order-po'
								maxLength={100}
								value={customerPoNumber}
								onChange={(e) => setCustomerPoNumber(e.target.value)}
							/>
							<FieldDescription>{t('sales:order.customerPoHint')}</FieldDescription>
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='order-date'>{t('sales:order.date')}</FieldLabel>
								<DatePicker
									id='order-date'
									required
									value={orderDate}
									onChange={setOrderDate}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='order-delivery' optional>{t('sales:order.deliveryDate')}</FieldLabel>
								<DatePicker
									id='order-delivery'
									min={orderDate}
									value={deliveryDate}
									onChange={setDeliveryDate}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='order-notes' optional>{t('sales:quotation.notes')}</FieldLabel>
							<Textarea id='order-notes' maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{t('sales:orders.create')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

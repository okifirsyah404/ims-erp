import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { customersQueryOptions } from '@/lib/customer-api';
import { minorToRupiah, rupiahToMinor } from '@/lib/format';
import { applicationsQueryOptions, BILLING_CYCLES, type TBillingCycle, type TContractInput, type TLicenseContract } from '@/lib/license-api';
import { salesOrdersQueryOptions } from '@/lib/sales-order-api';

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

/**
 * The draft contract form (new and edit). Customers are the active ones;
 * applications the active ones (plus the draft's own); sales orders are
 * narrowed to the picked customer.
 */
export function ContractForm({
	initial,
	submitLabel,
	onSubmit,
	onCancel,
}: {
	initial?: TLicenseContract;
	submitLabel: string;
	onSubmit: (input: TContractInput) => Promise<void>;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['licensing', 'common']);
	const customers = useQuery(customersQueryOptions({ limit: 100, status: 'active' }));
	const applications = useQuery(applicationsQueryOptions(true));
	const orders = useQuery(salesOrdersQueryOptions({ limit: 100 }));
	const [customerId, setCustomerId] = useState(initial?.customerId ?? '');
	const [applicationId, setApplicationId] = useState(initial?.licensableApplicationId ?? '');
	const [packageName, setPackageName] = useState(initial?.packageName ?? '');
	const [salesOrderId, setSalesOrderId] = useState(initial?.salesOrderId ?? '');
	const [startDate, setStartDate] = useState(initial?.startDate ?? '');
	const [endDate, setEndDate] = useState(initial?.endDate ?? '');
	const [billingCycle, setBillingCycle] = useState<TBillingCycle>(initial?.billingCycle ?? 'annual');
	const [value, setValue] = useState(initial ? minorToRupiah(initial.contractValue) : '');
	const [notes, setNotes] = useState(initial?.notes ?? '');
	const [busy, setBusy] = useState(false);

	const pickable = (applications.data ?? []).filter((app) => app.status === 'active' || app.id === initial?.licensableApplicationId);
	const customerOrders = (orders.data?.rows ?? []).filter((order) => order.customerId === customerId && order.status !== 'cancelled');

	return (
		<form
			onSubmit={async (event) => {
				event.preventDefault();
				setBusy(true);
				try {
					await onSubmit({
						customerId,
						licensableApplicationId: applicationId,
						packageName: packageName.trim() || null,
						salesOrderId: salesOrderId || null,
						startDate: startDate || null,
						endDate: endDate || null,
						billingCycle,
						contractValue: rupiahToMinor(value),
						notes: notes.trim() || null,
					});
				} finally {
					setBusy(false);
				}
			}}
		>
			<Card>
				<CardContent className='pt-6'>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='contract-customer'>{t('licensing:field.customer')}</FieldLabel>
							<select
								id='contract-customer'
								required
								className={select}
								value={customerId}
								onChange={(event) => {
									setCustomerId(event.target.value);
									setSalesOrderId('');
								}}
							>
								<option value=''>{t('licensing:pick.customer')}</option>
								{(customers.data?.rows ?? []).map((customer) => (
									<option key={customer.id} value={customer.id}>
										{customer.code} — {customer.name}
									</option>
								))}
							</select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-application'>{t('licensing:field.application')}</FieldLabel>
							<select id='contract-application' required className={select} value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
								<option value=''>{t('licensing:pick.application')}</option>
								{pickable.map((app) => (
									<option key={app.id} value={app.id}>
										{app.code} — {app.name}
									</option>
								))}
							</select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-package'>{t('licensing:field.package')}</FieldLabel>
							<Input id='contract-package' maxLength={200} value={packageName} onChange={(event) => setPackageName(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-order'>{t('licensing:field.salesOrder')}</FieldLabel>
							<select
								id='contract-order'
								className={select}
								value={salesOrderId}
								disabled={!customerId}
								onChange={(event) => setSalesOrderId(event.target.value)}
							>
								<option value=''>{t('licensing:pick.noOrder')}</option>
								{customerOrders.map((order) => (
									<option key={order.id} value={order.id}>
										{order.code} — {order.title}
									</option>
								))}
							</select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-start'>{t('licensing:field.startDate')}</FieldLabel>
							<Input id='contract-start' type='date' value={startDate} onChange={(event) => setStartDate(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-end'>{t('licensing:field.endDate')}</FieldLabel>
							<Input id='contract-end' type='date' min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
							<FieldDescription>{t('licensing:field.endDateHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-cycle'>{t('licensing:field.billingCycle')}</FieldLabel>
							<select id='contract-cycle' className={select} value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as TBillingCycle)}>
								{BILLING_CYCLES.map((cycle) => (
									<option key={cycle} value={cycle}>
										{t(`licensing:cycle.${cycle}`)}
									</option>
								))}
							</select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-value'>{t('licensing:field.valueRp')}</FieldLabel>
							<Input
								id='contract-value'
								type='number'
								min='0'
								step='0.01'
								inputMode='decimal'
								value={value}
								onChange={(event) => setValue(event.target.value)}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='contract-notes'>{t('licensing:field.notes')}</FieldLabel>
							<Textarea id='contract-notes' rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>
			<div className='mt-6 flex justify-end gap-2'>
				<Button type='button' variant='outline' onClick={onCancel}>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={busy || !customerId || !applicationId}>
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}

import { MoneyInput } from '@/components/money-input';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardFooter } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { customersQueryOptions } from '@/lib/customer-api';
import { minorToRupiah, rupiahToMinor } from '@/lib/format';
import { applicationsQueryOptions, BILLING_CYCLES, type TBillingCycle, type TContractInput, type TLicenseContract } from '@/lib/license-api';
import { salesOrdersQueryOptions } from '@/lib/sales-order-api';

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
	const [applicationId, setApplicationId] = useState(initial?.licenseApplicationId ?? '');
	const [packageName, setPackageName] = useState(initial?.packageName ?? '');
	const [salesOrderId, setSalesOrderId] = useState(initial?.orderId ?? '');
	const [startDate, setStartDate] = useState(initial?.startDate ?? '');
	const [endDate, setEndDate] = useState(initial?.endDate ?? '');
	const [billingCycle, setBillingCycle] = useState<TBillingCycle>(initial?.billingCycle ?? 'annual');
	const [value, setValue] = useState(initial ? minorToRupiah(initial.contractValue) : '');
	const [notes, setNotes] = useState(initial?.notes ?? '');
	const [busy, setBusy] = useState(false);

	const pickable = (applications.data ?? []).filter((app) => app.status === 'active' || app.id === initial?.licenseApplicationId);
	const customerOrders = (orders.data?.rows ?? []).filter((order) => order.customerId === customerId && order.status !== 'cancelled');

	return (
		<form
			onSubmit={async (event) => {
				event.preventDefault();
				setBusy(true);
				try {
					await onSubmit({
						customerId,
						licenseApplicationId: applicationId,
						packageName: packageName.trim() || null,
						orderId: salesOrderId || null,
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
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='contract-customer'>{t('licensing:field.customer')}</FieldLabel>
							<Select
								required
								value={customerId === '' ? 'none' : customerId}
								onValueChange={(value: string | null) => {
									setCustomerId(value === 'none' || value == null ? '' : value);
									setSalesOrderId('');
								}}
							>
								<SelectTrigger id='contract-customer' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('licensing:pick.customer')}</SelectItem>
									{(customers.data?.rows ?? []).map((customer) => (
										<SelectItem key={customer.id} value={customer.id}>
											{customer.code} — {customer.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-application'>{t('licensing:field.application')}</FieldLabel>
							<Select
								required
								value={applicationId === '' ? 'none' : applicationId}
								onValueChange={(value: string | null) => setApplicationId(value === 'none' || value == null ? '' : value)}
							>
								<SelectTrigger id='contract-application' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('licensing:pick.application')}</SelectItem>
									{pickable.map((app) => (
										<SelectItem key={app.id} value={app.id}>
											{app.code} — {app.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-package'>{t('licensing:field.package')}</FieldLabel>
							<Input id='contract-package' maxLength={200} value={packageName} onChange={(event) => setPackageName(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-order'>{t('licensing:field.salesOrder')}</FieldLabel>
							<Select
								disabled={!customerId}
								value={salesOrderId === '' ? 'none' : salesOrderId}
								onValueChange={(value: string | null) => setSalesOrderId(value === 'none' || value == null ? '' : value)}
							>
								<SelectTrigger id='contract-order' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('licensing:pick.noOrder')}</SelectItem>
									{customerOrders.map((order) => (
										<SelectItem key={order.id} value={order.id}>
											{order.code} — {order.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-start'>{t('licensing:field.startDate')}</FieldLabel>
							<DatePicker id='contract-start' value={startDate} onChange={setStartDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-end'>{t('licensing:field.endDate')}</FieldLabel>
							<DatePicker id='contract-end' min={startDate || undefined} value={endDate} onChange={setEndDate} />
							<FieldDescription>{t('licensing:field.endDateHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-cycle'>{t('licensing:field.billingCycle')}</FieldLabel>
							<Select
								value={billingCycle}
								onValueChange={(value: string | null) => setBillingCycle(value as TBillingCycle)}
							>
								<SelectTrigger id='contract-cycle' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BILLING_CYCLES.map((cycle) => (
										<SelectItem key={cycle} value={cycle}>
											{t(`licensing:cycle.${cycle}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='contract-value'>{t('licensing:field.valueRp')}</FieldLabel>
							<MoneyInput
								id='contract-value'
								value={value}
								onValueChange={setValue}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='contract-notes'>{t('licensing:field.notes')}</FieldLabel>
							<Textarea id='contract-notes' rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</Field>
					</FieldGroup>
				</CardContent>
				<CardFooter className='justify-end gap-2'>
					<Button type='button' variant='outline' onClick={onCancel}>
						{t('common:action.cancel')}
					</Button>
					<Button type='submit' disabled={busy || !customerId || !applicationId}>
						{submitLabel}
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}

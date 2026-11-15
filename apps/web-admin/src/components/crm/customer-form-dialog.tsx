import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
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
import {
	EMPTY_LOCATION_SELECTION,
	LocationCascade,
	type TLocationSelection,
} from '@/components/inventory/location-cascade';
import {
	CUSTOMER_TYPES,
	type TCustomer,
	type TCustomerInput,
	type TCustomerType,
} from '@/lib/customer-api';

/**
 * Create/edit dialog for a customer. The server normalises the code
 * (upper case) and the NPWP (digits only) and checks the village.
 */
export function CustomerFormDialog({
	customer,
	submitting,
	onClose,
	onSave,
}: {
	customer: TCustomer | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TCustomerInput) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const [code, setCode] = useState(customer?.code ?? '');
	const [customerType, setCustomerType] = useState<TCustomerType>(customer?.customerType ?? 'company');
	const [name, setName] = useState(customer?.name ?? '');
	const [legalName, setLegalName] = useState(customer?.legalName ?? '');
	const [taxId, setTaxId] = useState(customer?.taxId ?? '');
	const [email, setEmail] = useState(customer?.email ?? '');
	const [phone, setPhone] = useState(customer?.phone ?? '');
	const [whatsapp, setWhatsapp] = useState(customer?.whatsapp ?? '');
	const [addressLine, setAddressLine] = useState(customer?.addressLine ?? '');
	const [postalCode, setPostalCode] = useState(customer?.postalCode ?? '');
	const [notes, setNotes] = useState(customer?.notes ?? '');
	const [location, setLocation] = useState<TLocationSelection>({
		...EMPTY_LOCATION_SELECTION,
		villageId: customer?.villageId ?? null,
	});

	const text = (value: string) => value.trim() || null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							code: code.trim(),
							customerType,
							name: name.trim(),
							legalName: text(legalName),
							taxId: text(taxId),
							email: text(email),
							phone: text(phone),
							whatsapp: text(whatsapp),
							addressLine: text(addressLine),
							villageId: location.villageId,
							postalCode: text(postalCode),
							notes: text(notes),
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{customer ? t('crm:customers.edit') : t('crm:customers.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<div className='grid gap-4 sm:grid-cols-3'>
							<Field>
								<FieldLabel htmlFor='customer-code'>{t('crm:customer.code')}</FieldLabel>
								<Input
									id='customer-code'
									required
									maxLength={32}
									pattern='[A-Za-z0-9._\-\/]+'
									className='uppercase'
									value={code}
									onChange={(event) => setCode(event.target.value)}
								/>
								<FieldDescription>{t('crm:customer.codeHint')}</FieldDescription>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel htmlFor='customer-type'>{t('crm:customer.customerType')}</FieldLabel>
								<Select
									value={customerType}
									onValueChange={(value: string | null) => setCustomerType(value as TCustomerType)}
								>
									<SelectTrigger id='customer-type' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CUSTOMER_TYPES.map((type) => (
											<SelectItem key={type} value={type}>
												{t(`crm:customerType.${type}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='customer-name'>{t('crm:customer.name')}</FieldLabel>
								<Input
									id='customer-name'
									required
									maxLength={200}
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='customer-legal-name'>{t('crm:customer.legalName')}</FieldLabel>
								<Input
									id='customer-legal-name'
									maxLength={200}
									value={legalName}
									onChange={(event) => setLegalName(event.target.value)}
								/>
							</Field>
						</div>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='customer-tax-id'>{t('crm:customer.taxId')}</FieldLabel>
								<Input
									id='customer-tax-id'
									inputMode='numeric'
									maxLength={25}
									value={taxId}
									onChange={(event) => setTaxId(event.target.value)}
								/>
								<FieldDescription>{t('crm:customer.taxIdHint')}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor='customer-email'>{t('crm:customer.email')}</FieldLabel>
								<Input
									id='customer-email'
									type='email'
									maxLength={254}
									value={email}
									onChange={(event) => setEmail(event.target.value)}
								/>
							</Field>
						</div>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='customer-phone'>{t('crm:customer.phone')}</FieldLabel>
								<Input
									id='customer-phone'
									type='tel'
									maxLength={30}
									value={phone}
									onChange={(event) => setPhone(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='customer-whatsapp'>{t('crm:customer.whatsapp')}</FieldLabel>
								<Input
									id='customer-whatsapp'
									type='tel'
									maxLength={30}
									value={whatsapp}
									onChange={(event) => setWhatsapp(event.target.value)}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='customer-address'>{t('crm:customer.address')}</FieldLabel>
							<Textarea
								id='customer-address'
								rows={2}
								maxLength={500}
								value={addressLine}
								onChange={(event) => setAddressLine(event.target.value)}
							/>
						</Field>
						<LocationCascade
							value={location}
							initialVillageId={customer?.villageId ?? null}
							onChange={setLocation}
						/>
						<Field className='sm:max-w-48'>
							<FieldLabel htmlFor='customer-postal-code'>{t('crm:customer.postalCode')}</FieldLabel>
							<Input
								id='customer-postal-code'
								inputMode='numeric'
								pattern='[0-9]*'
								maxLength={10}
								value={postalCode}
								onChange={(event) => setPostalCode(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='customer-notes'>{t('crm:customer.notes')}</FieldLabel>
							<Textarea
								id='customer-notes'
								rows={2}
								maxLength={2000}
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

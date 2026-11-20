import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
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
import { companiesQueryOptions, type TCustomer, type TCustomerInput } from '@/lib/customer-api';

/**
 * Create/edit dialog for a customer person. A person with a company is a
 * `contact` of it, one without is an `individual` buyer. The server
 * normalises the code (upper case).
 */
export function CustomerFormDialog({
	customer,
	defaultCompanyId = null,
	submitting,
	onClose,
	onSave,
}: {
	customer: TCustomer | null;
	defaultCompanyId?: string | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TCustomerInput) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const [code, setCode] = useState(customer?.code ?? '');
	const [companyId, setCompanyId] = useState(customer?.companyId ?? defaultCompanyId ?? '');
	const [name, setName] = useState(customer?.name ?? '');
	const [position, setPosition] = useState(customer?.position ?? '');
	const [email, setEmail] = useState(customer?.email ?? '');
	const [phone, setPhone] = useState(customer?.phone ?? '');
	const [whatsapp, setWhatsapp] = useState(customer?.whatsapp ?? '');
	const [isPrimary, setIsPrimary] = useState(customer?.isPrimary ?? false);
	const [notes, setNotes] = useState(customer?.notes ?? '');
	const companies = useQuery(companiesQueryOptions({ page: 1, limit: 100, status: 'active' }));

	const text = (value: string) => value.trim() || null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							code: code.trim(),
							companyId: companyId || null,
							customerType: companyId ? 'contact' : 'individual',
							name: name.trim(),
							position: text(position),
							email: text(email),
							phone: text(phone),
							whatsapp: text(whatsapp),
							isPrimary: companyId ? isPrimary : false,
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
								<FieldLabel htmlFor='customer-company'>{t('crm:customer.company')}</FieldLabel>
								<Select
									value={companyId || 'none'}
									onValueChange={(value: string | null) => setCompanyId(value === null || value === 'none' ? '' : value)}
								>
									<SelectTrigger id='customer-company' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>{t('crm:customer.noCompany')}</SelectItem>
										{(companies.data?.rows ?? []).map((company) => (
											<SelectItem key={company.id} value={company.id}>
												{company.code} - {company.name}
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
								<FieldLabel htmlFor='customer-position'>{t('crm:customer.position')}</FieldLabel>
								<Input
									id='customer-position'
									maxLength={100}
									value={position}
									onChange={(event) => setPosition(event.target.value)}
								/>
							</Field>
						</div>
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
						{companyId && (
							<Field orientation='horizontal'>
								<Checkbox id='customer-primary' checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(checked === true)} />
								<FieldLabel htmlFor='customer-primary'>{t('crm:contacts.isPrimary')}</FieldLabel>
							</Field>
						)}
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

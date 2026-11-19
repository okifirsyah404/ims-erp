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
import { COMPANY_TYPES, type TCompany, type TCompanyInput, type TCompanyType } from '@/lib/customer-api';

/**
 * Create/edit dialog for a customer company (the B2B entity). The server
 * normalises the code (upper case) and the NPWP (digits only).
 */
export function CompanyFormDialog({
	company,
	submitting,
	onClose,
	onSave,
}: {
	company: TCompany | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TCompanyInput) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const [code, setCode] = useState(company?.code ?? '');
	const [companyType, setCompanyType] = useState<TCompanyType>(company?.companyType ?? 'company');
	const [name, setName] = useState(company?.name ?? '');
	const [legalName, setLegalName] = useState(company?.legalName ?? '');
	const [taxId, setTaxId] = useState(company?.taxId ?? '');
	const [email, setEmail] = useState(company?.email ?? '');
	const [phone, setPhone] = useState(company?.phone ?? '');
	const [whatsapp, setWhatsapp] = useState(company?.whatsapp ?? '');
	const [website, setWebsite] = useState(company?.website ?? '');
	const [notes, setNotes] = useState(company?.notes ?? '');

	const text = (value: string) => value.trim() || null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							code: code.trim(),
							companyType,
							name: name.trim(),
							legalName: text(legalName),
							taxId: text(taxId),
							email: text(email),
							phone: text(phone),
							whatsapp: text(whatsapp),
							website: text(website),
							notes: text(notes),
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{company ? t('crm:customers.editCompany') : t('crm:customers.newCompany')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<div className='grid gap-4 sm:grid-cols-3'>
							<Field>
								<FieldLabel htmlFor='company-code'>{t('crm:customer.code')}</FieldLabel>
								<Input
									id='company-code'
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
								<FieldLabel htmlFor='company-type'>{t('crm:customer.customerType')}</FieldLabel>
								<Select value={companyType} onValueChange={(value: string | null) => setCompanyType(value as TCompanyType)}>
									<SelectTrigger id='company-type' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{COMPANY_TYPES.map((type) => (
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
								<FieldLabel htmlFor='company-name'>{t('crm:customer.name')}</FieldLabel>
								<Input
									id='company-name'
									required
									maxLength={200}
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='company-legal-name'>{t('crm:customer.legalName')}</FieldLabel>
								<Input
									id='company-legal-name'
									maxLength={200}
									value={legalName}
									onChange={(event) => setLegalName(event.target.value)}
								/>
							</Field>
						</div>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='company-tax-id'>{t('crm:customer.taxId')}</FieldLabel>
								<Input
									id='company-tax-id'
									inputMode='numeric'
									maxLength={25}
									value={taxId}
									onChange={(event) => setTaxId(event.target.value)}
								/>
								<FieldDescription>{t('crm:customer.taxIdHint')}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor='company-email'>{t('crm:customer.email')}</FieldLabel>
								<Input
									id='company-email'
									type='email'
									maxLength={254}
									value={email}
									onChange={(event) => setEmail(event.target.value)}
								/>
							</Field>
						</div>
						<div className='grid gap-4 sm:grid-cols-3'>
							<Field>
								<FieldLabel htmlFor='company-phone'>{t('crm:customer.phone')}</FieldLabel>
								<Input
									id='company-phone'
									type='tel'
									maxLength={30}
									value={phone}
									onChange={(event) => setPhone(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='company-whatsapp'>{t('crm:customer.whatsapp')}</FieldLabel>
								<Input
									id='company-whatsapp'
									type='tel'
									maxLength={30}
									value={whatsapp}
									onChange={(event) => setWhatsapp(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='company-website'>{t('crm:customer.website')}</FieldLabel>
								<Input
									id='company-website'
									maxLength={200}
									value={website}
									onChange={(event) => setWebsite(event.target.value)}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='company-notes'>{t('crm:customer.notes')}</FieldLabel>
							<Textarea
								id='company-notes'
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

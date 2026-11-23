import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLegend, FieldSet } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { CountryPhoneField } from '@/components/form/country-phone-field';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	COMPANY_TYPES,
	CUSTOMER_STATUSES,
	customersQueryOptions,
	type TCompany,
	type TCompanyInput,
	type TCompanyType,
	type TCustomerStatus,
} from '@/lib/customer-api';

const NO_OWNER = 'none';

/**
 * Create/edit dialog for a customer company (ERP-0114): a data record with
 * no account of its own, grouped into identity, contact and management.
 *
 * @remarks
 * The owner is one of the company's contacts and is chosen on edit only (a
 * new company has no contacts yet; a person created with a new company
 * becomes its owner). Moving ownership turns the previous owner into staff.
 * The server normalises the code (upper case) and the phone (E.164).
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
	const [website, setWebsite] = useState(company?.website ?? '');
	const [status, setStatus] = useState<TCustomerStatus>(company?.status ?? 'active');
	const [ownerId, setOwnerId] = useState(company?.ownerCustomerId ?? NO_OWNER);
	const [notes, setNotes] = useState(company?.notes ?? '');
	const contacts = useQuery({
		...customersQueryOptions({ page: 1, limit: 100, companyId: company?.id }),
		enabled: Boolean(company),
	});

	const text = (value: string) => value.trim() || null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							// Empty on create: the server generates the code.
							code: code.trim() || undefined,
							companyType,
							name: name.trim(),
							legalName: text(legalName),
							taxId: text(taxId),
							email: text(email),
							phone: phone || null,
							website: text(website),
							notes: text(notes),
							...(company ? { status, ownerCustomerId: ownerId === NO_OWNER ? null : ownerId } : {}),
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{company ? t('crm:customers.editCompany') : t('crm:customers.newCompany')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<FieldSet>
							<FieldLegend>{t('crm:customers.section.identity')}</FieldLegend>
							<div className='grid gap-4 sm:grid-cols-3'>
								<Field>
									<FieldLabel htmlFor='company-code' optional={!company}>
										{t('crm:customer.code')}
									</FieldLabel>
									<Input
										id='company-code'
										required={!!company}
										maxLength={32}
										pattern='[A-Za-z0-9._\-\/]+'
										className='uppercase'
										value={code}
										onChange={(event) => setCode(event.target.value)}
									/>
									<FieldDescription>
										{company ? t('crm:customer.codeHint') : t('crm:customer.codeAutoHint')}
									</FieldDescription>
								</Field>
								<Field className='sm:col-span-2'>
									<FieldLabel htmlFor='company-type'>{t('crm:customer.customerType')}</FieldLabel>
									<Select
										value={companyType}
										onValueChange={(value: string | null) => setCompanyType((value ?? 'company') as TCompanyType)}
									>
										<SelectTrigger id='company-type' className='w-full'>
											<SelectValue>{(value: TCompanyType) => t(`crm:customerType.${value}`)}</SelectValue>
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
									<FieldLabel htmlFor='company-legal-name' optional>
										{t('crm:customer.legalName')}
									</FieldLabel>
									<Input
										id='company-legal-name'
										maxLength={200}
										value={legalName}
										onChange={(event) => setLegalName(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='company-tax-id' optional>
										{t('crm:customer.taxId')}
									</FieldLabel>
									<Input
										id='company-tax-id'
										inputMode='numeric'
										maxLength={25}
										value={taxId}
										onChange={(event) => setTaxId(event.target.value)}
									/>
									<FieldDescription>{t('crm:customer.taxIdHint')}</FieldDescription>
								</Field>
							</div>
						</FieldSet>

						<FieldSet>
							<FieldLegend>{t('crm:customers.section.contact')}</FieldLegend>
							<div className='grid gap-4 sm:grid-cols-2'>
								<Field>
									<FieldLabel htmlFor='company-email' optional>
										{t('crm:customer.email')}
									</FieldLabel>
									<Input
										id='company-email'
										type='email'
										maxLength={254}
										value={email}
										onChange={(event) => setEmail(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='company-phone' optional>
										{t('crm:customer.phone')}
									</FieldLabel>
									<CountryPhoneField
										id='company-phone'
										defaultValue={company?.phone}
										required={false}
										onChange={setPhone}
									/>
								</Field>
								<Field className='sm:col-span-2'>
									<FieldLabel htmlFor='company-website' optional>
										{t('crm:customer.website')}
									</FieldLabel>
									<Input
										id='company-website'
										inputMode='url'
										maxLength={200}
										value={website}
										onChange={(event) => setWebsite(event.target.value)}
									/>
								</Field>
							</div>
						</FieldSet>

						<FieldSet>
							<FieldLegend>{t('crm:customers.section.management')}</FieldLegend>
							{company && (
								<div className='grid gap-4 sm:grid-cols-2'>
									<Field>
										<FieldLabel htmlFor='company-owner' optional>
											{t('crm:customer.owner')}
										</FieldLabel>
										<Select value={ownerId} onValueChange={(value: string | null) => setOwnerId(value ?? NO_OWNER)}>
											<SelectTrigger id='company-owner' className='w-full'>
												<SelectValue>
													{(value: string) =>
														value === NO_OWNER
															? t('crm:customer.noOwner')
															: (contacts.data?.rows.find((person) => person.id === value)?.name ??
																company.owner?.name ??
																value)
													}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={NO_OWNER}>{t('crm:customer.noOwner')}</SelectItem>
												{(contacts.data?.rows ?? []).map((person) => (
													<SelectItem key={person.id} value={person.id}>
														{person.code} - {person.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldDescription>{t('crm:customer.ownerHint')}</FieldDescription>
									</Field>
									<Field>
										<FieldLabel htmlFor='company-status'>{t('crm:customer.status')}</FieldLabel>
										<Select
											value={status}
											onValueChange={(value: string | null) => setStatus((value ?? 'active') as TCustomerStatus)}
										>
											<SelectTrigger id='company-status' className='w-full'>
												<SelectValue>{(value: TCustomerStatus) => t(`crm:customerStatus.${value}`)}</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{CUSTOMER_STATUSES.map((value) => (
													<SelectItem key={value} value={value}>
														{t(`crm:customerStatus.${value}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								</div>
							)}
							<Field>
								<FieldLabel htmlFor='company-notes' optional>
									{t('crm:customer.notes')}
								</FieldLabel>
								<Textarea
									id='company-notes'
									rows={2}
									maxLength={2000}
									value={notes}
									onChange={(event) => setNotes(event.target.value)}
								/>
							</Field>
						</FieldSet>
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
			</ScrollDialogContent>
		</Dialog>
	);
}

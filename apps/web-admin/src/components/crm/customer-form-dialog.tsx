import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@ims-erp/ui/components/avatar';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
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
import { CompanyCombobox } from '@/components/crm/company-combobox';
import type { TPhotoChange } from '@/components/crm/use-customer-save';
import { CountryPhoneField } from '@/components/form/country-phone-field';
import { FieldLabel } from '@/components/form/field-label';
import { ImageDropzone } from '@/components/image-dropzone';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	COMPANY_TYPES,
	CUSTOMER_STATUSES,
	type TCompanyType,
	type TCustomer,
	type TCustomerInput,
	type TCustomerRef,
	type TCustomerStatus,
} from '@/lib/customer-api';

type TCompanyMode = 'none' | 'existing' | 'new';

/** Initials for the avatar fallback. */
function initials(name: string): string {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]!.toUpperCase())
			.join('') || '?'
	);
}

/**
 * Create/edit dialog for a customer person (ERP-0114), grouped by use:
 * identity (photo, code, name, position), company (individual, an existing
 * company, or a new company created with this person as its owner), contact
 * (the account email and the phone) and management (status, notes).
 *
 * @remarks
 * Every person gets a Better Auth account on create, so the email is
 * required; once the customer has signed in it is verified and locked. The
 * phone is E.164 through {@link CountryPhoneField}. The photo is picked
 * here and uploaded by the caller after the save.
 */
export function CustomerFormDialog({
	customer,
	defaultCompany = null,
	submitting,
	onClose,
	onSave,
}: {
	customer: TCustomer | null;
	/** Pre-selected company when a contact is added from a company page. */
	defaultCompany?: TCustomerRef | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TCustomerInput, photo: TPhotoChange) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const startCompany = customer?.company ?? defaultCompany;
	const [code, setCode] = useState(customer?.code ?? '');
	const [name, setName] = useState(customer?.name ?? '');
	const [position, setPosition] = useState(customer?.position ?? '');
	const [companyMode, setCompanyMode] = useState<TCompanyMode>(startCompany ? 'existing' : 'none');
	const [company, setCompany] = useState<TCustomerRef | null>(startCompany);
	const [newCompanyName, setNewCompanyName] = useState('');
	const [newCompanyType, setNewCompanyType] = useState<TCompanyType>('company');
	const [isOwner, setIsOwner] = useState(customer ? customer.isOwner && Boolean(customer.companyId) : false);
	const [email, setEmail] = useState(customer?.account?.email ?? '');
	const [phone, setPhone] = useState(customer?.phone ?? '');
	const [status, setStatus] = useState<TCustomerStatus>(customer?.status ?? 'active');
	const [notes, setNotes] = useState(customer?.notes ?? '');
	const [photo, setPhoto] = useState<TPhotoChange>(null);
	const [photoError, setPhotoError] = useState(false);
	const emailLocked = Boolean(customer?.account?.emailVerified);

	const previewUrl = useMemo(() => (photo && 'file' in photo ? URL.createObjectURL(photo.file) : null), [photo]);
	useEffect(() => () => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	}, [previewUrl]);
	const shownPhoto = photo && 'remove' in photo ? null : (previewUrl ?? customer?.account?.image ?? null);

	const text = (value: string) => value.trim() || null;
	const companyId = companyMode === 'existing' ? (company?.id ?? null) : null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave(
							{
								// Empty on create: the server generates the code.
								code: code.trim() || undefined,
								companyId,
								...(customer
									? { status }
									: {
											newCompany:
												companyMode === 'new'
													? { name: newCompanyName.trim(), companyType: newCompanyType }
													: null,
										}),
								isOwner: companyMode === 'existing' ? isOwner : companyMode === 'new',
								name: name.trim(),
								position: text(position),
								email: email.trim(),
								phone: phone || null,
								notes: text(notes),
							},
							photo,
						);
					}}
				>
					<DialogHeader>
						<DialogTitle>{customer ? t('crm:customers.edit') : t('crm:customers.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<FieldSet>
							<FieldLegend>{t('crm:customers.section.identity')}</FieldLegend>
							<div className='flex flex-col gap-4 sm:flex-row'>
								<Field className='w-auto shrink-0'>
									<FieldLabel optional>{t('crm:customer.photo')}</FieldLabel>
									<ImageDropzone
										variant='compact'
										previewUrl={shownPhoto}
										label={t('crm:customer.photoChoose')}
										hint={t('crm:customer.photoHint')}
										disabled={submitting}
										onSelect={(file) => {
											setPhotoError(false);
											setPhoto({ file });
										}}
										onReject={() => setPhotoError(true)}
									/>
									{shownPhoto && (
										<Button
											type='button'
											variant='ghost'
											size='sm'
											onClick={() => setPhoto(customer?.account?.image ? { remove: true } : null)}
										>
											{t('crm:customer.photoRemove')}
										</Button>
									)}
									{photoError && <p className='text-xs text-destructive'>{t('crm:customer.photoRejected')}</p>}
								</Field>
								<div className='grid flex-1 gap-4 sm:grid-cols-2'>
									<Field>
										<FieldLabel htmlFor='customer-code' optional={!customer}>
											{t('crm:customer.code')}
										</FieldLabel>
										<Input
											id='customer-code'
											required={!!customer}
											maxLength={32}
											pattern='[A-Za-z0-9._\-\/]+'
											className='uppercase'
											value={code}
											onChange={(event) => setCode(event.target.value)}
										/>
										<FieldDescription>
											{customer ? t('crm:customer.codeHint') : t('crm:customer.codeAutoHint')}
										</FieldDescription>
									</Field>
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
									<Field className='sm:col-span-2'>
										<FieldLabel htmlFor='customer-position' optional>
											{t('crm:customer.position')}
										</FieldLabel>
										<Input
											id='customer-position'
											maxLength={100}
											value={position}
											onChange={(event) => setPosition(event.target.value)}
										/>
									</Field>
								</div>
							</div>
						</FieldSet>

						<FieldSet>
							<FieldLegend>{t('crm:customers.section.company')}</FieldLegend>
							<div className='grid gap-4 sm:grid-cols-3'>
								<Field>
									<FieldLabel htmlFor='customer-company-mode'>{t('crm:customer.companyMode')}</FieldLabel>
									<Select
										value={companyMode}
										onValueChange={(value: string | null) => setCompanyMode((value ?? 'none') as TCompanyMode)}
									>
										<SelectTrigger id='customer-company-mode' className='w-full'>
											<SelectValue>
												{(value: string) =>
													value === 'existing'
														? t('crm:customer.companyExisting')
														: value === 'new'
															? t('crm:customer.companyNew')
															: t('crm:customer.companyNone')
												}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='none'>{t('crm:customer.companyNone')}</SelectItem>
											<SelectItem value='existing'>{t('crm:customer.companyExisting')}</SelectItem>
											{!customer && <SelectItem value='new'>{t('crm:customer.companyNew')}</SelectItem>}
										</SelectContent>
									</Select>
								</Field>
								{companyMode === 'existing' && (
									<Field className='sm:col-span-2'>
										<FieldLabel htmlFor='customer-company'>{t('crm:customer.company')}</FieldLabel>
										<CompanyCombobox
											id='customer-company'
											value={company}
											onChange={setCompany}
											placeholder={t('crm:customer.companyPlaceholder')}
											emptyText={t('crm:customer.companyEmpty')}
										/>
									</Field>
								)}
								{companyMode === 'new' && (
									<>
										<Field>
											<FieldLabel htmlFor='customer-new-company'>{t('crm:customer.newCompanyName')}</FieldLabel>
											<Input
												id='customer-new-company'
												required
												maxLength={200}
												value={newCompanyName}
												onChange={(event) => setNewCompanyName(event.target.value)}
											/>
										</Field>
										<Field>
											<FieldLabel htmlFor='customer-new-company-type'>{t('crm:customer.newCompanyType')}</FieldLabel>
											<Select
												value={newCompanyType}
												onValueChange={(value: string | null) => setNewCompanyType((value ?? 'company') as TCompanyType)}
											>
												<SelectTrigger id='customer-new-company-type' className='w-full'>
													<SelectValue>{(value: TCompanyType) => t(`crm:customerType.${value}`)}</SelectValue>
												</SelectTrigger>
												<SelectContent>
													{COMPANY_TYPES.map((value) => (
														<SelectItem key={value} value={value}>
															{t(`crm:customerType.${value}`)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
										<FieldDescription className='sm:col-span-3'>{t('crm:customer.newCompanyHint')}</FieldDescription>
									</>
								)}
							</div>
							{companyMode === 'existing' && company && (
								<Field orientation='horizontal'>
									<Checkbox
										id='customer-owner'
										checked={isOwner}
										onCheckedChange={(checked) => setIsOwner(checked === true)}
									/>
									<FieldLabel htmlFor='customer-owner'>{t('crm:customer.isOwner')}</FieldLabel>
									<FieldDescription>{t('crm:customer.isOwnerHint')}</FieldDescription>
								</Field>
							)}
						</FieldSet>

						<FieldSet>
							<FieldLegend>{t('crm:customers.section.contact')}</FieldLegend>
							<div className='grid gap-4 sm:grid-cols-2'>
								<Field>
									<FieldLabel htmlFor='customer-email'>{t('crm:customer.email')}</FieldLabel>
									<Input
										id='customer-email'
										type='email'
										required
										maxLength={254}
										value={email}
										disabled={emailLocked}
										onChange={(event) => setEmail(event.target.value)}
									/>
									<FieldDescription>
										{emailLocked ? t('crm:customer.emailLockedHint') : t('crm:customer.emailAccountHint')}
									</FieldDescription>
								</Field>
								<Field>
									<FieldLabel htmlFor='customer-phone' optional>
										{t('crm:customer.phone')}
									</FieldLabel>
									<CountryPhoneField
										id='customer-phone'
										defaultValue={customer?.phone}
										required={false}
										onChange={setPhone}
									/>
								</Field>
							</div>
						</FieldSet>

						<FieldSet>
							<FieldLegend>{t('crm:customers.section.management')}</FieldLegend>
							{customer && (
								<Field>
									<FieldLabel htmlFor='customer-status'>{t('crm:customer.status')}</FieldLabel>
									<Select
										value={status}
										onValueChange={(value: string | null) => setStatus((value ?? 'active') as TCustomerStatus)}
									>
										<SelectTrigger id='customer-status' className='w-full sm:w-60'>
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
							)}
							<Field>
								<FieldLabel htmlFor='customer-notes' optional>
									{t('crm:customer.notes')}
								</FieldLabel>
								<Textarea
									id='customer-notes'
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
						<Button type='submit' disabled={submitting || (companyMode === 'existing' && !company)}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}

/** Avatar of a person: their account photo, or initials. */
export function CustomerAvatar({ name, image, className }: { name: string; image: string | null | undefined; className?: string }) {
	return (
		<Avatar className={className}>
			{image && <AvatarImage src={image} alt='' />}
			<AvatarFallback>{initials(name)}</AvatarFallback>
		</Avatar>
	);
}

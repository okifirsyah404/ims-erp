import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import type {
	TCompanyProfile,
	TCompanyProfileInput,
	TInvoiceBankAccount,
} from '@/lib/company-settings-api';

type TTextKey = Exclude<keyof TCompanyProfileInput, 'bankAccounts'>;
type TBankDraft = { bankName: string; accountNumber: string; accountHolder: string };

const EMPTY_BANK: TBankDraft = { bankName: '', accountNumber: '', accountHolder: '' };

function toBankDraft(account: TInvoiceBankAccount | null | undefined): TBankDraft {
	return account ? { ...account } : { ...EMPTY_BANK };
}

/** `null` when every field is empty; `undefined` when only some are filled. */
function toBank(draft: TBankDraft): TInvoiceBankAccount | null | undefined {
	const values = Object.values(draft).map((v) => v.trim());
	if (values.every((v) => v === '')) return null;
	if (values.some((v) => v === '')) return undefined;
	return {
		bankName: draft.bankName.trim(),
		accountNumber: draft.accountNumber.trim(),
		accountHolder: draft.accountHolder.trim(),
	};
}

/**
 * The company profile form: letterhead, signatory, the two invoice bank
 * accounts, default terms, and warranty texts.
 *
 * @remarks
 * `readOnly` renders the same fields disabled for members without
 * `company_setting:update`. Bank accounts are only shown when the server
 * sent them (`bankAccounts !== null`), so a member without access never
 * sees, or blanks, them by saving.
 */
export function CompanyProfileForm({
	profile,
	readOnly,
	submitting,
	onSubmit,
}: {
	profile: TCompanyProfile | null;
	readOnly: boolean;
	submitting: boolean;
	onSubmit: (input: TCompanyProfileInput) => void;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const [values, setValues] = useState<Record<TTextKey, string>>(() => ({
		legalName: profile?.legalName ?? '',
		tradingName: profile?.tradingName ?? '',
		documentCode: profile?.documentCode ?? '',
		tagline: profile?.tagline ?? '',
		taxId: profile?.taxId ?? '',
		addressLine: profile?.addressLine ?? '',
		postalCode: profile?.postalCode ?? '',
		phone: profile?.phone ?? '',
		email: profile?.email ?? '',
		website: profile?.website ?? '',
		signatoryName: profile?.signatoryName ?? '',
		signatoryTitle: profile?.signatoryTitle ?? '',
		defaultQuotationTerms: profile?.defaultQuotationTerms ?? '',
		defaultInvoiceTerms: profile?.defaultInvoiceTerms ?? '',
		warrantyCoverage: profile?.warrantyCoverage ?? '',
		warrantyExclusions: profile?.warrantyExclusions ?? '',
		warrantyServiceTerms: profile?.warrantyServiceTerms ?? '',
	}));
	const [vat, setVat] = useState(() => toBankDraft(profile?.bankAccounts?.vat));
	const [nonVat, setNonVat] = useState(() => toBankDraft(profile?.bankAccounts?.nonVat));
	const [bankError, setBankError] = useState(false);
	// A new profile shows the bank section; an existing one only when sent.
	const showBanks = profile === null || profile.bankAccounts !== null;

	const set = (key: TTextKey) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
		setValues((current) => ({ ...current, [key]: event.target.value }));

	function textField(
		key: TTextKey,
		label: string,
		props: React.ComponentProps<typeof Input> & { hint?: string } = {},
	) {
		const { hint, ...input } = props;
		return (
			<Field>
				<FieldLabel htmlFor={`company-${key}`}>{label}</FieldLabel>
				<Input
					id={`company-${key}`}
					value={values[key]}
					onChange={set(key)}
					disabled={readOnly}
					{...input}
				/>
				{hint && <FieldDescription>{hint}</FieldDescription>}
			</Field>
		);
	}

	function textArea(key: TTextKey, label: string) {
		return (
			<Field>
				<FieldLabel htmlFor={`company-${key}`}>{label}</FieldLabel>
				<Textarea
					id={`company-${key}`}
					rows={4}
					maxLength={8000}
					value={values[key]}
					onChange={set(key)}
					disabled={readOnly}
				/>
			</Field>
		);
	}

	function bankFields(
		prefix: string,
		title: string,
		draft: TBankDraft,
		update: (draft: TBankDraft) => void,
	) {
		const field = (key: keyof TBankDraft, label: string, input: React.ComponentProps<typeof Input>) => (
			<Field>
				<FieldLabel htmlFor={`${prefix}-${key}`}>{label}</FieldLabel>
				<Input
					id={`${prefix}-${key}`}
					value={draft[key]}
					onChange={(event) => update({ ...draft, [key]: event.target.value })}
					disabled={readOnly}
					{...input}
				/>
			</Field>
		);
		return (
			<fieldset className='flex flex-col gap-3'>
				<legend className='mb-2 text-sm font-medium'>{title}</legend>
				<div className='grid gap-3 sm:grid-cols-3'>
					{field('bankName', t('settings:companyProfile.bankName'), { type: 'text', maxLength: 100 })}
					{field('accountNumber', t('settings:companyProfile.accountNumber'), {
						type: 'text',
						inputMode: 'numeric',
						maxLength: 50,
					})}
					{field('accountHolder', t('settings:companyProfile.accountHolder'), {
						type: 'text',
						maxLength: 200,
					})}
				</div>
			</fieldset>
		);
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const vatAccount = toBank(vat);
		const nonVatAccount = toBank(nonVat);
		if (showBanks && (vatAccount === undefined || nonVatAccount === undefined)) {
			setBankError(true);
			return;
		}
		setBankError(false);
		const text = (key: TTextKey) => values[key].trim() || null;
		onSubmit({
			legalName: values.legalName.trim(),
			documentCode: values.documentCode.trim().toUpperCase(),
			tradingName: text('tradingName'),
			tagline: text('tagline'),
			taxId: text('taxId'),
			addressLine: text('addressLine'),
			postalCode: text('postalCode'),
			phone: text('phone'),
			email: text('email'),
			website: text('website'),
			signatoryName: text('signatoryName'),
			signatoryTitle: text('signatoryTitle'),
			defaultQuotationTerms: text('defaultQuotationTerms'),
			defaultInvoiceTerms: text('defaultInvoiceTerms'),
			warrantyCoverage: text('warrantyCoverage'),
			warrantyExclusions: text('warrantyExclusions'),
			warrantyServiceTerms: text('warrantyServiceTerms'),
			// Hidden accounts are not sent, so saving never blanks them.
			...(showBanks
				? { bankAccounts: { vat: vatAccount ?? null, nonVat: nonVatAccount ?? null } }
				: {}),
		});
	}

	const section = (title: string, children: React.ReactNode, description?: string) => (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
			</CardHeader>
			<CardContent>
				<FieldGroup>{children}</FieldGroup>
			</CardContent>
		</Card>
	);

	return (
		<form className='flex flex-col gap-6' onSubmit={handleSubmit}>
			{section(
				t('settings:companyProfile.section.identity'),
				<>
					<div className='grid gap-4 sm:grid-cols-2'>
						{textField('legalName', t('settings:companyProfile.legalName'), { type: 'text', required: true, maxLength: 200 })}
						{textField('tradingName', t('settings:companyProfile.tradingName'), { type: 'text', maxLength: 200 })}
					</div>
					<div className='grid gap-4 sm:grid-cols-3'>
						{textField('documentCode', t('settings:companyProfile.documentCode'), {
							type: 'text',
							required: true,
							maxLength: 16,
							pattern: '[A-Za-z0-9]+',
							className: 'uppercase',
							hint: t('settings:companyProfile.documentCodeHint'),
						})}
						{textField('taxId', t('settings:companyProfile.taxId'), { type: 'text', maxLength: 32 })}
						{textField('tagline', t('settings:companyProfile.tagline'), { type: 'text', maxLength: 300 })}
					</div>
				</>,
			)}
			{section(
				t('settings:companyProfile.section.contact'),
				<>
					{textArea('addressLine', t('settings:companyProfile.addressLine'))}
					<div className='grid gap-4 sm:grid-cols-4'>
						{textField('postalCode', t('settings:companyProfile.postalCode'), { type: 'text', inputMode: 'numeric', maxLength: 10 })}
						{textField('phone', t('settings:companyProfile.phone'), { type: 'tel', maxLength: 100 })}
						{textField('email', t('settings:companyProfile.email'), { type: 'email', maxLength: 200 })}
						{textField('website', t('settings:companyProfile.website'), { type: 'url', maxLength: 200, placeholder: 'https://' })}
					</div>
				</>,
			)}
			{section(
				t('settings:companyProfile.section.signatory'),
				<div className='grid gap-4 sm:grid-cols-2'>
					{textField('signatoryName', t('settings:companyProfile.signatoryName'), { type: 'text', maxLength: 200 })}
					{textField('signatoryTitle', t('settings:companyProfile.signatoryTitle'), { type: 'text', maxLength: 100 })}
				</div>,
			)}
			{showBanks &&
				section(
					t('settings:companyProfile.section.banks'),
					<>
						{bankFields('bank-vat', t('settings:companyProfile.bankVat'), vat, setVat)}
						{bankFields('bank-non-vat', t('settings:companyProfile.bankNonVat'), nonVat, setNonVat)}
						{bankError && <FieldError>{t('settings:companyProfile.bankIncomplete')}</FieldError>}
					</>,
					t('settings:companyProfile.bankHint'),
				)}
			{section(
				t('settings:companyProfile.section.terms'),
				<>
					{textArea('defaultQuotationTerms', t('settings:companyProfile.defaultQuotationTerms'))}
					{textArea('defaultInvoiceTerms', t('settings:companyProfile.defaultInvoiceTerms'))}
				</>,
			)}
			{section(
				t('settings:companyProfile.section.warranty'),
				<>
					{textArea('warrantyCoverage', t('settings:companyProfile.warrantyCoverage'))}
					{textArea('warrantyExclusions', t('settings:companyProfile.warrantyExclusions'))}
					{textArea('warrantyServiceTerms', t('settings:companyProfile.warrantyServiceTerms'))}
				</>,
				t('settings:companyProfile.linesHint'),
			)}
			{!readOnly && (
				<div className='flex justify-end'>
					<Button type='submit' disabled={submitting}>
						{submitting ? t('common:action.saving') : t('common:action.save')}
					</Button>
				</div>
			)}
		</form>
	);
}

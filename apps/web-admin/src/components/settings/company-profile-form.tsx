import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardFooter } from '@ims-erp/ui/components/card';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import type { TCompanyProfile, TCompanyProfileInput } from '@/lib/company-api';

/** The fields this form still edits. Everything else is left to storage. */
type TTextKey =
	| 'legalName'
	| 'tradingName'
	| 'documentCode'
	| 'tagline'
	| 'taxId'
	| 'addressLine'
	| 'postalCode'
	| 'phone'
	| 'email'
	| 'website';

/**
 * The company profile form: legal identity and letterhead contact only.
 *
 * @remarks
 * Signatory, bank accounts, default terms, warranty texts and the images are
 * not edited here — the images have their own card on the page. They still
 * exist in storage and are still printed on documents; `PUT /company/profile`
 * is a patch, so omitting them leaves the stored values untouched.
 *
 * `readOnly` renders the same fields disabled for members without
 * `company:update`.
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
	}));

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

	/** Trimmed text, empty becomes `null` (the server clears the field). */
	const text = (key: TTextKey) => {
		const value = values[key].trim();
		return value === '' ? null : value;
	};

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
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
		});
	}

	const section = (title: string, fields: React.ReactNode) => (
		<FieldSet>
			<FieldLegend variant='label'>{title}</FieldLegend>
			<FieldGroup>{fields}</FieldGroup>
		</FieldSet>
	);

	return (
		<form onSubmit={handleSubmit}>
			<Card>
				<CardContent className='flex flex-col gap-6'>
					{section(
						t('settings:companyProfile.section.identity'),
						<>
							{textField('legalName', t('settings:companyProfile.legalName'), {
								type: 'text',
								required: true,
								maxLength: 200,
							})}
							{textField('tradingName', t('settings:companyProfile.tradingName'), {
								type: 'text',
								maxLength: 200,
							})}
							{textField('documentCode', t('settings:companyProfile.documentCode'), {
								type: 'text',
								required: true,
								maxLength: 16,
								className: 'font-mono uppercase',
								hint: t('settings:companyProfile.documentCodeHint'),
							})}
							{textField('taxId', t('settings:companyProfile.taxId'), { type: 'text', maxLength: 32 })}
							{textField('tagline', t('settings:companyProfile.tagline'), {
								type: 'text',
								maxLength: 300,
							})}
						</>,
					)}
					<FieldSeparator />
					{section(
						t('settings:companyProfile.section.contact'),
						<>
							<Field>
								<FieldLabel htmlFor='company-addressLine'>
									{t('settings:companyProfile.addressLine')}
								</FieldLabel>
								<Textarea
									id='company-addressLine'
									rows={3}
									maxLength={1000}
									value={values.addressLine}
									onChange={set('addressLine')}
									disabled={readOnly}
								/>
							</Field>
							<div className='grid gap-5 sm:grid-cols-2'>
								{textField('postalCode', t('settings:companyProfile.postalCode'), {
									type: 'text',
									maxLength: 10,
								})}
								{textField('phone', t('settings:companyProfile.phone'), {
									type: 'tel',
									maxLength: 100,
								})}
							</div>
							<div className='grid gap-5 sm:grid-cols-2'>
								{textField('email', t('settings:companyProfile.email'), {
									type: 'email',
									maxLength: 200,
								})}
								{textField('website', t('settings:companyProfile.website'), {
									type: 'url',
									maxLength: 200,
									placeholder: 'https://',
								})}
							</div>
						</>,
					)}
				</CardContent>
				{!readOnly && (
					<CardFooter className='justify-end'>
						<Button type='submit' disabled={submitting}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</CardFooter>
				)}
			</Card>
		</form>
	);
}

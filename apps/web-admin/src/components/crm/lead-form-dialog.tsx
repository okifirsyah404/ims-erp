import { createLeadSchema, leadFormSchema } from '@ims-erp/common';
import { useForm, useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DateTimePicker } from '@ims-erp/ui/components/datetime-picker';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { FieldDescription, FieldError, FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';

import { CountryPhoneField } from '@/components/form/country-phone-field';
import { RequiredLegend } from '@/components/form/field-label';
import { FormErrorSummary } from '@/components/form/form-error-summary';
import { FormField } from '@/components/form/form-field';
import { useIssueText } from '@/components/form/use-issue-text';
import { MoneyInput } from '@/components/money-input';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { ApiError } from '@/lib/api-error';
import { fromDateTimeInput, toDateTimeInput } from '@/lib/format';
import { focusControl, schemaIssues, serverIssues, type TFieldIssues, visibleIssues } from '@/lib/form-validation';
import { LEAD_SOURCES, type TLead, type TLeadInput, type TLeadSource } from '@/lib/lead-api';

/** Form values as typed; money in rupiah, the follow-up as `YYYY-MM-DDTHH:mm`. */
type TLeadFormValues = {
	name: string;
	companyName: string;
	phone: string;
	whatsapp: string;
	email: string;
	source: TLeadSource;
	needs: string;
	estimatedValue: string;
	nextFollowUpAt: string;
};

/** Field → control id; the order is the on-screen order (focus and summary, RF-16). */
const CONTROL_IDS = {
	name: 'lead-name',
	companyName: 'lead-company',
	contact: 'lead-phone',
	phone: 'lead-phone',
	whatsapp: 'lead-whatsapp',
	email: 'lead-email',
	source: 'lead-source',
	estimatedValue: 'lead-value',
	nextFollowUpAt: 'lead-follow-up',
	needs: 'lead-needs',
} as const;
type TFieldName = keyof typeof CONTROL_IDS;
const FIELD_ORDER = Object.keys(CONTROL_IDS) as TFieldName[];
const CONTACT_FIELDS: readonly TFieldName[] = ['phone', 'whatsapp', 'email'];

const text = (value: string) => value.trim() || null;

/** The request body the form sends (integer IDR minor units, unix ms). */
function toInput(values: TLeadFormValues): TLeadInput {
	return {
		name: values.name.trim(),
		companyName: text(values.companyName),
		phone: text(values.phone),
		whatsapp: text(values.whatsapp),
		email: text(values.email),
		source: values.source,
		needs: text(values.needs),
		estimatedValue: values.estimatedValue === '' ? null : Number(values.estimatedValue) * 100,
		nextFollowUpAt: fromDateTimeInput(values.nextFollowUpAt),
	};
}

/** `YYYY-MM-DD` of today, the earliest day the follow-up picker offers. */
function todayInput(): string {
	return toDateTimeInput(new Date().toISOString()).slice(0, 10);
}

/**
 * Create/edit dialog for a lead (form FU1), the reference form of P7-6.
 *
 * @remarks
 * TanStack Form holds the values; the rules are the shared
 * `@ims-erp/common` lead schema the backend validates with (TF-A). Errors
 * show under their field once it was left or a save was tried (RF-14),
 * the summary lists them and the cursor moves to the first (RF-16), and a
 * failed save keeps every typed value: server field errors land under their
 * field (RF-17), a server fault shows its reference (RF-27).
 *
 * `onSave` rejects with an {@link ApiError} when the request fails.
 */
export function LeadFormDialog({
	lead,
	onClose,
	onSave,
}: {
	lead: TLead | null;
	onClose: () => void;
	onSave: (input: TLeadInput) => Promise<unknown>;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const issueText = useIssueText();
	const [server, setServer] = useState<TFieldIssues>({});
	const [formMessage, setFormMessage] = useState<string | null>(null);
	const initialFollowUp = toDateTimeInput(lead?.nextFollowUpAt ?? null);

	/**
	 * Shared schema of this form. Editing keeps an already-passed follow-up
	 * the user did not touch; a new or changed follow-up must not be past.
	 */
	const validate = (values: TLeadFormValues): TFieldIssues =>
		schemaIssues(
			!lead || values.nextFollowUpAt !== initialFollowUp ? createLeadSchema : leadFormSchema,
			toInput(values),
		);

	const firstIssueId = (issues: TFieldIssues) => {
		const field = FIELD_ORDER.find((name) => issues[name]) ?? Object.keys(issues)[0];
		return field ? (CONTROL_IDS[field as TFieldName] ?? null) : null;
	};

	const form = useForm({
		defaultValues: {
			name: lead?.name ?? '',
			companyName: lead?.companyName ?? '',
			phone: lead?.phone ?? '',
			whatsapp: lead?.whatsapp ?? '',
			email: lead?.email ?? '',
			source: lead?.source ?? 'whatsapp',
			needs: lead?.needs ?? '',
			estimatedValue: lead?.estimatedValue != null ? String(Math.round(lead.estimatedValue / 100)) : '',
			nextFollowUpAt: initialFollowUp,
		} satisfies TLeadFormValues as TLeadFormValues,
		onSubmit: async ({ value }) => {
			setFormMessage(null);
			setServer({});
			const local = validate(value);
			const first = firstIssueId(local);
			if (first) {
				focusControl(first);
				return;
			}
			try {
				await onSave(toInput(value));
			} catch (cause) {
				const error = cause instanceof ApiError ? cause : null;
				const fieldIssues = error ? serverIssues(error) : {};
				setServer(fieldIssues);
				if (error?.isNetworkError) setFormMessage(t('common:form.networkError'));
				else if (error?.ref) setFormMessage(t('common:form.serverError', { ref: error.ref }));
				else if (error && error.formErrors.length > 0) setFormMessage(error.formErrors.join(' '));
				else if (!error || Object.keys(fieldIssues).length === 0) {
					setFormMessage(cause instanceof Error ? cause.message : t('common:error.failed'));
				}
				const serverFirst = firstIssueId(fieldIssues);
				if (serverFirst) focusControl(serverFirst);
			}
		},
	});

	const values = useStore(form.store, (state) => state.values);
	const submitted = useStore(form.store, (state) => state.submissionAttempts > 0);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const fieldMeta = useStore(form.store, (state) => state.fieldMeta);
	const left = (field: string) =>
		submitted ||
		(field === 'contact'
			? CONTACT_FIELDS.some((name) => fieldMeta[name as keyof TLeadFormValues]?.isBlurred)
			: Boolean(fieldMeta[field as keyof TLeadFormValues]?.isBlurred));

	const shown = visibleIssues(FIELD_ORDER, validate(values), server, left);
	const shownMap = Object.fromEntries(shown) as TFieldIssues;
	const labels: Record<TFieldName, string> = {
		name: t('crm:lead.name'),
		companyName: t('crm:lead.companyName'),
		contact: t('crm:lead.contact'),
		phone: t('crm:lead.phone'),
		whatsapp: t('crm:lead.whatsapp'),
		email: t('crm:lead.email'),
		source: t('crm:lead.source'),
		estimatedValue: t('crm:lead.estimatedValue'),
		nextFollowUpAt: t('crm:lead.nextFollowUpAt'),
		needs: t('crm:lead.needs'),
	};
	const examples: Partial<Record<TFieldName, string>> = {
		phone: t('crm:lead.phoneExample'),
		whatsapp: t('crm:lead.phoneExample'),
		email: t('crm:lead.emailExample'),
	};
	const errorOf = (field: TFieldName) => issueText(shownMap[field], labels[field], examples[field]);
	const summary = shown.map(([field, issue]) => ({
		id: CONTROL_IDS[field as TFieldName] ?? field,
		text: issueText(issue, labels[field as TFieldName] ?? field, examples[field as TFieldName]) ?? '',
	}));

	/** Clears the server's verdict on a field once the user changes it. */
	const touched = (field: TFieldName) => {
		setFormMessage(null);
		setServer((current) => {
			if (!current[field] && !(CONTACT_FIELDS.includes(field) && current.contact)) return current;
			const next = { ...current };
			delete next[field];
			if (CONTACT_FIELDS.includes(field)) delete next.contact;
			return next;
		});
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<DialogHeader>
						<DialogTitle>{lead ? t('crm:leads.edit') : t('crm:leads.new')}</DialogTitle>
						<RequiredLegend />
					</DialogHeader>
					<FieldGroup className='py-4'>
						<FormErrorSummary items={summary} formMessage={formMessage} />
						<div className='grid gap-4 sm:grid-cols-2'>
							<form.Field name='name'>
								{(field) => (
									<FormField
										id='lead-name'
										label={labels.name}
										required
										description={t('crm:lead.nameHelp')}
										error={errorOf('name')}
										onBlur={field.handleBlur}
									>
										<Input
											id='lead-name'
											maxLength={200}
											aria-invalid={Boolean(errorOf('name')) || undefined}
											value={field.state.value}
											onChange={(event) => {
												field.handleChange(event.target.value);
												touched('name');
											}}
										/>
									</FormField>
								)}
							</form.Field>
							<form.Field name='companyName'>
								{(field) => (
									<FormField
										id='lead-company'
										label={labels.companyName}
										optional
										description={t('crm:lead.companyNameHelp')}
										error={errorOf('companyName')}
										onBlur={field.handleBlur}
									>
										<Input
											id='lead-company'
											maxLength={120}
											aria-invalid={Boolean(errorOf('companyName')) || undefined}
											value={field.state.value}
											onChange={(event) => {
												field.handleChange(event.target.value);
												touched('companyName');
											}}
										/>
									</FormField>
								)}
							</form.Field>
						</div>
						<div className='flex flex-col gap-2'>
							<FieldDescription>{t('crm:lead.contactHint')}</FieldDescription>
							{errorOf('contact') && <FieldError id='lead-contact-error'>{errorOf('contact')}</FieldError>}
							<div className='grid gap-4 sm:grid-cols-3'>
								<form.Field name='phone'>
									{(field) => (
										<FormField
											id='lead-phone'
											label={labels.phone}
											optional
											error={errorOf('phone')}
											onBlur={field.handleBlur}
										>
											<CountryPhoneField
												id='lead-phone'
												defaultValue={lead?.phone}
												required={false}
												onChange={(value) => {
													field.handleChange(value);
													touched('phone');
												}}
											/>
										</FormField>
									)}
								</form.Field>
								<form.Field name='whatsapp'>
									{(field) => (
										<FormField
											id='lead-whatsapp'
											label={labels.whatsapp}
											optional
											error={errorOf('whatsapp')}
											onBlur={field.handleBlur}
										>
											<CountryPhoneField
												id='lead-whatsapp'
												defaultValue={lead?.whatsapp}
												required={false}
												onChange={(value) => {
													field.handleChange(value);
													touched('whatsapp');
												}}
											/>
										</FormField>
									)}
								</form.Field>
								<form.Field name='email'>
									{(field) => (
										<FormField
											id='lead-email'
											label={labels.email}
											optional
											error={errorOf('email')}
											onBlur={field.handleBlur}
										>
											<Input
												id='lead-email'
												type='email'
												maxLength={254}
												placeholder={t('crm:lead.emailExample')}
												aria-invalid={Boolean(errorOf('email')) || undefined}
												value={field.state.value}
												onChange={(event) => {
													field.handleChange(event.target.value);
													touched('email');
												}}
											/>
										</FormField>
									)}
								</form.Field>
							</div>
						</div>
						<div className='grid gap-4 sm:grid-cols-3'>
							<form.Field name='source'>
								{(field) => (
									<FormField
										id='lead-source'
										label={labels.source}
										required
										description={t('crm:lead.sourceHelp')}
										error={errorOf('source')}
										onBlur={field.handleBlur}
									>
										<Select
											value={field.state.value}
											onValueChange={(value: string | null) => {
												if (value) field.handleChange(value as TLeadSource);
												touched('source');
											}}
										>
											<SelectTrigger id='lead-source' className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{LEAD_SOURCES.map((value) => (
													<SelectItem key={value} value={value}>
														{t(`crm:leadSource.${value}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</FormField>
								)}
							</form.Field>
							<form.Field name='estimatedValue'>
								{(field) => (
									<FormField
										id='lead-value'
										label={labels.estimatedValue}
										optional
										description={t('crm:lead.estimatedValueHelp')}
										error={errorOf('estimatedValue')}
										onBlur={field.handleBlur}
									>
										<MoneyInput
											id='lead-value'
											value={field.state.value}
											onValueChange={(value) => {
												field.handleChange(value);
												touched('estimatedValue');
											}}
										/>
									</FormField>
								)}
							</form.Field>
							<form.Field name='nextFollowUpAt'>
								{(field) => (
									<FormField
										id='lead-follow-up'
										label={labels.nextFollowUpAt}
										optional
										description={t('crm:lead.nextFollowUpHelp')}
										error={errorOf('nextFollowUpAt')}
										onBlur={field.handleBlur}
									>
										<DateTimePicker
											id='lead-follow-up'
											min={todayInput()}
											value={field.state.value}
											onChange={(value) => {
												field.handleChange(value);
												touched('nextFollowUpAt');
											}}
										/>
									</FormField>
								)}
							</form.Field>
						</div>
						<form.Field name='needs'>
							{(field) => (
								<FormField
									id='lead-needs'
									label={labels.needs}
									optional
									error={errorOf('needs')}
									onBlur={field.handleBlur}
								>
									<Textarea
										id='lead-needs'
										rows={3}
										maxLength={2000}
										aria-invalid={Boolean(errorOf('needs')) || undefined}
										value={field.state.value}
										onChange={(event) => {
											field.handleChange(event.target.value);
											touched('needs');
										}}
									/>
								</FormField>
							)}
						</form.Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={isSubmitting}>
							{isSubmitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}

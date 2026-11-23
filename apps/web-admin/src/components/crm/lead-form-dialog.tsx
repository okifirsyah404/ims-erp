import { MoneyInput } from '@/components/money-input';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DateTimePicker } from '@ims-erp/ui/components/datetime-picker';
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { fromDateTimeInput, toDateTimeInput } from '@/lib/format';
import { LEAD_SOURCES, type TLead, type TLeadInput, type TLeadSource } from '@/lib/lead-api';
import { CountryPhoneField } from '@/components/form/country-phone-field';

/** Create/edit dialog for a lead. Money is typed in rupiah, sent in minor units. */
export function LeadFormDialog({
	lead,
	submitting,
	onClose,
	onSave,
}: {
	lead: TLead | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TLeadInput) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const [name, setName] = useState(lead?.name ?? '');
	const [companyName, setCompanyName] = useState(lead?.companyName ?? '');
	const [phone, setPhone] = useState(lead?.phone ?? '');
	const [whatsapp, setWhatsapp] = useState(lead?.whatsapp ?? '');
	const [email, setEmail] = useState(lead?.email ?? '');
	const [source, setSource] = useState<TLeadSource>(lead?.source ?? 'whatsapp');
	const [needs, setNeeds] = useState(lead?.needs ?? '');
	const [estimatedValue, setEstimatedValue] = useState(
		lead?.estimatedValue != null ? String(Math.round(lead.estimatedValue / 100)) : '',
	);
	const [nextFollowUpAt, setNextFollowUpAt] = useState(toDateTimeInput(lead?.nextFollowUpAt ?? null));
	const text = (value: string) => value.trim() || null;
	const hasContact = [phone, whatsapp, email].some((value) => value.trim() !== '');

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							name: name.trim(),
							companyName: text(companyName),
							phone: text(phone),
							whatsapp: text(whatsapp),
							email: text(email),
							source,
							needs: text(needs),
							estimatedValue: estimatedValue === '' ? null : Number(estimatedValue) * 100,
							nextFollowUpAt: fromDateTimeInput(nextFollowUpAt),
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{lead ? t('crm:leads.edit') : t('crm:leads.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='lead-name'>{t('crm:lead.name')}</FieldLabel>
								<Input id='lead-name' required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='lead-company' optional>{t('crm:lead.companyName')}</FieldLabel>
								<Input
									id='lead-company'
									maxLength={200}
									value={companyName}
									onChange={(e) => setCompanyName(e.target.value)}
								/>
							</Field>
						</div>
						<div className='grid gap-4 sm:grid-cols-3'>
							<Field>
								<FieldLabel htmlFor='lead-phone' optional>{t('crm:lead.phone')}</FieldLabel>
								<CountryPhoneField id='lead-phone' defaultValue={lead?.phone} required={false} onChange={setPhone} />
							</Field>
							<Field>
								<FieldLabel htmlFor='lead-whatsapp' optional>{t('crm:lead.whatsapp')}</FieldLabel>
								<CountryPhoneField
									id='lead-whatsapp'
									defaultValue={lead?.whatsapp}
									required={false}
									onChange={setWhatsapp}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='lead-email' optional>{t('crm:lead.email')}</FieldLabel>
								<Input id='lead-email' type='email' maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
							</Field>
						</div>
						<FieldDescription>{t('crm:lead.contactHint')}</FieldDescription>
						<div className='grid gap-4 sm:grid-cols-3'>
							<Field>
								<FieldLabel htmlFor='lead-source'>{t('crm:lead.source')}</FieldLabel>
								<Select
									value={source}
									onValueChange={(value: string | null) => setSource(value as TLeadSource)}
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
							</Field>
							<Field>
								<FieldLabel htmlFor='lead-value' optional>{t('crm:lead.estimatedValue')}</FieldLabel>
								<MoneyInput
									id='lead-value'
									value={estimatedValue}
									onValueChange={setEstimatedValue}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='lead-follow-up' optional>{t('crm:lead.nextFollowUpAt')}</FieldLabel>
								<DateTimePicker
									id='lead-follow-up'
									value={nextFollowUpAt}
									onChange={setNextFollowUpAt}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='lead-needs' optional>{t('crm:lead.needs')}</FieldLabel>
							<Textarea id='lead-needs' rows={3} maxLength={2000} value={needs} onChange={(e) => setNeeds(e.target.value)} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting || !hasContact}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}

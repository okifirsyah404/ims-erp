import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	CUSTOMER_TYPES,
	customersQueryOptions,
	type TCustomerInput,
	type TCustomerType,
} from '@/lib/customer-api';
import type { TLead } from '@/lib/lead-api';

type TConvertInput = { customerId: string } | { customer: TCustomerInput };

/**
 * "Make customer": create a customer from the lead's data, or link an
 * existing active customer. The server marks the lead won atomically.
 */
export function ConvertLeadDialog({
	lead,
	submitting,
	onClose,
	onConvert,
}: {
	lead: TLead;
	submitting: boolean;
	onClose: () => void;
	onConvert: (input: TConvertInput) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const [mode, setMode] = useState<'new' | 'existing'>('new');
	const [code, setCode] = useState('');
	const [customerType, setCustomerType] = useState<TCustomerType>(lead.companyName ? 'company' : 'individual');
	const [name, setName] = useState(lead.companyName ?? lead.name);
	const [search, setSearch] = useState('');
	const [customerId, setCustomerId] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const customers = useQuery({
		...customersQueryOptions({ page: 1, limit: 10, status: 'active', search: deferredSearch || undefined }),
		enabled: mode === 'existing',
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onConvert(
							mode === 'existing'
								? { customerId }
								: {
										customer: {
											code: code.trim(),
											customerType,
											name: name.trim(),
											legalName: null,
											taxId: null,
											email: lead.email,
											phone: lead.phone,
											whatsapp: lead.whatsapp,
											addressLine: null,
											villageId: null,
											postalCode: null,
											notes: lead.needs,
										},
									},
						);
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('crm:convert.title')}</DialogTitle>
						<DialogDescription>{t('crm:convert.description')}</DialogDescription>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='convert-mode'>{t('crm:convert.mode')}</FieldLabel>
							<select
								id='convert-mode'
								className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
								value={mode}
								onChange={(e) => setMode(e.target.value as 'new' | 'existing')}
							>
								<option value='new'>{t('crm:convert.modeNew')}</option>
								<option value='existing'>{t('crm:convert.modeExisting')}</option>
							</select>
						</Field>
						{mode === 'new' ? (
							<>
								<div className='grid gap-4 sm:grid-cols-2'>
									<Field>
										<FieldLabel htmlFor='convert-code'>{t('crm:customer.code')}</FieldLabel>
										<Input
											id='convert-code'
											required
											maxLength={32}
											pattern='[A-Za-z0-9._\-\/]+'
											className='uppercase'
											value={code}
											onChange={(e) => setCode(e.target.value)}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='convert-type'>{t('crm:customer.customerType')}</FieldLabel>
										<select
											id='convert-type'
											className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
											value={customerType}
											onChange={(e) => setCustomerType(e.target.value as TCustomerType)}
										>
											{CUSTOMER_TYPES.map((type) => (
												<option key={type} value={type}>
													{t(`crm:customerType.${type}`)}
												</option>
											))}
										</select>
									</Field>
								</div>
								<Field>
									<FieldLabel htmlFor='convert-name'>{t('crm:customer.name')}</FieldLabel>
									<Input id='convert-name' required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
									<FieldDescription>{t('crm:convert.copied')}</FieldDescription>
								</Field>
							</>
						) : (
							<>
								<Field>
									<FieldLabel htmlFor='convert-search'>{t('crm:convert.search')}</FieldLabel>
									<Input
										id='convert-search'
										type='search'
										placeholder={t('crm:customers.search')}
										value={search}
										onChange={(e) => setSearch(e.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='convert-customer'>{t('crm:convert.pick')}</FieldLabel>
									<select
										id='convert-customer'
										required
										className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
										value={customerId}
										onChange={(e) => setCustomerId(e.target.value)}
									>
										<option value=''>{t('crm:convert.pick')}</option>
										{(customers.data?.rows ?? []).map((customer) => (
											<option key={customer.id} value={customer.id}>
												{customer.code} — {customer.name}
											</option>
										))}
									</select>
								</Field>
							</>
						)}
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{submitting ? t('common:action.saving') : t('crm:leads.convert')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

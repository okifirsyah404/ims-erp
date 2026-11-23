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
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Search } from 'lucide-react';
import { customersQueryOptions, type TCustomerInput } from '@/lib/customer-api';
import type { TLead } from '@/lib/lead-api';

type TConvertInput = { customerId: string } | { customer: TCustomerInput };

/**
 * "Make customer": create a customer from the lead's data, or link an
 * existing active customer. The server marks the lead won atomically.
 *
 * @remarks
 * A new customer gets a Better Auth account (ERP-0114), so the email is
 * required; the login details are emailed to it. A lead with a company name
 * creates that company too, with the person as its owner.
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
	const [name, setName] = useState(lead.name);
	const [email, setEmail] = useState(lead.email ?? '');
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
											// Empty: the server generates the code.
											code: code.trim() || undefined,
											companyId: null,
											newCompany: lead.companyName
												? { name: lead.companyName, companyType: 'company' }
												: null,
											isOwner: Boolean(lead.companyName),
											name: name.trim(),
											position: null,
											email: email.trim(),
											// One number since ERP-0114: the phone, else the WhatsApp number.
											phone: lead.phone ?? lead.whatsapp,
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
							<Select
								value={mode}
								onValueChange={(value: string | null) => setMode(value as 'new' | 'existing')}
							>
								<SelectTrigger id='convert-mode' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='new'>{t('crm:convert.modeNew')}</SelectItem>
									<SelectItem value='existing'>{t('crm:convert.modeExisting')}</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						{mode === 'new' ? (
							<>
								<div className='grid gap-4 sm:grid-cols-2'>
									<Field>
										<FieldLabel htmlFor='convert-code' optional>
											{t('crm:customer.code')}
										</FieldLabel>
										<Input
											id='convert-code'
											maxLength={32}
											pattern='[A-Za-z0-9._\-\/]+'
											className='uppercase'
											value={code}
											onChange={(e) => setCode(e.target.value)}
										/>
										<FieldDescription>{t('crm:customer.codeAutoHint')}</FieldDescription>
									</Field>
								</div>
								<Field>
									<FieldLabel htmlFor='convert-name'>{t('crm:customer.name')}</FieldLabel>
									<Input id='convert-name' required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
									<FieldDescription>{t('crm:convert.copied')}</FieldDescription>
								</Field>
								<Field>
									<FieldLabel htmlFor='convert-email'>{t('crm:customer.email')}</FieldLabel>
									<Input
										id='convert-email'
										type='email'
										required
										maxLength={254}
										value={email}
										onChange={(e) => setEmail(e.target.value)}
									/>
									<FieldDescription>{t('crm:customer.emailAccountHint')}</FieldDescription>
								</Field>
							</>
						) : (
							<>
								<Field>
									<FieldLabel htmlFor='convert-search'>{t('crm:convert.search')}</FieldLabel>
									<InputGroup>
										<InputGroupAddon align='inline-start'>
											<Search aria-hidden='true' />
										</InputGroupAddon>
										<InputGroupInput
											id='convert-search'
											type='search'
											placeholder={t('crm:customers.search')}
											value={search}
											onChange={(e) => setSearch(e.target.value)}
										/>
									</InputGroup>
								</Field>
								<Field>
									<FieldLabel htmlFor='convert-customer'>{t('crm:convert.pick')}</FieldLabel>
									<Select
										required
										value={customerId === '' ? 'none' : customerId}
										onValueChange={(value: string | null) => setCustomerId(value === 'none' || value == null ? '' : value)}
									>
										<SelectTrigger id='convert-customer' className='w-full'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='none'>{t('crm:convert.pick')}</SelectItem>
											{(customers.data?.rows ?? []).map((customer) => (
												<SelectItem key={customer.id} value={customer.id}>
													{customer.code} — {customer.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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

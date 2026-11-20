import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@ims-erp/ui/components/alert-dialog';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { AddressFormDialog, type TAddressFormValues } from '@/components/crm/address-form-dialog';
import { CompanyFormDialog } from '@/components/crm/company-form-dialog';
import { CustomerFormDialog } from '@/components/crm/customer-form-dialog';
import { PortalAccountCard } from '@/components/crm/portal-account-card';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton, SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import {
	addCompanyAddress,
	addCustomerAddress,
	COMPANY_ADDRESS_KINDS,
	companyQueryOptions,
	CUSTOMER_ADDRESS_KINDS,
	createCustomer,
	customerQueryOptions,
	customersQueryOptions,
	removeCompanyAddress,
	removeCustomerAddress,
	setCompanyActive,
	setCustomerActive,
	type TCompanyAddress,
	type TCompanyInput,
	type TCustomerAddress,
	type TCustomerInput,
	updateCompany,
	updateCustomer,
} from '@/lib/customer-api';
import { usePermission } from '@/lib/use-permission';

/**
 * `/crm/customers/$customerId` - one customer person, or (with
 * `?kind=company`) one customer company with its people and addresses.
 */
export const Route = createFileRoute('/_authed/crm/customers/$customerId')({
	validateSearch: (search: Record<string, unknown>): { kind?: 'company' } =>
		search.kind === 'company' ? { kind: 'company' } : {},
	component: CustomerDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '-'}</div>
		</div>
	);
}

function CustomerDetailPage() {
	const { kind } = useSearch({ from: Route.id });
	return kind === 'company' ? <CompanyDetail /> : <PersonDetail />;
}

type TAddress = TCompanyAddress | TCustomerAddress;

function AddressList({
	addresses,
	canUpdate,
	onAdd,
	onRemove,
}: {
	addresses: TAddress[];
	canUpdate: boolean;
	onAdd: () => void;
	onRemove: (address: TAddress) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('crm:customers.addresses')}</CardTitle>
				{canUpdate && (
					<CardAction>
						<Button size='sm' variant='outline' onClick={onAdd}>
							{t('crm:address.add')}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				{addresses.length === 0 && <EmptyState title={t('crm:customers.noAddresses')} size='sm' />}
				{addresses.map((address) => (
					<div key={address.id} className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
						<div>
							<div className='font-medium'>
								{t(`crm:address.kind.${address.kind}` as 'address.kind.other')}
								{address.label ? ` - ${address.label}` : ''}
								{address.isPrimary && (
									<Badge variant='secondary' className='ml-2'>
										{t('crm:contacts.primary')}
									</Badge>
								)}
							</div>
							<div className='whitespace-pre-line text-muted-foreground'>
								{[address.addressLine, address.postalCode].filter(Boolean).join(' ')}
							</div>
						</div>
						{canUpdate && (
							<Button size='sm' variant='outline' onClick={() => onRemove(address)}>
								{t('crm:address.remove')}
							</Button>
						)}
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function RemoveAddressDialog({
	address,
	onCancel,
	onConfirm,
}: {
	address: TAddress | null;
	onCancel: () => void;
	onConfirm: (address: TAddress) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	return (
		<AlertDialog open={address !== null} onOpenChange={(open) => !open && onCancel()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('crm:address.remove')}</AlertDialogTitle>
					<AlertDialogDescription>{t('crm:address.removeConfirm', { address: address?.addressLine ?? '' })}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
					<AlertDialogAction onClick={() => address && onConfirm(address)}>{t('crm:address.remove')}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** Runs a mutation, refreshes the customer queries and toasts the outcome. */
function useRunner() {
	const { t } = useTranslation(['crm', 'common']);
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	async function run(action: () => Promise<unknown>, success: string, done?: () => void) {
		setSubmitting(true);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
			toast.success(success);
			done?.();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}
	return { run, submitting };
}

function PersonDetail() {
	const { t } = useTranslation(['crm', 'common']);
	const { customerId } = useParams({ from: Route.id });
	const canUpdate = usePermission('customer.update');
	const canArchive = usePermission('customer.archive');
	const { data: customer, isPending, isError, error } = useQuery(customerQueryOptions(customerId));
	const company = useQuery({ ...companyQueryOptions(customer?.companyId ?? '', !!customer?.companyId) });
	const [editing, setEditing] = useState(false);
	const [adding, setAdding] = useState(false);
	const [removing, setRemoving] = useState<TAddress | null>(null);
	const { run, submitting } = useRunner();

	if (isPending) return <PageSkeleton />;
	if (isError) return <ErrorState error={error} bordered />;
	if (!customer) return <EmptyState title={t('crm:customers.notFound')} bordered />;

	const active = customer.status === 'active';

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/crm/customers' className='text-sm text-muted-foreground hover:underline'>
				{t('crm:customers.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<div className='flex items-center gap-2'>
						<h1 className='text-2xl font-bold'>{customer.name}</h1>
						<Badge variant={active ? 'secondary' : 'outline'}>{t(`crm:customerStatus.${customer.status}`)}</Badge>
					</div>
					<p className='font-mono text-xs text-muted-foreground'>{customer.code}</p>
				</div>
				<div className='flex gap-2'>
					{canUpdate && (
						<Button variant='outline' onClick={() => setEditing(true)}>
							{t('common:action.edit')}
						</Button>
					)}
					{canArchive && (
						<Button
							variant='outline'
							disabled={submitting}
							onClick={() =>
								void run(
									() => setCustomerActive(customer.id, !active),
									active ? t('crm:customers.deactivated') : t('crm:customers.activated'),
								)
							}
						>
							{active ? t('crm:customers.deactivate') : t('crm:customers.activate')}
						</Button>
					)}
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('crm:customers.details')}</CardTitle>
				</CardHeader>
				<CardContent className='grid grid-cols-2 gap-4 text-sm sm:grid-cols-4'>
					<Detail label={t('crm:customer.customerType')} value={t(`crm:customerType.${customer.customerType}`)} />
					<div>
						<div className='text-muted-foreground'>{t('crm:customer.company')}</div>
						<div>
							{customer.companyId ? (
								<Link
									to='/crm/customers/$customerId'
									params={{ customerId: customer.companyId }}
									search={{ kind: 'company' }}
									className='hover:underline'
								>
									{company.data?.name ?? '-'}
								</Link>
							) : (
								'-'
							)}
						</div>
					</div>
					<Detail label={t('crm:customer.position')} value={customer.position} />
					<Detail label={t('crm:customer.email')} value={customer.email} />
					<Detail label={t('crm:customer.phone')} value={customer.phone} />
					<Detail label={t('crm:customer.whatsapp')} value={customer.whatsapp} />
					<div className='col-span-2 sm:col-span-4'>
						<Detail label={t('crm:customer.notes')} value={customer.notes} />
					</div>
				</CardContent>
			</Card>

			<AddressList
				addresses={customer.addresses}
				canUpdate={canUpdate}
				onAdd={() => setAdding(true)}
				onRemove={setRemoving}
			/>

			{/* Contacts of a company get their login through the company's card. */}
			{!customer.companyId && (
				<PortalAccountCard scope={{ customerId: customer.id }} defaultName={customer.name} defaultEmail={customer.email} />
			)}

			{editing && (
				<CustomerFormDialog
					customer={customer}
					submitting={submitting}
					onClose={() => setEditing(false)}
					onSave={(input: TCustomerInput) =>
						void run(() => updateCustomer(customer.id, input), t('crm:customers.saved'), () => setEditing(false))
					}
				/>
			)}
			{adding && (
				<AddressFormDialog
					kinds={CUSTOMER_ADDRESS_KINDS}
					submitting={submitting}
					onClose={() => setAdding(false)}
					onSave={(values: TAddressFormValues) =>
						void run(
							() => addCustomerAddress(customer.id, { ...values, kind: values.kind as TCustomerAddress['kind'] }),
							t('crm:address.saved'),
							() => setAdding(false),
						)
					}
				/>
			)}
			<RemoveAddressDialog
				address={removing}
				onCancel={() => setRemoving(null)}
				onConfirm={(address) =>
					void run(() => removeCustomerAddress(customer.id, address.id), t('crm:address.removed'), () => setRemoving(null))
				}
			/>
		</div>
	);
}

function CompanyDetail() {
	const { t } = useTranslation(['crm', 'common']);
	const { customerId: companyId } = useParams({ from: Route.id });
	const canUpdate = usePermission('customer.update');
	const canArchive = usePermission('customer.archive');
	const { data: company, isPending, isError, error } = useQuery(companyQueryOptions(companyId));
	const people = useQuery(customersQueryOptions({ page: 1, limit: 100, companyId }));
	const [editing, setEditing] = useState(false);
	const [addingPerson, setAddingPerson] = useState(false);
	const [adding, setAdding] = useState(false);
	const [removing, setRemoving] = useState<TAddress | null>(null);
	const { run, submitting } = useRunner();

	if (isPending) return <PageSkeleton />;
	if (isError) return <ErrorState error={error} bordered />;
	if (!company) return <EmptyState title={t('crm:customers.notFound')} bordered />;

	const active = company.status === 'active';
	const primary = people.data?.rows.find((person) => person.isPrimary);

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/crm/customers' className='text-sm text-muted-foreground hover:underline'>
				{t('crm:customers.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<div className='flex items-center gap-2'>
						<h1 className='text-2xl font-bold'>{company.name}</h1>
						<Badge variant={active ? 'secondary' : 'outline'}>{t(`crm:customerStatus.${company.status}`)}</Badge>
					</div>
					<p className='font-mono text-xs text-muted-foreground'>{company.code}</p>
				</div>
				<div className='flex gap-2'>
					{canUpdate && (
						<Button variant='outline' onClick={() => setEditing(true)}>
							{t('common:action.edit')}
						</Button>
					)}
					{canArchive && (
						<Button
							variant='outline'
							disabled={submitting}
							onClick={() =>
								void run(
									() => setCompanyActive(company.id, !active),
									active ? t('crm:customers.deactivated') : t('crm:customers.activated'),
								)
							}
						>
							{active ? t('crm:customers.deactivate') : t('crm:customers.activate')}
						</Button>
					)}
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('crm:customers.details')}</CardTitle>
				</CardHeader>
				<CardContent className='grid grid-cols-2 gap-4 text-sm sm:grid-cols-4'>
					<Detail label={t('crm:customer.customerType')} value={t(`crm:customerType.${company.companyType}`)} />
					<Detail label={t('crm:customer.legalName')} value={company.legalName} />
					<Detail label={t('crm:customer.taxId')} value={company.taxId} />
					<Detail label={t('crm:customer.website')} value={company.website} />
					<Detail label={t('crm:customer.email')} value={company.email} />
					<Detail label={t('crm:customer.phone')} value={company.phone} />
					<Detail label={t('crm:customer.whatsapp')} value={company.whatsapp} />
					<div className='col-span-2 sm:col-span-4'>
						<Detail label={t('crm:customer.notes')} value={company.notes} />
					</div>
				</CardContent>
			</Card>

			<AddressList
				addresses={company.addresses}
				canUpdate={canUpdate}
				onAdd={() => setAdding(true)}
				onRemove={setRemoving}
			/>

			<Card>
				<CardHeader>
					<CardTitle>{t('crm:contacts.title')}</CardTitle>
					{canUpdate && (
						<CardAction>
							<Button size='sm' variant='outline' onClick={() => setAddingPerson(true)}>
								{t('crm:contacts.add')}
							</Button>
						</CardAction>
					)}
				</CardHeader>
				<CardContent className='flex flex-col gap-2 text-sm'>
					{people.isPending && <SectionSkeleton />}
					{people.isError && <ErrorState error={people.error} size='sm' />}
					{!people.isPending && !people.isError && (people.data?.rows.length ?? 0) === 0 && (
						<EmptyState title={t('crm:contacts.empty')} size='sm' />
					)}
					{people.data?.rows.map((person) => (
						<div key={person.id} className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
							<div>
								<Link
									to='/crm/customers/$customerId'
									params={{ customerId: person.id }}
									className='font-medium hover:underline'
								>
									{person.name}
								</Link>
								{person.isPrimary && (
									<Badge variant='secondary' className='ml-2'>
										{t('crm:contacts.primary')}
									</Badge>
								)}
								<div className='text-muted-foreground'>
									{[person.position, person.phone, person.whatsapp, person.email].filter(Boolean).join(' · ') || '-'}
								</div>
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			<PortalAccountCard
				scope={{ companyId: company.id }}
				defaultName={primary?.name ?? company.name}
				defaultEmail={primary?.email ?? company.email}
			/>

			{editing && (
				<CompanyFormDialog
					company={company}
					submitting={submitting}
					onClose={() => setEditing(false)}
					onSave={(input: TCompanyInput) =>
						void run(() => updateCompany(company.id, input), t('crm:customers.saved'), () => setEditing(false))
					}
				/>
			)}
			{addingPerson && (
				<CustomerFormDialog
					customer={null}
					defaultCompanyId={company.id}
					submitting={submitting}
					onClose={() => setAddingPerson(false)}
					onSave={(input: TCustomerInput) =>
						void run(() => createCustomer(input), t('crm:contacts.saved'), () => setAddingPerson(false))
					}
				/>
			)}
			{adding && (
				<AddressFormDialog
					kinds={COMPANY_ADDRESS_KINDS}
					submitting={submitting}
					onClose={() => setAdding(false)}
					onSave={(values: TAddressFormValues) =>
						void run(
							() => addCompanyAddress(company.id, { ...values, kind: values.kind as TCompanyAddress['kind'], contactName: null, contactPhone: null }),
							t('crm:address.saved'),
							() => setAdding(false),
						)
					}
				/>
			)}
			<RemoveAddressDialog
				address={removing}
				onCancel={() => setRemoving(null)}
				onConfirm={(address) =>
					void run(() => removeCompanyAddress(company.id, address.id), t('crm:address.removed'), () => setRemoving(null))
				}
			/>
		</div>
	);
}

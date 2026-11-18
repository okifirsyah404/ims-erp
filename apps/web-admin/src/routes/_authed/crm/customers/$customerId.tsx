import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useParams } from '@tanstack/react-router';
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
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { ContactFormDialog } from '@/components/crm/contact-form-dialog';
import { CustomerFormDialog } from '@/components/crm/customer-form-dialog';
import { PortalAccountCard } from '@/components/crm/portal-account-card';
import { toast } from '@/components/toast';
import {
	addContact,
	customerQueryOptions,
	removeContact,
	setCustomerActive,
	type TContactInput,
	type TCustomerContact,
	type TCustomerInput,
	updateContact,
	updateCustomer,
} from '@/lib/customer-api';
import { usePermission } from '@/lib/use-permission';

/** `/crm/customers/$customerId` — one customer with its contacts. */
export const Route = createFileRoute('/_authed/crm/customers/$customerId')({
	component: CustomerDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function CustomerDetailPage() {
	const { t } = useTranslation(['crm', 'common']);
	const { customerId } = useParams({ from: Route.id });
	const queryClient = useQueryClient();
	const canUpdate = usePermission('customer.update');
	const canArchive = usePermission('customer.archive');
	const { data: customer, isPending, isError } = useQuery(customerQueryOptions(customerId));
	const [editing, setEditing] = useState(false);
	const [contact, setContact] = useState<TCustomerContact | 'new' | null>(null);
	const [removing, setRemoving] = useState<TCustomerContact | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });

	async function run(action: () => Promise<unknown>, success: string, done?: () => void) {
		setSubmitting(true);
		try {
			await action();
			await refresh();
			toast.success(success);
			done?.();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	if (isPending) return null;
	if (isError || !customer) {
		return <p className='text-sm text-muted-foreground'>{t('crm:customers.notFound')}</p>;
	}

	const active = customer.status === 'active';

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/crm/customers' className='text-sm text-muted-foreground hover:underline'>
				← {t('crm:customers.back')}
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
					<Detail label={t('crm:customer.legalName')} value={customer.legalName} />
					<Detail label={t('crm:customer.taxId')} value={customer.taxId} />
					<Detail label={t('crm:customer.email')} value={customer.email} />
					<Detail label={t('crm:customer.phone')} value={customer.phone} />
					<Detail label={t('crm:customer.whatsapp')} value={customer.whatsapp} />
					<Detail label={t('crm:customer.postalCode')} value={customer.postalCode} />
					<div className='col-span-2 sm:col-span-4'>
						<Detail label={t('crm:customer.address')} value={customer.addressLine} />
					</div>
					<div className='col-span-2 sm:col-span-4'>
						<Detail label={t('crm:customer.notes')} value={customer.notes} />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className='flex flex-row items-center justify-between'>
					<CardTitle>{t('crm:contacts.title')}</CardTitle>
					{canUpdate && (
						<Button size='sm' variant='outline' onClick={() => setContact('new')}>
							{t('crm:contacts.add')}
						</Button>
					)}
				</CardHeader>
				<CardContent className='flex flex-col gap-2 text-sm'>
					{customer.contacts.length === 0 && <p className='text-muted-foreground'>{t('crm:contacts.empty')}</p>}
					{customer.contacts.map((person) => (
						<div key={person.id} className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
							<div>
								<div className='font-medium'>
									{person.name}
									{person.isPrimary && (
										<Badge variant='secondary' className='ml-2'>
											{t('crm:contacts.primary')}
										</Badge>
									)}
								</div>
								<div className='text-muted-foreground'>
									{[person.position, person.phone, person.whatsapp, person.email].filter(Boolean).join(' · ') || '—'}
								</div>
							</div>
							{canUpdate && (
								<div className='flex gap-2'>
									<Button size='sm' variant='outline' onClick={() => setContact(person)}>
										{t('common:action.edit')}
									</Button>
									<Button size='sm' variant='outline' onClick={() => setRemoving(person)}>
										{t('crm:contacts.remove')}
									</Button>
								</div>
							)}
						</div>
					))}
				</CardContent>
			</Card>

			<PortalAccountCard
				customerId={customer.id}
				defaultName={customer.contacts.find((item) => item.isPrimary)?.name ?? customer.name}
				defaultEmail={customer.contacts.find((item) => item.isPrimary)?.email ?? customer.email}
			/>

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
			{contact && (
				<ContactFormDialog
					contact={contact === 'new' ? null : contact}
					submitting={submitting}
					onClose={() => setContact(null)}
					onSave={(input: TContactInput) =>
						void run(
							() =>
								contact === 'new'
									? addContact(customer.id, input)
									: updateContact(customer.id, contact.id, input),
							t('crm:contacts.saved'),
							() => setContact(null),
						)
					}
				/>
			)}
			<AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('crm:contacts.remove')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('crm:contacts.removeConfirm', { name: removing?.name ?? '' })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								removing &&
								void run(() => removeContact(customer.id, removing.id), t('crm:contacts.removed'), () =>
									setRemoving(null),
								)
							}
						>
							{t('crm:contacts.remove')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

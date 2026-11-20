import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { SupplierFormDialog } from '@/components/procurement/supplier-form-dialog';
import { toast } from '@/components/toast';
import {
	createSupplierPerson,
	removeSupplierPerson,
	setSupplierCompanyActive,
	supplierCompanyQueryOptions,
	updateSupplierCompany,
} from '@/lib/supplier-api';
import { usePermission } from '@/lib/use-permission';

/** `/procurement/suppliers/$supplierId` - one supplier company with its contact people. */
export const Route = createFileRoute('/_authed/procurement/suppliers/$supplierId')({
	component: SupplierDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '-'}</div>
		</div>
	);
}

function PersonDialog({
	submitting,
	onClose,
	onSave,
}: {
	submitting: boolean;
	onClose: () => void;
	onSave: (input: { name: string; title: string | null; phone: string | null; email: string | null; isPrimary: boolean }) => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const [name, setName] = useState('');
	const [title, setTitle] = useState('');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');
	const [isPrimary, setIsPrimary] = useState(false);
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							name: name.trim(),
							title: title.trim() || null,
							phone: phone.trim() || null,
							email: email.trim() || null,
							isPrimary,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('procurement:suppliers.addPerson')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='grid gap-4 py-4 sm:grid-cols-2'>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='person-name'>{t('procurement:supplier.picName')}</FieldLabel>
							<Input id='person-name' required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='person-title'>{t('procurement:supplier.picTitle')}</FieldLabel>
							<Input id='person-title' maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='person-phone'>{t('procurement:supplier.picPhone')}</FieldLabel>
							<Input id='person-phone' type='tel' maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} />
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='person-email'>{t('procurement:supplier.picEmail')}</FieldLabel>
							<Input id='person-email' type='email' value={email} onChange={(event) => setEmail(event.target.value)} />
						</Field>
						<Field orientation='horizontal' className='sm:col-span-2'>
							<Checkbox id='person-primary' checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(checked === true)} />
							<FieldLabel htmlFor='person-primary'>{t('procurement:supplier.isPrimary')}</FieldLabel>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting || name.trim() === ''}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function SupplierDetailPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const { supplierId } = Route.useParams();
	const queryClient = useQueryClient();
	const canUpdate = usePermission('supplier.update');
	const canArchive = usePermission('supplier.archive');
	const canSeeBank = usePermission('supplier.read_bank');
	const [editing, setEditing] = useState(false);
	const [addingPerson, setAddingPerson] = useState(false);
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(supplierCompanyQueryOptions(supplierId));

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: ['procurement', 'suppliers'] });
			toast.success(message);
			setEditing(false);
			setAddingPerson(false);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	}

	if (isPending) return null;
	if (isError) return <p className='text-sm text-destructive'>{error.message}</p>;

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/procurement/suppliers' className='text-sm text-muted-foreground hover:underline'>
				{t('procurement:suppliers.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.name}</h1>
					<div className='mt-1 flex items-center gap-2 text-sm text-muted-foreground'>
						{data.code}
						<Badge variant={data.status === 'active' ? 'default' : 'outline'}>{t(`common:status.${data.status}`)}</Badge>
					</div>
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
							disabled={busy}
							onClick={() =>
								void run(
									() => setSupplierCompanyActive(supplierId, data.status !== 'active'),
									data.status === 'active' ? t('procurement:suppliers.deactivated') : t('procurement:suppliers.activated'),
								)
							}
						>
							{data.status === 'active' ? t('procurement:suppliers.deactivate') : t('procurement:suppliers.activate')}
						</Button>
					)}
				</div>
			</div>
			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:suppliers.identity')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('procurement:supplier.supplierType')} value={t(`procurement:supplierType.${data.supplierType}`)} />
						<Detail label={t('procurement:supplier.legalName')} value={data.legalName} />
						<Detail label={t('procurement:supplier.taxId')} value={data.taxId} />
						<Detail label={t('procurement:supplier.website')} value={data.website} />
						<Detail label={t('procurement:supplier.email')} value={data.email} />
						<Detail label={t('procurement:supplier.phone')} value={data.phone} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:suppliers.purchasing')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('procurement:supplier.paymentTermsDays')} value={String(data.paymentTermsDays)} />
						<Detail label={t('procurement:supplier.paymentTermNote')} value={data.paymentTermNote} />
						{canSeeBank && (
							<Detail
								label={t('procurement:suppliers.bank')}
								value={[data.bankName, data.bankAccountNumber, data.bankAccountHolder].filter(Boolean).join(' · ')}
							/>
						)}
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:suppliers.people')}</CardTitle>
					{canUpdate && (
						<CardAction>
							<Button variant='outline' size='sm' onClick={() => setAddingPerson(true)}>
								{t('procurement:suppliers.addPerson')}
							</Button>
						</CardAction>
					)}
				</CardHeader>
				<CardContent className='flex flex-col gap-3 text-sm'>
					{data.people.length === 0 && <p className='text-muted-foreground'>{t('procurement:suppliers.noPeople')}</p>}
					{data.people.map((person) => (
						<div key={person.id} className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
							<div>
								<div className='font-medium'>
									{person.name}
									{person.title ? ` (${person.title})` : ''}{' '}
									{person.isPrimary && <Badge variant='secondary'>{t('procurement:suppliers.primary')}</Badge>}
								</div>
								<div className='text-muted-foreground'>{[person.phone, person.email].filter(Boolean).join(' · ') || '-'}</div>
							</div>
							{canUpdate && (
								<Button
									variant='ghost'
									size='sm'
									disabled={busy}
									onClick={() => void run(() => removeSupplierPerson(person.id), t('procurement:suppliers.personRemoved'))}
								>
									{t('common:action.delete')}
								</Button>
							)}
						</div>
					))}
				</CardContent>
			</Card>
			{editing && (
				<SupplierFormDialog
					supplier={data}
					canSeeBank={canSeeBank}
					submitting={busy}
					onClose={() => setEditing(false)}
					onSave={(input) => void run(() => updateSupplierCompany(supplierId, input), t('procurement:suppliers.saved'))}
				/>
			)}
			{addingPerson && (
				<PersonDialog
					submitting={busy}
					onClose={() => setAddingPerson(false)}
					onSave={(input) =>
						void run(() => createSupplierPerson({ ...input, companyId: supplierId, whatsapp: null }), t('procurement:suppliers.personSaved'))
					}
				/>
			)}
		</div>
	);
}

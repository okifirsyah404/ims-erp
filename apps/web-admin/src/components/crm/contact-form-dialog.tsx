import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import type { TContactInput, TCustomerContact } from '@/lib/customer-api';

/** Create/edit dialog for a customer's contact person. */
export function ContactFormDialog({
	contact,
	submitting,
	onClose,
	onSave,
}: {
	contact: TCustomerContact | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TContactInput) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const [name, setName] = useState(contact?.name ?? '');
	const [position, setPosition] = useState(contact?.position ?? '');
	const [email, setEmail] = useState(contact?.email ?? '');
	const [phone, setPhone] = useState(contact?.phone ?? '');
	const [whatsapp, setWhatsapp] = useState(contact?.whatsapp ?? '');
	const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false);
	const text = (value: string) => value.trim() || null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							name: name.trim(),
							position: text(position),
							email: text(email),
							phone: text(phone),
							whatsapp: text(whatsapp),
							isPrimary,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{contact ? t('crm:contacts.edit') : t('crm:contacts.add')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='contact-name'>{t('crm:contacts.name')}</FieldLabel>
								<Input
									id='contact-name'
									required
									maxLength={200}
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='contact-position'>{t('crm:contacts.position')}</FieldLabel>
								<Input
									id='contact-position'
									maxLength={100}
									value={position}
									onChange={(event) => setPosition(event.target.value)}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='contact-email'>{t('crm:customer.email')}</FieldLabel>
							<Input
								id='contact-email'
								type='email'
								maxLength={254}
								value={email}
								onChange={(event) => setEmail(event.target.value)}
							/>
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='contact-phone'>{t('crm:customer.phone')}</FieldLabel>
								<Input
									id='contact-phone'
									type='tel'
									maxLength={30}
									value={phone}
									onChange={(event) => setPhone(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='contact-whatsapp'>{t('crm:customer.whatsapp')}</FieldLabel>
								<Input
									id='contact-whatsapp'
									type='tel'
									maxLength={30}
									value={whatsapp}
									onChange={(event) => setWhatsapp(event.target.value)}
								/>
							</Field>
						</div>
						<label className='flex items-center gap-2 text-sm'>
							<Checkbox checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(checked === true)} />
							{t('crm:contacts.isPrimary')}
						</label>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

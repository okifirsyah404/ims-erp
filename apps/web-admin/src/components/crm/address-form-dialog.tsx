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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import {
	EMPTY_LOCATION_SELECTION,
	LocationCascade,
	type TLocationSelection,
} from '@/components/inventory/location-cascade';

export type TAddressFormValues = {
	kind: string;
	label: string | null;
	addressLine: string;
	villageId: string | null;
	postalCode: string | null;
	isPrimary: boolean;
};

/**
 * Add-address dialog shared by companies (billing / shipping / .) and
 * people (residence / office / .). Only the village is stored, the server
 * derives the rest of the location chain.
 */
export function AddressFormDialog({
	kinds,
	submitting,
	onClose,
	onSave,
}: {
	kinds: readonly string[];
	submitting: boolean;
	onClose: () => void;
	onSave: (values: TAddressFormValues) => void;
}) {
	const { t } = useTranslation(['crm', 'common']);
	const [kind, setKind] = useState(kinds[0] ?? 'other');
	const [label, setLabel] = useState('');
	const [addressLine, setAddressLine] = useState('');
	const [postalCode, setPostalCode] = useState('');
	const [isPrimary, setIsPrimary] = useState(false);
	const [location, setLocation] = useState<TLocationSelection>(EMPTY_LOCATION_SELECTION);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							kind,
							label: label.trim() || null,
							addressLine: addressLine.trim(),
							villageId: location.villageId,
							postalCode: postalCode.trim() || null,
							isPrimary,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('crm:address.add')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='address-kind'>{t('crm:address.kindLabel')}</FieldLabel>
								<Select value={kind} onValueChange={(value: string | null) => setKind(value ?? kinds[0] ?? 'other')}>
									<SelectTrigger id='address-kind' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{kinds.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`crm:address.kind.${value}` as 'address.kind.other')}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='address-label'>{t('crm:address.label')}</FieldLabel>
								<Input id='address-label' maxLength={100} value={label} onChange={(event) => setLabel(event.target.value)} />
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='address-line'>{t('crm:customer.address')}</FieldLabel>
							<Textarea
								id='address-line'
								required
								rows={2}
								maxLength={500}
								value={addressLine}
								onChange={(event) => setAddressLine(event.target.value)}
							/>
						</Field>
						<LocationCascade value={location} initialVillageId={null} onChange={setLocation} />
						<Field className='sm:max-w-48'>
							<FieldLabel htmlFor='address-postal'>{t('crm:customer.postalCode')}</FieldLabel>
							<Input
								id='address-postal'
								inputMode='numeric'
								pattern='[0-9]*'
								maxLength={10}
								value={postalCode}
								onChange={(event) => setPostalCode(event.target.value)}
							/>
						</Field>
						<Field orientation='horizontal'>
							<Checkbox id='address-primary' checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(checked === true)} />
							<FieldLabel htmlFor='address-primary'>{t('crm:address.primary')}</FieldLabel>
						</Field>
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

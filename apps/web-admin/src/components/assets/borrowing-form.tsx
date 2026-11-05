import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect } from '@ims-erp/ui/components/native-select';
import {
	BORROWING_PURPOSES,
	GUEST_ID_TYPES,
	createBorrowing,
	type TBorrowerInput,
	type TBorrowingLineInput,
	type TBorrowingPurpose,
	type TGuestIdType,
} from '@/lib/borrowing-api';
import { assetsQueryOptions } from '@/lib/asset-api';
import { toast } from '@/components/toast';

/** One unit the user has added to the request. */
type TUnitDraft = {
	/** React key, so removing a row cannot reuse another row's state. */
	key: number;
	assetId: string;
	label: string;
};

let nextKey = 1;

/**
 * The borrowing create form, with the three borrower paths as tabs.
 *
 * @remarks
 * **Creating a borrowing does not move stock.** The document starts in
 * `requested`; issuing it is a separate action by someone holding
 * `asset_borrowing:issue`. That split is why this form has no "issue" button — a form
 * that could hand out a tool would bypass approval entirely.
 *
 * The three borrower kinds are modelled as a **discriminated union** end to end
 * (here, in `borrowing-api.ts`, and in the backend schema), so switching tabs
 * cannot leave a guest's `borrowerUserId` set alongside `guestName`. On submit
 * only the active branch's fields are sent; the backend rejects a mixed body at
 * the edge rather than trusting this form to be careful.
 *
 * The unit picker lists assets that are currently `ready`; the backend
 * re-checks availability and custody under guard, so the list is a convenience
 * rather than a second source of truth.
 */
export function BorrowingForm() {
	const { t } = useTranslation(['assets', 'common']);
	const queryClient = useQueryClient();

	const [borrowerType, setBorrowerType] = useState<
		'user' | 'customer' | 'guest'
	>('user');
	const [borrowerUserId, setBorrowerUserId] = useState('');
	const [borrowerCustomerId, setBorrowerCustomerId] = useState('');
	const [guestName, setGuestName] = useState('');
	const [guestPhone, setGuestPhone] = useState('');
	const [guestIdType, setGuestIdType] = useState<TGuestIdType | ''>('');
	const [guestIdNumber, setGuestIdNumber] = useState('');
	const [guestAddressText, setGuestAddressText] = useState('');
	const [guestIdDocumentRef, setGuestIdDocumentRef] = useState('');
	const [purpose, setPurpose] = useState<TBorrowingPurpose>('internal_use');
	const [dueAt, setDueAt] = useState('');
	const [notes, setNotes] = useState('');
	const [units, setUnits] = useState<TUnitDraft[]>([]);
	const [unitSelect, setUnitSelect] = useState('');

	const readyAssets = useQuery(
		assetsQueryOptions({ page: 1, limit: 100, status: 'ready' }),
	);

	const creation = useMutation({
		mutationFn: (input: Parameters<typeof createBorrowing>[0]) =>
			createBorrowing(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['assets'] });
			toast.success(t('assets:borrowingForm.created'));
			setUnits([]);
			setNotes('');
		},
		onError: (error) => toast.error(error.message),
	});

	/** Assembles the borrower branch, or explains what is missing. */
	function buildBorrower(): TBorrowerInput | null {
		if (borrowerType === 'user') {
			if (!borrowerUserId) return null;
			return { borrowerType: 'user', borrowerUserId };
		}
		if (borrowerType === 'customer') {
			if (!borrowerCustomerId) return null;
			return { borrowerType: 'customer', borrowerCustomerId };
		}
		// The backend's schema CHECK requires the name/phone/id triple, so the form
		// refuses to submit without all three rather than earning a 422.
		if (!guestName || !guestPhone || !guestIdNumber) return null;
		return {
			borrowerType: 'guest',
			guestName,
			guestPhone,
			guestIdType: guestIdType === '' ? null : guestIdType,
			guestIdNumber,
			guestAddressText: guestAddressText === '' ? null : guestAddressText,
			guestIdDocumentRef: guestIdDocumentRef === '' ? null : guestIdDocumentRef,
		};
	}

	function addUnit() {
		if (unitSelect === '') return;
		if (units.some((unit) => unit.assetId === unitSelect)) return;
		const asset = readyAssets.data?.rows.find((row) => row.id === unitSelect);
		setUnits((current) => [
			...current,
			{
				key: nextKey++,
				assetId: unitSelect,
				label: asset ? `${asset.code} · ${asset.name}` : unitSelect,
			},
		]);
		setUnitSelect('');
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const borrower = buildBorrower();
		if (!borrower || !dueAt || units.length === 0) return;

		const lines: TBorrowingLineInput[] = units.map((unit) => ({
			assetId: unit.assetId,
		}));

		creation.mutate({
			...borrower,
			purpose,
			dueAt: new Date(dueAt).toISOString(),
			notes: notes === '' ? null : notes,
			lines,
		});
	}

	const canSubmit =
		!creation.isPending && dueAt !== '' && units.length > 0 && buildBorrower() !== null;

	return (
		<form onSubmit={handleSubmit}>
			<Card>
				<CardHeader>
					<CardTitle className='text-base'>
						{t('assets:borrowingForm.new')}
					</CardTitle>
					<CardDescription>
						{t('assets:borrowingForm.newDescription')}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor='borrowerType'>
								{t('assets:borrowingForm.borrowerType')}
							</FieldLabel>
							<NativeSelect
								id='borrowerType'
								value={borrowerType}
								onChange={(event) =>
									setBorrowerType(
										event.target.value as 'user' | 'customer' | 'guest',
									)
								}
							>
								<option value='user'>{t('assets:borrowingForm.user')}</option>
								<option value='customer'>
									{t('assets:borrowingForm.customer')}
								</option>
								<option value='guest'>
									{t('assets:borrowingForm.guest')}
								</option>
							</NativeSelect>
						</Field>

						{borrowerType === 'user' ? (
							<Field>
								<FieldLabel htmlFor='borrowerUserId'>
									{t('assets:borrowingForm.userId')}
								</FieldLabel>
								<Input
									id='borrowerUserId'
									value={borrowerUserId}
									onChange={(event) => setBorrowerUserId(event.target.value)}
								/>
							</Field>
						) : null}

						{borrowerType === 'customer' ? (
							<Field>
								<FieldLabel htmlFor='borrowerCustomerId'>
									{t('assets:borrowingForm.customerId')}
								</FieldLabel>
								<Input
									id='borrowerCustomerId'
									value={borrowerCustomerId}
									onChange={(event) =>
										setBorrowerCustomerId(event.target.value)
									}
								/>
							</Field>
						) : null}

						{borrowerType === 'guest' ? (
							<>
								<Field>
									<FieldLabel htmlFor='guestName'>
										{t('assets:borrowingForm.guestName')}
									</FieldLabel>
									<Input
										id='guestName'
										value={guestName}
										onChange={(event) => setGuestName(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestPhone'>
										{t('assets:borrowingForm.guestPhone')}
									</FieldLabel>
									<Input
										id='guestPhone'
										value={guestPhone}
										onChange={(event) => setGuestPhone(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestIdType'>
										{t('assets:borrowingForm.guestIdType')}
									</FieldLabel>
									<NativeSelect
										id='guestIdType'
										value={guestIdType}
										onChange={(event) =>
											setGuestIdType(event.target.value as TGuestIdType | '')
										}
									>
										<option value=''>—</option>
										{GUEST_ID_TYPES.map((type) => (
											<option key={type} value={type}>
												{type.toUpperCase()}
											</option>
										))}
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestIdNumber'>
										{t('assets:borrowingForm.guestIdNumber')}
									</FieldLabel>
									<Input
										id='guestIdNumber'
										value={guestIdNumber}
										onChange={(event) => setGuestIdNumber(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestAddress'>
										{t('assets:borrowingForm.guestAddress')}
									</FieldLabel>
									<Input
										id='guestAddress'
										value={guestAddressText}
										onChange={(event) =>
											setGuestAddressText(event.target.value)
										}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestIdDocumentRef'>
										{t('assets:borrowingForm.guestDocumentRef')}
									</FieldLabel>
									<Input
										id='guestIdDocumentRef'
										value={guestIdDocumentRef}
										onChange={(event) =>
											setGuestIdDocumentRef(event.target.value)
										}
									/>
								</Field>
								<p className='text-xs text-muted-foreground'>
									{t('assets:borrowingForm.identityHint')}
								</p>
							</>
						) : null}

						<Field>
							<FieldLabel htmlFor='purpose'>
								{t('assets:borrowingForm.purpose')}
							</FieldLabel>
							<NativeSelect
								id='purpose'
								value={purpose}
								onChange={(event) =>
									setPurpose(event.target.value as TBorrowingPurpose)
								}
							>
								{BORROWING_PURPOSES.map((option) => (
									<option key={option} value={option}>
										{t(
											`assets:borrowingPurpose.${option}` as 'assets:borrowingPurpose.rental',
										)}
									</option>
								))}
							</NativeSelect>
						</Field>

						<Field>
							<FieldLabel htmlFor='dueAt'>
								{t('assets:borrowingForm.dueAt')}
							</FieldLabel>
							<Input
								id='dueAt'
								type='date'
								value={dueAt}
								onChange={(event) => setDueAt(event.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor='notes'>
								{t('assets:borrowingForm.notes')}
							</FieldLabel>
							<Input
								id='notes'
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor='unitInput'>
								{t('assets:borrowings.serial')}
							</FieldLabel>
							<p className='text-xs text-muted-foreground'>
								{t('assets:borrowingForm.unitsDescription')}
							</p>
							<div className='flex gap-2'>
								<NativeSelect
									id='unitInput'
									value={unitSelect}
									onChange={(event) => setUnitSelect(event.target.value)}
								>
									<option value=''>
										{t('assets:borrowingForm.searchUnits')}
									</option>
									{(readyAssets.data?.rows ?? [])
										.filter(
											(asset) =>
												!units.some((unit) => unit.assetId === asset.id),
										)
										.map((asset) => (
											<option key={asset.id} value={asset.id}>
												{asset.code} · {asset.name}
											</option>
										))}
								</NativeSelect>
								<Button type='button' variant='secondary' onClick={addUnit}>
									{t('assets:borrowingForm.addUnit')}
								</Button>
							</div>
							{units.length === 0 ? (
								<p className='text-xs text-muted-foreground'>
									{t('assets:borrowingForm.emptyLines')}
								</p>
							) : (
								<ol className='space-y-1 text-sm'>
									{units.map((unit) => (
										<li
											key={unit.key}
											className='flex items-center justify-between gap-2'
										>
											<Badge variant='outline' className='font-mono text-xs'>
												{unit.label}
											</Badge>
											<Button
												type='button'
												size='sm'
												variant='ghost'
												onClick={() =>
													setUnits((current) =>
														current.filter((row) => row.key !== unit.key),
													)
												}
											>
												{t('assets:borrowingForm.removeUnit')}
											</Button>
										</li>
									))}
								</ol>
							)}
						</Field>

						<Button type='submit' disabled={!canSubmit}>
							{creation.isPending
								? t('assets:borrowingForm.creating')
								: t('assets:borrowingForm.create')}
						</Button>
					</FieldGroup>
				</CardContent>
			</Card>
		</form>
	);
}

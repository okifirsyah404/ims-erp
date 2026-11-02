import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { toast } from '@/components/toast';

/** One unit the user has added to the request. */
type TUnitDraft = {
	/** React key, so removing a row cannot reuse another row's state. */
	key: number;
	serialTrackedItemId: string;
};

let nextKey = 1;

/**
 * The borrowing create form, with the three borrower paths as tabs.
 *
 * @remarks
 * **Creating a borrowing does not move stock.** The document starts in
 * `requested`; issuing it is a separate action by someone holding
 * `borrowing:issue`. That split is why this form has no "issue" button — a form
 * that could hand out a tool would bypass approval entirely.
 *
 * The three borrower kinds are modelled as a **discriminated union** end to end
 * (here, in `borrowing-api.ts`, and in the backend schema), so switching tabs
 * cannot leave a guest's `borrowerUserId` set alongside `guestName`. On submit
 * only the active branch's fields are sent; the backend rejects a mixed body at
 * the edge rather than trusting this form to be careful.
 *
 * The units input takes a pasted serial UUID rather than a picker: borrowing is
 * serialized-only (Q5), and the backend re-checks availability under guard, so a
 * picker would only add a second source of truth about what is in stock.
 */
export function BorrowingForm() {
	const { t } = useTranslation(['inventory', 'common']);
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
	const [unitInput, setUnitInput] = useState('');

	const creation = useMutation({
		mutationFn: (input: Parameters<typeof createBorrowing>[0]) =>
			createBorrowing(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['inventory'] });
			toast.success(t('inventory:borrowingForm.created'));
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
		const value = unitInput.trim();
		if (value === '') return;
		if (units.some((unit) => unit.serialTrackedItemId === value)) return;
		setUnits((current) => [
			...current,
			{ key: nextKey++, serialTrackedItemId: value },
		]);
		setUnitInput('');
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const borrower = buildBorrower();
		if (!borrower || !dueAt || units.length === 0) return;

		const lines: TBorrowingLineInput[] = units.map((unit) => ({
			serialTrackedItemId: unit.serialTrackedItemId,
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
						{t('inventory:borrowingForm.new')}
					</CardTitle>
					<CardDescription>
						{t('inventory:borrowingForm.newDescription')}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor='borrowerType'>
								{t('inventory:borrowingForm.borrowerType')}
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
								<option value='user'>{t('inventory:borrowingForm.user')}</option>
								<option value='customer'>
									{t('inventory:borrowingForm.customer')}
								</option>
								<option value='guest'>
									{t('inventory:borrowingForm.guest')}
								</option>
							</NativeSelect>
						</Field>

						{borrowerType === 'user' ? (
							<Field>
								<FieldLabel htmlFor='borrowerUserId'>
									{t('inventory:borrowingForm.userId')}
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
									{t('inventory:borrowingForm.customerId')}
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
										{t('inventory:borrowingForm.guestName')}
									</FieldLabel>
									<Input
										id='guestName'
										value={guestName}
										onChange={(event) => setGuestName(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestPhone'>
										{t('inventory:borrowingForm.guestPhone')}
									</FieldLabel>
									<Input
										id='guestPhone'
										value={guestPhone}
										onChange={(event) => setGuestPhone(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestIdType'>
										{t('inventory:borrowingForm.guestIdType')}
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
										{t('inventory:borrowingForm.guestIdNumber')}
									</FieldLabel>
									<Input
										id='guestIdNumber'
										value={guestIdNumber}
										onChange={(event) => setGuestIdNumber(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor='guestAddress'>
										{t('inventory:borrowingForm.guestAddress')}
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
										{t('inventory:borrowingForm.guestDocumentRef')}
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
									{t('inventory:borrowingForm.identityHint')}
								</p>
							</>
						) : null}

						<Field>
							<FieldLabel htmlFor='purpose'>
								{t('inventory:borrowingForm.purpose')}
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
											`inventory:borrowingPurpose.${option}` as 'inventory:borrowingPurpose.rental',
										)}
									</option>
								))}
							</NativeSelect>
						</Field>

						<Field>
							<FieldLabel htmlFor='dueAt'>
								{t('inventory:borrowingForm.dueAt')}
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
								{t('inventory:borrowingForm.notes')}
							</FieldLabel>
							<Input
								id='notes'
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor='unitInput'>
								{t('inventory:borrowings.serial')}
							</FieldLabel>
							<p className='text-xs text-muted-foreground'>
								{t('inventory:borrowingForm.unitsDescription')}
							</p>
							<div className='flex gap-2'>
								<Input
									id='unitInput'
									value={unitInput}
									placeholder={t('inventory:borrowingForm.searchUnits')}
									onChange={(event) => setUnitInput(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') {
											// Enter adds a unit rather than submitting the form —
											// the natural gesture in a repeatable list input.
											event.preventDefault();
											addUnit();
										}
									}}
								/>
								<Button type='button' variant='secondary' onClick={addUnit}>
									{t('inventory:borrowingForm.addUnit')}
								</Button>
							</div>
							{units.length === 0 ? (
								<p className='text-xs text-muted-foreground'>
									{t('inventory:borrowingForm.emptyLines')}
								</p>
							) : (
								<ol className='space-y-1 text-sm'>
									{units.map((unit) => (
										<li
											key={unit.key}
											className='flex items-center justify-between gap-2'
										>
											<Badge variant='outline' className='font-mono text-xs'>
												{unit.serialTrackedItemId}
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
												{t('inventory:borrowingForm.removeUnit')}
											</Button>
										</li>
									))}
								</ol>
							)}
						</Field>

						<Button type='submit' disabled={!canSubmit}>
							{creation.isPending
								? t('inventory:borrowingForm.creating')
								: t('inventory:borrowingForm.create')}
						</Button>
					</FieldGroup>
				</CardContent>
			</Card>
		</form>
	);
}

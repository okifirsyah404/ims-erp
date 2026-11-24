import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Separator } from '@ims-erp/ui/components/separator';
import { FieldLabel } from '@/components/form/field-label';
import { MoneyInput } from '@/components/money-input';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	accountsQueryOptions,
	toMinor,
	type TCashBankAccount,
} from '@/lib/finance-api';

/** Values the create/edit dialog hands to the caller (money already in minor units). */
export type TCashBankFormValues = {
	code: string;
	name: string;
	accountType: string;
	bankName: string | null;
	accountNumber: string | null;
	accountHolder: string | null;
	invoiceUsage: 'vat' | 'non_vat' | null;
	isPrimary: boolean;
	openingBalance: number;
	glAccountId: string | null;
};

const NONE = 'none';

const ACCOUNT_TYPE_VALUES = ['bank', 'cash', 'ewallet', 'clearing'] as const;

function FormSection({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section className='flex flex-col gap-3'>
			<div>
				<h3 className='text-sm font-medium'>{title}</h3>
				<p className='text-xs text-muted-foreground'>{description}</p>
			</div>
			<div className='grid gap-4 sm:grid-cols-2'>{children}</div>
		</section>
	);
}

/**
 * Create/edit dialog for a treasury cash/bank account (M09 F3).
 *
 * @remarks
 * The invoice fields (`accountNumber`, `accountHolder`, `invoiceUsage`,
 * `isPrimary`) are what the invoice print reads to pick a bank block
 * (`invoice-document.tsx`), so they live in the form rather than only in the
 * seeder. `code` is immutable after create. Opening balance is create-only and
 * informational (the GL stays the source of truth).
 */
export function CashBankFormDialog({
	account,
	submitting,
	onClose,
	onSave,
}: {
	account: TCashBankAccount | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (values: TCashBankFormValues) => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const editing = account !== null;

	const [code, setCode] = useState(account?.code ?? '');
	const [name, setName] = useState(account?.name ?? '');
	const [accountType, setAccountType] = useState(account?.accountType ?? 'bank');
	const [bankName, setBankName] = useState(account?.bankName ?? '');
	const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? '');
	const [accountHolder, setAccountHolder] = useState(account?.accountHolder ?? '');
	const [invoiceUsage, setInvoiceUsage] = useState(account?.invoiceUsage ?? NONE);
	const [isPrimary, setIsPrimary] = useState(account?.isPrimary ?? false);
	const [openingBalance, setOpeningBalance] = useState(
		account ? String(account.openingBalance / 100) : '',
	);
	const [glAccountId, setGlAccountId] = useState(account?.glAccountId ?? NONE);

	const { data: glAccounts } = useQuery(
		accountsQueryOptions({ page: 1, limit: 100, isActive: true, isPostable: true }),
	);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					className='flex flex-col gap-5'
					onSubmit={(event) => {
						event.preventDefault();
						const text = (value: string) => value.trim() || null;
						onSave({
							code: code.trim().toUpperCase(),
							name: name.trim(),
							accountType,
							bankName: text(bankName),
							accountNumber: text(accountNumber),
							accountHolder: text(accountHolder),
							invoiceUsage:
								invoiceUsage === NONE
									? null
									: (invoiceUsage as 'vat' | 'non_vat'),
							isPrimary,
							openingBalance: toMinor(openingBalance),
							glAccountId: glAccountId === NONE ? null : glAccountId,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{editing ? t('finance:cashBank.edit') : t('finance:cashBank.create')}
						</DialogTitle>
					</DialogHeader>

					<FormSection
						title={t('finance:cashBank.identity')}
						description={t('finance:cashBank.identityDescription')}
					>
						<Field>
							<FieldLabel htmlFor='cash-bank-code'>
								{t('finance:common.code')}
							</FieldLabel>
							<Input
								id='cash-bank-code'
								required
								maxLength={32}
								className='font-mono uppercase'
								value={code}
								disabled={editing}
								onChange={(event) => setCode(event.target.value)}
							/>
							{editing ? (
								<FieldDescription>
									{t('finance:cashBank.codeImmutable')}
								</FieldDescription>
							) : null}
						</Field>
						<Field>
							<FieldLabel htmlFor='cash-bank-name'>
								{t('finance:common.name')}
							</FieldLabel>
							<Input
								id='cash-bank-name'
								required
								maxLength={200}
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='cash-bank-type'>
								{t('finance:cashBank.accountType')}
							</FieldLabel>
							<Select
								value={accountType}
								onValueChange={(value: string | null) =>
									setAccountType(value ?? 'bank')
								}
							>
								<SelectTrigger id='cash-bank-type' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ACCOUNT_TYPE_VALUES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`finance:accountType.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='cash-bank-gl'>
								{t('finance:cashBank.glLink')}
							</FieldLabel>
							<Select
								value={glAccountId}
								onValueChange={(value: string | null) =>
									setGlAccountId(value ?? NONE)
								}
							>
								<SelectTrigger id='cash-bank-gl' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>{t('finance:common.none')}</SelectItem>
									{(glAccounts?.rows ?? []).map((gl) => (
										<SelectItem key={gl.id} value={gl.id}>
											{gl.code} — {gl.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								{t('finance:cashBank.glLinkRequired')}
							</FieldDescription>
						</Field>
						{editing ? null : (
							<Field>
								<FieldLabel htmlFor='cash-bank-opening' optional>
									{t('finance:cashBank.openingBalance')}
								</FieldLabel>
								<MoneyInput
									id='cash-bank-opening'
									value={openingBalance}
									onValueChange={setOpeningBalance}
								/>
							</Field>
						)}
					</FormSection>

					<Separator />

					<FormSection
						title={t('finance:cashBank.bankDetails')}
						description={t('finance:cashBank.bankDetailsDescription')}
					>
						<Field>
							<FieldLabel htmlFor='cash-bank-bank-name' optional>
								{t('finance:cashBank.bankName')}
							</FieldLabel>
							<Input
								id='cash-bank-bank-name'
								maxLength={200}
								value={bankName}
								onChange={(event) => setBankName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='cash-bank-number' optional>
								{t('finance:cashBank.accountNumber')}
							</FieldLabel>
							<Input
								id='cash-bank-number'
								inputMode='numeric'
								maxLength={100}
								value={accountNumber}
								onChange={(event) => setAccountNumber(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='cash-bank-holder' optional>
								{t('finance:cashBank.accountHolder')}
							</FieldLabel>
							<Input
								id='cash-bank-holder'
								maxLength={200}
								value={accountHolder}
								onChange={(event) => setAccountHolder(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='cash-bank-usage' optional>
								{t('finance:cashBank.invoiceUsage')}
							</FieldLabel>
							<Select
								value={invoiceUsage}
								onValueChange={(value: string | null) =>
									setInvoiceUsage(value ?? NONE)
								}
							>
								<SelectTrigger id='cash-bank-usage' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>{t('finance:common.none')}</SelectItem>
									<SelectItem value='vat'>
										{t('finance:cashBank.invoiceUsage.vat')}
									</SelectItem>
									<SelectItem value='non_vat'>
										{t('finance:cashBank.invoiceUsage.nonVat')}
									</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<Field orientation='horizontal' className='sm:col-span-2'>
							<Checkbox
								id='cash-bank-primary'
								checked={isPrimary}
								disabled={invoiceUsage === NONE}
								onCheckedChange={(checked) => setIsPrimary(checked === true)}
							/>
							<div className='flex flex-col gap-1'>
								<FieldLabel htmlFor='cash-bank-primary'>
									{t('finance:cashBank.isPrimary')}
								</FieldLabel>
								<FieldDescription>
									{t('finance:cashBank.isPrimaryHint')}
								</FieldDescription>
							</div>
						</Field>
					</FormSection>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting || !code.trim() || !name.trim()}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}

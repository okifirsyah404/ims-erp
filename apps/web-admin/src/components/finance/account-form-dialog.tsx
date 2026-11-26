import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import { Textarea } from '@ims-erp/ui/components/textarea';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	ACCOUNT_TYPES,
	accountsQueryOptions,
	CASH_FLOW_CATEGORIES,
	type TAccount,
	type TAccountType,
	type TCashFlowCategory,
} from '@/lib/finance-api';

/** Values the create/edit dialog hands to the caller. */
export type TAccountFormValues = {
	code: string;
	name: string;
	accountType: TAccountType;
	normalBalance: 'debit' | 'credit';
	parentAccountId: string | null;
	isPostable: boolean;
	cashFlowCategory: TCashFlowCategory | null;
	description: string | null;
};

const NONE = 'none';

/** One titled form section (the supplier form's pattern). */
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
 * Create/edit dialog for a chart-of-accounts row (M09 F2).
 *
 * @remarks
 * `code`, `accountType` and `normalBalance` are immutable after create: the
 * backend's update contract accepts neither, and the code is the stable key
 * the posting service resolves. The dialog shows them disabled with a hint
 * instead of pretending they are editable.
 */
export function AccountFormDialog({
	account,
	submitting,
	onClose,
	onSave,
}: {
	account: TAccount | null;
	submitting: boolean;
	onClose: () => void;
	onSave: (values: TAccountFormValues) => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const editing = account !== null;

	const [code, setCode] = useState(account?.code ?? '');
	const [name, setName] = useState(account?.name ?? '');
	const [accountType, setAccountType] = useState<TAccountType>(
		account?.accountType ?? 'asset',
	);
	const [normalBalance, setNormalBalance] = useState<'debit' | 'credit'>(
		account?.normalBalance ?? 'debit',
	);
	const [parentAccountId, setParentAccountId] = useState(
		account?.parentAccountId ?? NONE,
	);
	const [isPostable, setIsPostable] = useState(account?.isPostable ?? true);
	const [cashFlowCategory, setCashFlowCategory] = useState(
		account?.cashFlowCategory ?? NONE,
	);
	const [description, setDescription] = useState(account?.description ?? '');

	// Parents come from the unfiltered list: the table's own filters are not
	// what the hierarchy means.
	const { data } = useQuery(accountsQueryOptions({ page: 1, limit: 100 }));
	const parents = useMemo(
		() => (data?.rows ?? []).filter((row) => row.id !== account?.id),
		[data, account?.id],
	);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					className='flex flex-col gap-5'
					onSubmit={(event) => {
						event.preventDefault();
						onSave({
							code: code.trim().toUpperCase(),
							name: name.trim(),
							accountType,
							normalBalance,
							parentAccountId: parentAccountId === NONE ? null : parentAccountId,
							isPostable,
							cashFlowCategory:
								cashFlowCategory === NONE
									? null
									: (cashFlowCategory as TCashFlowCategory),
							description: description.trim() || null,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{editing ? t('finance:accounts.edit') : t('finance:accounts.create')}
						</DialogTitle>
					</DialogHeader>

					<FormSection
						title={t('finance:accounts.identity')}
						description={t('finance:accounts.identityDescription')}
					>
						<Field>
							<FieldLabel htmlFor='account-code'>
								{t('finance:accounts.code')}
							</FieldLabel>
							<Input
								id='account-code'
								required
								maxLength={32}
								className='font-mono uppercase'
								value={code}
								disabled={editing}
								onChange={(event) => setCode(event.target.value)}
							/>
							<FieldDescription>
								{editing
									? t('finance:accounts.immutableHint')
									: t('finance:accounts.codeHint')}
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='account-name'>
								{t('finance:common.name')}
							</FieldLabel>
							<Input
								id='account-name'
								required
								maxLength={200}
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='account-description' optional>
								{t('finance:common.description')}
							</FieldLabel>
							<Textarea
								id='account-description'
								rows={2}
								maxLength={500}
								value={description}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</Field>
					</FormSection>

					<Separator />

					<FormSection
						title={t('finance:accounts.classification')}
						description={t('finance:accounts.classificationDescription')}
					>
						<Field>
							<FieldLabel htmlFor='account-type'>
								{t('finance:accounts.type')}
							</FieldLabel>
							<Select
								value={accountType}
								disabled={editing}
								onValueChange={(value: string | null) =>
									setAccountType((value ?? 'asset') as TAccountType)
								}
							>
								<SelectTrigger id='account-type' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ACCOUNT_TYPES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`finance:accountType.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='account-normal-balance'>
								{t('finance:accounts.normalBalance')}
							</FieldLabel>
							<Select
								value={normalBalance}
								disabled={editing}
								onValueChange={(value: string | null) =>
									setNormalBalance(value === 'credit' ? 'credit' : 'debit')
								}
							>
								<SelectTrigger id='account-normal-balance' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='debit'>
										{t('finance:normalBalance.debit')}
									</SelectItem>
									<SelectItem value='credit'>
										{t('finance:normalBalance.credit')}
									</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='account-parent' optional>
								{t('finance:accounts.parent')}
							</FieldLabel>
							<Select
								value={parentAccountId}
								disabled={editing}
								onValueChange={(value: string | null) =>
									setParentAccountId(value ?? NONE)
								}
							>
								<SelectTrigger id='account-parent' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>
										{t('finance:accounts.parentNone')}
									</SelectItem>
									{parents.map((parent) => (
										<SelectItem key={parent.id} value={parent.id}>
											{parent.code} — {parent.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='account-cash-flow' optional>
								{t('finance:accounts.cashFlowCategory')}
							</FieldLabel>
							<Select
								value={cashFlowCategory}
								onValueChange={(value: string | null) =>
									setCashFlowCategory(value ?? NONE)
								}
							>
								<SelectTrigger id='account-cash-flow' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>
										{t('finance:common.none')}
									</SelectItem>
									{CASH_FLOW_CATEGORIES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`finance:cashFlowCategory.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field orientation='horizontal' className='sm:col-span-2'>
							<Checkbox
								id='account-postable'
								checked={isPostable}
								onCheckedChange={(checked) => setIsPostable(checked === true)}
							/>
							<div className='flex flex-col gap-1'>
								<FieldLabel htmlFor='account-postable'>
									{t('finance:accounts.postable')}
								</FieldLabel>
								<FieldDescription>
									{t('finance:accounts.postableHint')}
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
